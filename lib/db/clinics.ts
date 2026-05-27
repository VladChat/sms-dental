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

// MVP automated-onboarding allowlist. The current MVP flow is U.S.-only.
// "CA" remains in the union for forward-compatibility of any historical
// rows or future expansion, but onboarding entry points reject non-US.
export type ClinicCountry = "US" | "CA";

// Step 1 of onboarding collects only the three fields required to advance
// to number search: name, mainPhone, postalCode. country is forced to
// "US" by the API route. ownerContactEmail is taken from the verified
// setup request, not from the form. Everything else is collected later
// (settings, admin review, billing/compliance, future onboarding steps).
export type ClinicOnboardingInput = {
  name: string;
  mainPhone: string;
  country: ClinicCountry;
  postalCode: string;
  ownerContactEmail: string;
  // Optional / collected later. Kept here because the DB columns still
  // exist for backward compatibility with older onboarding data.
  legalBusinessName?: string | null;
  timezone?: string | null;
  ownerContactName?: string | null;
  ownerContactPhone?: string | null;
  testPatientPhone?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  preferredAreaCode?: string | null;
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
  country: ClinicCountry;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  preferred_area_code: string | null;
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
      test_patient_phone, setup_status,
      country, city, state_region, postal_code, preferred_area_code
    from public.clinics
    where id = ${id}
    limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Insert a new clinic from onboarding form input or update an existing one
 * keyed by id. SMS is never enabled here; sms_recovery_enabled stays false
 * by default. setup_status starts at 'clinic_details_completed'.
 */
export async function upsertClinicForOnboarding(params: {
  existingClinicId?: string | null;
  input: ClinicOnboardingInput;
}): Promise<ClinicOnboardingRow> {
  const sql = getDb();
  const i = params.input;

  // Optional fields default to null on insert and are preserved with
  // coalesce() on update so re-saving Step 1 doesn't wipe out data the
  // user may have entered in a later step.
  const legalBusinessName = i.legalBusinessName ?? null;
  // timezone defaults to 'America/Chicago' on the column itself.
  const timezone = i.timezone ?? null;
  const ownerContactName = i.ownerContactName ?? null;
  const ownerContactPhone = i.ownerContactPhone ?? null;
  const testPatientPhone = i.testPatientPhone ?? null;
  const city = i.city ?? null;
  const stateRegion = i.stateRegion ?? null;
  const preferredAreaCode = i.preferredAreaCode ?? null;

  if (params.existingClinicId) {
    const rows = await sql<ClinicOnboardingRow[]>`
      update public.clinics
      set
        name = ${i.name},
        legal_business_name = coalesce(${legalBusinessName}, legal_business_name),
        main_phone = ${i.mainPhone},
        timezone = coalesce(${timezone}, timezone),
        owner_contact_name = coalesce(${ownerContactName}, owner_contact_name),
        owner_contact_email = ${i.ownerContactEmail},
        owner_contact_phone = coalesce(${ownerContactPhone}, owner_contact_phone),
        test_patient_phone = coalesce(${testPatientPhone}, test_patient_phone),
        country = ${i.country},
        city = coalesce(${city}, city),
        state_region = coalesce(${stateRegion}, state_region),
        postal_code = ${i.postalCode},
        preferred_area_code = coalesce(${preferredAreaCode}, preferred_area_code),
        setup_status = case
          when setup_status in ('setup_pending') then 'clinic_details_completed'
          else setup_status
        end
      where id = ${params.existingClinicId}
      returning
        id, name, is_active, sms_recovery_enabled,
        legal_business_name, main_phone, timezone,
        owner_contact_name, owner_contact_email, owner_contact_phone,
        test_patient_phone, setup_status,
        country, city, state_region, postal_code, preferred_area_code
    `;
    const row = rows[0];
    if (!row) throw new Error("clinic update returned no row");
    return row;
  }

  // For inserts, leave timezone NULL so the column default
  // ('America/Chicago') is applied. Other optional columns are nullable.
  const rows = await sql<ClinicOnboardingRow[]>`
    insert into public.clinics
      (name, legal_business_name, main_phone,
       owner_contact_name, owner_contact_email, owner_contact_phone,
       test_patient_phone, country, city, state_region, postal_code,
       preferred_area_code, is_active, sms_recovery_enabled, setup_status)
    values
      (${i.name}, ${legalBusinessName}, ${i.mainPhone},
       ${ownerContactName}, ${i.ownerContactEmail}, ${ownerContactPhone},
       ${testPatientPhone}, ${i.country}, ${city}, ${stateRegion},
       ${i.postalCode}, ${preferredAreaCode}, true, false,
       'clinic_details_completed')
    returning
      id, name, is_active, sms_recovery_enabled,
      legal_business_name, main_phone, timezone,
      owner_contact_name, owner_contact_email, owner_contact_phone,
      test_patient_phone, setup_status,
      country, city, state_region, postal_code, preferred_area_code
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
