import { getDb } from "./client";

// Find or create the conversation thread for a (clinic, patient) pair.
// Uses the unique index on (clinic_id, patient_phone) for idempotency.
export async function getOrCreateConversation(
  clinicId: string,
  patientPhone: string,
): Promise<{ id: string; created: boolean }> {
  const sql = getDb();
  const rows = await sql<{ id: string; inserted: boolean }[]>`
    with ins as (
      insert into public.patient_conversations (clinic_id, patient_phone)
      values (${clinicId}, ${patientPhone})
      on conflict (clinic_id, patient_phone) do nothing
      returning id
    )
    select id, true as inserted from ins
    union all
    select id, false as inserted from public.patient_conversations
    where clinic_id   = ${clinicId}
      and patient_phone = ${patientPhone}
      and not exists (select 1 from ins)
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("patient_conversations get-or-create returned no row");
  return { id: row.id, created: row.inserted };
}

export async function touchConversation(conversationId: string): Promise<void> {
  const sql = getDb();
  await sql`
    update public.patient_conversations
    set last_message_at = now(),
        updated_at      = now()
    where id = ${conversationId}
  `;
}

// Start a fresh deterministic auto-reply cycle after a new missed-call
// recovery SMS is accepted and recorded. Keep the safely collected display name
// so future follow-ups can still address the patient naturally.
export async function resetConversationAutoReplyCycle(conversationId: string): Promise<void> {
  const sql = getDb();
  await sql`
    update public.patient_conversations
    set sms_auto_reply_count = 0,
        sms_auto_reply_last_sent_at = null,
        updated_at = now()
    where id = ${conversationId}
  `;
}

export type ConversationAutoReplyState = {
  patientDisplayName: string | null;
  smsAutoReplyCount: number;
};

// Read the conversation state the auto-reply decision needs.
export async function getConversationAutoReplyState(
  conversationId: string,
): Promise<ConversationAutoReplyState | null> {
  const sql = getDb();
  const rows = await sql<{ patient_display_name: string | null; sms_auto_reply_count: number }[]>`
    select patient_display_name, sms_auto_reply_count
    from public.patient_conversations
    where id = ${conversationId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    patientDisplayName: row.patient_display_name,
    smsAutoReplyCount: row.sms_auto_reply_count ?? 0,
  };
}

// Store a safely-extracted patient display name ONLY when none is set yet.
// Never overwrites an existing name. Returns the stored name, or null when
// nothing was written (already set, or input empty).
export async function setPatientDisplayNameIfEmpty(
  conversationId: string,
  displayName: string,
): Promise<string | null> {
  const name = displayName.trim();
  if (name.length === 0 || name.length > 80) return null;
  const sql = getDb();
  const rows = await sql<{ patient_display_name: string | null }[]>`
    update public.patient_conversations
    set patient_display_name = ${name},
        updated_at = now()
    where id = ${conversationId}
      and (patient_display_name is null or patient_display_name = '')
    returning patient_display_name
  `;
  return rows[0]?.patient_display_name ?? null;
}

// Atomically claim the next auto-reply slot. Uses an optimistic compare on the
// current count so concurrent webhook deliveries (or retries) can never claim
// the same slot twice. Returns the claimed sequence (the new count) or null
// when the expected count no longer matches (already advanced).
export async function claimAutoReplySlot(
  conversationId: string,
  expectedCount: number,
): Promise<number | null> {
  return claimAutoReplySequence(conversationId, expectedCount, expectedCount + 1);
}

// Atomically claim a specific auto-reply sequence. This is used when sequence 1
// is skipped because a patient name is already known and the flow sends
// sequence 2 as the first automated follow-up.
export async function claimAutoReplySequence(
  conversationId: string,
  expectedCount: number,
  sequence: number,
): Promise<number | null> {
  if (!Number.isInteger(sequence) || sequence <= expectedCount) return null;
  const sql = getDb();
  const rows = await sql<{ sms_auto_reply_count: number }[]>`
    update public.patient_conversations
    set sms_auto_reply_count = ${sequence},
        sms_auto_reply_last_sent_at = now(),
        updated_at = now()
    where id = ${conversationId}
      and sms_auto_reply_count = ${expectedCount}
    returning sms_auto_reply_count
  `;
  return rows[0]?.sms_auto_reply_count ?? null;
}
