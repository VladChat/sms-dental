import { getDb } from "./client";

export type UpsertCallEventInput = {
  clinicId: string | null;
  callSid: string;
  fromNumber: string;
  toNumber: string;
  callStatus: string;
  direction: string;
  isMissed: boolean;
  rawPayload: unknown;
};

// Idempotent upsert keyed on twilio_call_sid. On conflict, refreshes
// call_status and raw_payload so later status callbacks keep the row current.
export async function upsertCallEvent(
  input: UpsertCallEventInput,
): Promise<{ id: string }> {
  const sql = getDb();
  const rawJson = JSON.stringify(input.rawPayload ?? null);
  const rows = await sql<{ id: string }[]>`
    insert into public.call_events
      (clinic_id, twilio_call_sid, from_number, to_number,
       call_status, direction, is_missed, raw_payload)
    values (
      ${input.clinicId},
      ${input.callSid},
      ${input.fromNumber},
      ${input.toNumber},
      ${input.callStatus},
      ${input.direction},
      ${input.isMissed},
      ${rawJson}::jsonb
    )
    on conflict (twilio_call_sid) do update
      set call_status = excluded.call_status,
          raw_payload  = excluded.raw_payload,
          updated_at   = now()
    returning id
  `;
  const row = rows[0];
  if (!row) throw new Error("call_events upsert returned no row");
  return { id: row.id };
}
