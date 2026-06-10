// SMS Recovery settings: the fixed MVP message template and send-safety tunables.
//
// Non-secret committed config. The template is intentionally FIXED for the MVP —
// clinics cannot edit SMS copy. Any wording change must keep: clear clinic
// identity, "Reply STOP to opt out", no diagnosis/treatment/medical promises,
// no fake urgency, no discounts or aggressive sales language, no unnecessary PHI.

export const smsRecoveryConfig = {
  // {{clinic_name}} is the only supported placeholder. Built exclusively by
  // lib/sms-recovery/templates.ts — do not interpolate this string anywhere else.
  missedCallTemplate:
    "Hi, this is {{clinic_name}}. We missed your call. Reply here and our team will follow up. Reply STOP to opt out.",

  // Used when a clinic row has a missing/blank name. Keeps the message honest
  // and non-spammy without exposing template syntax to the patient.
  fallbackClinicIdentity: "your dental office",

  // Suppress repeat recovery SMS to the same (clinic, caller) pair within this
  // window. Mirrored read-only by the voice-greeting prediction.
  duplicateSuppressionHours: 24,

  // Upper bound for the built message body. Two GSM-7 segments (2 x 153 chars
  // with concatenation headers). The fixed template plus a long clinic name must
  // stay under this; the template builder also truncates oversized clinic names.
  maxSmsBodyLength: 306,

  // Longest clinic identity inserted into the template. Names longer than this
  // are truncated (whole-word where possible) so the body stays within
  // maxSmsBodyLength and remains readable.
  maxClinicNameLength: 80,
} as const;

// Future-compatibility only (AI Call Assistant is planned, NOT implemented).
// A call that reaches an assigned number is handled in exactly one mode. The
// only live mode today is "sms_only" (missed-call SMS recovery). "ai_then_sms"
// and "transfer_only" are reserved names so a future voice feature does not
// force a rename of the call/conversation/recovery pipeline. Nothing reads
// these values to enable AI behavior.
export type CallHandlingMode = "sms_only" | "ai_then_sms" | "transfer_only";

export const CURRENT_CALL_HANDLING_MODE: CallHandlingMode = "sms_only";
