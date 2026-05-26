import { getDb } from "./client";

export type RecordInboundMessageInput = {
  clinicId: string;
  conversationId: string | null;
  twilioMessageSid: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  status: string;
  detectedKeyword: "stop" | "start" | "help" | null;
  rawPayload: unknown;
};

// Idempotent insert for an inbound SMS. Returns duplicate:true when the
// MessageSid is already recorded (e.g. a Twilio retry) — callers can skip
// further processing in that case.
export async function recordInboundMessage(
  input: RecordInboundMessageInput,
): Promise<{ id: string; duplicate: boolean }> {
  const sql = getDb();
  const rawJson = JSON.stringify(input.rawPayload ?? null);
  const rows = await sql<{ id: string }[]>`
    insert into public.messages
      (clinic_id, conversation_id, direction, twilio_message_sid,
       from_number, to_number, body, status, detected_keyword, raw_payload, sent_at)
    values (
      ${input.clinicId},
      ${input.conversationId},
      'inbound',
      ${input.twilioMessageSid},
      ${input.fromNumber},
      ${input.toNumber},
      ${input.body},
      ${input.status},
      ${input.detectedKeyword},
      ${rawJson}::jsonb,
      now()
    )
    on conflict (twilio_message_sid) do nothing
    returning id
  `;
  if (!rows[0]) return { id: "", duplicate: true };
  return { id: rows[0].id, duplicate: false };
}

export type RecordOutboundMessageInput = {
  clinicId: string;
  conversationId: string | null;
  twilioMessageSid: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  status: string;
  rawPayload: unknown;
};

// Returns true when an outbound message to this (clinic, toNumber) pair
// already exists within the given window. Prevents duplicate recovery SMS.
export async function hasSentRecoverySmsSince(
  clinicId: string,
  toNumber: string,
  since: Date,
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql<{ cnt: string }[]>`
    select count(*) as cnt
    from public.messages
    where clinic_id   = ${clinicId}
      and to_number   = ${toNumber}
      and direction   = 'outbound'
      and created_at >= ${since.toISOString()}
    limit 1
  `;
  return parseInt(rows[0]?.cnt ?? "0", 10) > 0;
}

// Idempotent insert keyed on twilio_message_sid. Safe to call on retry.
export async function recordOutboundMessage(
  input: RecordOutboundMessageInput,
): Promise<{ id: string }> {
  const sql = getDb();
  const rawJson = JSON.stringify(input.rawPayload ?? null);
  const rows = await sql<{ id: string }[]>`
    insert into public.messages
      (clinic_id, conversation_id, direction, twilio_message_sid,
       from_number, to_number, body, status, raw_payload, sent_at)
    values (
      ${input.clinicId},
      ${input.conversationId},
      'outbound',
      ${input.twilioMessageSid},
      ${input.fromNumber},
      ${input.toNumber},
      ${input.body},
      ${input.status},
      ${rawJson}::jsonb,
      now()
    )
    on conflict (twilio_message_sid) do nothing
    returning id
  `;
  const row = rows[0];
  if (!row) throw new Error("messages insert returned no row");
  return { id: row.id };
}
