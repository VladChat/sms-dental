// Deterministic safety validation for admin-configured SMS templates.
//
// No AI moderation — fixed rule checks only. Rejects spammy/medical/urgency
// phrasing, contact details embedded in copy, and unknown placeholders. Allows
// normal dental-office-neutral language. Shared by the admin SMS Conversation
// Builder API.

import {
  MAX_INITIAL_TEMPLATE_LENGTH,
  MAX_TEMPLATE_BODY_LENGTH,
  hasClinicIdentity,
  hasRequiredStopOptOut,
  normalizeInitialTemplateForStorage,
} from "./conversation-templates";
import {
  MAX_VOICE_GREETING_TEMPLATE_LENGTH,
  type VoiceGreetingScenario,
} from "./voice-greeting-templates";

export type TemplateTextResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

// Case-insensitive banned phrases (spam / medical promises / fake urgency /
// booking guarantees). Matched as substrings on the normalized lowercase text.
const BANNED_PHRASES = [
  "urgent",
  "guarantee",
  "guaranteed",
  "limited time",
  "discount",
  "click now",
  "you need treatment",
  "diagnosis",
  "diagnose",
  "treatment is required",
  "emergency treatment",
  "we can book you",
  "appointment confirmed",
  "confirmed appointment",
];

const URL_RE = /(https?:\/\/|www\.)/i;
const BARE_DOMAIN_RE = /\b[a-z0-9-]+\.(com|net|org|io|co|us|biz|info|dental|clinic|health)\b/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// 7+ digit runs, or grouped phone shapes like 224-532-9236 / (224) 532 9236.
const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/;
const PLACEHOLDER_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

// Validate one template body. `allowPatientName` controls whether
// {{patient_name}} is permitted (initial SMS: no; follow-ups: yes). Empty
// input is allowed and returned as "" — callers decide what empty means
// (default-backed template / disabled follow-up).
export function validateTemplateText(
  raw: unknown,
  opts: { allowPatientName: boolean; maxLength?: number },
): TemplateTextResult {
  if (raw === undefined || raw === null) return { ok: true, value: "" };
  if (typeof raw !== "string") {
    return { ok: false, message: "Invalid message text." };
  }
  const value = raw.replace(/\s+/g, " ").trim();
  if (value.length === 0) return { ok: true, value: "" };

  const maxLength = opts.maxLength ?? MAX_TEMPLATE_BODY_LENGTH;
  if (value.length > maxLength) {
    return { ok: false, message: `Keep the message under ${maxLength} characters.` };
  }

  const lower = value.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      return { ok: false, message: `Please remove “${phrase}” — it isn’t allowed in patient messages.` };
    }
  }

  if (URL_RE.test(value) || BARE_DOMAIN_RE.test(value)) {
    return { ok: false, message: "Links aren’t allowed in the message text." };
  }
  if (EMAIL_RE.test(value)) {
    return { ok: false, message: "Email addresses aren’t allowed in the message text." };
  }

  // Allow the placeholders before checking for phone-like digit runs, so a
  // template is not flagged for incidental digits inside a variable.
  const withoutPlaceholders = value.replace(PLACEHOLDER_RE, " ");
  if (PHONE_RE.test(withoutPlaceholders)) {
    return { ok: false, message: "Phone numbers aren’t allowed in the message text." };
  }

  // Unknown placeholders (and {{patient_name}} where not allowed) are rejected.
  let match: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((match = PLACEHOLDER_RE.exec(value)) !== null) {
    const name = (match[1] ?? "").toLowerCase();
    if (name === "clinic_name") continue;
    if (name === "patient_name" && opts.allowPatientName) continue;
    return {
      ok: false,
      message:
        name === "patient_name"
          ? "{{patient_name}} can only be used in follow-up messages."
          : `Unknown variable {{${match[1]}}}. Use {{clinic_name}}${opts.allowPatientName ? " or {{patient_name}}" : ""}.`,
    };
  }

  // Excessive punctuation (e.g. "!!!", "??", "Now!!").
  if (/[!?]{2,}/.test(value) || (value.match(/!/g)?.length ?? 0) > 1) {
    return { ok: false, message: "Please remove the extra exclamation/question marks." };
  }

  // All-caps shouting beyond a small threshold.
  const letters = value.replace(/[^a-z]/gi, "");
  if (letters.length > 12 && letters === letters.toUpperCase()) {
    return { ok: false, message: "Please don’t use all capital letters." };
  }

  return { ok: true, value };
}

export function validateInitialTemplate(
  raw: unknown,
  clinicName: string | null | undefined,
): TemplateTextResult {
  const base = validateTemplateText(raw, {
    allowPatientName: false,
    maxLength: MAX_INITIAL_TEMPLATE_LENGTH,
  });
  if (!base.ok) return base;
  if (base.value.length === 0) return base;

  const value = normalizeInitialTemplateForStorage(base.value, clinicName) ?? "";
  if (!hasClinicIdentity(value, clinicName)) {
    return {
      ok: false,
      message: "Include the clinic identity with {{clinic_name}}.",
    };
  }
  if (!hasRequiredStopOptOut(value)) {
    return {
      ok: false,
      message: "Include “Reply STOP to opt out.”",
    };
  }
  return { ok: true, value };
}

export function validateFollowUpBody(raw: unknown): TemplateTextResult {
  return validateTemplateText(raw, { allowPatientName: true, maxLength: MAX_TEMPLATE_BODY_LENGTH });
}

export function validateVoiceGreetingTemplate(
  raw: unknown,
  scenario: VoiceGreetingScenario,
): TemplateTextResult {
  const base = validateTemplateText(raw, {
    allowPatientName: false,
    maxLength: MAX_VOICE_GREETING_TEMPLATE_LENGTH,
  });
  if (!base.ok) return base;
  if (base.value.length === 0) return base;

  if ((scenario === "duplicate" || scenario === "none") && promisesFutureText(base.value)) {
    return {
      ok: false,
      message: "Duplicate and no-text greetings can’t promise that a text will be sent now.",
    };
  }

  return base;
}

function promisesFutureText(value: string): boolean {
  const lower = value.toLowerCase().replace(/[’]/g, "'");
  return (
    /\bwe(?:'ll| will| can| are going to|'re going to)\s+(?:send|text)\b/.test(lower) ||
    /\bsend you a text now\b/.test(lower) ||
    /\btext you now\b/.test(lower) ||
    /\bwe(?:'ll| will)\s+send you a text\b/.test(lower)
  );
}
