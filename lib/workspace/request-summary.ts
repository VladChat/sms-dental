// Deterministic, front-desk-safe request summary derivation.
//
// No AI and no invented facts: every field is derived from simple observable
// keyword/phrase matches over the patient's INBOUND messages plus existing
// conversation state. Anything not clearly present fails closed to "Unknown"
// (or "None detected" for the safety signal). Nothing here is written to the
// DB — display only. Pure module: no DB, no Twilio, unit-testable.

export const UNKNOWN_VALUE = "Unknown";
export const NO_SAFETY_SIGNAL = "None detected";
export const SAFETY_SIGNAL = "Mentioned pain/urgent concern";

export const REQUEST_CATEGORIES = [
  "Cleaning appointment",
  "Appointment request",
  "Reschedule request",
  "Cancel request",
  "Payment question",
  "Insurance question",
  "Pain / urgent concern",
  "General message",
  "Unknown",
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

// Mirrors the deterministic safety-concern wording used by reply
// classification (pain/emergency/urgent etc.). Kept local so this module stays
// pure and front-desk-scoped.
const SAFETY_RE =
  /\b(pain|emergency|urgent|urgently|swelling|swollen|bleeding|infection|infected|fever|abscess|trauma|knocked\s+out|can[’']?t\s+breathe|cannot\s+breathe|trouble\s+breathing|difficulty\s+breathing)\b/i;

const RESCHEDULE_RE = /\b(reschedul\w*|move\s+(?:my|the)\s+appointment|change\s+(?:my|the)\s+appointment)\b/i;
const CANCEL_RE = /\bcancel\w*\b/i;
const CLEANING_RE = /\bcleaning\b/i;
const INSURANCE_RE =
  /\b(insurance|insured|delta\s*dental|aetna|cigna|metlife|humana|guardian|united\s*healthcare|medicaid|medicare|ppo|hmo|coverage|covered|in[-\s]network|out[-\s]of[-\s]network)\b/i;
const PAYMENT_RE =
  /\b(payment|pay|paying|cash|price|prices|pricing|cost|costs|how\s+much|bill|billing|invoice|financing|payment\s+plan|installment)\b/i;
const APPOINTMENT_RE =
  /\b(appointment|appt|book|booking|schedule|scheduling|availability|available|openings?|checkup|check[-\s]up|exam|visit)\b/i;

// Simple, explicitly present time phrases only. Never invent and never promise
// availability — these are display hints for staff.
const TIME_PHRASE_RE =
  /\b(today|tomorrow|tonight|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week|(?:[1-9]|1[0-2])(?::[0-5][0-9])?\s*(?:am|pm|a\.m\.|p\.m\.))\b/gi;

export type RequestSummaryInput = {
  // Chronological inbound (patient) message bodies. Outbound texts are never
  // used — the office's own wording must not become "the patient's request".
  inboundTexts: string[];
  // Conversation-state safety signal (the one-time 911 prefix marker).
  safetyNoticeSent?: boolean;
};

export type RequestSummary = {
  request: RequestCategory;
  preferredTime: string;
  safetyConcern: string;
  paymentInsurance: string;
};

export function deriveRequestCategory(inboundTexts: string[]): RequestCategory {
  const text = joinNonEmpty(inboundTexts);
  if (text.length === 0) return "Unknown";

  // Priority: safety first, then the most specific intents, then generic
  // appointment words, then "General message" for any other readable text.
  if (SAFETY_RE.test(text)) return "Pain / urgent concern";
  if (RESCHEDULE_RE.test(text)) return "Reschedule request";
  if (CANCEL_RE.test(text)) return "Cancel request";
  if (CLEANING_RE.test(text)) return "Cleaning appointment";
  if (INSURANCE_RE.test(text)) return "Insurance question";
  if (PAYMENT_RE.test(text)) return "Payment question";
  if (APPOINTMENT_RE.test(text)) return "Appointment request";
  return "General message";
}

// Returns a short phrase like "Tomorrow", "Tuesday morning", or "10am" when the
// patient explicitly wrote it; otherwise "Unknown". The most recent inbound
// message containing any time phrase wins (latest intent).
export function derivePreferredTime(inboundTexts: string[]): string {
  for (let i = inboundTexts.length - 1; i >= 0; i -= 1) {
    const text = (inboundTexts[i] ?? "").trim();
    if (!text) continue;
    TIME_PHRASE_RE.lastIndex = 0;
    const matches = text.match(TIME_PHRASE_RE);
    if (!matches || matches.length === 0) continue;
    const seen = new Set<string>();
    const phrases: string[] = [];
    for (const raw of matches) {
      const normalized = raw.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      phrases.push(normalized);
      if (phrases.length >= 3) break;
    }
    const joined = phrases.join(" ");
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  }
  return UNKNOWN_VALUE;
}

export function deriveSafetyConcern(input: RequestSummaryInput): string {
  if (input.safetyNoticeSent) return SAFETY_SIGNAL;
  const text = joinNonEmpty(input.inboundTexts);
  return SAFETY_RE.test(text) ? SAFETY_SIGNAL : NO_SAFETY_SIGNAL;
}

export function derivePaymentInsurance(inboundTexts: string[]): string {
  const text = joinNonEmpty(inboundTexts);
  if (INSURANCE_RE.test(text)) return "Insurance mentioned";
  if (PAYMENT_RE.test(text)) return "Payment mentioned";
  return UNKNOWN_VALUE;
}

export function buildRequestSummary(input: RequestSummaryInput): RequestSummary {
  return {
    request: deriveRequestCategory(input.inboundTexts),
    preferredTime: derivePreferredTime(input.inboundTexts),
    safetyConcern: deriveSafetyConcern(input),
    paymentInsurance: derivePaymentInsurance(input.inboundTexts),
  };
}

// ------------------------------------------------ workspace summary headline

export const REVIEW_CONVERSATION = "Review conversation";

export type WorkspaceSummaryChip = {
  id: "pain_urgent" | "payment" | "insurance";
  label: string;
};

export type WorkspaceRequestSummaryInput = RequestSummaryInput & {
  // Future hook ONLY: if an AI-written summary is ever stored upstream it can
  // be passed here and wins over the deterministic fallback. Nothing produces
  // or calls AI today — no provider, no env, no generation in this codebase.
  aiSummary?: string | null;
};

export type WorkspaceRequestSummary = {
  // One short scannable line for the front desk, e.g.
  // "Cleaning appointment · Tomorrow" or "Review conversation".
  headline: string;
  // Small chips shown only when a real signal exists (never "None detected").
  chips: WorkspaceSummaryChip[];
  preferredTime: string | null;
  requestCategory: RequestCategory | null;
  source: "ai" | "deterministic" | "fallback";
};

// Compose the compact one-line request summary. Deterministic fallback only:
// category + explicit time phrase, joined with " · ". When nothing observable
// exists the headline is "Review conversation" (source "fallback").
export function buildWorkspaceRequestSummary(
  input: WorkspaceRequestSummaryInput,
): WorkspaceRequestSummary {
  const category = deriveRequestCategory(input.inboundTexts);
  const time = derivePreferredTime(input.inboundTexts);
  const preferredTime = time === UNKNOWN_VALUE ? null : time;
  const safety = deriveSafetyConcern(input) === SAFETY_SIGNAL;
  const paymentInsurance = derivePaymentInsurance(input.inboundTexts);

  const chips: WorkspaceSummaryChip[] = [];
  if (safety) chips.push({ id: "pain_urgent", label: "Pain/urgent" });
  if (paymentInsurance === "Insurance mentioned") chips.push({ id: "insurance", label: "Insurance" });
  if (paymentInsurance === "Payment mentioned") chips.push({ id: "payment", label: "Payment" });

  const aiSummary = (input.aiSummary ?? "").trim();
  if (aiSummary.length > 0) {
    return { headline: aiSummary, chips, preferredTime, requestCategory: category, source: "ai" };
  }

  if (category === "Pain / urgent concern") {
    const text = input.inboundTexts.map((t) => (t ?? "").trim()).join("\n");
    const wantsAppointment = APPOINTMENT_RE.test(text) || CLEANING_RE.test(text);
    const parts = ["Mentions pain/urgent concern"];
    if (wantsAppointment) parts.push("Wants appointment");
    else if (preferredTime) parts.push(preferredTime);
    return {
      headline: parts.join(" · "),
      chips,
      preferredTime,
      requestCategory: category,
      source: "deterministic",
    };
  }

  if (category === "Unknown" || category === "General message") {
    return {
      headline: REVIEW_CONVERSATION,
      chips,
      preferredTime,
      requestCategory: category === "Unknown" ? null : category,
      source: "fallback",
    };
  }

  const parts = [category as string];
  if (preferredTime) parts.push(preferredTime);
  return {
    headline: parts.join(" · "),
    chips,
    preferredTime,
    requestCategory: category,
    source: "deterministic",
  };
}

function joinNonEmpty(texts: string[]): string {
  return texts
    .map((t) => (t ?? "").trim())
    .filter((t) => t.length > 0)
    .join("\n");
}
