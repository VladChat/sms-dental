import { getDb } from "../client";
import type { AdminOverview } from "./types";

// Cross-tenant aggregate counts for the admin overview. Read-only.
export async function getAdminOverview(): Promise<AdminOverview> {
  const sql = getDb();

  const clinicRows = await sql<
    {
      total: string;
      active: string;
      inactive: string;
      sms_on: string;
      sms_off: string;
      need_action: string;
    }[]
  >`
    select
      count(*)::text as total,
      count(*) filter (where is_active)::text as active,
      count(*) filter (where not is_active)::text as inactive,
      count(*) filter (where sms_recovery_enabled)::text as sms_on,
      count(*) filter (where not sms_recovery_enabled)::text as sms_off,
      count(*) filter (where is_active and (business_info_completed = false or a2p_info_completed = false))::text as need_action
    from public.clinics
  `;
  const c = clinicRows[0];

  const numRows = await sql<{ with_num: string }[]>`
    select count(distinct clinic_id)::text as with_num
    from public.clinic_phone_numbers
    where is_active = true
  `;
  const callRows = await sql<{ n: string }[]>`
    select count(*)::text as n
    from public.call_events
    where occurred_at > now() - interval '7 days'
  `;
  const failRows = await sql<{ n: string }[]>`
    select count(*)::text as n
    from public.messages
    where created_at > now() - interval '7 days'
      and (status in ('failed', 'undelivered') or error_code is not null)
  `;

  const total = Number(c?.total ?? 0);
  const withNum = Number(numRows[0]?.with_num ?? 0);

  return {
    totalClinics: total,
    activeClinics: Number(c?.active ?? 0),
    inactiveClinics: Number(c?.inactive ?? 0),
    smsRecoveryEnabled: Number(c?.sms_on ?? 0),
    smsRecoveryDisabled: Number(c?.sms_off ?? 0),
    withAssignedNumber: withNum,
    withoutAssignedNumber: Math.max(0, total - withNum),
    recentCalls: Number(callRows[0]?.n ?? 0),
    recentMessageFailures: Number(failRows[0]?.n ?? 0),
    clinicsNeedingAction: Number(c?.need_action ?? 0),
  };
}
