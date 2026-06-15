import { getDb } from "./client";
import {
  getOrCreateConversation,
  setPatientDisplayNameIfEmpty,
  touchConversation,
} from "./conversations";
import { normalizeWorkspaceDisplayName } from "../workspace/display-name";
import { normalizePhone, isValidE164 } from "../phone/normalize";
import { buildAiVoiceCallSummary } from "../workspace/ai-voice-summary";
import { logger } from "../logging/logger";
import {
  AI_VOICE_FIELD_LIMITS,
  DEFAULT_AI_VOICE_ID,
  isAiVoiceSessionSource,
  isAiVoiceSessionStatus,
  isValidAiVoiceId,
  type AiVoiceSessionSource,
  type AiVoiceSessionStatus,
} from "../../config/ai-answering.config";

// Clinic-scoped AI Answering data access (NON-LIVE foundation).
//
// Nothing here runs AI, calls a provider, sends SMS, or stores transcripts/audio/
// raw payloads. The read paths are degradation-safe: if the AI answering
// migration has not been applied yet they return defaults / empty results so
// /account and /workspace never crash. The mock-session writer is used ONLY by
// the platform-admin mock route.

// postgres.js sets `.code` to the Postgres SQLSTATE. 42P01 = undefined_table:
// the AI answering migration has not been applied to this database yet.
// Exported so the provider-agnostic runtime helper
// (lib/db/ai-voice-runtime-sessions.ts) treats a missing table identically.
export function isUndefinedTableError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "42P01"
  );
}

// Thrown when an AI answering table does not exist yet, so an API route can
// return a clear "unavailable" message instead of a generic 500.
export class AiAnsweringUnavailableError extends Error {
  constructor() {
    super("AI answering is not available yet.");
    this.name = "AiAnsweringUnavailableError";
  }
}

// Thrown for invalid mock-session input (e.g. an unparseable phone number).
export class AiVoiceSessionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiVoiceSessionValidationError";
  }
}

// --------------------------------------------------------- answering settings

export type ClinicAiAnsweringSettings = {
  // Future AI voice preference (display only today). Always a valid curated id.
  selectedVoiceId: string;
};

function defaultAiAnsweringSettings(): ClinicAiAnsweringSettings {
  return { selectedVoiceId: DEFAULT_AI_VOICE_ID };
}

// Read path — degradation-safe. Returns the default preference when the table is
// missing OR on any read error, so /account never crashes pre-migration. An
// unknown/invalid stored voice id falls back to the default.
export async function getClinicAiAnsweringSettings(
  clinicId: string,
): Promise<ClinicAiAnsweringSettings> {
  try {
    const sql = getDb();
    const rows = await sql<{ selected_voice_id: string }[]>`
      select selected_voice_id
      from public.clinic_ai_answering_settings
      where clinic_id = ${clinicId}
      limit 1
    `;
    const stored = rows[0]?.selected_voice_id;
    if (stored && isValidAiVoiceId(stored)) return { selectedVoiceId: stored };
  } catch {
    // Missing table (pre-migration) or any read error → safe defaults.
  }
  return defaultAiAnsweringSettings();
}

// Save path — future owner/admin AI answering settings. Validates the voice id
// against the curated list. Throws AiAnsweringUnavailableError when the table is
// missing so the caller can surface a clear message (never a generic 500).
export async function upsertClinicAiAnsweringSettings(params: {
  clinicId: string;
  selectedVoiceId: string;
  updatedByProfileId: string | null;
  updatedByEmail: string | null;
}): Promise<ClinicAiAnsweringSettings> {
  if (!isValidAiVoiceId(params.selectedVoiceId)) {
    throw new AiVoiceSessionValidationError("Select a valid voice.");
  }
  const sql = getDb();
  try {
    const rows = await sql<{ selected_voice_id: string }[]>`
      insert into public.clinic_ai_answering_settings (
        clinic_id, selected_voice_id, updated_by_profile_id, updated_by_email
      ) values (
        ${params.clinicId}, ${params.selectedVoiceId},
        ${params.updatedByProfileId}, ${params.updatedByEmail}
      )
      on conflict (clinic_id) do update set
        selected_voice_id = excluded.selected_voice_id,
        updated_by_profile_id = excluded.updated_by_profile_id,
        updated_by_email = excluded.updated_by_email
      returning selected_voice_id
    `;
    return { selectedVoiceId: rows[0]?.selected_voice_id ?? params.selectedVoiceId };
  } catch (err) {
    if (isUndefinedTableError(err)) throw new AiAnsweringUnavailableError();
    throw err;
  }
}

