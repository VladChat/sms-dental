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

// Lead-in phrases that introduce a name. Order matters (most specific first).
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

const REQUEST_BOUNDARY_RE =
  /\b((?:and\s+)?i\s+(?:need|want|would like|would love|am looking|was looking)|can\s+i|could\s+i|please|need|want|appointment|appt|cleaning|schedule|book|tooth|teeth|pain|insurance|question|reschedule)\b/i;

// Words that are never a name on their own — appointment/problem/keyword terms.
const NON_NAME_WORDS = new Set([
  "appointment", "cleaning", "tooth", "teeth", "pain", "tomorrow", "today",
  "help", "call", "office", "dentist", "emergency", "insurance", "price",
  "cost", "schedule", "cancel", "reschedule", "stop", "start", "yes", "no",
  "ok", "okay", "thanks", "thank", "hello", "hi", "hey", "please", "appt",
  "booking", "book", "question", "info", "information", "the", "a", "an",
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

  // Drop trailing punctuation ("John." / "John!").
  candidate = candidate.replace(/[.!?,;:]+$/g, "").trim();
  if (candidate.length === 0) return null;

  const words = candidate.split(/\s+/);
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
