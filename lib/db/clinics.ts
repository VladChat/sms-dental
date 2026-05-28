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

// Customer-facing status values surfaced on the Business Profile page.
export type LocalNumberStatus = "preparing" | "reserved" | "assigned";
export type SmsStatus = "preparing" | "waiting_for_approval" | "active";
export type BillingStatus =
  | "not_started"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type ClinicOnboardingRow = ClinicRow & {
  slug: string | null;
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
  // Business Information
  ein_tax_id: string | null;
  business_type: string | null;
  street_address: string | null;
  address_line2: string | null;
  website: string | null;
  business_info_completed: boolean;
  // A2P representative (stored locally for future submission)
  a2p_rep_first_name: string | null;
  a2p_rep_last_name: string | null;
  a2p_rep_business_title: string | null;
  a2p_rep_email: string | null;
  a2p_rep_phone: string | null;
  a2p_authorized: boolean;
  a2p_info_completed: boolean;
  // Lifecycle status
  local_number_status: LocalNumberStatus;
  sms_status: SmsStatus;
  billing_status: BillingStatus;
  trial_started_at: Date | null;
  trial_ends_at: Date | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

// Column list shared by every SELECT/RETURNING that builds a
// ClinicOnboardingRow. Passed to postgres.js as an identifier array.
const CLINIC_COLS = [
  "id", "name", "slug", "is_active", "sms_recovery_enabled",
  "legal_business_name", "main_phone", "timezone",
  "owner_contact_name", "owner_contact_email", "owner_contact_phone",
  "test_patient_phone", "setup_status",
  "country", "city", "state_region", "postal_code", "preferred_area_code",
  "ein_tax_id", "business_type", "street_address", "address_line2", "website", "business_info_completed",
  "a2p_rep_first_name", "a2p_rep_last_name", "a2p_rep_business_title",
  "a2p_rep_email", "a2p_rep_phone", "a2p_authorized", "a2p_info_completed",
  "local_number_status", "sms_status", "billing_status",
  "trial_started_at", "trial_ends_at", "stripe_customer_id", "stripe_subscription_id",
] as const;

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
    select ${sql(CLINIC_COLS as unknown as string[])}
    from public.clinics
    where id = ${id}
    limit 1
  `;
  return rows[0] ?? null;
}

// Public lookup for the /business/{slug} pages. Returns the full row; the
// page is responsible for exposing only public-safe fields.
export async function findClinicBySlug(
  slug: string,
): Promise<ClinicOnboardingRow | null> {
  const sql = getDb();
  const rows = await sql<ClinicOnboardingRow[]>`
    select ${sql(CLINIC_COLS as unknown as string[])}
    from public.clinics
    where slug = ${slug}
    limit 1
  `;
  return rows[0] ?? null;
}

async function slugExists(slug: string, exceptClinicId?: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    select id from public.clinics
    where slug = ${slug}
      and (${exceptClinicId ?? null}::uuid is null or id <> ${exceptClinicId ?? null}::uuid)
    limit 1
  `;
  return rows.length > 0;
}

/**
 * Ensure the clinic has a slug derived from its name. If it already has one,
 * it is kept. Returns the resolved slug.
 */
export async function ensureClinicSlug(
  clinicId: string,
  name: string,
): Promise<string> {
  const sql = getDb();
  const current = await sql<{ slug: string | null }[]>`
    select slug from public.clinics where id = ${clinicId} limit 1
  `;
  const existing = current[0]?.slug;
  if (existing) return existing;

  const { ensureUniqueSlug } = await import("../onboarding/slug");
  const slug = await ensureUniqueSlug(name, (s) => slugExists(s, clinicId));
  await sql`update public.clinics set slug = ${slug} where id = ${clinicId}`;
  return slug;
}

export type BusinessInformationInput = {
  name: string;
  mainPhone: string;
  postalCode: string;
  legalBusinessName: string;
  einTaxId: string;
  businessType: string;
  streetAddress: string;
  addressLine2?: string | null;
  city: string;
  stateRegion: string;
  website?: string | null;
};

/**
 * Save the Business Information card. Marks business_info_completed=true.
 * Does not touch SMS or billing state.
 */
export async function updateBusinessInformation(
  clinicId: string,
  input: BusinessInformationInput,
): Promise<ClinicOnboardingRow> {
  const sql = getDb();
  const rows = await sql<ClinicOnboardingRow[]>`
    update public.clinics
    set
      name = ${input.name},
      main_phone = ${input.mainPhone},
      postal_code = ${input.postalCode},
      legal_business_name = ${input.legalBusinessName},
      ein_tax_id = ${input.einTaxId},
      business_type = ${input.businessType},
      street_address = ${input.streetAddress},
      address_line2 = ${input.addressLine2 ?? null},
      city = ${input.city},
      state_region = ${input.stateRegion},
      website = ${input.website ?? null},
      business_info_completed = true
    where id = ${clinicId}
    returning ${sql(CLINIC_COLS as unknown as string[])}
  `;
  const row = rows[0];
  if (!row) throw new Error("business information update returned no row");
  return row;
}

export type A2pInformationInput = {
  repFirstName: string;
  repLastName: string;
  repEmail: string;
  repPhone: string;
  authorized: boolean;
};

/**
 * Save the A2P Approval Information card. Marks a2p_info_completed=true and
 * advances sms_status to 'waiting_for_approval'. Never enables live SMS:
 * sms_recovery_enabled stays false.
 */
export async function updateA2pInformation(
  clinicId: string,
  input: A2pInformationInput,
): Promise<ClinicOnboardingRow> {
  const sql = getDb();
  const rows = await sql<ClinicOnboardingRow[]>`
    update public.clinics
    set
      a2p_rep_first_name = ${input.repFirstName},
      a2p_rep_last_name = ${input.repLastName},
      -- Representative title is system-generated, not customer-entered.
      a2p_rep_business_title = 'Owner',
      a2p_rep_email = ${input.repEmail},
      a2p_rep_phone = ${input.repPhone},
      a2p_authorized = ${input.authorized},
      a2p_info_completed = true,
      sms_status = case when sms_status = 'preparing'
        then 'waiting_for_approval' else sms_status end
    where id = ${clinicId}
    returning ${sql(CLINIC_COLS as unknown as string[])}
  `;
  const row = rows[0];
  if (!row) throw new Error("a2p information update returned no row");
  return row;
}

/**
 * Set the customer-facing local number status (preparing/reserved/assigned).
 * Used by the automatic local-number preparation step.
 */
export async function setLocalNumberStatus(
  clinicId: string,
  status: LocalNumberStatus,
): Promise<void> {
  const sql = getDb();
  await sql`
    update public.clinics set local_number_status = ${status} where id = ${clinicId}
  `;
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
      returning ${sql(CLINIC_COLS as unknown as string[])}
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
    returning ${sql(CLINIC_COLS as unknown as string[])}
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
