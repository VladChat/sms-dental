import { smsRecoveryConfig } from "../../config/sms-recovery.config";

// Deterministic builder for the fixed missed-call recovery SMS. This is the ONLY
// place the template is interpolated; sendRecoverySms() must call this instead of
// formatting message bodies inline so the approved wording cannot drift.

const TEMPLATE_PLACEHOLDER = "{{clinic_name}}";

// Collapse whitespace and strip characters that would break or spoof the message
// body (template braces, control characters). The clinic name is clinic-entered
// data, so sanitize defensively even though onboarding validates it.
function sanitizeClinicName(raw: string | null | undefined): string {
  const cleaned = (raw ?? "")
    .replace(/[{}]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned.length <= smsRecoveryConfig.maxClinicNameLength) return cleaned;
  const truncated = cleaned.slice(0, smsRecoveryConfig.maxClinicNameLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated).trim();
}

export function buildMissedCallRecoverySmsBody(
  clinicName: string | null | undefined,
): string {
  const identity =
    sanitizeClinicName(clinicName) || smsRecoveryConfig.fallbackClinicIdentity;
  const body = smsRecoveryConfig.missedCallTemplate.replace(
    TEMPLATE_PLACEHOLDER,
    identity,
  );
  if (body.includes("{{") || body.includes("}}")) {
    // The fixed template has exactly one placeholder; anything left means the
    // committed template was edited incorrectly. Fail loudly in dev/test.
    throw new Error("sms recovery template contains an unresolved placeholder");
  }
  if (body.length > smsRecoveryConfig.maxSmsBodyLength) {
    throw new Error("sms recovery message body exceeds the configured maximum length");
  }
  return body;
}

export function getDuplicateSuppressionWindowMs(): number {
  return smsRecoveryConfig.duplicateSuppressionHours * 60 * 60 * 1000;
}
