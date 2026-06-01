import { getDb } from "../client";
import type { AuditEventInput, AuditEventRow, AuditListFilters } from "./types";

// Append-only writer for platform-admin actions. Callers must pass only
// redacted, non-secret snapshots in before/after/metadata.
export async function recordAdminAuditEvent(input: AuditEventInput): Promise<void> {
  const sql = getDb();
  await sql`
    insert into public.admin_audit_events
      (admin_user_id, admin_email, action, target_type, target_id, clinic_id,
       before_state, after_state, metadata)
    values (
      ${input.adminUserId ?? null},
      ${input.adminEmail},
      ${input.action},
      ${input.targetType},
      ${input.targetId ?? null},
      ${input.clinicId ?? null},
      ${input.beforeState ? sql.json(input.beforeState) : null},
      ${input.afterState ? sql.json(input.afterState) : null},
      ${input.metadata ? sql.json(input.metadata) : null}
    )
  `;
}

export async function listAdminAuditEvents(
  filters: AuditListFilters = {},
  limit = 200,
): Promise<AuditEventRow[]> {
  const sql = getDb();
  const adminEmail = filters.adminEmail?.trim().toLowerCase() || null;
  const clinicId = filters.clinicId || null;
  const action = filters.action?.trim() || null;
  const rows = await sql<AuditEventRow[]>`
    select id, admin_email, action, target_type, target_id, clinic_id,
           before_state, after_state, metadata, created_at
    from public.admin_audit_events
    where (${adminEmail}::text is null or admin_email = ${adminEmail})
      and (${clinicId}::uuid is null or clinic_id = ${clinicId}::uuid)
      and (${action}::text is null or action = ${action})
    order by created_at desc
    limit ${limit}
  `;
  return rows;
}
