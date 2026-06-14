import { getDb } from "./client";
import { getOrCreateConversation, setPatientDisplayNameIfEmpty } from "./conversations";
import { normalizeWorkspaceDisplayName } from "../workspace/display-name";
import { normalizePhone, isValidE164 } from "../phone/normalize";
import { buildAiVoiceCallSummary } from "../workspace/ai-voice-summary";
import {
  AI_VOICE_FIELD_LIMITS,
  DEFAULT_AI_VOICE_ID,
  isAiVoiceSessionStatus,
  isValidAiVoiceId,
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
function isUndefinedTableError(err: unknown): boolean {
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

function trimToLimit(value: string | null | undefined, limit: number): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length === 0) return null;
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