// ----------------------------------------------------------- voice sessions

// Front-desk-safe view of the latest AI voice session for a conversation. Only
// the narrow captured fields — never provider ids, SIDs, transcripts, or audio.
export type AiVoiceSessionSummary = {
  id: string;
  conversationId: string | null;
  status: AiVoiceSessionStatus;
  summaryHeadline: string | null;
  capturedPatientName: string | null;
  capturedReason: string | null;
  capturedPreferredTime: string | null;
  handoffNote: string | null;
  safetySignal: boolean;
  smsFollowupRecommended: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export const AI_VOICE_SESSION_HISTORY_LIMIT = 10;

export type AiVoiceSessionHistorySummary = AiVoiceSessionSummary & {
  transcriptTurns: unknown;
  transcriptExpiresAt: Date | null;
};

export type PreviousCallerAiContext = {
  patientPhone: string;
  knownPatientName: string | null;
  recentAiAnsweredCalls: {
    callCapturedAt: Date;
    summaryHeadline: string | null;
    previousRequest: string | null;
    previousPreferredTime: string | null;
  }[];
};

export type CreateMockAiVoiceSessionInput = {
  clinicId: string;
  patientPhone: string;
  clinicPhone?: string | null;
  capturedPatientName?: string | null;
  capturedReason?: string | null;
  capturedPreferredTime?: string | null;
  status: AiVoiceSessionStatus;
  safetySignal?: boolean | null;
  handoffNote?: string | null;
  externalSessionId?: string | null;
  smsFollowupRecommended?: boolean | null;
};

function normalizeLabelLikeValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LABEL_LIKE_PLACEHOLDERS = new Set(
  [
    "Patient name (optional)",
    "Name",
    "Reason for call (optional)",
    "Reason for call",
    "Preferred time (optional)",
    "Preferred time",
    "Handoff note (optional)",
    "Handoff note",
    "Internal note",
    "Anything the front desk should know",
  ].map(normalizeLabelLikeValue),
);

// Shared trim + placeholder cleanup. Exported so the runtime session helper
// (lib/db/ai-voice-runtime-sessions.ts) sanitizes captured fields with the EXACT
// same length limits and label-like placeholder dropping as the mock route, so
// the two paths never drift.
export function trimToLimit(value: string | null | undefined, limit: number): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length === 0) return null;
  if (LABEL_LIKE_PLACEHOLDERS.has(normalizeLabelLikeValue(trimmed))) return null;
  return trimmed.slice(0, limit);
}

