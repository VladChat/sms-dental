import { getDb } from "./client";

export type ClinicRow = {
  id: string;
  name: string;
  is_active: boolean;
};

// Look up the active clinic that owns a given E.164 phone number.
// Returns null if the number has no mapping or the clinic/mapping is inactive.
export async function lookupClinicByPhone(
  phoneNumber: string,
): Promise<ClinicRow | null> {
  if (!phoneNumber) return null;
  const sql = getDb();
  const rows = await sql<ClinicRow[]>`
    select c.id, c.name, c.is_active
    from public.clinics c
    join public.clinic_phone_numbers cpn on cpn.clinic_id = c.id
    where cpn.phone_number = ${phoneNumber}
      and cpn.is_active = true
      and c.is_active = true
    limit 1
  `;
  return rows[0] ?? null;
}
