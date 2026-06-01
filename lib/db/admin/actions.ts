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
