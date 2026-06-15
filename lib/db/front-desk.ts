import { getDb } from "./client";
import {
  FRONT_DESK_OUTCOME_TO_STATUS,
  type FrontDeskOutcome,
} from "../workspace/outcome";
import { listLatestAiVoiceSessionsForConversations } from "./ai-voice-sessions";
import type { AiVoiceSessionStatus } from "../../config/ai-answering.config";
import type { WorkspaceFreshnessSnapshot } from "../workspace/freshness";

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
  // Safely collected patient display name (volunteered by the patient), if any.
  patientDisplayName: string | null;
  // Raw conversation lifecycle status from the DB: open | closed | booked | lost.
  dbStatus: string;
  createdAt: Date;
  lastMessageAt: Date | null;
  // Saved front-desk outcome (null until a result is recorded).
  frontDeskOutcome: FrontDeskOutcome | null;
  frontDeskNote: string | null;
  frontDeskOutcomeAt: Date | null;
  // Safety / anti-spam signals (front-desk-safe; no SIDs or payloads).
  smsSafetyNoticeSentAt: Date | null;
  automationMutedUntil: Date | null;
  highVolumeFlaggedAt: Date | null;
  unansweredAfterAutomationCount: number;
  // Workspace queue state.
  workspaceArchivedAt: Date | null;
  workspaceHandledAt: Date | null;
  // Clinic-scoped PATIENT number block (never the clinic's Twilio number).
  isBlocked: boolean;
  blockedAt: Date | null;
  messages: FrontDeskMessage[];
  // Latest AI answered call session for this conversation, when present. Safe
  // captured fields only (never providers, SIDs, transcripts, or audio). Null
  // for ordinary SMS-only conversations and whenever the ai_voice_sessions table
  // is not applied yet (degradation-safe).
  aiVoiceSessionId: string | null;
  aiVoiceStatus: AiVoiceSessionStatus | null;
  aiVoiceCompletedAt: Date | null;
  aiVoiceCreatedAt: Date | null;
  aiVoiceSummaryHeadline: string | null;
  aiVoiceCapturedName: string | null;
  aiVoiceCapturedReason: string | null;
  aiVoiceCapturedPreferredTime: string | null;
  aiVoiceSafetySignal: boolean;
  aiVoiceHandoffNote: string | null;
};

