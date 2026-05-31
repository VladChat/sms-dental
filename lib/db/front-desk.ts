import { getDb } from "./client";

// Read-only data access for the front-desk workspace (/workspace).
//
// Privacy / minimum-necessary: these queries select ONLY the columns the front
// desk needs to handle a patient request (phone, message direction/body,
// timestamps, conversation status). They deliberately never read raw webhook
// payloads, Twilio SIDs, error codes, clinic/owner identity, billing, or any
// compliance/setup fields. This module performs no writes.

export type FrontDeskMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  detectedKeyword: "stop" | "start" | "help" | null;
  createdAt: Date;
};

export type FrontDeskConversation = {
  id: string;
  patientPhone: string;
  // Raw conversation lifecycle status from the DB: open | closed | booked | lost.
  dbStatus: string;
  createdAt: Date;
  lastMessageAt: Date | null;
  messages: FrontDeskMessage[];
};

// List a clinic's patient conversations (most recently active first) with their
// message timelines. Two queries (conversations, then their messages) grouped in
// memory — fine for MVP volume and avoids per-row round-trips.
export async function listClinicConversations(
  clinicId: string,
  limit = 100,
): Promise<FrontDeskConversation[]> {
  const sql = getDb();

  const convos = await sql<
    {
      id: string;
      patient_phone: string;
      status: string;
      created_at: Date;
      last_message_at: Date | null;
    }[]
  >`
    select id, patient_phone, status, created_at, last_message_at
    from public.patient_conversations
    where clinic_id = ${clinicId}
    order by coalesce(last_message_at, created_at) desc
    limit ${limit}
  `;
  if (convos.length === 0) return [];

  const ids = convos.map((c) => c.id);
  const msgs = await sql<
    {
      id: string;
      conversation_id: string;
      direction: "inbound" | "outbound";
      body: string | null;
      detected_keyword: "stop" | "start" | "help" | null;
      created_at: Date;
    }[]
  >`
    select id, conversation_id, direction, body, detected_keyword, created_at
    from public.messages
    where clinic_id = ${clinicId}
      and conversation_id in ${sql(ids)}
    order by created_at asc
    limit 2000
  `;

  const byConvo = new Map<string, FrontDeskMessage[]>();
  for (const m of msgs) {
    const list = byConvo.get(m.conversation_id) ?? [];
    list.push({
      id: m.id,
      direction: m.direction,
      body: m.body ?? "",
      detectedKeyword: m.detected_keyword,
      createdAt: m.created_at,
    });
    byConvo.set(m.conversation_id, list);
  }

  return convos.map((c) => ({
    id: c.id,
    patientPhone: c.patient_phone,
    dbStatus: c.status,
    createdAt: c.created_at,
    lastMessageAt: c.last_message_at,
    messages: byConvo.get(c.id) ?? [],
  }));
}
