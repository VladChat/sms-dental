import { getDb } from "./client";
import { shouldApplyMessageStatusTransition } from "../sms-recovery/message-status";

// Stable, non-secret classifier for a message row. Existing rows are null and
// are treated by direction (inbound = inbound, outbound = recovery).
export type MessageKind =
  | "missed_call_recovery"
  | "conversation_auto_reply"
  | "manual"
  | "inbound";

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
       from_number, to_number, body, status, detected_keyword, message_kind, raw_payload, sent_at)
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
      'inbound',
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
  // Defaults to 'missed_call_recovery' for backward-compatible behavior.
  messageKind?: MessageKind;
};

// Returns true when a missed-call RECOVERY outbound to this (clinic, toNumber)
// pair already exists within the given window. Auto-replies
// (message_kind='conversation_auto_reply') are intentionally excluded so they
// never affect recovery duplicate suppression. Legacy rows (null message_kind)
// are counted as recovery — preserving existing behavior for existing data.
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
      and (message_kind is null or message_kind = 'missed_call_recovery')
      and created_at >= ${since.toISOString()}
    limit 1
  `;
  return parseInt(rows[0]?.cnt ?? "0", 10) > 0;
}

// True when the conversation already has a missed-call recovery outbound. The
// auto-reply flow only runs inside an existing recovery thread. Legacy null
// message_kind outbounds count as recovery.
export async function hasPriorRecoveryOutbound(
  conversationId: string,
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql<{ cnt: string }[]>`
    select count(*) as cnt
    from public.messages
    where conversation_id = ${conversationId}
      and direction = 'outbound'
      and (message_kind is null or message_kind = 'missed_call_recovery')
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
  const messageKind = input.messageKind ?? "missed_call_recovery";
  const rows = await sql<{ id: string }[]>`
    insert into public.messages
      (clinic_id, conversation_id, direction, twilio_message_sid,
       from_number, to_number, body, status, message_kind, raw_payload, sent_at)
    values (
      ${input.clinicId},
      ${input.conversationId},
      'outbound',
      ${input.twilioMessageSid},
      ${input.fromNumber},
      ${input.toNumber},
      ${input.body},
      ${input.status},
      ${messageKind},
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

export type UpdateOutboundMessageStatusInput = {
  twilioMessageSid: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type UpdateOutboundMessageStatusResult =
  | { found: false; updated: false }
  | { found: true; updated: boolean };

// Apply a Twilio delivery status callback to the matching outbound message row.
// Idempotent: Twilio may send the same status multiple times, and statuses may
// arrive out of order — a later "sent" never overwrites "delivered". Returns
// found:false when no outbound row matches the MessageSid (callers log and ack;
// never throw back to Twilio).
export async function updateOutboundMessageStatus(
  input: UpdateOutboundMessageStatusInput,
): Promise<UpdateOutboundMessageStatusResult> {
  const sql = getDb();
  const rows = await sql<{ id: string; status: string | null }[]>`
    select id, status
    from public.messages
    where twilio_message_sid = ${input.twilioMessageSid}
      and direction = 'outbound'
    limit 1
  `;
  const current = rows[0];
  if (!current) return { found: false, updated: false };

  if (!shouldApplyMessageStatusTransition(current.status, input.status)) {
    return { found: true, updated: false };
  }

  // The WHERE clause repeats the id + prior status so a concurrent callback that
  // already advanced the row further leaves this update a harmless no-op.
  const updated = await sql<{ id: string }[]>`
    update public.messages set
      status = ${input.status},
      error_code = coalesce(${input.errorCode ?? null}, error_code),
      error_message = coalesce(${input.errorMessage?.slice(0, 500) ?? null}, error_message),
      updated_at = now()
    where id = ${current.id}
      and status is not distinct from ${current.status}
    returning id
  `;
  return { found: true, updated: updated.length > 0 };
}
