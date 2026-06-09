import { getDb } from "../client";

// Minimal admin write helpers. Each reads a before-snapshot, performs one
// targeted update, and returns before/after so the API route can write a
// redacted audit event. Clinic-scoped by id. Returns null if the clinic does
// not exist (treated as "not found" by the caller).

export type ClinicAdminSnapshot = {
  is_active: boolean;
  sms_recovery_enabled: boolean;
  admin_internal_note: string | null;
  admin_provisioning_status: string | null;
  admin_provisioning_note: string | null;
};

export type ActionResult = { before: ClinicAdminSnapshot; after: ClinicAdminSnapshot } | null;

async function readSnapshot(clinicId: string): Promise<ClinicAdminSnapshot | null> {
  const sql = getDb();
  const rows = await sql<ClinicAdminSnapshot[]>`
    select is_active, sms_recovery_enabled, admin_internal_note,
           admin_provisioning_status, admin_provisioning_note
    from public.clinics
    where id = ${clinicId}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function setClinicActive(clinicId: string, active: boolean): Promise<ActionResult> {
  const sql = getDb();
  const before = await readSnapshot(clinicId);
  if (!before) return null;
  const rows = await sql<ClinicAdminSnapshot[]>`
    update public.clinics set is_active = ${active}
    where id = ${clinicId}
    returning is_active, sms_recovery_enabled, admin_internal_note,
              admin_provisioning_status, admin_provisioning_note
  `;
  const after = rows[0];
  if (!after) return null;
  return { before, after };
}

export async function setSmsRecoveryEnabled(clinicId: string, enabled: boolean): Promise<ActionResult> {
  const sql = getDb();
  const before = await readSnapshot(clinicId);
  if (!before) return null;
  const rows = await sql<ClinicAdminSnapshot[]>`
    update public.clinics set sms_recovery_enabled = ${enabled}
    where id = ${clinicId}
    returning is_active, sms_recovery_enabled, admin_internal_note,
              admin_provisioning_status, admin_provisioning_note
  `;
  const after = rows[0];
  if (!after) return null;
  return { before, after };
}

export async function setAdminInternalNote(clinicId: string, note: string | null): Promise<ActionResult> {
  const sql = getDb();
  const before = await readSnapshot(clinicId);
  if (!before) return null;
  const rows = await sql<ClinicAdminSnapshot[]>`
    update public.clinics set admin_internal_note = ${note}
    where id = ${clinicId}
    returning is_active, sms_recovery_enabled, admin_internal_note,
              admin_provisioning_status, admin_provisioning_note
  `;
  const after = rows[0];
  if (!after) return null;
  return { before, after };
}

export async function setAdminProvisioning(
  clinicId: string,
  status: string,
  note: string | null,
): Promise<ActionResult> {
  const sql = getDb();
  const before = await readSnapshot(clinicId);
  if (!before) return null;
  const rows = await sql<ClinicAdminSnapshot[]>`
    update public.clinics
    set admin_provisioning_status = ${status}, admin_provisioning_note = ${note}
    where id = ${clinicId}
    returning is_active, sms_recovery_enabled, admin_internal_note,
              admin_provisioning_status, admin_provisioning_note
  `;
  const after = rows[0];
  if (!after) return null;
  return { before, after };
}

// ── Number purchase controls (clinic-level) ──────────────────────────────────

// Allow/revoke the clinic's permission to purchase NEW numbers. Revoke does NOT
// release any existing Twilio number — it only blocks new purchases.
export async function setNumberPurchasesEnabled(
  clinicId: string,
  enabled: boolean,
  reason: string | null,
): Promise<{ enabled: boolean } | null> {
  const sql = getDb();
  const rows = await sql<{ phone_number_purchases_enabled: boolean }[]>`
    update public.clinics set
      phone_number_purchases_enabled = ${enabled},
      phone_number_purchase_suspended_reason = ${enabled ? null : reason}
    where id = ${clinicId}
    returning phone_number_purchases_enabled
  `;
  const row = rows[0];
  return row ? { enabled: row.phone_number_purchases_enabled } : null;
}

// Held numbers = all clinic_phone_numbers rows (active OR suspended) + in-flight
// attempts that already hold a purchased Twilio number. Used to prevent lowering
// the limit below what the clinic already holds.
export async function countHeldNumbers(clinicId: string): Promise<number> {
  const sql = getDb();
  const rows = await sql<{ n: number }[]>`
    select (
      (select count(*) from public.clinic_phone_numbers
         where clinic_id = ${clinicId}
           and removal_status not in ('permanently_removed', 'detached'))
      + (select count(*) from public.clinic_phone_number_purchase_attempts
           where clinic_id = ${clinicId}
             and status in ('twilio_purchased', 'billing_pending', 'reconciliation_required'))
    )::int as n
  `;
  return rows[0]?.n ?? 0;
}

export async function setPhoneNumberLimit(
  clinicId: string,
  limit: number,
  adminProfileId: string | null,
): Promise<{ limit: number } | null> {
  const sql = getDb();
  const rows = await sql<{ phone_number_limit: number }[]>`
    update public.clinics set
      phone_number_limit = ${limit},
      phone_number_limit_updated_at = now(),
      phone_number_limit_updated_by_profile_id = ${adminProfileId}
    where id = ${clinicId}
    returning phone_number_limit
  `;
  const row = rows[0];
  return row ? { limit: row.phone_number_limit } : null;
}

// ── Per-number suspend / reactivate ──────────────────────────────────────────
// Suspend sets is_active=false but KEEPS the number (no Twilio release, no Stripe
// quantity change — suspended additional numbers stay billed and counted).

export type NumberSuspendResult = { phoneNumber: string; isActive: boolean } | null;

export async function suspendClinicPhoneNumber(
  clinicId: string,
  phoneNumberId: string,
  adminProfileId: string | null,
  reason: string | null,
): Promise<NumberSuspendResult> {
  const sql = getDb();
  const rows = await sql<{ phone_number: string; is_active: boolean }[]>`
    update public.clinic_phone_numbers set
      is_active = false,
      suspended_at = now(),
      suspended_by_profile_id = ${adminProfileId},
      suspension_reason = ${reason}
    where id = ${phoneNumberId} and clinic_id = ${clinicId}
    returning phone_number, is_active
  `;
  const row = rows[0];
  return row ? { phoneNumber: row.phone_number, isActive: row.is_active } : null;
}

export async function reactivateClinicPhoneNumber(
  clinicId: string,
  phoneNumberId: string,
): Promise<NumberSuspendResult> {
  const sql = getDb();
  const rows = await sql<{ phone_number: string; is_active: boolean }[]>`
    update public.clinic_phone_numbers set
      is_active = true,
      suspended_at = null,
      suspended_by_profile_id = null,
      suspension_reason = null
    where id = ${phoneNumberId} and clinic_id = ${clinicId}
    returning phone_number, is_active
  `;
  const row = rows[0];
  return row ? { phoneNumber: row.phone_number, isActive: row.is_active } : null;
}

// Mark an open legacy number request cancelled. No Stripe/Twilio side effect.
export async function dismissLegacyNumberRequest(
  clinicId: string,
  requestId: string,
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    update public.clinic_number_requests set status = 'cancelled', updated_at = now()
    where id = ${requestId} and clinic_id = ${clinicId} and status in ('pending', 'reviewed')
    returning id
  `;
  return rows.length > 0;
}
