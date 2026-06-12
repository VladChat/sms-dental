import { getDb } from "./client";

// Clinic-scoped PATIENT/CALLER phone number blocks.
//
// IMPORTANT terminology: "block number" blocks the patient's phone number for
// ONE clinic. It never releases, deletes, or changes the clinic's own Twilio
// business number, never mutates Twilio, and never deletes message history.
// A block suppresses future AUTOMATION (initial recovery SMS, follow-ups,
// thanks courtesy, safety prefix) to that patient number for that clinic only.
// Inbound messages are still recorded for audit/context, and STOP/START/HELP
// compliance handling is untouched. Blocks are an operator action and are
// intentionally separate from carrier opt-outs (public.opt_outs).

export type PatientNumberBlock = {
  phoneNumber: string;
  blockedAt: Date;
  reason: string | null;
};

// True when the patient phone is blocked for this clinic. Fails CLOSED for
// automation callers: any DB error should be handled by the caller as "do not
// send" only if they choose; this helper itself just reports the row.
export async function isPatientNumberBlocked(
  clinicId: string,
  phoneNumber: string,
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    select id
    from public.clinic_blocked_patient_numbers
    where clinic_id = ${clinicId}
      and phone_number = ${phoneNumber}
    limit 1
  `;
  return rows.length > 0;
}

// Idempotent: blocking an already-blocked number keeps the original row.
export async function blockPatientNumberForClinic(params: {
  clinicId: string;
  phoneNumber: string;
  blockedByProfileId: string | null;
  blockedByEmail: string | null;
  reason?: string | null;
  sourceConversationId?: string | null;
}): Promise<{ blockedAt: Date }> {
  const sql = getDb();
  const rows = await sql<{ blocked_at: Date }[]>`
    with ins as (
      insert into public.clinic_blocked_patient_numbers
        (clinic_id, phone_number, blocked_by_profile_id, blocked_by_email,
         reason, source_conversation_id)
      values (${params.clinicId}, ${params.phoneNumber},
              ${params.blockedByProfileId}, ${params.blockedByEmail},
              ${params.reason ?? null}, ${params.sourceConversationId ?? null})
      on conflict (clinic_id, phone_number) do nothing
      returning blocked_at
    )
    select blocked_at from ins
    union all
    select blocked_at from public.clinic_blocked_patient_numbers
    where clinic_id = ${params.clinicId}
      and phone_number = ${params.phoneNumber}
      and not exists (select 1 from ins)
    limit 1
  `;
  return { blockedAt: rows[0]?.blocked_at ?? new Date() };
}

// Removes the clinic-scoped block. Never sends SMS and never reopens the
// conversation by itself — staff reopen explicitly if they want it active.
export async function unblockPatientNumberForClinic(
  clinicId: string,
  phoneNumber: string,
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    delete from public.clinic_blocked_patient_numbers
    where clinic_id = ${clinicId}
      and phone_number = ${phoneNumber}
    returning id
  `;
  return rows.length > 0;
}