// Create a foundation/test AI voice session for a clinic WITHOUT any provider.
// No SMS, no Twilio, no OpenAI, no transcript/payload storage. It reuses the
// existing conversation thread (get-or-create) so the session shows up as a
// Workspace request, and only stores a safe display name when one is not already
// set. Returns the new session id + the conversation id.
//
// Throws AiVoiceSessionValidationError for bad input and
// AiAnsweringUnavailableError when the ai_voice_sessions table is missing.
export async function createMockAiVoiceSession(
  input: CreateMockAiVoiceSessionInput,
): Promise<{ sessionId: string; conversationId: string }> {
  if (!isAiVoiceSessionStatus(input.status)) {
    throw new AiVoiceSessionValidationError("Invalid session status.");
  }

  const patientPhone = normalizePhone(input.patientPhone);
  if (!isValidE164(patientPhone)) {
    throw new AiVoiceSessionValidationError("Enter a valid patient phone number in E.164 format.");
  }
  const clinicPhone = input.clinicPhone ? normalizePhone(input.clinicPhone) : null;
  if (clinicPhone && !isValidE164(clinicPhone)) {
    throw new AiVoiceSessionValidationError("Enter a valid clinic phone number in E.164 format.");
  }

  const capturedReason = trimToLimit(input.capturedReason, AI_VOICE_FIELD_LIMITS.capturedReason);
  const capturedPreferredTime = trimToLimit(
    input.capturedPreferredTime,
    AI_VOICE_FIELD_LIMITS.capturedPreferredTime,
  );
  const handoffNote = trimToLimit(input.handoffNote, AI_VOICE_FIELD_LIMITS.handoffNote);
  const capturedPatientName = trimToLimit(
    input.capturedPatientName,
    AI_VOICE_FIELD_LIMITS.capturedPatientName,
  );
  const externalSessionId = trimToLimit(
    input.externalSessionId,
    AI_VOICE_FIELD_LIMITS.externalSessionId,
  );
  const safetySignal = input.safetySignal === true;
  const smsFollowupRecommended = input.smsFollowupRecommended === true;

  // Deterministic, front-desk-safe summary headline derived from the captured
  // reason. Stored only when it is meaningful (not the generic fallback), so the
  // Workspace can fall back to its own derivation otherwise.
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

  // Reuse the existing (clinic, patient) thread so AI voice + SMS converge on one
  // Workspace request.
  const conversation = await getOrCreateConversation(input.clinicId, patientPhone);

  const sql = getDb();
  let sessionId: string;
  try {
    const rows = await sql<{ id: string }[]>`
      insert into public.ai_voice_sessions (
        clinic_id, conversation_id, source, external_session_id,
        patient_phone, clinic_phone, status,
        captured_patient_name, captured_reason, captured_preferred_time,
        summary_headline, handoff_note, safety_signal, sms_followup_recommended,
        started_at, completed_at
      ) values (
        ${input.clinicId}, ${conversation.id}, 'mock', ${externalSessionId},
        ${patientPhone}, ${clinicPhone}, ${input.status},
        ${capturedPatientName}, ${capturedReason}, ${capturedPreferredTime},
        ${summaryHeadline}, ${handoffNote}, ${safetySignal}, ${smsFollowupRecommended},
        now(), now()
      )
      returning id
    `;
    sessionId = rows[0]?.id ?? "";
    if (!sessionId) throw new Error("ai_voice_sessions insert returned no row");
  } catch (err) {
    if (isUndefinedTableError(err)) throw new AiAnsweringUnavailableError();
    throw err;
  }

  // Keep the linked request active in the queue ordering. If this secondary
  // update fails, preserve the inserted AI session and log only safe metadata.
  try {
    await touchConversation(conversation.id);
  } catch {
    logger.warn("ai_answering.mock_session.touch_conversation_failed", {
      clinicId: input.clinicId,
      conversationId: conversation.id,
    });
  }

  // Only store a safe display name, and only when one is not already set. The
  // conservative extractor rejects request-like text so it never becomes a name.
  const safeName = capturedPatientName ? normalizeWorkspaceDisplayName(capturedPatientName) : null;
  if (safeName) {
    await setPatientDisplayNameIfEmpty(conversation.id, safeName).catch(() => null);
  }

  return { sessionId, conversationId: conversation.id };
}

// Latest AI voice session per conversation (clinic-scoped), keyed by
// conversation_id. Degradation-safe: returns an empty map if the table is
// missing (pre-migration) or on any read error, so the Workspace behaves exactly
// as before. Selects only front-desk-safe columns.
export async function listLatestAiVoiceSessionsForConversations(
  clinicId: string,
  conversationIds: string[],
): Promise<Map<string, AiVoiceSessionSummary>> {
  const result = new Map<string, AiVoiceSessionSummary>();
  if (conversationIds.length === 0) return result;
  try {
    const sql = getDb();
    const rows = await sql<
      {
        id: string;
        conversation_id: string;
        status: string;
        summary_headline: string | null;
        captured_patient_name: string | null;
        captured_reason: string | null;
        captured_preferred_time: string | null;
        handoff_note: string | null;
        safety_signal: boolean;
        sms_followup_recommended: boolean;
        started_at: Date | null;
        completed_at: Date | null;
        created_at: Date;
      }[]
    >`
      select distinct on (conversation_id)
        id, conversation_id, status, summary_headline, captured_patient_name,
        captured_reason, captured_preferred_time, handoff_note, safety_signal,
        sms_followup_recommended, started_at, completed_at, created_at
      from public.ai_voice_sessions
      where clinic_id = ${clinicId}
        and conversation_id in ${sql(conversationIds)}
      order by conversation_id, created_at desc
    `;
    for (const row of rows) {
      const status = isAiVoiceSessionStatus(row.status) ? row.status : "incomplete";
      result.set(row.conversation_id, {
        id: row.id,
        conversationId: row.conversation_id,
        status,
        summaryHeadline: row.summary_headline,
        capturedPatientName: row.captured_patient_name,
        capturedReason: row.captured_reason,
        capturedPreferredTime: row.captured_preferred_time,
        handoffNote: row.handoff_note,
        safetySignal: row.safety_signal === true,
        smsFollowupRecommended: row.sms_followup_recommended === true,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
      });
    }
  } catch {
    // Missing table (pre-migration) or any read error → no AI voice data.
  }
  return result;
}

