// Conservative, deterministic patient name extraction from an inbound SMS.
//
// No AI. Designed to FAIL CLOSED: it returns null whenever the message is not
// an obvious, simple name reply. Storing nothing is always preferable to
// storing the wrong name.

import { detectSmsKeyword } from "../twilio/keywords";

// Short safe threshold for simple raw-name replies. Clear "my name is..."
// phrases may be longer because they can include request content after the
// name ("My name is Jon Svillow. I need an appointment").
const MAX_SIMPLE_RAW_LENGTH = 40;
const MAX_PREFIXED_RAW_LENGTH = 160;

// Lead-in phrases that introduce a name at the START of the message only.
// Order matters (most specific first). "this is" / "it's" / "I'm" stay
// start-anchored because mid-message they are far too ambiguous.
const NAME_PREFIXES = [
  /^my name is\s+/i,
  /^my name's\s+/i,
  /^the name is\s+/i,
  /^name is\s+/i,
  /^name:\s*/i,
  /^this is\s+/i,
  /^it'?s\s+/i,
  /^i\s*'?\s*a?m\s+/i, // I'm / Im / I am
];

// A single name word: letters plus internal apostrophe/hyphen.
const NAME_WORD = "[A-Za-z][A-Za-z'’-]*";
// 1-3 name words, captured.
const NAME_PHRASE = `(${NAME_WORD}(?:\\s+${NAME_WORD}){0,2})`;

// Explicit name-introduction patterns where the name sits BETWEEN fixed
// tokens. The fixed wording on both sides makes these safe to honor anywhere
// in a longer message ("Ok. maybe, use alex sikorsky as it's my name ...").
const INLINE_NAME_CAPTURE_RES = [
  // "use Alex Sikorsky as my name" / "as it's my name" / "as it is my name"
  new RegExp(
    `\\buse\\s+${NAME_PHRASE}\\s+as\\s+(?:it[’']?s\\s+|it\\s+is\\s+)?my\\s+name\\b`,
    "i",
  ),
  // "Alex Sikorsky is my name" — only at the start of the message or of a
  // sentence, so free-floating words before the phrase are never captured.
  new RegExp(`(?:^|[.!?,;:]\\s*)${NAME_PHRASE}\\s+is\\s+my\\s+name\\b`, "i"),
];

// Lead-in phrases that are explicit enough to honor mid-message. The candidate
// is whatever follows, cut at the first punctuation/request boundary.
const INLINE_NAME_LEAD_IN_RES = [
  /\bmy\s+name\s+should\s+be\s+/i,
  /\bmy\s+name\s+is\s+/i,
  /\bmy\s+name[’']?s\s+/i,
  /\byou\s+can\s+use\s+/i,
  /\byou\s+can\s+call\s+me\s+/i,
  /\bcall\s+me\s+/i,
];

const REQUEST_BOUNDARY_RE =
  /\b((?:and\s+)?i\s+(?:need|want|would like|would love|am looking|was looking)|can\s+i|could\s+i|please|need|want|appointment|appt|cleaning|schedule|book|tooth|teeth|pain|insurance|question|reschedule)\b/i;

// Words that are never a name on their own — appointment/problem/safety/
// keyword/filler terms. Any candidate containing one of these fails closed.
const NON_NAME_WORDS = new Set([
  "appointment", "cleaning", "tooth", "teeth", "pain", "tomorrow", "today",
  "help", "call", "office", "dentist", "emergency", "insurance", "price",
  "cost", "schedule", "cancel", "reschedule", "stop", "start", "yes", "no",
  "ok", "okay", "thanks", "thank", "hello", "hi", "hey", "please", "appt",
  "booking", "book", "question", "info", "information", "the", "a", "an",
  // Safety/urgency terms must never be stored as a display name.
  "urgent", "urgently", "swelling", "swollen", "bleeding", "infection",
  "infected", "fever", "abscess", "trauma", "hurt", "hurts", "severe",
  // Filler/pronoun/time words that follow inline lead-ins in real texts
  // ("call me later", "use whatever as my name").
  "name", "use", "my", "me", "you", "your", "it", "is", "as", "at", "what",
  "that", "this", "when", "back", "later", "now", "soon", "asap", "anytime",
  "tonight", "morning", "afternoon", "evening", "whatever", "anything",
  "something", "nothing", "maybe", "wrong", "number",
]);

function titleCaseWord(word: string): string {
  // Preserve internal apostrophes/hyphens (O'Brien, Mary-Jane).
  return word
    .toLowerCase()
    .replace(/(^|[\s'’-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

// Returns a safe display name (1–3 title-cased words) or null.
export function extractPatientName(body: string | null | undefined): string | null {
  if (!body) return null;
  const raw = body.replace(/\s+/g, " ").trim();
  if (raw.length === 0) return null;

  // Reject anything with contact details or digits, or a compliance keyword.
  if (/https?:\/\/|www\.|@|\d/.test(raw)) return null;
  if (detectSmsKeyword(raw)) return null;

  // Explicit inline name-introduction phrases first. These are strong signals,
  // so they may appear anywhere in a longer (but still bounded) message.
  if (raw.length <= MAX_PREFIXED_RAW_LENGTH) {
    for (const re of INLINE_NAME_CAPTURE_RES) {
      const match = raw.match(re);
      if (match?.[1]) {
        const name = validateNameCandidate(match[1]);
        if (name) return name;
      }
    }
    for (const re of INLINE_NAME_LEAD_IN_RES) {
      const match = re.exec(raw);
      if (match) {
        const remainder = raw.slice(match.index + match[0].length);
        const name = validateNameCandidate(takeNamePhrase(remainder));
        if (name) return name;
      }
    }
  }

  // Strip a leading "my name is" / "this is" / "I'm" style phrase if present.
  let candidate = raw;
  let hadPrefix = false;
  for (const re of NAME_PREFIXES) {
    if (re.test(candidate)) {
      candidate = candidate.replace(re, "").trim();
      hadPrefix = true;
      break;
    }
  }

  if (hadPrefix) {
    if (raw.length > MAX_PREFIXED_RAW_LENGTH) return null;
    candidate = takeNamePhrase(candidate);
  } else {
    if (raw.length > MAX_SIMPLE_RAW_LENGTH) return null;
    // Without an explicit name prefix, a sentence is ambiguous request content.
    if (/[.!?,;:]/.test(candidate)) return null;
  }

  return validateNameCandidate(candidate);
}

// Validate a candidate phrase: 1-3 plain name words, none of them a known
// non-name term. Returns the title-cased display name or null (fail closed).
function validateNameCandidate(candidate: string): string | null {
  // Drop trailing punctuation ("John." / "John!").
  const cleaned = candidate.replace(/[.!?,;:]+$/g, "").trim();
  if (cleaned.length === 0) return null;

  const words = cleaned.split(/\s+/);
  if (words.length < 1 || words.length > 3) return null;

  for (const word of words) {
    // Letters plus internal apostrophe/hyphen; must start with a letter.
    if (!/^[A-Za-z][A-Za-z'’-]*$/.test(word)) return null;
    if (NON_NAME_WORDS.has(word.toLowerCase())) return null;
  }

  const display = words.map(titleCaseWord).join(" ");
  if (display.length === 0 || display.length > 80) return null;
  return display;
}

function takeNamePhrase(value: string): string {
  const stops = [
    value.search(/[.!?,;:]/),
    value.search(REQUEST_BOUNDARY_RE),
  ].filter((idx) => idx >= 0);
  if (stops.length === 0) return value.trim();
  return value.slice(0, Math.min(...stops)).trim();
}
