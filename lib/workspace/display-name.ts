// Deterministic, front-desk-safe patient display-name handling.
//
// A stored patient_display_name can occasionally be request text (e.g.
// "I Need Appointment") rather than a real name. The workspace must never show
// such phrases as a name: this module reuses the conservative fail-closed
// extractor so anything that is not an obvious simple name renders as the
// "Not provided" placeholder instead. Pure module — no DB, no Twilio.

import { extractPatientName } from "../sms-recovery/patient-name";

export const NAME_NOT_PROVIDED = "Not provided";

export const WORKSPACE_NAME_MAX = 80;

// Returns a safe display name (1-3 title-cased name words) or null when the
// stored value is missing or fails the conservative name rules (digits, URLs,
// emails, keywords, request/appointment/safety/payment words, >3 words).
export function normalizeWorkspaceDisplayName(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > WORKSPACE_NAME_MAX) return null;
  return extractPatientName(trimmed);
}

export type WorkspaceNameValidation =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

// Validate a staff-entered name for save_name. Empty input clears the name
// (value null). Anything else must pass the same conservative rules used for
// SMS-collected names, so digits/URLs/emails/phones/keywords/request words are
// rejected and the saved value is the title-cased normalized name.
export function validateWorkspaceDisplayNameInput(raw: unknown): WorkspaceNameValidation {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, message: "Enter a valid name." };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > WORKSPACE_NAME_MAX) {
    return { ok: false, message: `Keep the name under ${WORKSPACE_NAME_MAX} characters.` };
  }
  const normalized = extractPatientName(trimmed);
  if (!normalized) {
    return {
      ok: false,
      message: "Enter a simple name (letters only, up to 3 words).",
    };
  }
  return { ok: true, value: normalized };
}
