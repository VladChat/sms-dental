import { getDb } from "./client";

// Owner-requested phone numbers. A request is an owner preference only — the
// platform admin reviews it and finishes assignment through the existing
// admin-only purchase flow. Nothing here touches Twilio, clinic_phone_numbers,
// local_number_status, or sms_recovery_enabled.

export type ClinicNumberRequestStatus =
  | "pending"
  | "reviewed"
  | "fulfilled"
  | "rejected"
  | "cancelled";

export type ClinicNumberRequestRow = {
  id: string;
  clinic_id: string;
  requested_phone_number: string;
  friendly_name: string | null;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
  number_type: string;
  capabilities: Record<string, boolean> | null;
  status: ClinicNumberRequestStatus;
  requested_by_profile_id: string | null;
  requested_by_email: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  reviewed_by_profile_id: string | null;
  admin_note: string | null;
};

const REQUEST_COLS = [
  "id", "clinic_id", "requested_phone_number", "friendly_name", "locality",
  "region", "postal_code", "number_type", "capabilities", "status",
  "requested_by_profile_id", "requested_by_email", "created_at", "updated_at",
  "reviewed_at", "reviewed_by_profile_id", "admin_note",
] as const;

export type CreateClinicNumberRequestInput = {
  clinicId: string;
  requestedPhoneNumber: string;
  friendlyName?: string | null;
  locality?: string | null;
  region?: string | null;
  postalCode?: string | null;
  numberType?: "local" | "toll_free";
  capabilities?: Record<string, boolean>;
  requestedByProfileId?: string | null;
  requestedByEmail?: string | null;
};

/**
 * Record an owner's requested number. Idempotent for repeat clicks: if the
 * clinic's current pending request is already the same number, it is returned
 * unchanged. Otherwise any prior pending requests for the clinic are superseded
 * (status -> 'cancelled') and a new 'pending' row is inserted. No Twilio calls;
 * never writes clinic_phone_numbers or changes sms_recovery_enabled.
 */
export async function createClinicNumberRequest(
  input: CreateClinicNumberRequestInput,
): Promise<ClinicNumberRequestRow> {
  const sql = getDb();

  const existingPending = await sql<ClinicNumberRequestRow[]>`
    select ${sql(REQUEST_COLS as unknown as string[])}
    from public.clinic_number_requests
    where clinic_id = ${input.clinicId} and status = 'pending'
    order by created_at desc
    limit 1
  `;
  const latestPending = existingPending[0];
  if (latestPending && latestPending.requested_phone_number === input.requestedPhoneNumber) {
    // Same clinic + same number already pending — no duplicate row.
    return latestPending;
  }

  // Supersede any prior pending requests for this clinic before inserting.
  await sql`
    update public.clinic_number_requests
    set status = 'cancelled', updated_at = now()
    where clinic_id = ${input.clinicId} and status = 'pending'
  `;

  const capabilitiesJson = JSON.stringify(input.capabilities ?? {});
  const rows = await sql<ClinicNumberRequestRow[]>`
    insert into public.clinic_number_requests
      (clinic_id, requested_phone_number, friendly_name, locality, region,
       postal_code, number_type, capabilities, requested_by_profile_id,
       requested_by_email)
    values
      (${input.clinicId}, ${input.requestedPhoneNumber}, ${input.friendlyName ?? null},
       ${input.locality ?? null}, ${input.region ?? null}, ${input.postalCode ?? null},
       ${input.numberType ?? "local"}, ${capabilitiesJson}::jsonb,
       ${input.requestedByProfileId ?? null}, ${input.requestedByEmail ?? null})
    returning ${sql(REQUEST_COLS as unknown as string[])}
  `;
  const row = rows[0];
  if (!row) throw new Error("clinic number request insert returned no row");
  return row;
}

// Latest request (any status) for a clinic — used for owner + admin display.
export async function findLatestClinicNumberRequest(
  clinicId: string,
): Promise<ClinicNumberRequestRow | null> {
  const sql = getDb();
  const rows = await sql<ClinicNumberRequestRow[]>`
    select ${sql(REQUEST_COLS as unknown as string[])}
    from public.clinic_number_requests
    where clinic_id = ${clinicId}
    order by created_at desc
    limit 1
  `;
  return rows[0] ?? null;
}

// Recent requests for a clinic (admin history view, if needed).
export async function listRecentClinicNumberRequestsForClinic(
  clinicId: string,
  limit = 5,
): Promise<ClinicNumberRequestRow[]> {
  const sql = getDb();
  return sql<ClinicNumberRequestRow[]>`
    select ${sql(REQUEST_COLS as unknown as string[])}
    from public.clinic_number_requests
    where clinic_id = ${clinicId}
    order by created_at desc
    limit ${limit}
  `;
}
