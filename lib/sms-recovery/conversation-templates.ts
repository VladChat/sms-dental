// Deterministic SMS conversation templates (admin-configured).
//
// Pure rendering + canonical defaults for the SMS Conversation Builder. No DB,
// no Twilio, no AI. Platform admins can edit the full initial missed-call SMS,
// while the server still enforces clinic identity and STOP opt-out language.
// Follow-up templates are full bodies sent after patient replies.
//
// Supported variables: {{clinic_name}} (always resolved) and {{patient_name}}
// (resolved only when a name was safely collected; otherwise removed cleanly so
// the sentence stays natural).

import { smsRecoveryConfig } from "../../config/sms-recovery.config";
import { buildMissedCallRecoverySmsBody, resolveClinicIdentity } from "./templates";
import type { VoiceGreetingTemplateConfig } from "./voice-greeting-templates";

// No saved initial template still sends the existing fixed production message.
export const DEFAULT_INITIAL_TEMPLATE = smsRecoveryConfig.missedCallTemplate;

export const MAX_AUTO_REPLIES = 10;
export const AUTO_REPLY_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type FollowUpSlot = (typeof AUTO_REPLY_SLOTS)[number];

export const DEFAULT_FOLLOW_UP_SLOTS = [1, 2, 3] as const;
export type DefaultFollowUpSlot = (typeof DEFAULT_FOLLOW_UP_SLOTS)[number];

export const DEFAULT_FOLLOW_UP_TEMPLATES: Record<DefaultFollowUpSlot, string> = {
  1: "Thanks for the info. What name should we use when our office follows up?",
  2: "Thanks, {{patient_name}}. I'll pass this to our team so they can follow up.",
  3: "Got it. We'll pass that along to our team.",
};

export const MAX_TEMPLATE_BODY_LENGTH = 240;
export const MAX_INITIAL_TEMPLATE_LENGTH = 240;
export const MAX_INITIAL_MIDDLE_LENGTH = MAX_INITIAL_TEMPLATE_LENGTH;
export const SUPPORTED_TEMPLATE_VARIABLES = ["clinic_name", "patient_name"] as const;

const CLINIC_NAME_PLACEHOLDER_RE = /\{\{\s*clinic_name\s*\}\}/i;
const STOP_OPT_OUT_RE = /\bReply\s+STOP\s+to\s+opt\s+out\.?/gi;

export type RenderContext = {
  clinicName: string | null | undefined;
  patientName?: string | null;
};

// Render an arbitrary template body. {{clinic_name}} always resolves; when a
// patient name is present {{patient_name}} resolves, otherwise the placeholder
// (and a leading comma/space) is removed so the text stays grammatical. Any
// leftover unknown placeholder is stripped defensively (validation rejects them
// before save, so this only guards malformed stored data).
export function renderConversationTemplate(text: string, ctx: RenderContext): string {
  let out = text.replace(/\{\{\s*clinic_name\s*\}\}/g, resolveClinicIdentity(ctx.clinicName));
  const name = (ctx.patientName ?? "").trim();
  if (name.length > 0) {
    out = out.replace(/\{\{\s*patient_name\s*\}\}/g, name);
  } else {
    // Drop ", {{patient_name}}" / " {{patient_name}}" cleanly.
    out = out.replace(/,?\s*\{\{\s*patient_name\s*\}\}/g, "");
  }
  // Strip any remaining placeholder defensively, then tidy whitespace/punctuation.
  out = out.replace(/\{\{[^}]*\}\}/g, "");
  out = out.replace(/\s+/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();
  return out;
}

// Normalize a full initial template for storage after platform-admin input.
// This removes accidental duplicate STOP phrases / adjacent duplicate sentences
// but does not add missing required content; validation is responsible for
// rejecting missing identity or opt-out language.
export function normalizeInitialTemplateForStorage(
  raw: string | null | undefined,
  clinicName?: string | null,
): string | null {
  const collapsed = collapseTemplateWhitespace(raw ?? "");
  if (!collapsed) return null;
  return dedupeInitialTemplateText(collapsed, clinicName);
}

export function hasRequiredStopOptOut(text: string): boolean {
  STOP_OPT_OUT_RE.lastIndex = 0;
  return STOP_OPT_OUT_RE.test(text);
}

export function hasClinicIdentity(text: string, clinicName?: string | null): boolean {
  if (CLINIC_NAME_PLACEHOLDER_RE.test(text)) return true;
  const identity = resolveClinicIdentity(clinicName);
  if (!identity) return false;
  return normalizeComparable(text).includes(normalizeComparable(identity));
}

// Build the initial missed-call SMS. With a blank/missing template this
// delegates to the fixed recovery template, guaranteeing the current production
// wording is unchanged when no admin settings exist. Full custom templates are
// rendered directly.
export function buildInitialSmsBody(
  clinicName: string | null | undefined,
  initialTemplate?: string | null,
): string {
  const raw = collapseTemplateWhitespace(initialTemplate ?? "");
  if (raw.length === 0) {
    return buildMissedCallRecoverySmsBody(clinicName);
  }

  const template = normalizeInitialTemplateForStorage(raw, clinicName) ?? DEFAULT_INITIAL_TEMPLATE;
  const body = dedupeRenderedInitialSms(
    renderConversationTemplate(template, { clinicName }),
  );
  if (body.includes("{{") || body.includes("}}")) {
    throw new Error("initial sms template contains an unresolved placeholder");
  }
  if (!hasClinicIdentity(body, clinicName)) {
    throw new Error("initial sms template is missing clinic identity");
  }
  if (!hasRequiredStopOptOut(body)) {
    throw new Error("initial sms template is missing STOP opt-out language");
  }
  if (body.length > smsRecoveryConfig.maxSmsBodyLength) {
    throw new Error("initial sms message body exceeds the configured maximum length");
  }
  return body;
}

