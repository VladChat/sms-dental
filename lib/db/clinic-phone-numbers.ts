import { getDb } from "./client";

export type ClinicPhoneNumberRow = {
  id: string;
  clinic_id: string;
  phone_number: string;
  twilio_phone_number_sid: string | null;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
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
    order by is_active desc, created_at asc
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
      is_active = true
    returning *
  `;
  const row = rows[0];
  if (!row) throw new Error("clinic_phone_numbers upsert returned no row");
  return row;
}