// Bounded, selected-card AI answered call history for one clinic-scoped
// conversation. Front-desk-safe fields only: no provider IDs, raw payloads, audio,
// secrets, model names, or call identifiers. Existing rows without transcripts
// still return their captured summary fields; expired transcripts are omitted.
export async function listAiVoiceSessionHistoryForConversation(params: {
  clinicId: string;
  conversationId: string;
  limit?: number;
}): Promise<AiVoiceSessionHistorySummary[]> {
  const safeLimit = Math.min(
    Math.max(1, Math.trunc(params.limit ?? AI_VOICE_SESSION_HISTORY_LIMIT) || 1),
    AI_VOICE_SESSION_HISTORY_LIMIT,
  );
  try {
    const sql = getDb();
    const rows = await sql<
      {
        id: string;
        conversation_id: string;
        status: string;
        summary_headline: string | null;
        captured_patient_name: string | null;
        captured_reason: string | null;
        captured_preferred_time: string | null;
        handoff_note: string | null;
        safety_signal: boolean;
        sms_followup_recommended: boolean;
        started_at: Date | null;
        completed_at: Date | null;
        created_at: Date;
        transcript_turns: unknown;
        transcript_expires_at: Date | null;
      }[]
    >`
      select id, conversation_id, status, summary_headline, captured_patient_name,
             captured_reason, captured_preferred_time, handoff_note, safety_signal,
             sms_followup_recommended, started_at, completed_at, created_at,
             case
               when transcript_expires_at is null or transcript_expires_at > now()
                 then transcript_turns
               else null
             end as transcript_turns,
             transcript_expires_at
      from public.ai_voice_sessions
      where clinic_id = ${params.clinicId}
        and conversation_id = ${params.conversationId}
      order by coalesce(completed_at, created_at) desc, created_at desc
      limit ${safeLimit}
    `;

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      status: isAiVoiceSessionStatus(row.status) ? row.status : "incomplete",
      summaryHeadline: row.summary_headline,
      capturedPatientName: row.captured_patient_name,
      capturedReason: row.captured_reason,
      capturedPreferredTime: row.captured_preferred_time,
      handoffNote: row.handoff_note,
      safetySignal: row.safety_signal === true,
      smsFollowupRecommended: row.sms_followup_recommended === true,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      transcriptTurns: row.transcript_turns,
      transcriptExpiresAt: row.transcript_expires_at,
    }));
  } catch {
    // Missing table/columns or any read error -> no history, never a workspace crash.
    return [];
  }
}

// Future-only helper boundary for safe previous caller context. This is NOT
// wired into the live voice prompt. Any future AI use must label these as
// previous facts and ask the caller to confirm current needs/preferences.
export async function getPreviousCallerContextForAi(input: {
  clinicId: string;
  patientPhone: string;
  limit?: number;
}): Promise<PreviousCallerAiContext | null> {
  const patientPhone = normalizePhone(input.patientPhone);
  if (!isValidE164(patientPhone)) return null;
  const safeLimit = Math.min(Math.max(1, Math.trunc(input.limit ?? 3) || 1), 5);

  try {
    const sql = getDb();
    const conversationRows = await sql<
      { id: string; patient_display_name: string | null }[]
    >`
      select id, patient_display_name
      from public.patient_conversations
      where clinic_id = ${input.clinicId}
        and patient_phone = ${patientPhone}
      limit 1
    `;
    const conversation = conversationRows[0] ?? null;

    const sessionRows = await sql<
      {
        status: string;
        summary_headline: string | null;
        captured_reason: string | null;
        captured_preferred_time: string | null;
        safety_signal: boolean;
        completed_at: Date | null;
        created_at: Date;
      }[]
    >`
      select status, summary_headline, captured_reason, captured_preferred_time,
             safety_signal, completed_at, created_at
      from public.ai_voice_sessions
      where clinic_id = ${input.clinicId}
        and patient_phone = ${patientPhone}
        and status = 'captured'
      order by coalesce(completed_at, created_at) desc, created_at desc
      limit ${safeLimit}
    `;

    if (!conversation && sessionRows.length === 0) return null;

    return {
      patientPhone,
      knownPatientName: normalizeWorkspaceDisplayName(conversation?.patient_display_name ?? null),
      recentAiAnsweredCalls: sessionRows.map((row) => {
        const summary = buildAiVoiceCallSummary({
          status: isAiVoiceSessionStatus(row.status) ? row.status : "captured",
          capturedReason: row.captured_reason,
          capturedPreferredTime: row.captured_preferred_time,
          summaryHeadline: row.summary_headline,
          safetySignal: row.safety_signal,
        });
        return {
          callCapturedAt: row.completed_at ?? row.created_at,
          summaryHeadline: summary.source === "fallback" ? null : summary.headline,
          previousRequest: row.captured_reason,
          previousPreferredTime: row.captured_preferred_time,
        };
      }),
    };
  } catch {
    return null;
  }
}

