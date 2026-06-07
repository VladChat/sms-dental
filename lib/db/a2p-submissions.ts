import { getDb } from "./client";
import type {
  A2pStoredSubmissionMode,
  A2pSubmissionMode,
  A2pSubmissionStatus,
  JsonObject,
} from "../a2p/types";

// Local persistence for the platform-admin A2P/10DLC review/submission workflow.
// The current schema stores one row per (clinic_id, submission_mode) so dry-run,
// mock, and live attempts remain separate. This module does NO Twilio mutation —
// it only records local state.
//
// Reads are wrapped so a missing table OR a missing newer column (additive
// migration not yet applied) degrades gracefully rather than throwing. Writes
// throw so the caller can fail closed and tell the operator to apply migrations.

export type A2pSubmissionTrackingCapabilities = {
  available: boolean;
  modeSeparated: boolean;
};

export type A2pSubmissionSelectedNumber = {
  phoneNumber: string;
  twilioPhoneNumberSid: string | null;
};

export type A2pSubmissionRecord = {
  clinicId: string;
  status: A2pSubmissionStatus;
  submissionMode: A2pSubmissionMode;
  submissionStep: string | null;
  providerState: JsonObject;
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
  submission_step?: string | null;
  provider_state?: JsonObject | null;
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

const BASE_COLS = [
  "clinic_id", "status", "submission_mode", "target_messaging_service_sid",
  "selected_phone_numbers", "twilio_customer_profile_sid",
  "twilio_secondary_customer_profile_sid", "twilio_trust_product_sid",
  "twilio_brand_registration_sid", "twilio_campaign_sid",
  "twilio_messaging_service_sid", "submitted_at", "submitted_by_admin_user_id",
  "submitted_by_admin_email", "last_status_synced_at", "last_error_code",
  "last_error_message", "rejection_reason", "created_at", "updated_at",
] as const;

// Base columns + the resumable progress columns added by migration 20260608000100.
const FULL_COLS = [...BASE_COLS, "submission_step", "provider_state"] as const;

function mapRow(row: SubmissionRow): A2pSubmissionRecord {
  return {
    clinicId: row.clinic_id,
    status: row.status,
    submissionMode: row.submission_mode,
    submissionStep: row.submission_step ?? null,
    providerState: (row.provider_state && typeof row.provider_state === "object"
      ? row.provider_state
      : {}) as JsonObject,
    targetMessagingServiceSid: row.target_messaging_service_sid,
    selectedPhoneNumbers: Array.isArray(row.selected_phone_numbers) ? row.selected_phone_numbers : [],
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

export async function getA2pSubmissionTrackingCapabilities(): Promise<A2pSubmissionTrackingCapabilities> {
  const sql = getDb();
  try {
    const rows = await sql<Array<{ mode_separated: boolean }>>`
      select exists (
        select 1
        from pg_constraint
        where conrelid = 'public.clinic_a2p_submissions'::regclass
          and conname = 'clinic_a2p_submissions_clinic_mode_unique'
      ) as mode_separated
    `;
    return {
      available: true,
      modeSeparated: Boolean(rows[0]?.mode_separated),
    };
  } catch {
    return {
      available: false,
      modeSeparated: false,
    };
  }
}

// Tri-state read. Tries the full column set (post-migration), falls back to the
// base columns if the progress columns don't exist yet, and reports
// available=false only when the table itself is unreachable.
export async function getA2pSubmissionState(
  clinicId: string,
  submissionMode?: A2pStoredSubmissionMode,
): Promise<{ available: boolean; record: A2pSubmissionRecord | null }> {
  const sql = getDb();
  const modeWhere = submissionMode
    ? sql`where clinic_id = ${clinicId} and submission_mode = ${submissionMode}`
    : sql`where clinic_id = ${clinicId}`;
  try {
    const rows = await sql<SubmissionRow[]>`
      select ${sql(FULL_COLS as unknown as string[])}
      from public.clinic_a2p_submissions
      ${modeWhere}
      limit 1
    `;
    return { available: true, record: rows[0] ? mapRow(rows[0]) : null };
  } catch {
    try {
      const rows = await sql<SubmissionRow[]>`
        select ${sql(BASE_COLS as unknown as string[])}
        from public.clinic_a2p_submissions
        ${modeWhere}
        limit 1
      `;
      return { available: true, record: rows[0] ? mapRow(rows[0]) : null };
    } catch {
      return { available: false, record: null };
    }
  }
}

export async function listA2pSubmissionStates(
  clinicId: string,
): Promise<{ available: boolean; records: A2pSubmissionRecord[] }> {
  const sql = getDb();
  try {
    const rows = await sql<SubmissionRow[]>`
      select ${sql(FULL_COLS as unknown as string[])}
      from public.clinic_a2p_submissions
      where clinic_id = ${clinicId}
      order by updated_at desc
    `;
    return { available: true, records: rows.map(mapRow) };
  } catch {
    try {
      const rows = await sql<SubmissionRow[]>`
        select ${sql(BASE_COLS as unknown as string[])}
        from public.clinic_a2p_submissions
        where clinic_id = ${clinicId}
        order by updated_at desc
      `;
      return { available: true, records: rows.map(mapRow) };
    } catch {
      return { available: false, records: [] };
    }
  }
}

// ---- dry-run write (unchanged column set; works without 20260608 migration) ----

export type UpsertA2pSubmissionInput = {
  clinicId: string;
  status: A2pSubmissionStatus;
  submissionMode: A2pStoredSubmissionMode;
  targetMessagingServiceSid: string | null;
  selectedPhoneNumbers: A2pSubmissionSelectedNumber[];
  submittedAt: Date | null;
  submittedByAdminUserId: string | null;
  submittedByAdminEmail: string | null;
  payloadSnapshot: JsonObject | null;
};

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
    on conflict (clinic_id, submission_mode) do update set
      status = excluded.status,
      submission_mode = excluded.submission_mode,
      target_messaging_service_sid = excluded.target_messaging_service_sid,
      selected_phone_numbers = excluded.selected_phone_numbers,
      submitted_at = excluded.submitted_at,
      submitted_by_admin_user_id = excluded.submitted_by_admin_user_id,
      submitted_by_admin_email = excluded.submitted_by_admin_email,
      payload_snapshot = excluded.payload_snapshot
    returning ${sql(BASE_COLS as unknown as string[])}
  `;
  const row = rows[0];
  if (!row) throw new Error("a2p submission upsert returned no row");
  return mapRow(row);
}

// ---- live state-machine progress write (requires 20260608 migration) ----

export type A2pProgressInput = {
  clinicId: string;
  submissionMode: A2pStoredSubmissionMode;
  status?: A2pSubmissionStatus;
  submissionStep?: string | null;
  // Merged into provider_state (jsonb ||). Must be redacted (no full EIN/secrets).
  providerStatePatch?: JsonObject;
  // Replaces provider_state entirely. Use only for controlled recovery when
  // stale keys must be dropped before retry.
  replaceProviderState?: boolean;
  targetMessagingServiceSid?: string | null;
  customerProfileSid?: string | null;
  secondaryCustomerProfileSid?: string | null;
  trustProductSid?: string | null;
  brandRegistrationSid?: string | null;
  campaignSid?: string | null;
  messagingServiceSid?: string | null;
  selectedPhoneNumbers?: A2pSubmissionSelectedNumber[];
  submittedAt?: Date | null;
  submittedByAdminUserId?: string | null;
  submittedByAdminEmail?: string | null;
  lastStatusSyncedAt?: Date | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  rejectionReason?: string | null;
};

// Idempotent per-clinic progress upsert. SIDs are coalesced (never nulled out by
// a later step) and provider_state is JSON-merged so partial progress is durable
// and retry-safe. Throws if the table/columns are missing so live mode can fail
// closed and tell the operator to apply migration 20260608000100.
export async function upsertA2pSubmissionProgress(
  input: A2pProgressInput,
): Promise<A2pSubmissionRecord> {
  const sql = getDb();
  const patch = input.providerStatePatch ?? {};
  const sel = input.selectedPhoneNumbers ?? null;
  const providerStateUpdate = input.replaceProviderState
    ? sql`${sql.json(patch)}`
    : sql`public.clinic_a2p_submissions.provider_state || ${sql.json(patch)}`;
  const rows = await sql<SubmissionRow[]>`
    insert into public.clinic_a2p_submissions
      (clinic_id, status, submission_mode, submission_step, provider_state,
       target_messaging_service_sid, selected_phone_numbers,
       twilio_customer_profile_sid, twilio_secondary_customer_profile_sid,
       twilio_trust_product_sid, twilio_brand_registration_sid,
       twilio_campaign_sid, twilio_messaging_service_sid,
       submitted_at, submitted_by_admin_user_id, submitted_by_admin_email,
       last_status_synced_at, last_error_code, last_error_message, rejection_reason)
    values
      (${input.clinicId}, ${input.status ?? "submitted"}, ${input.submissionMode},
       ${input.submissionStep ?? null}, ${sql.json(patch)},
       ${input.targetMessagingServiceSid ?? null},
       ${sel ? sql.json(sel) : sql.json([])},
       ${input.customerProfileSid ?? null}, ${input.secondaryCustomerProfileSid ?? null},
       ${input.trustProductSid ?? null}, ${input.brandRegistrationSid ?? null},
       ${input.campaignSid ?? null}, ${input.messagingServiceSid ?? null},
       ${input.submittedAt ?? null}, ${input.submittedByAdminUserId ?? null},
       ${input.submittedByAdminEmail ?? null}, ${input.lastStatusSyncedAt ?? null},
       ${input.lastErrorCode ?? null}, ${input.lastErrorMessage ?? null},
       ${input.rejectionReason ?? null})
    on conflict (clinic_id, submission_mode) do update set
      status = coalesce(${input.status ?? null}, public.clinic_a2p_submissions.status),
      submission_mode = ${input.submissionMode},
      submission_step = coalesce(${input.submissionStep ?? null}, public.clinic_a2p_submissions.submission_step),
      provider_state = ${providerStateUpdate},
      target_messaging_service_sid = coalesce(${input.targetMessagingServiceSid ?? null}, public.clinic_a2p_submissions.target_messaging_service_sid),
      selected_phone_numbers = ${sel ? sql.json(sel) : sql`public.clinic_a2p_submissions.selected_phone_numbers`},
      twilio_customer_profile_sid = coalesce(${input.customerProfileSid ?? null}, public.clinic_a2p_submissions.twilio_customer_profile_sid),
      twilio_secondary_customer_profile_sid = coalesce(${input.secondaryCustomerProfileSid ?? null}, public.clinic_a2p_submissions.twilio_secondary_customer_profile_sid),
      twilio_trust_product_sid = coalesce(${input.trustProductSid ?? null}, public.clinic_a2p_submissions.twilio_trust_product_sid),
      twilio_brand_registration_sid = coalesce(${input.brandRegistrationSid ?? null}, public.clinic_a2p_submissions.twilio_brand_registration_sid),
      twilio_campaign_sid = coalesce(${input.campaignSid ?? null}, public.clinic_a2p_submissions.twilio_campaign_sid),
      twilio_messaging_service_sid = coalesce(${input.messagingServiceSid ?? null}, public.clinic_a2p_submissions.twilio_messaging_service_sid),
      submitted_at = coalesce(public.clinic_a2p_submissions.submitted_at, ${input.submittedAt ?? null}),
      submitted_by_admin_user_id = coalesce(${input.submittedByAdminUserId ?? null}, public.clinic_a2p_submissions.submitted_by_admin_user_id),
      submitted_by_admin_email = coalesce(${input.submittedByAdminEmail ?? null}, public.clinic_a2p_submissions.submitted_by_admin_email),
      last_status_synced_at = coalesce(${input.lastStatusSyncedAt ?? null}, public.clinic_a2p_submissions.last_status_synced_at),
      last_error_code = ${input.lastErrorCode ?? null},
      last_error_message = ${input.lastErrorMessage ?? null},
      rejection_reason = coalesce(${input.rejectionReason ?? null}, public.clinic_a2p_submissions.rejection_reason)
    returning ${sql(FULL_COLS as unknown as string[])}
  `;
  const row = rows[0];
  if (!row) throw new Error("a2p submission progress upsert returned no row");
  return mapRow(row);
}
