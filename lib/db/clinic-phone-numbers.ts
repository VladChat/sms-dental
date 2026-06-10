import { getDb } from "./client";

export const PHONE_NUMBER_TEXTING_STATUSES = [
  "preparing",
  "waiting_for_approval",
  "active",
  "failed",
] as const;

export type PhoneNumberTextingStatus = (typeof PHONE_NUMBER_TEXTING_STATUSES)[number];

export function isPhoneNumberTextingStatus(
  value: unknown,
): value is PhoneNumberTextingStatus {
  return (
    typeof value === "string" &&
    (PHONE_NUMBER_TEXTING_STATUSES as readonly string[]).includes(value)
  );
}

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
  // Added by 20260612000100_phone_number_twilio_purchased_at. Estimated Twilio
  // billing anchor (IncomingPhoneNumber dateCreated, or a safe fallback). Nullable
  // for legacy rows; removal-lifecycle code falls back to created_at when null.
  twilio_purchased_at: Date | null;
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
  // 'detached' (20260613000100) = clinic assignment released by a platform admin
  // while the Twilio number stays owned in our account (no Twilio release). A
  // detached row is excluded from the old clinic's owner/admin lists and counts.
  removal_status: "active" | "scheduled" | "permanently_removed" | "detached";
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
  texting_status: PhoneNumberTextingStatus;
  texting_status_source: string;
  texting_status_updated_at: Date;
  texting_provider_status: string | null;
  texting_provider_error_code: string | null;
  texting_provider_error_message: string | null;
  texting_provider_synced_at: Date | null;
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
      and removal_status not in ('permanently_removed', 'detached')
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

export type TextingStatusSyncPhoneNumberRow = {
  id: string;
  clinic_id: string;
  phone_number: string;
  twilio_phone_number_sid: string | null;
  number_type: "toll_free" | "local";
  is_active: boolean;
  removal_status: "active" | "scheduled" | "permanently_removed" | "detached";
  texting_status: PhoneNumberTextingStatus;
  texting_status_source: string;
  texting_status_updated_at: Date;
  texting_provider_status: string | null;
  texting_provider_error_code: string | null;
  texting_provider_error_message: string | null;
  texting_provider_synced_at: Date | null;
};

export async function listPhoneNumbersDueForTextingStatusSync(params: {
  limit: number;
  pendingStaleBefore: Date;
  activeStaleBefore: Date;
  includeActiveReconciliation: boolean;
  clinicId?: string | null;
  phoneNumberId?: string | null;
  force?: boolean;
}): Promise<TextingStatusSyncPhoneNumberRow[]> {
  const limit = Math.max(1, Math.min(100, Math.floor(params.limit)));
  const sql = getDb();
  return sql<TextingStatusSyncPhoneNumberRow[]>`
    select
      id, clinic_id, phone_number, twilio_phone_number_sid, number_type,
      is_active, removal_status, texting_status, texting_status_source,
      texting_status_updated_at, texting_provider_status,
      texting_provider_error_code, texting_provider_error_message,
      texting_provider_synced_at
    from public.clinic_phone_numbers
    where is_active = true
      and removal_status = 'active'
      and (${params.clinicId ?? null}::uuid is null or clinic_id = ${params.clinicId ?? null}::uuid)
      and (${params.phoneNumberId ?? null}::uuid is null or id = ${params.phoneNumberId ?? null}::uuid)
      and (
        ${params.force === true}::boolean
        or (
          texting_status in ('preparing', 'waiting_for_approval', 'failed')
          and texting_status_updated_at <= ${params.pendingStaleBefore}
        )
        or (
          ${params.includeActiveReconciliation}::boolean
          and texting_status = 'active'
          and texting_status_updated_at <= ${params.activeStaleBefore}
        )
      )
    order by
      case when texting_status = 'active' then 1 else 0 end asc,
      texting_status_updated_at asc,
      created_at asc
    limit ${limit}
  `;
}

