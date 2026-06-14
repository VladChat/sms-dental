import { getDb } from "./client";
import {
  getOrCreateConversation,
  setPatientDisplayNameIfEmpty,
  touchConversation,
} from "./conversations";
import {
  AiAnsweringUnavailableError,
  AiVoiceSessionValidationError,
  isUndefinedTableError,
  trimToLimit,
} from "./ai-voice-sessions";
import { normalizeWorkspaceDisplayName } from "../workspace/display-name";
import { normalizePhone, isValidE164 } from "../phone/normalize";
import { buildAiVoiceCallSummary } from "../workspace/ai-voice-summary";
import { logger } from "../logging/logger";
import {
  AI_VOICE_FIELD_LIMITS,
  isAiVoiceSessionStatus,
  type AiVoiceSessionStatus,
} from "../../config/ai-answering.config";

// Provider-agnostic AI voice session lifecycle (SKELETON for a future runtime).
//
// These helpers write to the existing `ai_voice_sessions` table using the
// reserved `future_twilio` source. They are NOT called by any live webhook in
// this task — they exist so a future real runtime can start/complete/fail a
// session with the same safety guarantees as the platform-admin mock route:
//
//   - no provider calls (no Twilio client, no OpenAI),
//   - no SMS sent and no SMS-recovery decision touched,
//   - no transcripts, audio recordings, raw provider payloads, or raw AI
//     prompt/response bodies stored — only the narrow captured request
//     (name/reason/preferred time/handoff note/safety flag),
//   - the SAME length limits + label-like placeholder cleanup as mock sessions
//     (shared via trimToLimit from ai-voice-sessions.ts so they never drift),
//   - degradation-safe: a missing table surfaces AiAnsweringUnavailableError.

// The only source these helpers ever write. `mock` belongs to the admin route.
export const AI_VOICE_RUNTIME_SOURCE = "future_twilio" as const;

// --------------------------------------------------------- pure validation

export type RuntimeSessionPhones = { patientPhone: string; clinicPhone: string | null };

// Normalize + validate the call's phone numbers. Pure (no DB). Throws
// AiVoiceSessionValidationError for an invalid/missing caller or clinic phone.
export function normalizeRuntimeSessionPhones(input: {
  patientPhone: string;
  clinicPhone?: string | null;
}): RuntimeSessionPhones {
  const patientPhone = normalizePhone(input.patientPhone);
  if (!isValidE164(patientPhone)) {
    throw new AiVoiceSessionValidationError("Enter a valid caller phone number in E.164 format.");
  }
  const clinicPhone = input.clinicPhone ? normalizePhone(input.clinicPhone) : null;
  if (clinicPhone && !isValidE164(clinicPhone)) {
    throw new AiVoiceSessionValidationError("Enter a valid clinic phone number in E.164 format.");
  }
  return { patientPhone, clinicPhone };
}

export type CapturedRuntimeFields = {
  capturedPatientName: string | null;
  capturedReason: string | null;
  capturedPreferredTime: string | null;
  handoffNote: string | null;
  safetySignal: boolean;
  smsFollowupRecommended: boolean;
  summaryHeadline: string | null;
};

// Sanitize captured request fields with the EXACT same limits + placeholder
// cleanup as the mock route, then derive a deterministic, front-desk-safe
// summary headline (only stored when meaningful, never the generic fallback).
// Pure (no DB, no provider) so it is directly unit-testable.
export function sanitizeCapturedRuntimeFields(input: {
  status: AiVoiceSessionStatus;
  capturedPatientName?: string | null;
  capturedReason?: string | null;
  capturedPreferredTime?: string | null;
  handoffNote?: string | null;
  safetySignal?: boolean | null;
  smsFollowupRecommended?: boolean | null;
}): CapturedRuntimeFields {
  const capturedPatientName = trimToLimit(
    input.capturedPatientName,
    AI_VOICE_FIELD_LIMITS.capturedPatientName,
  );
  const capturedReason = trimToLimit(input.capturedReason, AI_VOICE_FIELD_LIMITS.capturedReason);
  const capturedPreferredTime = trimToLimit(
    input.capturedPreferredTime,
    AI_VOICE_FIELD_LIMITS.capturedPreferredTime,
  );
  const handoffNote = trimToLimit(input.handoffNote, AI_VOICE_FIELD_LIMITS.handoffNote);
  const safetySignal = input.safetySignal === true;
  const smsFollowupRecommended = input.smsFollowupRecommended === true;

  const derived = buildAiVoiceCallSummary({
    status: input.status,
    capturedReason,
    capturedPreferredTime,
    safetySignal,
  });
  const summaryHeadline =
    derived.source === "fallback"
      ? null
      : trimToLimit(derived.headline, AI_VOICE_FIELD_LIMITS.summaryHeadline);

  return {
    capturedPatientName,
    capturedReason,
    capturedPreferredTime,
    handoffNote,
    safetySignal,
    smsFollowupRecommended,
    summaryHeadline,
  };
}

