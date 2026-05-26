import { getDb } from "./client";

export type ClinicRow = {
  id: string;
  name: string;
  is_active: boolean;
  sms_recovery_enabled: boolean;
};

export type ClinicSetupStatus =
  | "setup_pending"
  | "clinic_details_completed"
  | "number_assigned"
  | "qa_pending"
  | "qa_passed"
  | "ready_for_approval"
  | "active"
  | "cancelled"
  | "expired";

export type ClinicOnboardingInput = {
  name: string;
  legalBusinessName: string;
  mainPhone: string;
  timezone: string;
  ownerContactName: string;
  ownerContactEmail: string;
  ownerContactPhone: string;
  testPatientPhone: string;
};

export type ClinicOnboardingRow = ClinicRow & {
  legal_business_name: string | null;
  main_phone: string | null;
  timezone: string;
  owner_contact_name: string | null;
  owner_contact_email: string | null;
  owner_contact_phone: string | null;
  test_patient_phone: string | null;
  setup_status: ClinicSetupStatus;
};

// Look up the active clinic that owns a given E.164 phone number.
// Returns null if the number has no mapping or the clinic/mapping is inactive.
export async function lookupClinicByPhone(
  phoneNumber: string,
): Promise<ClinicRow | null> {
  if (!phoneNumber) return null;
  const sql = getDb();
  const rows = await sql<ClinicRow[]>`
    select c.id, c.name, c.is_active, c.sms_recovery_enabled
    from public.clinics c
    join public.clinic_phone_numbers cpn on cpn.clinic_id = c.id
    where cpn.phone_number = ${phoneNumber}
      and cpn.is_active = true
      and c.is_active = true
    limit 1
  `;
  return rows[0] ?? null;
}

export async function findClinicById(
  id: string,
): Promise<ClinicOnboardingRow | null> {
  const sql = getDb();
  const rows = await sql<ClinicOnboardingRow[]>`
    select
      id, name, is_active, sms_recovery_enabled,
      legal_business_name, main_phone, timezone,
      owner_contact_name, owner_contact_email, owner_contact_phone,
      test_patient_phone, setup_status
    from public.clinics
    where id = ${id}
    limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Insert a new clinic from onboarding form input or update an existing one
 * keyed by id. SMS is never enabled here; sms_recovery_enabled stays false
 * by default. setup_status starts at 'setup_pending'.
 */
export async function upsertClinicForOnboarding(params: {
  existingClinicId?: string | null;
  input: ClinicOnboardingInput;
}): Promise<ClinicOnboardingRow> {
  const sql = getDb();
  const i = params.input;

  if (params.existingClinicId) {
    const rows = await sql<ClinicOnboardingRow[]>`
      update public.clinics
      set
        name = ${i.name},
        legal_business_name = ${i.legalBusinessName},
        main_phone = ${i.mainPhone},
        timezone = ${i.timezone},
        owner_contact_name = ${i.ownerContactName},
        owner_contact_email = ${i.ownerContactEmail},
        owner_contact_phone = ${i.ownerContactPhone},
        test_patient_phone = ${i.testPatientPhone},
        setup_status = case
          when setup_status in ('setup_pending') then 'clinic_details_completed'
          else setup_status
        end
      where id = ${params.existingClinicId}
      returning
        id, name, is_active, sms_recovery_enabled,
        legal_business_name, main_phone, timezone,
        owner_contact_name, owner_contact_email, owner_contact_phone,
        test_patient_phone, setup_status
    `;
    const row = rows[0];
    if (!row) throw new Error("clinic update returned no row");
    return row;
  }

  const rows = await sql<ClinicOnboardingRow[]>`
    insert into public.clinics
      (name, legal_business_name, main_phone, timezone,
       owner_contact_name, owner_contact_email, owner_contact_phone,
       test_patient_phone, is_active, sms_recovery_enabled, setup_status)
    values
      (${i.name}, ${i.legalBusinessName}, ${i.mainPhone}, ${i.timezone},
       ${i.ownerContactName}, ${i.ownerContactEmail}, ${i.ownerContactPhone},
       ${i.testPatientPhone}, true, false, 'clinic_details_completed')
    returning
      id, name, is_active, sms_recovery_enabled,
      legal_business_name, main_phone, timezone,
      owner_contact_name, owner_contact_email, owner_contact_phone,
      test_patient_phone, setup_status
  `;
  const row = rows[0];
  if (!row) throw new Error("clinic insert returned no row");
  return row;
}

export async function setClinicSetupStatus(
  id: string,
  status: ClinicSetupStatus,
): Promise<void> {
  const sql = getDb();
  await sql`
    update public.clinics
    set setup_status = ${status}
    where id = ${id}
  `;
}
