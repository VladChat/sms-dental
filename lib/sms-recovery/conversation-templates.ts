// Deterministic SMS conversation templates (admin-configured, v1).
//
// Pure rendering + defaults for the SMS Conversation Builder. No DB, no Twilio,
// no AI. The initial missed-call SMS keeps a locked clinic-identity prefix and a
// locked "Reply STOP to opt out." suffix; only the middle text is configurable.
// Follow-up (auto-reply) templates are full bodies sent after patient replies.
//
// Supported variables: {{clinic_name}} (always resolved) and {{patient_name}}
// (resolved only when a name was safely collected; otherwise removed cleanly so
// the sentence stays natural).

import { smsRecoveryConfig } from "../../config/sms-recovery.config";
import { buildMissedCallRecoverySmsBody, resolveClinicIdentity } from "./templates";

export const INITIAL_PREFIX_TEMPLATE = "Hi, this is {{clinic_name}}.";
export const INITIAL_SUFFIX = "Reply STOP to opt out.";

// Default editable middle. With this exact value (and no other settings) the
// built initial SMS equals the current fixed production message byte-for-byte.
export const DEFAULT_INITIAL_MIDDLE =
  "We missed your call. Reply here and our team will follow up.";

// Suggested (inactive until saved/enabled) follow-up bodies.
export const DEFAULT_FOLLOW_UP_SUGGESTIONS: Record<1 | 2 | 3, string> = {
  1: "Thanks. What name should we use when the office follows up?",
  2: "Thanks, {{patient_name}}. I’ll pass this to the office so they can follow up.",
  3: "Got it. We’ll include that note for the office.",
};

export const MAX_TEMPLATE_BODY_LENGTH = 240;
export const MAX_INITIAL_MIDDLE_LENGTH = 240;
export const SUPPORTED_TEMPLATE_VARIABLES = ["clinic_name", "patient_name"] as const;

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

// Build the initial missed-call SMS. With a blank/missing middle this delegates
// to the fixed recovery template, guaranteeing the current production wording is
// unchanged when no admin settings exist. With a custom middle it composes
// prefix + middle + suffix and resolves {{clinic_name}}.
export function buildInitialSmsBody(
  clinicName: string | null | undefined,
  initialMiddle?: string | null,
): string {
  const middle = (initialMiddle ?? "").replace(/\s+/g, " ").trim();
  if (middle.length === 0) {
    return buildMissedCallRecoverySmsBody(clinicName);
  }
  const composed = `${INITIAL_PREFIX_TEMPLATE} ${middle} ${INITIAL_SUFFIX}`;
  const body = renderConversationTemplate(composed, { clinicName });
  if (body.includes("{{") || body.includes("}}")) {
    throw new Error("initial sms template contains an unresolved placeholder");
  }
  if (body.length > smsRecoveryConfig.maxSmsBodyLength) {
    throw new Error("initial sms message body exceeds the configured maximum length");
  }
  return body;
}

// The four template slots the admin builder manages.
export type FollowUpSlot = 1 | 2 | 3;

export type ConversationTemplateConfig = {
  initialMiddle: string | null; // null => default middle
  maxAutoReplies: number; // 0..3
  followUps: Record<FollowUpSlot, { body: string | null; enabled: boolean }>;
};

// The enabled follow-up sequences with a usable (non-empty) body, capped by
// maxAutoReplies. Used by both the preview and the inbound auto-reply decision.
export function enabledFollowUpSequences(config: ConversationTemplateConfig): FollowUpSlot[] {
  const slots: FollowUpSlot[] = [];
  for (const slot of [1, 2, 3] as FollowUpSlot[]) {
    if (slot > config.maxAutoReplies) continue;
    const fu = config.followUps[slot];
    if (fu.enabled && (fu.body ?? "").trim().length > 0) slots.push(slot);
  }
  return slots;
}

// Resolve the body for a given follow-up slot (saved body, else suggestion).
export function followUpBodyForSlot(
  config: ConversationTemplateConfig,
  slot: FollowUpSlot,
): string | null {
  const saved = (config.followUps[slot]?.body ?? "").trim();
  return saved.length > 0 ? saved : null;
}
