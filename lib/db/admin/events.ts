import { getDb } from "../client";
import {
  maskPhone,
  tailSid,
  type AdminCallEvent,
  type AdminClinicEvents,
  type AdminMessageEvent,
} from "./types";

// Clinic-scoped diagnostics. webhook_events has no clinic_id (global ingress
// log), so per-clinic diagnostics come from call_events + messages, which both
// carry clinic_id and the voice/SMS status + error fields. All phone numbers are
// masked and Twilio SIDs are shown as a short tail only; no raw payloads.
export async function getClinicEvents(
  clinicId: string,
  limit = 25,
): Promise<AdminClinicEvents> {
  const sql = getDb();

  const callRows = await sql<
    {
      id: string;
      from_number: string | null;
      to_number: string | null;
      call_status: string | null;
      direction: string | null;
      is_missed: boolean | null;
      twilio_call_sid: string | null;
      occurred_at: Date;
    }[]
  >`
    select id, from_number, to_number, call_status, direction, is_missed,
           twilio_call_sid, occurred_at
    from public.call_events
    where clinic_id = ${clinicId}
    order by occurred_at desc
    limit ${limit}
  `;

  const msgRows = await sql<
    {
      id: string;
      direction: string;
      status: string | null;
      detected_keyword: string | null;
      error_code: string | null;
      twilio_message_sid: string | null;
      created_at: Date;
    }[]
  >`
    select id, direction, status, detected_keyword, error_code,
           twilio_message_sid, created_at
    from public.messages
    where clinic_id = ${clinicId}
    order by created_at desc
    limit ${limit}
  `;

  const calls: AdminCallEvent[] = callRows.map((r) => ({
    id: r.id,
    fromMasked: maskPhone(r.from_number),
    toMasked: maskPhone(r.to_number),
    callStatus: r.call_status,
    direction: r.direction,
    isMissed: r.is_missed,
    sidTail: tailSid(r.twilio_call_sid),
    occurredAt: r.occurred_at.toISOString(),
  }));

  const messages: AdminMessageEvent[] = msgRows.map((r) => ({
    id: r.id,
    direction: r.direction,
    status: r.status,
    detectedKeyword: r.detected_keyword,
    errored:
      Boolean(r.error_code) ||
      r.status === "failed" ||
      r.status === "undelivered",
    sidTail: tailSid(r.twilio_message_sid),
    createdAt: r.created_at.toISOString(),
  }));

  return { calls, messages };
}