/**
 * Update only the per-number texting approval/capability fields. This helper is
 * intentionally scoped away from routing, lifecycle, billing, and Twilio release
 * columns so an approval/status correction cannot change call behavior.
 */
export async function updatePhoneNumberTextingStatus(params: {
  phoneNumberId: string;
  clinicId?: string | null;
  status: PhoneNumberTextingStatus;
  source: string;
  providerStatus?: string | null;
  providerErrorCode?: string | null;
  providerErrorMessage?: string | null;
}): Promise<ClinicPhoneNumberRow | null> {
  if (!isPhoneNumberTextingStatus(params.status)) {
    throw new Error(`Invalid phone-number texting status: ${String(params.status)}`);
  }
  const source = params.source.trim();
  if (!source) {
    throw new Error("Phone-number texting status source is required");
  }
  const hasProviderDetails =
    params.providerStatus !== undefined ||
    params.providerErrorCode !== undefined ||
    params.providerErrorMessage !== undefined;

  const sql = getDb();
  const rows = await sql<ClinicPhoneNumberRow[]>`
    update public.clinic_phone_numbers set
      texting_status = ${params.status},
      texting_status_source = ${source},
      texting_status_updated_at = now(),
      texting_provider_status = case
        when ${hasProviderDetails}::boolean then ${params.providerStatus ?? null}
        else texting_provider_status
      end,
      texting_provider_error_code = case
        when ${hasProviderDetails}::boolean then ${params.providerErrorCode ?? null}
        else texting_provider_error_code
      end,
      texting_provider_error_message = case
        when ${hasProviderDetails}::boolean then ${params.providerErrorMessage?.slice(0, 500) ?? null}
        else texting_provider_error_message
      end,
      texting_provider_synced_at = case
        when ${hasProviderDetails}::boolean then now()
        else texting_provider_synced_at
      end
    where id = ${params.phoneNumberId}
      and (${params.clinicId ?? null}::uuid is null or clinic_id = ${params.clinicId ?? null}::uuid)
    returning *
  `;
  return rows[0] ?? null;
}

export async function recordPhoneNumberTextingSyncDiagnostic(params: {
  phoneNumberId: string;
  clinicId?: string | null;
  providerStatus: string | null;
  providerErrorCode: string | null;
  providerErrorMessage: string | null;
}): Promise<void> {
  const sql = getDb();
  await sql`
    update public.clinic_phone_numbers set
      texting_provider_status = ${params.providerStatus},
      texting_provider_error_code = ${params.providerErrorCode},
      texting_provider_error_message = ${params.providerErrorMessage?.slice(0, 500) ?? null},
      texting_provider_synced_at = now()
    where id = ${params.phoneNumberId}
      and (${params.clinicId ?? null}::uuid is null or clinic_id = ${params.clinicId ?? null}::uuid)
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
      (clinic_id, phone_number, twilio_phone_number_sid, role, is_active,
       twilio_purchased_at, texting_status, texting_status_source,
       texting_status_updated_at)
    values
      (${params.clinicId}, ${params.phoneNumber}, ${params.twilioPhoneNumberSid},
       'office_texting', true, now(), 'waiting_for_approval',
       'assignment_default', now())
    on conflict (phone_number)
    do update set
      clinic_id = excluded.clinic_id,
      twilio_phone_number_sid = excluded.twilio_phone_number_sid,
      role = excluded.role,
      is_active = true,
      texting_status = 'waiting_for_approval',
      texting_status_source = 'assignment_default',
      texting_status_updated_at = now(),
      texting_provider_status = null,
      texting_provider_error_code = null,
      texting_provider_error_message = null,
      texting_provider_synced_at = null,
      -- Safe fallback billing anchor: keep an existing value, else stamp now().
      twilio_purchased_at = coalesce(public.clinic_phone_numbers.twilio_purchased_at, now()),
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
