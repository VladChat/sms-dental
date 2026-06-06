import { getDb } from "./client";
import type { A2pSubmissionMode, A2pSubmissionStatus, JsonObject } from "../a2p/types";

// Local persistence for the platform-admin A2P/10DLC review/submission workflow.
// One row per clinic (current state). This module performs NO Twilio mutation
// and NO A2P submission — it only records the local review/submission status.
//
// All reads are wrapped so a missing table (additive migration not yet applied)
// degrades to "unavailable" rather than throwing. Writes throw so the caller can
// surface a clear, safe error and refuse the action.

export type A2pSubmissionSelectedNumber = {
  phoneNumber: string;
  twilioPhoneNumberSid: string | null;
};

export type A2pSubmissionRecord = {
  clinicId: string;
  status: A2pSubmissionStatus;
  submissionMode: A2pSubmissionMode;
  targetMessagingServiceSid: string | null;
  selectedPhoneNumbers: A2pSubmissionSelectedNumber[];
  twilioCustomerProfileSid: string | null;
  twilioSecondaryCustomerProfileSid: string | null;
  twilioTrustProductSid: string | null;
  twilioBrandRegistrationSid: string | null;
  twilioCampaignSid: string | null;
  twilioMessagingServiceSid: string | null;
  submittedAt: string | null;
  submittedByAdminUserId: string | null;
  submittedByAdminEmail: string | null;
  lastStatusSyncedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type SubmissionRow = {
  clinic_id: string;
  status: A2pSubmissionStatus;
  submission_mode: A2pSubmissionMode;
  target_messaging_service_sid: string | null;
  selected_phone_numbers: A2pSubmissionSelectedNumber[] | null;
  twilio_customer_profile_sid: string | null;
  twilio_secondary_customer_profile_sid: string | null;
  twilio_trust_product_sid: string | null;
  twilio_brand_registration_sid: string | null;
  twilio_campaign_sid: string | null;
  twilio_messaging_service_sid: string | null;
  submitted_at: Date | null;
  submitted_by_admin_user_id: string | null;
  submitted_by_admin_email: string | null;
  last_status_synced_at: Date | null;
  last_error_code: string | null;
  last_error_message: string | null;
  rejection_reason: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

// Column list shared by every SELECT/RETURNING (passed to postgres.js as an
// identifier array, mirroring the CLINIC_COLS pattern in lib/db/clinics.ts).
const SUBMISSION_COLS = [
  "clinic_id", "status", "submission_mode", "target_messaging_service_sid",
  "selected_phone_numbers", "twilio_customer_profile_sid",
  "twilio_secondary_customer_profile_sid", "twilio_trust_product_sid",
  "twilio_brand_registration_sid", "twilio_campaign_sid",
  "twilio_messaging_service_sid", "submitted_at", "submitted_by_admin_user_id",
  "submitted_by_admin_email", "last_status_synced_at", "last_error_code",
  "last_error_message", "rejection_reason", "created_at", "updated_at",
] as const;

function mapRow(row: SubmissionRow): A2pSubmissionRecord {
  return {
    clinicId: row.clinic_id,
    status: row.status,
    submissionMode: row.submission_mode,
    targetMessagingServiceSid: row.target_messaging_service_sid,
    selectedPhoneNumbers: Array.isArray(row.selected_phone_numbers)
      ? row.selected_phone_numbers
      : [],
    twilioCustomerProfileSid: row.twilio_customer_profile_sid,
    twilioSecondaryCustomerProfileSid: row.twilio_secondary_customer_profile_sid,
    twilioTrustProductSid: row.twilio_trust_product_sid,
    twilioBrandRegistrationSid: row.twilio_brand_registration_sid,
    twilioCampaignSid: row.twilio_campaign_sid,
    twilioMessagingServiceSid: row.twilio_messaging_service_sid,
    submittedAt: row.submitted_at ? row.submitted_at.toISOString() : null,
    submittedByAdminUserId: row.submitted_by_admin_user_id,
    submittedByAdminEmail: row.submitted_by_admin_email,
    lastStatusSyncedAt: row.last_status_synced_at ? row.last_status_synced_at.toISOString() : null,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

// Tri-state read: available=false when the table is unreachable (migration not
// applied), available=true with record=null when present but no row yet.
export async function getA2pSubmissionState(
  clinicId: string,
): Promise<{ available: boolean; record: A2pSubmissionRecord | null }> {
  const sql = getDb();
  try {
    const rows = await sql<SubmissionRow[]>`
      select ${sql(SUBMISSION_COLS as unknown as string[])}
      from public.clinic_a2p_submissions
      where clinic_id = ${clinicId}
      limit 1
    `;
    return { available: true, record: rows[0] ? mapRow(rows[0]) : null };
  } catch {
    return { available: false, record: null };
  }
}

export type UpsertA2pSubmissionInput = {
  clinicId: string;
  status: A2pSubmissionStatus;
  submissionMode: A2pSubmissionMode;
  targetMessagingServiceSid: string | null;
  selectedPhoneNumbers: A2pSubmissionSelectedNumber[];
  submittedAt: Date | null;
  submittedByAdminUserId: string | null;
  submittedByAdminEmail: string | null;
  payloadSnapshot: JsonObject | null;
};

// Idempotent per-clinic upsert of the current review/submission state. Throws on
// DB error (including a missing table) so the caller can fail closed and tell the
// operator to apply the additive migration. Never mutates Twilio.
export async function upsertA2pSubmission(
  input: UpsertA2pSubmissionInput,
): Promise<A2pSubmissionRecord> {
  const sql = getDb();
  const rows = await sql<SubmissionRow[]>`
    insert into public.clinic_a2p_submissions
      (clinic_id, status, submission_mode, target_messaging_service_sid,
       selected_phone_numbers, submitted_at, submitted_by_admin_user_id,
       submitted_by_admin_email, payload_snapshot)
    values
      (${input.clinicId}, ${input.status}, ${input.submissionMode},
       ${input.targetMessagingServiceSid},
       ${sql.json(input.selectedPhoneNumbers)},
       ${input.submittedAt}, ${input.submittedByAdminUserId},
       ${input.submittedByAdminEmail},
       ${input.payloadSnapshot ? sql.json(input.payloadSnapshot) : null})
    on conflict (clinic_id) do update set
      status = excluded.status,
      submission_mode = excluded.submission_mode,
      target_messaging_service_sid = excluded.target_messaging_service_sid,
      selected_phone_numbers = excluded.selected_phone_numbers,
      submitted_at = excluded.submitted_at,
      submitted_by_admin_user_id = excluded.submitted_by_admin_user_id,
      submitted_by_admin_email = excluded.submitted_by_admin_email,
      payload_snapshot = excluded.payload_snapshot
    returning ${sql(SUBMISSION_COLS as unknown as string[])}
  `;
  const row = rows[0];
  if (!row) throw new Error("a2p submission upsert returned no row");
  return mapRow(row);
}