// Admin-safe summary of a clinic's AI voice sessions. Captured fields + source +
// phone only — never provider IDs, raw payloads, transcripts/audio, Twilio SIDs,
// OpenAI fields, or DB internals. Used by the platform-admin AI Answering tab.
export type AiVoiceSessionAdminSummary = {
  id: string;
  conversationId: string | null;
  patientPhone: string;
  status: AiVoiceSessionStatus;
  source: AiVoiceSessionSource;
  capturedPatientName: string | null;
  capturedReason: string | null;
  capturedPreferredTime: string | null;
  summaryHeadline: string | null;
  handoffNote: string | null;
  safetySignal: boolean;
  smsFollowupRecommended: boolean;
  createdAt: Date;
  completedAt: Date | null;
};

// Latest AI voice sessions for a clinic (newest first), platform-admin read.
// Degradation-safe: returns [] when the table is missing (pre-migration) or on
// any read error. Selects only the admin-safe columns above.
export async function listLatestAiVoiceSessionsForClinic(
  clinicId: string,
  limit = 20,
): Promise<AiVoiceSessionAdminSummary[]> {
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit) || 1), 50);
  try {
    const sql = getDb();
    const rows = await sql<
      {
        id: string;
        conversation_id: string | null;
        patient_phone: string;
        status: string;
        source: string;
        captured_patient_name: string | null;
        captured_reason: string | null;
        captured_preferred_time: string | null;
        summary_headline: string | null;
        handoff_note: string | null;
        safety_signal: boolean;
        sms_followup_recommended: boolean;
        created_at: Date;
        completed_at: Date | null;
      }[]
    >`
      select id, conversation_id, patient_phone, status, source,
             captured_patient_name, captured_reason, captured_preferred_time,
             summary_headline, handoff_note, safety_signal, sms_followup_recommended,
             created_at, completed_at
      from public.ai_voice_sessions
      where clinic_id = ${clinicId}
      order by created_at desc
      limit ${safeLimit}
    `;
    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      patientPhone: row.patient_phone,
      status: isAiVoiceSessionStatus(row.status) ? row.status : "incomplete",
      source: isAiVoiceSessionSource(row.source) ? row.source : "mock",
      capturedPatientName: row.captured_patient_name,
      capturedReason: row.captured_reason,
      capturedPreferredTime: row.captured_preferred_time,
      summaryHeadline: row.summary_headline,
      handoffNote: row.handoff_note,
      safetySignal: row.safety_signal === true,
      smsFollowupRecommended: row.sms_followup_recommended === true,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
  } catch {
    // Missing table (pre-migration) or any read error → no sessions.
    return [];
  }
}

// Count of AI voice sessions for a clinic. Returns null when the table does not
// exist yet (pre-migration), so the admin UI can show a "foundation not applied"
// state instead of crashing. Returns a number (>= 0) when the table exists.
export async function countAiVoiceSessionsForClinic(clinicId: string): Promise<number | null> {
  try {
    const sql = getDb();
    const rows = await sql<{ count: string }[]>`
      select count(*)::text as count from public.ai_voice_sessions where clinic_id = ${clinicId}
    `;
    return Number(rows[0]?.count ?? 0);
  } catch (err) {
    if (isUndefinedTableError(err)) return null;
    return null;
  }
}
