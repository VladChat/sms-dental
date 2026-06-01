import { getDb } from "./client";
import {
  FRONT_DESK_OUTCOME_TO_STATUS,
  type FrontDeskOutcome,
} from "../workspace/outcome";

// Data access for the front-desk workspace (/workspace).
//
// Privacy / minimum-necessary: these queries select ONLY the columns the front
// desk needs to handle a patient request (phone, message direction/body,
// timestamps, conversation status, and the saved front-desk outcome/note). They
// deliberately never read raw webhook payloads, Twilio SIDs, error codes,
// clinic/owner identity, billing, or any compliance/setup fields. The only write
// is the clinic-scoped outcome save below.

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
  // Saved front-desk outcome (null until a result is recorded).
  frontDeskOutcome: FrontDeskOutcome | null;
  frontDeskNote: string | null;
  frontDeskOutcomeAt: Date | null;
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
      front_desk_outcome: string | null;
      front_desk_note: string | null;
      front_desk_outcome_at: Date | null;
    }[]
  >`
    select id, patient_phone, status, created_at, last_message_at,
           front_desk_outcome, front_desk_note, front_desk_outcome_at
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
    frontDeskOutcome: (c.front_desk_outcome as FrontDeskOutcome | null) ?? null,
    frontDeskNote: c.front_desk_note,
    frontDeskOutcomeAt: c.front_desk_outcome_at,
    messages: byConvo.get(c.id) ?? [],
  }));
}

export type SavedFrontDeskOutcome = {
  id: string;
  outcome: FrontDeskOutcome;
  note: string | null;
  outcomeAt: Date;
  status: string;
};

// Save a front-desk outcome + optional note for one conversation, and advance the
// conversation lifecycle status to match. Scoped by clinic_id in the WHERE clause:
// a conversation that does not belong to `clinicId` matches zero rows and returns
// null (caller treats that as "not found"). `note` should already be trimmed by
// the caller; pass null for an empty note.
export async function saveFrontDeskOutcome(params: {
  clinicId: string;
  conversationId: string;
  outcome: FrontDeskOutcome;
  note: string | null;
}): Promise<SavedFrontDeskOutcome | null> {
  const sql = getDb();
  const status = FRONT_DESK_OUTCOME_TO_STATUS[params.outcome];

  const rows = await sql<
    {
      id: string;
      front_desk_outcome: string;
      front_desk_note: string | null;
      front_desk_outcome_at: Date;
      status: string;
    }[]
  >`
    update public.patient_conversations
    set front_desk_outcome = ${params.outcome},
        front_desk_note = ${params.note},
        front_desk_outcome_at = now(),
        status = ${status}
    where id = ${params.conversationId}
      and clinic_id = ${params.clinicId}
    returning id, front_desk_outcome, front_desk_note, front_desk_outcome_at, status
  `;

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    outcome: row.front_desk_outcome as FrontDeskOutcome,
    note: row.front_desk_note,
    outcomeAt: row.front_desk_outcome_at,
    status: row.status,
  };
}
