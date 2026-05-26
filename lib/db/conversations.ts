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
