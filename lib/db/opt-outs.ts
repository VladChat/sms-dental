import { getDb } from "./client";

// Record or refresh an opt-out for a (clinic, phone) pair.
// Safe to call multiple times — uses ON CONFLICT to keep one row per pair.
// Clears opted_back_in_at so a prior START cannot re-enable sends.
export async function upsertOptOut(
  clinicId: string,
  phoneNumber: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into public.opt_outs (clinic_id, phone_number, source, opted_out_at, opted_back_in_at)
    values (${clinicId}, ${phoneNumber}, 'sms_stop', now(), null)
    on conflict (clinic_id, phone_number)
    do update
      set opted_out_at     = now(),
          opted_back_in_at = null,
          updated_at       = now()
  `;
}

// Mark a (clinic, phone) pair as opted back in after a START message.
// If no opt-out row exists the phone was never opted out — that is fine,
// the UPDATE is a no-op and no error is raised.
export async function clearOptOut(
  clinicId: string,
  phoneNumber: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    update public.opt_outs
    set opted_back_in_at = now(),
        updated_at       = now()
    where clinic_id   = ${clinicId}
      and phone_number = ${phoneNumber}
  `;
}