export type ConversationTemplateConfig = {
  initialTemplate: string | null; // null => current code default initial template
  maxAutoReplies: number; // 0..10
  // Slots 1-3 are default-backed when body is null. Slots 4-10 require custom
  // text before they are usable.
  followUps: Record<FollowUpSlot, { body: string | null; enabled: boolean }>;
  voiceGreetings: VoiceGreetingTemplateConfig;
};

// The enabled follow-up sequences, capped by maxAutoReplies. Slots 1-3 can be
// default-backed; slots 4-10 are included only when custom text exists.
export function enabledFollowUpSequences(config: ConversationTemplateConfig): FollowUpSlot[] {
  const slots: FollowUpSlot[] = [];
  for (const slot of AUTO_REPLY_SLOTS) {
    if (slot > config.maxAutoReplies) continue;
    const fu = config.followUps[slot];
    if (fu.enabled && followUpBodyForSlot(config, slot)) slots.push(slot);
  }
  return slots;
}

// Resolve the body for a given follow-up slot (custom body, else code default
// for slots 1-3). Returns null when the slot has no usable body.
export function followUpBodyForSlot(
  config: ConversationTemplateConfig,
  slot: FollowUpSlot,
): string | null {
  const saved = (config.followUps[slot]?.body ?? "").trim();
  return saved.length > 0 ? saved : defaultFollowUpTemplateForSlot(slot);
}

export function effectiveInitialTemplate(customBody: string | null | undefined): string {
  const saved = normalizeTemplateBody(customBody);
  return saved ?? DEFAULT_INITIAL_TEMPLATE;
}

export function effectiveFollowUpTemplate(
  slot: FollowUpSlot,
  customBody: string | null | undefined,
): string {
  const saved = normalizeTemplateBody(customBody);
  return saved ?? defaultFollowUpTemplateForSlot(slot) ?? "";
}

export function isDefaultInitialTemplate(text: string | null | undefined): boolean {
  return sameTemplateText(text, DEFAULT_INITIAL_TEMPLATE);
}

export function isDefaultFollowUpTemplate(
  slot: FollowUpSlot,
  text: string | null | undefined,
): boolean {
  const defaultText = defaultFollowUpTemplateForSlot(slot);
  return defaultText ? sameTemplateText(text, defaultText) : false;
}

export function hasDefaultFollowUpTemplate(slot: FollowUpSlot): boolean {
  return defaultFollowUpTemplateForSlot(slot) !== null;
}

export function defaultFollowUpTemplateForSlot(slot: FollowUpSlot): string | null {
  if ((DEFAULT_FOLLOW_UP_SLOTS as readonly number[]).includes(slot)) {
    return DEFAULT_FOLLOW_UP_TEMPLATES[slot as DefaultFollowUpSlot];
  }
  return null;
}

export function normalizeTemplateBody(body: string | null | undefined): string | null {
  const trimmed = collapseTemplateWhitespace(body ?? "");
  return trimmed.length > 0 ? trimmed : null;
}

export function sameTemplateText(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeTemplateBody(left);
  const normalizedRight = normalizeTemplateBody(right);
  return normalizedLeft !== null && normalizedRight !== null && normalizedLeft === normalizedRight;
}

function dedupeInitialTemplateText(text: string, clinicName?: string | null): string {
  const withoutDuplicateStop = dedupeStopOptOut(text);
  const renderedComparable = renderConversationTemplate(withoutDuplicateStop, {
    clinicName,
  });
  if (!hasAdjacentDuplicateSentences(renderedComparable)) {
    return collapseTemplateWhitespace(withoutDuplicateStop);
  }
  return dedupeAdjacentDuplicateSentences(withoutDuplicateStop);
}

function dedupeRenderedInitialSms(text: string): string {
  return dedupeAdjacentDuplicateSentences(dedupeStopOptOut(text));
}

function dedupeStopOptOut(text: string): string {
  let seen = false;
  const out = text.replace(STOP_OPT_OUT_RE, () => {
    if (seen) return "";
    seen = true;
    return "Reply STOP to opt out.";
  });
  return collapseTemplateWhitespace(out).replace(/\s+\./g, ".");
}

function hasAdjacentDuplicateSentences(text: string): boolean {
  const sentences = splitSentences(text);
  for (let i = 1; i < sentences.length; i += 1) {
    if (normalizeComparable(sentences[i]) === normalizeComparable(sentences[i - 1])) {
      return true;
    }
  }
  return false;
}

function dedupeAdjacentDuplicateSentences(text: string): string {
  const sentences = splitSentences(text);
  const kept: string[] = [];
  for (const sentence of sentences) {
    const previous = kept[kept.length - 1];
    if (previous && normalizeComparable(previous) === normalizeComparable(sentence)) {
      continue;
    }
    kept.push(sentence);
  }
  return collapseTemplateWhitespace(kept.join(" "));
}

function splitSentences(text: string): string[] {
  return collapseTemplateWhitespace(text)
    .match(/[^.!?]+[.!?]?/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [];
}

function collapseTemplateWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeComparable(text: string): string {
  return collapseTemplateWhitespace(text)
    .replace(/[.?!]+$/g, "")
    .toLowerCase();
}
