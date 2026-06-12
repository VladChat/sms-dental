// Special one-off reply texts (admin-configurable, deterministic, no AI).
//
// These are NOT numbered follow-ups:
//   - safety_notice  — prefix prepended ONCE per recovery cycle before the next
//     otherwise-eligible normal follow-up when the patient mentions pain/
//     emergency wording. Never a standalone SMS, never a separate branch.
//   - thanks_courtesy — the one-per-cycle courtesy reply to a "thanks" message.
//     Does not consume a numbered follow-up slot.
//
// Storage reuses public.clinic_sms_message_templates with
// template_role='special_reply' (sequence 1 = safety_notice, 2 = thanks_courtesy).
// Code defaults are the source of truth: body NULL / no row = current default.

export const SPECIAL_REPLY_KEYS = ["safety_notice", "thanks_courtesy"] as const;

export type SpecialReplyKey = (typeof SPECIAL_REPLY_KEYS)[number];

export const SPECIAL_REPLY_SEQUENCE_BY_KEY: Record<SpecialReplyKey, 1 | 2> = {
  safety_notice: 1,
  thanks_courtesy: 2,
};

export const SPECIAL_REPLY_KEY_BY_SEQUENCE: Record<1 | 2, SpecialReplyKey> = {
  1: "safety_notice",
  2: "thanks_courtesy",
};

export const DEFAULT_SPECIAL_REPLY_TEMPLATES: Record<SpecialReplyKey, string> = {
  safety_notice: "If this is a medical emergency, call 911.",
  thanks_courtesy: "You're welcome. Our team will follow up.",
};

export const SPECIAL_REPLY_LABELS: Record<SpecialReplyKey, string> = {
  safety_notice: "Safety notice",
  thanks_courtesy: "Thanks reply",
};

export const SPECIAL_REPLY_HELPERS: Record<SpecialReplyKey, string> = {
  safety_notice:
    "Added once per recovery cycle before the next automated follow-up when the patient mentions pain, emergency, urgent, swelling, bleeding, or similar safety terms.",
  thanks_courtesy:
    "Sent once per recovery cycle when the patient says thanks. It does not consume a normal follow-up slot.",
};

// Special replies are intentionally short. No template variables are supported.
export const MAX_SPECIAL_REPLY_LENGTH = 160;

export type SpecialReplyTemplateConfig = Record<SpecialReplyKey, { body: string | null }>;

export function defaultSpecialReplyTemplateConfig(): SpecialReplyTemplateConfig {
  return {
    safety_notice: { body: null },
    thanks_courtesy: { body: null },
  };
}

// Effective text for a special reply: saved custom body, else code default.
export function specialReplyTextForKey(
  config: SpecialReplyTemplateConfig | null | undefined,
  key: SpecialReplyKey,
): string {
  const saved = (config?.[key]?.body ?? "").trim();
  return saved.length > 0 ? saved : DEFAULT_SPECIAL_REPLY_TEMPLATES[key];
}