// List a clinic's patient conversations (most recently active first) with their
// message timelines. Two queries (conversations, then their messages) grouped in
// memory — fine for MVP volume and avoids per-row round-trips. The left join on
// clinic_blocked_patient_numbers marks conversations whose PATIENT number is
// blocked for this clinic.
export async function listClinicConversations(
  clinicId: string,
  limit = 100,
): Promise<FrontDeskConversation[]> {
  const sql = getDb();

  const convos = await sql<
    {
      id: string;
      patient_phone: string;
      patient_display_name: string | null;
      status: string;
      created_at: Date;
      last_message_at: Date | null;
      front_desk_outcome: string | null;
      front_desk_note: string | null;
      front_desk_outcome_at: Date | null;
      sms_safety_notice_sent_at: Date | null;
      automation_muted_until: Date | null;
      high_volume_flagged_at: Date | null;
      unanswered_after_automation_count: number;
      workspace_archived_at: Date | null;
      workspace_handled_at: Date | null;
      blocked_at: Date | null;
    }[]
  >`
    select c.id, c.patient_phone, c.patient_display_name, c.status, c.created_at,
           c.last_message_at, c.front_desk_outcome, c.front_desk_note,
           c.front_desk_outcome_at, c.sms_safety_notice_sent_at,
           c.automation_muted_until, c.high_volume_flagged_at,
           c.unanswered_after_automation_count,
           c.workspace_archived_at, c.workspace_handled_at,
           b.blocked_at
    from public.patient_conversations c
    left join public.clinic_blocked_patient_numbers b
      on b.clinic_id = c.clinic_id
     and b.phone_number = c.patient_phone
    where c.clinic_id = ${clinicId}
    order by coalesce(c.last_message_at, c.created_at) desc
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

  // Latest AI answered call session per conversation. Degradation-safe: returns
  // an empty map when the ai_voice_sessions table is missing, so SMS-only
  // workspaces render exactly as before.
  const aiByConvo = await listLatestAiVoiceSessionsForConversations(clinicId, ids);

  return convos.map((c) => {
    const ai = aiByConvo.get(c.id) ?? null;
    return {
    id: c.id,
    patientPhone: c.patient_phone,
    patientDisplayName: c.patient_display_name,
    dbStatus: c.status,
    createdAt: c.created_at,
    lastMessageAt: c.last_message_at,
    frontDeskOutcome: (c.front_desk_outcome as FrontDeskOutcome | null) ?? null,
    frontDeskNote: c.front_desk_note,
    frontDeskOutcomeAt: c.front_desk_outcome_at,
    smsSafetyNoticeSentAt: c.sms_safety_notice_sent_at,
    automationMutedUntil: c.automation_muted_until,
    highVolumeFlaggedAt: c.high_volume_flagged_at,
    unansweredAfterAutomationCount: c.unanswered_after_automation_count ?? 0,
    workspaceArchivedAt: c.workspace_archived_at,
    workspaceHandledAt: c.workspace_handled_at,
    isBlocked: c.blocked_at !== null,
    blockedAt: c.blocked_at,
    messages: byConvo.get(c.id) ?? [],
    aiVoiceSessionId: ai?.id ?? null,
    aiVoiceStatus: ai?.status ?? null,
    aiVoiceCompletedAt: ai?.completedAt ?? null,
    aiVoiceCreatedAt: ai?.createdAt ?? null,
    aiVoiceSummaryHeadline: ai?.summaryHeadline ?? null,
    aiVoiceCapturedName: ai?.capturedPatientName ?? null,
    aiVoiceCapturedReason: ai?.capturedReason ?? null,
    aiVoiceCapturedPreferredTime: ai?.capturedPreferredTime ?? null,
    aiVoiceSafetySignal: ai?.safetySignal ?? false,
    aiVoiceHandoffNote: ai?.handoffNote ?? null,
    };
  });
}

// Small polling read for /workspace. It intentionally returns counters and one
// activity version only, not full cards or message/AI-call history. AI answered
// calls touch `patient_conversations.last_message_at`, so the same activity
// version covers SMS and AI answered call changes without polling every table.
export async function getWorkspaceFreshnessSnapshot(params: {
  clinicId: string;
  since?: Date | null;
}): Promise<WorkspaceFreshnessSnapshot> {
  const sql = getDb();
  const since = params.since ?? null;
  const rows = await sql<
    {
      latest_activity_at: Date | null;
      needs_follow_up_count: string;
      handled_count: string;
      blocked_count: string;
      changed_count: string;
    }[]
  >`
    with base as (
      select
        c.id,
        greatest(
          c.created_at,
          coalesce(c.last_message_at, c.created_at),
          coalesce(c.workspace_handled_at, c.created_at),
          coalesce(c.workspace_archived_at, c.created_at),
          coalesce(c.front_desk_outcome_at, c.created_at),
          coalesce(b.blocked_at, c.created_at)
        ) as activity_at,
        (b.blocked_at is not null) as is_blocked,
        (c.workspace_handled_at is not null) as is_handled
      from public.patient_conversations c
      left join public.clinic_blocked_patient_numbers b
        on b.clinic_id = c.clinic_id
       and b.phone_number = c.patient_phone
      where c.clinic_id = ${params.clinicId}
    )
    select
      max(activity_at) as latest_activity_at,
      count(*) filter (where not is_blocked and not is_handled)::text as needs_follow_up_count,
      count(*) filter (where is_handled and not is_blocked)::text as handled_count,
      count(*) filter (where is_blocked)::text as blocked_count,
      count(*) filter (
        where ${since}::timestamptz is not null
          and activity_at > ${since}::timestamptz
      )::text as changed_count
    from base
  `;
  const row = rows[0];
  return {
    latestActivityAt: row?.latest_activity_at?.toISOString() ?? null,
    needsFollowUpCount: Number(row?.needs_follow_up_count ?? 0),
    handledCount: Number(row?.handled_count ?? 0),
    blockedCount: Number(row?.blocked_count ?? 0),
    changedCount: Number(row?.changed_count ?? 0),
  };
}

export type WorkspaceActor = {
  profileId: string | null;
  email: string | null;
};

// Find one conversation's id + patient phone, clinic-scoped. Returns null when
// the conversation does not belong to the clinic (callers treat as not found —
// never reveal cross-clinic existence).
export async function findClinicConversationPhone(
  clinicId: string,
  conversationId: string,
): Promise<{ id: string; patientPhone: string } | null> {
  const sql = getDb();
  const rows = await sql<{ id: string; patient_phone: string }[]>`
    select id, patient_phone
    from public.patient_conversations
    where id = ${conversationId}
      and clinic_id = ${clinicId}
    limit 1
  `;
  const row = rows[0];
  return row ? { id: row.id, patientPhone: row.patient_phone } : null;
}

// Save ONLY the internal staff note (no outcome required). Empty note clears it.
export async function saveFrontDeskNote(params: {
  clinicId: string;
  conversationId: string;
  note: string | null;
}): Promise<{ note: string | null } | null> {
  const sql = getDb();
  const rows = await sql<{ front_desk_note: string | null }[]>`
    update public.patient_conversations
    set front_desk_note = ${params.note},
        updated_at = now()
    where id = ${params.conversationId}
      and clinic_id = ${params.clinicId}
    returning front_desk_note
  `;
  const row = rows[0];
  return row ? { note: row.front_desk_note } : null;
}

// Archive = hide from the active workspace queue. Reversible; deletes nothing.
export async function archiveConversation(params: {
  clinicId: string;
  conversationId: string;
  actor: WorkspaceActor;
}): Promise<{ archivedAt: Date } | null> {
  const sql = getDb();
  const rows = await sql<{ workspace_archived_at: Date }[]>`
    update public.patient_conversations
    set workspace_archived_at = coalesce(workspace_archived_at, now()),
        workspace_archived_by_profile_id = coalesce(workspace_archived_by_profile_id, ${params.actor.profileId}),
        workspace_archived_by_email = coalesce(workspace_archived_by_email, ${params.actor.email}),
        updated_at = now()
    where id = ${params.conversationId}
      and clinic_id = ${params.clinicId}
    returning workspace_archived_at
  `;
  const row = rows[0];
  return row ? { archivedAt: row.workspace_archived_at } : null;
}

// Reopen = put a handled/archived conversation back in the active queue.
// Clears BOTH workspace states plus the saved appointment outcome (and resets
// the lifecycle status to open) so a reopened request never shows a stale
// booked / no-appointment state in Active. Nothing is deleted.
export async function reopenConversation(params: {
  clinicId: string;
  conversationId: string;
}): Promise<{ reopened: true } | null> {
  const sql = getDb();
  const rows = await sql<{ id: string }[]>`
    update public.patient_conversations
    set workspace_archived_at = null,
        workspace_archived_by_profile_id = null,
        workspace_archived_by_email = null,
        workspace_handled_at = null,
        workspace_handled_by_profile_id = null,
        workspace_handled_by_email = null,
        front_desk_outcome = null,
        front_desk_outcome_at = null,
        status = 'open',
        updated_at = now()
    where id = ${params.conversationId}
      and clinic_id = ${params.clinicId}
    returning id
  `;
  return rows[0] ? { reopened: true } : null;
}

// Mark handled: stamps the workspace handled state AND records whether an
// appointment was booked (front_desk_outcome + lifecycle status). Handled is
// its own queue section — this does not archive.
export async function markConversationHandled(params: {
  clinicId: string;
  conversationId: string;
  appointmentBooked: boolean;
  actor: WorkspaceActor;
}): Promise<{ handledAt: Date; outcome: FrontDeskOutcome } | null> {
  const sql = getDb();
  const outcome: FrontDeskOutcome = params.appointmentBooked
    ? "appointment_booked"
    : "no_appointment_booked";
  const status = FRONT_DESK_OUTCOME_TO_STATUS[outcome];
  const rows = await sql<{ workspace_handled_at: Date; front_desk_outcome: string }[]>`
    update public.patient_conversations
    set workspace_handled_at = coalesce(workspace_handled_at, now()),
        workspace_handled_by_profile_id = coalesce(workspace_handled_by_profile_id, ${params.actor.profileId}),
        workspace_handled_by_email = coalesce(workspace_handled_by_email, ${params.actor.email}),
        front_desk_outcome = ${outcome},
        front_desk_outcome_at = now(),
        status = ${status},
        updated_at = now()
    where id = ${params.conversationId}
      and clinic_id = ${params.clinicId}
    returning workspace_handled_at, front_desk_outcome
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    handledAt: row.workspace_handled_at,
    outcome: row.front_desk_outcome as FrontDeskOutcome,
  };
}

// Save a staff-edited patient display name. Pass null to clear the name back
// to "Not provided". The caller validates the name (conservative fail-closed
// rules) before this write; this helper only persists clinic-scoped.
export async function saveWorkspacePatientName(params: {
  clinicId: string;
  conversationId: string;
  name: string | null;
}): Promise<{ name: string | null } | null> {
  const sql = getDb();
  const rows = await sql<{ patient_display_name: string | null }[]>`
    update public.patient_conversations
    set patient_display_name = ${params.name},
        updated_at = now()
    where id = ${params.conversationId}
      and clinic_id = ${params.clinicId}
    returning patient_display_name
  `;
  const row = rows[0];
  return row ? { name: row.patient_display_name } : null;
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
