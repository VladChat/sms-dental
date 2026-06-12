import { detectSmsKeyword } from "../twilio/keywords";
import { extractPatientName } from "./patient-name";

export type ReplyClassificationKind =
  | "thanks"
  | "acknowledgement"
  | "negative"
  | "informative"
  | "name_provided"
  | "unclear_short";

export type ReplyClassification = {
  kind: ReplyClassificationKind;
  patientName: string | null;
  hasRequestContent: boolean;
};

const THANKS = new Set([
  "thanks",
  "thank you",
  "thx",
  "thank you so much",
  "appreciate it",
]);

const ACKNOWLEDGEMENTS = new Set([
  "ok",
  "okay",
  "k",
  "got it",
  "sounds good",
  "great",
  "perfect",
  "yes",
  "sure",
]);

const NEGATIVE = new Set([
  "no",
  "not now",
  "never mind",
  "nevermind",
  "cancel",
  "not interested",
  "wrong number",
]);

const UNCLEAR_SHORT = new Set(["?", "hmm", "maybe", "later", "idk"]);

const REQUEST_CONTENT_RE =
  /\b(appointment|appt|schedule|scheduled|book|booking|cleaning|tooth|teeth|pain|hurt|hurts|call|question|insurance|reschedule|cancel|need|want|would like|looking for|follow up|availability|available|openings?)\b/i;

export function classifyInboundReply(body: string | null | undefined): ReplyClassification {
  const raw = (body ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return result("unclear_short");

  const normalized = normalizeForSet(raw);
  // The webhook handles real compliance keywords before this classifier is
  // called. Keep explicit STOP/START/HELP out of ordinary conversation tests,
  // while allowing words like "yes" and "cancel" to classify by reply intent
  // when this pure helper is exercised directly.
  const compact = normalized.replace(/[^a-z]/g, "");
  if (detectSmsKeyword(raw) && (compact === "stop" || compact === "start" || compact === "help")) {
    return result("unclear_short");
  }
  if (THANKS.has(normalized)) return result("thanks");
  if (ACKNOWLEDGEMENTS.has(normalized)) return result("acknowledgement");
  if (NEGATIVE.has(normalized)) return result("negative");
  if (UNCLEAR_SHORT.has(normalized)) return result("unclear_short");

  const patientName = extractPatientName(raw);
  const hasRequestContent = REQUEST_CONTENT_RE.test(raw);
  if (patientName) {
    return { kind: "name_provided", patientName, hasRequestContent };
  }

  // Very short non-request replies are too ambiguous to automate against.
  if (raw.length <= 12 && !hasRequestContent) return result("unclear_short");

  return { kind: "informative", patientName: null, hasRequestContent: true };
}

export function replyClassificationBlocksAutoReply(
  kind: ReplyClassificationKind | null | undefined,
): string | null {
  if (!kind) return null;
  if (kind === "thanks") return "reply_thanks";
  if (kind === "acknowledgement") return "reply_acknowledgement";
  if (kind === "negative") return "reply_negative";
  if (kind === "unclear_short") return "reply_unclear_short";
  return null;
}

function result(kind: ReplyClassificationKind): ReplyClassification {
  return { kind, patientName: null, hasRequestContent: false };
}

function normalizeForSet(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
