import { getDb } from "./client";

export type ClinicPhoneNumberRow = {
  id: string;
  clinic_id: string;
  phone_number: string;
  // Added by 20260609000100_phone_number_type. Existing rows backfilled to 'local'
  // (conservative). New rows are always written explicitly by provisioning.
  number_type: "toll_free" | "local";
  twilio_phone_number_sid: string | null;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  // Added by the self-service-numbers migration (present after it is applied;
  // `select *` returns them). Legacy rows default to source/billing_class
  // 'legacy', amount 0.
  source: string;
  billing_class: "legacy" | "included" | "additional";
  monthly_unit_amount_cents: number;
  currency: string;
  purchased_by_profile_id: string | null;
  purchased_by_email: string | null;
  activated_at: Date | null;
  suspended_at: Date | null;
  suspended_by_profile_id: string | null;
  suspension_reason: string | null;
  removal_status: "active" | "scheduled" | "permanently_removed";
  removal_requested_at: Date | null;
  removal_requested_by_profile_id: string | null;
  removal_requested_by_email: string | null;
  permanent_removal_at: Date | null;
  restored_at: Date | null;
  restored_by_profile_id: string | null;
  restored_by_email: string | null;
  twilio_released_at: Date | null;
  twilio_release_status: "not_required" | "pending" | "released" | "failed";
  twilio_release_error: string | null;
};

/**
 * Returns ALL phone-number rows for a clinic (active first, then oldest first).
 * Read-only listing for the owner/admin "all business numbers" views. Does not
 * delete, hide, release, or modify any row or Twilio configuration.
 */
export async function listClinicPhoneNumbersForClinic(
  clinicId: string,
): Promise<ClinicPhoneNumberRow[]> {
  const sql = getDb();
  return sql<ClinicPhoneNumberRow[]>`
    select *
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
      and removal_status <> 'permanently_removed'
    order by
      case when removal_status = 'scheduled' then 1 else 0 end asc,
      is_active desc,
      created_at asc
  `;
}

export type DuePhoneNumberReleaseRow = ClinicPhoneNumberRow & {
  clinic_name: string | null;
};

export async function listDuePhoneNumberReleases(limit = 25): Promise<DuePhoneNumberReleaseRow[]> {
  const sql = getDb();
  return sql<DuePhoneNumberReleaseRow[]>`
    select cpn.*, c.name as clinic_name
    from public.clinic_phone_numbers cpn
    join public.clinics c on c.id = cpn.clinic_id
    where cpn.removal_status = 'scheduled'
      and cpn.permanent_removal_at <= now()
      and cpn.twilio_release_status in ('pending', 'failed')
    order by cpn.permanent_removal_at asc, cpn.created_at asc
    limit ${Math.max(1, Math.min(100, Math.floor(limit)))}
  `;
}

export async function markPhoneNumberReleaseFailed(
  phoneNumberId: string,
  error: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    update public.clinic_phone_numbers set
      twilio_release_status = 'failed',
      twilio_release_error = ${error.slice(0, 500)}
    where id = ${phoneNumberId}
      and removal_status = 'scheduled'
  `;
}

export async function markPhoneNumberReleased(phoneNumberId: string): Promise<void> {
  const sql = getDb();
  await sql`
    update public.clinic_phone_numbers set
      removal_status = 'permanently_removed',
      is_active = false,
      twilio_release_status = 'released',
      twilio_released_at = now(),
      twilio_release_error = null
    where id = ${phoneNumberId}
      and removal_status = 'scheduled'
  `;
}

/**
 * Returns the active office texting number for the clinic, if any.
 * Used to enforce idempotent purchase at the clinic level.
 */
export async function findActiveOfficeTextingNumber(
  clinicId: string,
): Promise<ClinicPhoneNumberRow | null> {
  const sql = getDb();
  const rows = await sql<ClinicPhoneNumberRow[]>`
    select *
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
      and is_active = true
      and role = 'office_texting'
    order by created_at desc
    limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Returns the first ACTIVE clinic_phone_numbers row for a clinic regardless of
 * role (oldest first), or null when none exists. The additional-number purchase
 * safety gate uses this so a clinic that already has ANY active assigned number
 * — including a legacy/manually-provisioned row with a non-`office_texting` role
 * (e.g. `recovery`) — is detected and a second purchase is blocked. Read-only;
 * never writes, releases, or reconfigures a number.
 */
export async function findAnyActiveClinicPhoneNumber(
  clinicId: string,
): Promise<ClinicPhoneNumberRow | null> {
  const sql = getDb();
  const rows = await sql<ClinicPhoneNumberRow[]>`
    select *
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
      and is_active = true
    order by created_at asc
    limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Persist the assigned office texting number for a clinic. Uses upsert by
 * phone_number (unique). Sets role='office_texting' and is_active=true.
 */
export async function upsertOfficeTextingNumber(params: {
  clinicId: string;
  phoneNumber: string;
  twilioPhoneNumberSid: string;
}): Promise<ClinicPhoneNumberRow> {
  const sql = getDb();
  const rows = await sql<ClinicPhoneNumberRow[]>`
    insert into public.clinic_phone_numbers
      (clinic_id, phone_number, twilio_phone_number_sid, role, is_active)
    values
      (${params.clinicId}, ${params.phoneNumber}, ${params.twilioPhoneNumberSid},
       'office_texting', true)
    on conflict (phone_number)
    do update set
      clinic_id = excluded.clinic_id,
      twilio_phone_number_sid = excluded.twilio_phone_number_sid,
      role = excluded.role,
      is_active = true,
      removal_status = 'active',
      removal_requested_at = null,
      removal_requested_by_profile_id = null,
      removal_requested_by_email = null,
      permanent_removal_at = null,
      twilio_release_status = 'not_required',
      twilio_release_error = null
    returning *
  `;
  const row = rows[0];
  if (!row) throw new Error("clinic_phone_numbers upsert returned no row");
  return row;
}