function requireExternalSessionId(value: string | null | undefined): string {
  const trimmed = trimToLimit(value, AI_VOICE_FIELD_LIMITS.externalSessionId);
  if (!trimmed) {
    throw new AiVoiceSessionValidationError("A session id is required for an AI voice session.");
  }
  return trimmed;
}

// ------------------------------------------------------------ start session

export type StartAiVoiceRuntimeSessionInput = {
  clinicId: string;
  // Provider session id / call sid / generated test id. Required: idempotency
  // relies on the (clinic_id, source, external_session_id) unique index.
  externalSessionId: string;
  patientPhone: string;
  clinicPhone?: string | null;
  callEventId?: string | null;
};

export type AiVoiceRuntimeSessionResult = {
  sessionId: string;
  conversationId: string | null;
  status: AiVoiceSessionStatus;
  created: boolean;
};

// Create — or idempotently return — an `incomplete` `future_twilio` session for
// (clinic, source, external_session_id). No Workspace conversation is created
// here: nothing is captured yet. Returns the existing session (with its real
// status/conversation) when the external id was already started.
export async function startAiVoiceRuntimeSession(
  input: StartAiVoiceRuntimeSessionInput,
): Promise<AiVoiceRuntimeSessionResult> {
  if (!input.clinicId) {
    throw new AiVoiceSessionValidationError("Clinic id is required.");
  }
  const externalSessionId = requireExternalSessionId(input.externalSessionId);
  const { patientPhone, clinicPhone } = normalizeRuntimeSessionPhones(input);

  const sql = getDb();
  try {
    const rows = await sql<
      { id: string; conversation_id: string | null; status: string; inserted: boolean }[]
    >`
      with ins as (
        insert into public.ai_voice_sessions (
          clinic_id, call_event_id, source, external_session_id,
          patient_phone, clinic_phone, status, started_at
        ) values (
          ${input.clinicId}, ${input.callEventId ?? null}, 'future_twilio', ${externalSessionId},
          ${patientPhone}, ${clinicPhone}, 'incomplete', now()
        )
        on conflict (clinic_id, source, external_session_id)
          where external_session_id is not null
          do nothing
        returning id, conversation_id, status
      )
      select id, conversation_id, status, true as inserted from ins
      union all
      select id, conversation_id, status, false as inserted
      from public.ai_voice_sessions
      where clinic_id = ${input.clinicId}
        and source = 'future_twilio'
        and external_session_id = ${externalSessionId}
        and not exists (select 1 from ins)
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("ai_voice_sessions get-or-create returned no row");
    return {
      sessionId: row.id,
      conversationId: row.conversation_id,
      status: isAiVoiceSessionStatus(row.status) ? row.status : "incomplete",
      created: row.inserted,
    };
  } catch (err) {
    if (isUndefinedTableError(err)) throw new AiAnsweringUnavailableError();
    throw err;
  }
}

// --------------------------------------------------------- complete session

export type CompleteAiVoiceRuntimeSessionInput = {
  clinicId: string;
  // Identify the session by external id (preferred) OR by session id. At least
  // one is required.
  externalSessionId?: string | null;
  sessionId?: string | null;
  status: AiVoiceSessionStatus;
  capturedPatientName?: string | null;
  capturedReason?: string | null;
  capturedPreferredTime?: string | null;
  handoffNote?: string | null;
  safetySignal?: boolean | null;
  smsFollowupRecommended?: boolean | null;
};

type ExistingSessionRow = {
  id: string;
  patient_phone: string;
  conversation_id: string | null;
};

async function findRuntimeSession(
  clinicId: string,
  externalSessionId: string | null,
  sessionId: string | null,
): Promise<ExistingSessionRow | null> {
  const sql = getDb();
  try {
    const rows = sessionId
      ? await sql<ExistingSessionRow[]>`
          select id, patient_phone, conversation_id
          from public.ai_voice_sessions
          where clinic_id = ${clinicId} and id = ${sessionId}
          limit 1
        `
      : await sql<ExistingSessionRow[]>`
          select id, patient_phone, conversation_id
          from public.ai_voice_sessions
          where clinic_id = ${clinicId}
            and source = 'future_twilio'
            and external_session_id = ${externalSessionId}
          limit 1
        `;
    return rows[0] ?? null;
  } catch (err) {
    if (isUndefinedTableError(err)) throw new AiAnsweringUnavailableError();
    throw err;
  }
}

// Complete a started session with its captured outcome.
//
//   status "captured":  get/create the (clinic, patient) conversation, store
//     the sanitized captured fields + derived summary, link the conversation,
//     set a safe display name only when empty, and touch the conversation so it
//     appears in Workspace. The summary touch + name write are secondary: a
//     failure there preserves the session (logged with safe metadata only).
//
//   status "incomplete" / "failed":  mark the outcome + completed_at only. No
//     NEW Workspace conversation is created; an already-linked conversation id
//     is preserved.
export async function completeAiVoiceRuntimeSession(
  input: CompleteAiVoiceRuntimeSessionInput,
): Promise<AiVoiceRuntimeSessionResult> {
  if (!input.clinicId) {
    throw new AiVoiceSessionValidationError("Clinic id is required.");
  }
  if (!isAiVoiceSessionStatus(input.status)) {
    throw new AiVoiceSessionValidationError("Invalid session status.");
  }
  const externalSessionId = input.externalSessionId
    ? requireExternalSessionId(input.externalSessionId)
    : null;
  const sessionId = input.sessionId?.trim() || null;
  if (!externalSessionId && !sessionId) {
    throw new AiVoiceSessionValidationError("A session id is required to complete a session.");
  }

  const session = await findRuntimeSession(input.clinicId, externalSessionId, sessionId);
  if (!session) {
    throw new AiVoiceSessionValidationError("AI voice session not found.");
  }

  const fields = sanitizeCapturedRuntimeFields(input);
  const sql = getDb();

  // Incomplete / failed: record the outcome only. Never create a Workspace
  // request; keep any existing conversation link.
  if (input.status !== "captured") {
    try {
      await sql`
        update public.ai_voice_sessions set
          status = ${input.status},
          handoff_note = coalesce(${fields.handoffNote}, handoff_note),
          safety_signal = ${fields.safetySignal},
          completed_at = now()
        where id = ${session.id}
      `;
    } catch (err) {
      if (isUndefinedTableError(err)) throw new AiAnsweringUnavailableError();
      throw err;
    }
    return {
      sessionId: session.id,
      conversationId: session.conversation_id,
      status: input.status,
      created: false,
    };
  }

  // Captured: converge on the existing (clinic, patient) conversation thread so
  // AI voice + SMS share one Workspace request.
  const conversation = await getOrCreateConversation(input.clinicId, session.patient_phone);

  try {
    await sql`
      update public.ai_voice_sessions set
        conversation_id = ${conversation.id},
        status = 'captured',
        captured_patient_name = ${fields.capturedPatientName},
        captured_reason = ${fields.capturedReason},
        captured_preferred_time = ${fields.capturedPreferredTime},
        summary_headline = ${fields.summaryHeadline},
        handoff_note = ${fields.handoffNote},
        safety_signal = ${fields.safetySignal},
        sms_followup_recommended = ${fields.smsFollowupRecommended},
        completed_at = now()
      where id = ${session.id}
    `;
  } catch (err) {
    if (isUndefinedTableError(err)) throw new AiAnsweringUnavailableError();
    throw err;
  }

  // Keep the linked request active in the queue ordering. Secondary — preserve
  // the captured session and log only safe metadata if it fails.
  try {
    await touchConversation(conversation.id);
  } catch {
    logger.warn("ai_answering.runtime_session.touch_conversation_failed", {
      clinicId: input.clinicId,
      conversationId: conversation.id,
    });
  }

  // Only store a safe display name, and only when one is not already set. The
  // conservative extractor rejects request-like text so it never becomes a name.
  const safeName = fields.capturedPatientName
    ? normalizeWorkspaceDisplayName(fields.capturedPatientName)
    : null;
  if (safeName) {
    await setPatientDisplayNameIfEmpty(conversation.id, safeName).catch(() => null);
  }

  return {
    sessionId: session.id,
    conversationId: conversation.id,
    status: "captured",
    created: false,
  };
}

// ------------------------------------------------------------- fail session

export type FailAiVoiceRuntimeSessionInput = {
  clinicId: string;
  externalSessionId?: string | null;
  sessionId?: string | null;
  handoffNote?: string | null;
};

// Mark a session failed/completed. No Workspace request is created and NO raw
// error payload is stored — only an optional safe handoff note.
export async function failAiVoiceRuntimeSession(
  input: FailAiVoiceRuntimeSessionInput,
): Promise<AiVoiceRuntimeSessionResult> {
  return completeAiVoiceRuntimeSession({
    clinicId: input.clinicId,
    externalSessionId: input.externalSessionId,
    sessionId: input.sessionId,
    handoffNote: input.handoffNote,
    status: "failed",
  });
}

// ------------------------------------------------------- existence check (DB-only)

// Does an AI voice runtime session (source `future_twilio`) exist for this
// clinic + call sid? Used by the voice status callback to suppress missed-call
// SMS recovery after an AI-answered call. DB-only: no provider calls, no SMS.
// Degradation-safe: returns false when the table is missing (pre-migration) so
// the normal SMS recovery path is never blocked by a missing foundation.
export async function hasAiVoiceRuntimeSessionForCall(input: {
  clinicId: string;
  callSid: string;
}): Promise<boolean> {
  if (!input.clinicId || !input.callSid) return false;
  const sql = getDb();
  try {
    const rows = await sql<{ found: number }[]>`
      select 1 as found
      from public.ai_voice_sessions
      where clinic_id = ${input.clinicId}
        and source = 'future_twilio'
        and external_session_id = ${input.callSid}
      limit 1
    `;
    return rows.length > 0;
  } catch (err) {
    if (isUndefinedTableError(err)) return false;
    throw err;
  }
}
