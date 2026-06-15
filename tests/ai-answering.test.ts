import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  AI_VOICE_SESSION_SOURCES,
  AI_VOICE_SESSION_STATUSES,
  AI_VOICE_SOURCE_LABEL,
  AI_VOICE_STATUS_LABEL,
  WORKSPACE_SOURCE_CHANNELS,
  WORKSPACE_SOURCE_CHANNEL_LABEL,
  DEFAULT_AI_VOICE_ID,
  aiVoiceSourceLabel,
  aiVoiceStatusLabel,
  isAiVoiceSessionSource,
  isAiVoiceSessionStatus,
  isValidAiVoiceId,
} from "../config/ai-answering.config";
import {
  AI_ANSWERING_TEST_CALLER,
  AI_ANSWERING_TEST_CALLER_RESET_CONFIRM,
} from "../config/test-callers.config";
import {
  AI_VOICE_REVIEW_FALLBACK,
  buildAiVoiceCallSummary,
  deriveWorkspaceSourceChannel,
  workspaceSourceChannelLabel,
} from "../lib/workspace/ai-voice-summary";
import { buildWorkspaceRequestSummary } from "../lib/workspace/request-summary";
import { validateAiAnsweringTestCallerResetInput } from "../lib/db/test-caller-reset";

const REPO_ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

// --------------------------------------------------------------- vocabulary

test("AI answering vocabulary stays small and explicit", () => {
  assert.deepEqual([...AI_VOICE_SESSION_SOURCES], ["mock", "future_twilio"]);
  assert.deepEqual([...AI_VOICE_SESSION_STATUSES], ["captured", "incomplete", "failed"]);
  assert.deepEqual([...WORKSPACE_SOURCE_CHANNELS], ["sms", "ai_voice", "mixed"]);

  assert.equal(isAiVoiceSessionSource("mock"), true);
  assert.equal(isAiVoiceSessionSource("twilio"), false);
  assert.equal(isAiVoiceSessionStatus("captured"), true);
  assert.equal(isAiVoiceSessionStatus("done"), false);
});

// --------------------------------------------------------- channel derivation

test("source channel: sms only => sms, ai only => ai_voice, both => mixed", () => {
  assert.equal(deriveWorkspaceSourceChannel({ hasSms: true, hasAiVoice: false }), "sms");
  assert.equal(deriveWorkspaceSourceChannel({ hasSms: false, hasAiVoice: true }), "ai_voice");
  assert.equal(deriveWorkspaceSourceChannel({ hasSms: true, hasAiVoice: true }), "mixed");
  // No SMS and no AI voice falls back to "sms" so existing cards are unchanged.
  assert.equal(deriveWorkspaceSourceChannel({ hasSms: false, hasAiVoice: false }), "sms");
});

test("source channel labels never leak providers/SIDs/ids", () => {
  assert.equal(workspaceSourceChannelLabel("sms"), "SMS conversation");
  assert.equal(workspaceSourceChannelLabel("ai_voice"), "AI answered call");
  assert.equal(workspaceSourceChannelLabel("mixed"), "AI answered call + SMS");
  const joined = Object.values(WORKSPACE_SOURCE_CHANNEL_LABEL).join(" ").toLowerCase();
  for (const banned of ["twilio", "openai", "conversationrelay", "sid", "model", "session"]) {
    assert.ok(!joined.includes(banned), `source labels avoid "${banned}"`);
  }
});

// --------------------------------------------------------- AI summary builder

test("AI voice summary fails closed to Review conversation with nothing usable", () => {
  const empty = buildAiVoiceCallSummary({ status: "incomplete" });
  assert.equal(empty.headline, AI_VOICE_REVIEW_FALLBACK);
  assert.equal(empty.source, "fallback");
  assert.equal(empty.reason, null);
  assert.equal(empty.preferredTime, null);
  assert.equal(empty.safetyConcern, false);

  const blank = buildAiVoiceCallSummary({
    status: "failed",
    capturedReason: "   ",
    summaryHeadline: "  ",
  });
  assert.equal(blank.headline, AI_VOICE_REVIEW_FALLBACK);
  assert.equal(blank.source, "fallback");
});

test("AI voice summary uses reason (+ preferred time), then a provided summary", () => {
  const reasonOnly = buildAiVoiceCallSummary({
    status: "captured",
    capturedReason: "Wants a cleaning",
  });
  assert.equal(reasonOnly.headline, "Wants a cleaning");
  assert.equal(reasonOnly.source, "reason");

  const reasonAndTime = buildAiVoiceCallSummary({
    status: "captured",
    capturedReason: "New patient, wants a cleaning",
    capturedPreferredTime: "Friday morning",
  });
  assert.equal(reasonAndTime.headline, "New patient, wants a cleaning · Friday morning");
  assert.equal(reasonAndTime.source, "reason");

  const withSummary = buildAiVoiceCallSummary({
    status: "captured",
    capturedReason: "Wants a cleaning",
    summaryHeadline: "Cleaning · Friday AM",
  });
  assert.equal(withSummary.headline, "Cleaning · Friday AM");
  assert.equal(withSummary.source, "ai_summary");
});

test("safety signal becomes a front-desk flag only — never medical advice text", () => {
  const flagged = buildAiVoiceCallSummary({ status: "captured", safetySignal: true });
  // The signal raises an attention flag but invents no diagnosis/triage text.
  assert.equal(flagged.safetyConcern, true);
  assert.equal(flagged.headline, AI_VOICE_REVIEW_FALLBACK);
  for (const banned of ["911", "emergency room", "diagnos", "prescri", "treatment"]) {
    assert.ok(
      !flagged.headline.toLowerCase().includes(banned),
      `safety fallback headline avoids "${banned}"`,
    );
  }
  // Without the signal the flag is off.
  assert.equal(buildAiVoiceCallSummary({ status: "captured" }).safetyConcern, false);
});

// ---------------------------------------------- request summary AI hook reuse

test("buildWorkspaceRequestSummary uses the AI summary when present", () => {
  const ai = buildWorkspaceRequestSummary({
    inboundTexts: ["I need a cleaning"],
    aiSummary: "Wants a cleaning, prefers Friday morning.",
  });
  assert.equal(ai.headline, "Wants a cleaning, prefers Friday morning.");
  assert.equal(ai.source, "ai");
  // No AI summary => deterministic SMS-derived line, unchanged behavior.
  assert.equal(
    buildWorkspaceRequestSummary({ inboundTexts: ["I need a cleaning"] }).source,
    "deterministic",
  );
});

// --------------------------------------------------------- voice validation

test("voice settings validation: default voice id valid, unknown rejected", () => {
  assert.equal(isValidAiVoiceId(DEFAULT_AI_VOICE_ID), true);
  assert.equal(isValidAiVoiceId("google-leda"), true);
  assert.equal(isValidAiVoiceId("not-a-real-voice"), false);
  assert.equal(isValidAiVoiceId(""), false);
  assert.equal(isValidAiVoiceId(123 as unknown as string), false);
});

// ----------------------------------------------------------------- migration

test("AI answering migration is additive, clinic-scoped, RLS-only, non-destructive", () => {
  const sql = read(path.join("supabase", "migrations", "20260627000100_ai_answering_foundation.sql"));
  assert.match(sql, /create table if not exists public\.clinic_ai_answering_settings/);
  assert.match(sql, /create table if not exists public\.ai_voice_sessions/);
  assert.match(sql, /clinic_id uuid not null references public\.clinics\(id\) on delete cascade/);
  assert.match(sql, /conversation_id uuid references public\.patient_conversations\(id\) on delete set null/);
  assert.match(sql, /call_event_id uuid references public\.call_events\(id\) on delete set null/);
  // Source/status enums + length caps.
  assert.match(sql, /check \(source in \('mock', 'future_twilio'\)\)/);
  assert.match(sql, /check \(status in \('captured', 'incomplete', 'failed'\)\)/);
  assert.ok(sql.includes("char_length(captured_patient_name) <= 80"));
  assert.ok(sql.includes("char_length(captured_reason) <= 240"));
  assert.ok(sql.includes("char_length(captured_preferred_time) <= 120"));
  assert.ok(sql.includes("char_length(summary_headline) <= 240"));
  assert.ok(sql.includes("char_length(handoff_note) <= 500"));
  // Unique partial index for a future provider's external id.
  assert.match(sql, /create unique index if not exists ai_voice_sessions_external_id_key/);
  assert.ok(sql.includes("where external_session_id is not null"));
  // Required indexes.
  assert.ok(sql.includes("ai_voice_sessions_clinic_created_idx"));
  assert.ok(sql.includes("ai_voice_sessions_conversation_created_idx"));
  assert.ok(sql.includes("ai_voice_sessions_patient_idx"));
  // RLS enabled on both, with NO public policies; uses the shared trigger.
  const rls = sql.match(/enable row level security/g) ?? [];
  assert.ok(rls.length >= 2, "RLS enabled on both new tables");
  assert.equal(/create policy/i.test(sql), false);
  assert.ok(sql.includes("public.set_updated_at()"));
  // Additive only — no drops/deletes.
  assert.equal(/\bdrop\s+table\b/i.test(sql), false);
  assert.equal(/\bdelete\s+from\b/i.test(sql), false);
  // No columns for transcript/audio/raw payloads/prompts (the comment documents
  // the exclusion; assert there is no such COLUMN definition).
  for (const col of ["transcript", "audio", "raw_payload", "prompt", "ai_response"]) {
    assert.ok(
      !new RegExp(`\\n\\s+${col}\\w*\\s+\\w`, "i").test(sql),
      `migration defines no ${col} column`,
    );
  }
});

test("AI answering transcript migration is additive text-only storage", () => {
  const sql = read(
    path.join("supabase", "migrations", "20260628000100_ai_answering_transcript_storage.sql"),
  );
  assert.match(sql, /alter table public\.ai_voice_sessions/);
  assert.ok(sql.includes("add column if not exists transcript_turns jsonb"));
  assert.ok(sql.includes("add column if not exists transcript_expires_at timestamptz"));
  assert.ok(sql.includes("jsonb_typeof(transcript_turns) = 'array'"));
  assert.ok(sql.includes("ai_voice_sessions_conversation_completed_idx"));
  assert.ok(sql.includes("(clinic_id, conversation_id, completed_at desc, created_at desc)"));
  assert.ok(sql.includes("where conversation_id is not null"));
  assert.equal(/\bdrop\s+table\b/i.test(sql), false);
  assert.equal(/\bdelete\s+from\b/i.test(sql), false);
  for (const banned of ["audio", "raw_payload", "provider", "secret", "payment"]) {
    assert.ok(
      !new RegExp(`\\n\\s+${banned}\\w*\\s+\\w`, "i").test(sql),
      `migration defines no ${banned} column`,
    );
  }
});

// --------------------------------------------------------------- db helpers

test("ai-voice-sessions DB helpers are degradation-safe and provider-free", () => {
  const src = read(path.join("lib", "db", "ai-voice-sessions.ts"));
  assert.ok(src.includes("export async function getClinicAiAnsweringSettings"));
  assert.ok(src.includes("export async function upsertClinicAiAnsweringSettings"));
  assert.ok(src.includes("export async function createMockAiVoiceSession"));
  assert.ok(src.includes("export async function listLatestAiVoiceSessionsForConversations"));
  assert.ok(src.includes("export async function listAiVoiceSessionHistoryForConversation"));
  assert.ok(src.includes("export async function getPreviousCallerContextForAi"));
  // 42P01 (undefined_table) → defaults / typed unavailable error, not a crash.
  assert.ok(src.includes('=== "42P01"'));
  assert.ok(src.includes("AiAnsweringUnavailableError"));
  // Reuses the existing conversation thread + safe display-name helper.
  assert.ok(src.includes("getOrCreateConversation"));
  assert.ok(src.includes("setPatientDisplayNameIfEmpty"));
  assert.ok(src.includes("touchConversation"));
  assert.ok(src.includes("normalizeWorkspaceDisplayName"));
  assert.ok(src.includes("LABEL_LIKE_PLACEHOLDERS"));
  // No live AI / SMS / provider calls (code usage, not the doc comment that
  // documents the exclusion). No transcript/payload columns are written.
  assert.ok(!/from ["'][^"']*openai[^"']*["']/i.test(src), "db helper imports no openai sdk");
  assert.ok(!src.includes("getTwilioClient"), "db helper makes no Twilio client");
  assert.ok(!src.includes("messages.create"), "db helper sends no SMS");
  assert.ok(!src.includes("sendRecoverySms"), "db helper sends no recovery SMS");
  assert.ok(src.includes("transcript_expires_at is null or transcript_expires_at > now()"));
  assert.ok(src.includes("AI_VOICE_SESSION_HISTORY_LIMIT"));
  assert.ok(!src.includes("raw_payload"), "db helper writes no raw payload column");
});

test("createMockAiVoiceSession touches linked conversation activity after insert", () => {
  const src = read(path.join("lib", "db", "ai-voice-sessions.ts"));
  const insertIdx = src.indexOf("insert into public.ai_voice_sessions");
  const touchIdx = src.indexOf("await touchConversation(conversation.id)");
  const nameIdx = src.indexOf("setPatientDisplayNameIfEmpty(conversation.id");
  assert.ok(insertIdx >= 0, "session insert is present");
  assert.ok(touchIdx > insertIdx, "conversation activity is touched after session insert");
  assert.ok(nameIdx > touchIdx, "safe display-name write remains secondary");
  assert.ok(src.includes('logger.warn("ai_answering.mock_session.touch_conversation_failed"'));
  assert.ok(!src.includes("patientPhone, err"), "touch failure logging avoids patient phone");
});

test("mock text normalization drops label-like placeholder values", () => {
  const src = read(path.join("lib", "db", "ai-voice-sessions.ts"));
  for (const text of [
    "Handoff note (optional)",
    "Internal note",
    "Reason for call (optional)",
    "Preferred time (optional)",
    "Anything the front desk should know",
  ]) {
    assert.ok(src.includes(text), `normalizer knows ${text}`);
  }
  assert.ok(src.includes("LABEL_LIKE_PLACEHOLDERS.has(normalizeLabelLikeValue(trimmed))"));
});

test("front-desk read path integrates AI voice sessions degradation-safely", () => {
  const src = read(path.join("lib", "db", "front-desk.ts"));
  assert.ok(src.includes("listLatestAiVoiceSessionsForConversations(clinicId, ids)"));
  assert.ok(src.includes("aiVoiceSessionId"));
  assert.ok(src.includes("aiVoiceSafetySignal"));
});

// ------------------------------------------------------------- mock route

test("mock-session route is platform-admin-only, URL-scoped, and provider-free", () => {
  const src = read(
    path.join(
      "app", "api", "admin", "clinics", "[clinicId]", "ai-answering", "mock-session", "route.ts",
    ),
  );
  // Guarded by the platform-admin clinic guard; clinic id comes from the URL.
  assert.ok(src.includes("requirePlatformAdminClinic(req, clinicId)"));
  assert.ok(src.includes("const { clinicId } = await ctx.params"));
  assert.ok(src.includes("clinicId: guard.clinic.id"));
  // Clear unavailable error when the migration is not applied.
  assert.ok(src.includes("AiAnsweringUnavailableError"));
  assert.ok(src.includes("ai_answering_unavailable"));
  // No SMS / Twilio / OpenAI runtime in the route (code usage, not the doc
  // comment that documents the exclusion).
  assert.ok(!/from ["'][^"']*openai[^"']*["']/i.test(src), "route imports no openai sdk");
  assert.ok(!src.includes("getTwilioClient"), "route makes no Twilio client");
  assert.ok(!src.includes("messages.create"), "route sends no SMS");
  assert.ok(!src.includes("sendRecoverySms"), "route sends no recovery SMS");
  // Response no longer points platform admins at generic /workspace.
  assert.ok(!src.includes("workspaceUrl"));
  assert.ok(src.includes('message: "Test request created."'));
});

// ----------------------------------------------------- admin label helpers

test("admin AI voice label maps cover every status and source", () => {
  assert.equal(aiVoiceStatusLabel("captured"), "Captured");
  assert.equal(aiVoiceStatusLabel("incomplete"), "Incomplete");
  assert.equal(aiVoiceStatusLabel("failed"), "Failed");
  assert.equal(aiVoiceSourceLabel("mock"), "Mock (test)");
  assert.equal(aiVoiceSourceLabel("future_twilio"), "Future (Twilio)");
  // Unknown values pass through unchanged (never throw).
  assert.equal(aiVoiceStatusLabel("weird"), "weird");
  assert.equal(aiVoiceSourceLabel("weird"), "weird");
  // Every enum member has a label.
  for (const s of AI_VOICE_SESSION_STATUSES) assert.ok(AI_VOICE_STATUS_LABEL[s]);
  for (const s of AI_VOICE_SESSION_SOURCES) assert.ok(AI_VOICE_SOURCE_LABEL[s]);
});

// ------------------------------------------------ clinic-level admin helper

test("clinic-level admin session helper selects only safe fields", () => {
  const src = read(path.join("lib", "db", "ai-voice-sessions.ts"));
  assert.ok(src.includes("export async function listLatestAiVoiceSessionsForClinic"));
  assert.ok(src.includes("export async function countAiVoiceSessionsForClinic"));
  const start = src.indexOf("export async function listLatestAiVoiceSessionsForClinic");
  const end = src.indexOf("export async function countAiVoiceSessionsForClinic", start);
  const helper = src.slice(start, end);
  // Selects the documented safe columns.
  for (const col of [
    "patient_phone",
    "status",
    "source",
    "captured_patient_name",
    "captured_reason",
    "captured_preferred_time",
    "summary_headline",
    "handoff_note",
    "safety_signal",
    "sms_followup_recommended",
    "created_at",
    "completed_at",
  ]) {
    assert.ok(helper.includes(col), `clinic helper selects ${col}`);
  }
  // Never selects provider/internal raw fields.
  for (const banned of ["external_session_id", "call_event_id", "raw_payload", "transcript"]) {
    assert.ok(!helper.includes(banned), `clinic helper does not expose ${banned}`);
  }
  // Degradation-safe (empty list on missing table / read error).
  assert.ok(helper.includes("return [];"));
});

// ----------------------------------------------------------- admin GET route

test("admin AI Answering GET is platform-admin-only, URL-scoped, masks phone, safe fields", () => {
  const src = read(
    path.join("app", "api", "admin", "clinics", "[clinicId]", "ai-answering", "route.ts"),
  );
  assert.ok(src.includes("export async function GET"));
  assert.ok(src.includes("requirePlatformAdminClinic(req, clinicId)"));
  assert.ok(src.includes("const { clinicId } = await ctx.params"));
  // Graceful pre-migration state, not a crash.
  assert.ok(src.includes("foundationApplied"));
  // Phone is masked; full patient phone is never returned.
  assert.ok(src.includes("patientPhoneMasked"));
  assert.ok(!src.includes("patientPhone:"), "GET never returns the full patient phone");
  // No provider/internal/raw fields leaked in the JSON response builder (scope to
  // the response block so the doc comment that documents the exclusion is ignored).
  const respStart = src.indexOf("return jsonOk(");
  const respBlock = src.slice(respStart);
  for (const banned of ["external_session_id", "call_event_id", "raw_payload", "transcript", "twilioSid", "Sid"]) {
    assert.ok(!respBlock.includes(banned), `GET response does not expose ${banned}`);
  }
  // No SMS / Twilio / OpenAI runtime in the route.
  assert.ok(!/from ["'][^"']*openai[^"']*["']/i.test(src), "GET imports no openai sdk");
  assert.ok(!src.includes("getTwilioClient"), "GET makes no Twilio client");
  assert.ok(!src.includes("messages.create"), "GET sends no SMS");
});

test("admin patient requests GET is platform-admin-only, URL-scoped, masks phone, safe fields", () => {
  const src = read(
    path.join("app", "api", "admin", "clinics", "[clinicId]", "patient-requests", "route.ts"),
  );
  assert.ok(src.includes("export async function GET"));
  assert.ok(src.includes("requirePlatformAdminClinic(req, clinicId)"));
  assert.ok(src.includes("const { clinicId } = await ctx.params"));
  assert.ok(src.includes("listClinicConversations(guard.clinic.id"));
  assert.ok(src.includes("toPatientRequestCard"));
  assert.ok(src.includes("callerPhoneMasked"));
  assert.ok(src.includes("maskPhone(card.callerPhone)"));

  const respStart = src.indexOf("return jsonOk(");
  const respBlock = src.slice(respStart);
  assert.ok(respBlock.includes("requestKey"));
  assert.ok(!respBlock.includes("id: card.id"), "response does not expose raw conversation ids");
  assert.ok(!respBlock.includes("callerPhone: card.callerPhone"), "response does not expose full phone");
  assert.ok(!respBlock.includes("latestMessage"), "response does not expose message bodies");
  for (const banned of [
    "raw_payload",
    "external_session_id",
    "call_event_id",
    "twilioSid",
    "openai",
    "billing",
    "ein",
    "legal",
    "stripe",
  ]) {
    assert.ok(!respBlock.includes(banned), `patient request response avoids ${banned}`);
  }
});

test("admin patient requests preview is read-only with no mutation actions", () => {
  const src = read(
    path.join(
      "app", "admin", "(console)", "clinics", "[clinicId]", "_components",
      "AdminPatientRequestsPreview.tsx",
    ),
  );
  assert.ok(src.includes("No patient requests yet."));
  assert.ok(src.includes("callerPhoneMasked"));
  assert.ok(src.includes("AI call summary"));
  assert.ok(src.includes("Urgent concern"));
  for (const forbidden of [
    "Handled</button>",
    "Block number</button>",
    "Reopen</button>",
    "Unblock number</button>",
    "conversation-action",
  ]) {
    assert.ok(!src.includes(forbidden), `preview has no ${forbidden}`);
  }
});

// --------------------------------------------------------- admin console tab

test("admin clinic console exposes an AI Answering tab (admin-only)", () => {
  const src = read(
    path.join(
      "app", "admin", "(console)", "clinics", "[clinicId]", "_components", "AdminClinicConsole.tsx",
    ),
  );
  assert.ok(src.includes('{ id: "ai_answering", label: "AI Answering" }'));
  assert.ok(src.includes('{ id: "patient_requests", label: "Patient requests" }'));
  assert.ok(src.includes("AdminAiAnsweringMockTester"));
  assert.ok(src.includes("AdminPatientRequestsPreview"));
  assert.ok(src.includes('onViewPatientRequests={() => goTo("patient_requests")}'));
  assert.ok(src.includes("Not live yet"));
});

test("admin AI Answering UI uses operator copy and links to admin patient requests", () => {
  const src = read(
    path.join(
      "app", "admin", "(console)", "clinics", "[clinicId]", "_components",
      "AdminAiAnsweringMockTester.tsx",
    ),
  );
  for (const required of [
    "For testing only. Use a test caller number.",
    "AI Answering test",
    "Create test request",
    "Caller phone",
    "Reason for call",
    "Preferred time",
    "Urgent concern",
    "Internal note",
    "Latest test requests",
    "View patient request",
    "onViewPatientRequests",
    "Test request created.",
    "Reset test caller",
    "Clear this test caller&apos;s previous requests before running a fresh test.",
    "AI_ANSWERING_TEST_CALLER.resetConfirm",
    "patientPhone: AI_ANSWERING_TEST_CALLER.patientPhone",
  ]) {
    assert.ok(src.includes(required), `AI Answering UI includes ${required}`);
  }
  assert.ok(src.includes("AI_ANSWERING_TEST_CALLER.patientPhoneMasked"));
  assert.ok(!src.includes(AI_ANSWERING_TEST_CALLER.patientPhone), "UI source does not render full phone literal");
  for (const banned of [
    "Open Workspace if your account has clinic access",
    "No call is placed. No AI runs. No SMS is sent.",
    "Not live yet — internal test tool",
    "Latest mock sessions",
    "Create mock Workspace request",
    "Patient phone (test number, E.164)",
    "Handoff note (optional)",
    "Activity & SMS audit trail",
    "Raw SMS",
    "audit entries",
  ]) {
    assert.ok(!src.includes(banned), `AI Answering UI avoids ${banned}`);
  }
});

test("AI Answering test caller reset config is exact and masked for UI", () => {
  assert.equal(AI_ANSWERING_TEST_CALLER_RESET_CONFIRM, "RESET_TEST_CALLER");
  assert.equal(AI_ANSWERING_TEST_CALLER.clinicId, "f37f24a1-070f-436b-b803-956f55466093");
  assert.equal(AI_ANSWERING_TEST_CALLER.clinicName, "Test Dental Clinic");
  assert.equal(AI_ANSWERING_TEST_CALLER.clinicSlug, "fairstone-dental-smile");
  assert.equal(AI_ANSWERING_TEST_CALLER.patientPhone, "+12245329236");
  assert.equal(AI_ANSWERING_TEST_CALLER.patientPhoneMasked, "***-***-9236");
});

test("AI Answering test caller reset validation rejects broad resets", () => {
  const ok = validateAiAnsweringTestCallerResetInput({
    clinicId: AI_ANSWERING_TEST_CALLER.clinicId,
    patientPhone: AI_ANSWERING_TEST_CALLER.patientPhone,
    confirm: AI_ANSWERING_TEST_CALLER.resetConfirm,
  });
  assert.deepEqual(ok, { ok: true });

  const wrongConfirm = validateAiAnsweringTestCallerResetInput({
    clinicId: AI_ANSWERING_TEST_CALLER.clinicId,
    patientPhone: AI_ANSWERING_TEST_CALLER.patientPhone,
    confirm: "RESET",
  });
  assert.deepEqual(wrongConfirm, {
    ok: false,
    status: 400,
    code: "confirmation_required",
    message: "Type RESET_TEST_CALLER to confirm this reset.",
  });

  const wrongClinic = validateAiAnsweringTestCallerResetInput({
    clinicId: "00000000-0000-0000-0000-000000000000",
    patientPhone: AI_ANSWERING_TEST_CALLER.patientPhone,
    confirm: AI_ANSWERING_TEST_CALLER.resetConfirm,
  });
  assert.equal(wrongClinic.ok, false);
  if (!wrongClinic.ok) {
    assert.equal(wrongClinic.status, 403);
    assert.equal(wrongClinic.code, "clinic_not_allowed");
  }

  const wrongPhone = validateAiAnsweringTestCallerResetInput({
    clinicId: AI_ANSWERING_TEST_CALLER.clinicId,
    patientPhone: "+12245550199",
    confirm: AI_ANSWERING_TEST_CALLER.resetConfirm,
  });
  assert.equal(wrongPhone.ok, false);
  if (!wrongPhone.ok) {
    assert.equal(wrongPhone.status, 400);
    assert.equal(wrongPhone.code, "caller_not_allowed");
  }
});

test("AI Answering test caller reset helper deletes only exact clinic and caller rows", () => {
  const src = read(path.join("lib", "db", "test-caller-reset.ts"));
  assert.ok(src.includes("sql.begin(async (tx)"));
  for (const table of [
    "public.ai_voice_sessions",
    "public.messages",
    "public.patient_conversations",
    "public.call_events",
    "public.opt_outs",
    "public.clinic_blocked_patient_numbers",
  ]) {
    assert.ok(src.includes(`delete from ${table}`), `helper deletes from ${table}`);
  }
  for (const forbidden of [
    "public.webhook_events",
    "public.clinics",
    "public.clinic_phone_numbers",
    "public.clinic_sms_number_readiness",
    "public.clinic_a2p_submissions",
    "public.clinic_phone_number_purchase_attempts",
  ]) {
    assert.ok(!src.includes(`delete from ${forbidden}`), `helper never deletes ${forbidden}`);
  }
  assert.ok(src.includes("const clinicId = AI_ANSWERING_TEST_CALLER.clinicId"));
  assert.ok(src.includes("const phone = AI_ANSWERING_TEST_CALLER.patientPhone"));
  assert.ok(src.includes("s.clinic_id = ${clinicId}"));
  assert.ok(src.includes("m.clinic_id = ${clinicId}"));
  assert.ok(src.includes("clinic_id = ${clinicId}"));
  assert.ok(src.includes("patient_phone = ${phone}"));
  assert.ok(src.includes("from_number = ${phone} or to_number = ${phone}"));
  assert.ok(src.includes("phone_number = ${phone}"));
  assert.ok(src.includes("returning id"));
  assert.ok(src.includes("aiVoiceSessions: aiVoiceSessions.length"));
  assert.ok(src.includes("clinicBlockedPatientNumbers: clinicBlockedPatientNumbers.length"));
});

test("AI Answering test caller reset route is platform-admin-only and URL-scoped", () => {
  const src = read(
    path.join(
      "app", "api", "admin", "clinics", "[clinicId]", "ai-answering",
      "reset-test-caller", "route.ts",
    ),
  );
  assert.ok(src.includes("export async function POST"));
  assert.ok(src.includes("const { clinicId } = await ctx.params"));
  assert.ok(src.includes("requirePlatformAdminClinic(req, clinicId)"));
  assert.ok(src.includes("clinicId: guard.clinic.id"));
  assert.ok(src.includes("patientPhone: parsed.data.patientPhone"));
  assert.ok(src.includes("confirm: parsed.data.confirm"));
  assert.ok(!src.includes("parsed.data.clinicId"), "route never reads clinic id from the body");
  assert.ok(src.includes(".strict()"));
  assert.ok(src.includes("TestCallerResetValidationError"));
  assert.ok(src.includes("maskedPhone: result.maskedPhone"));
  assert.ok(src.includes("counts: result.counts"));
  assert.ok(!src.includes("getTwilioClient"));
  assert.ok(!/from ["'][^"']*openai[^"']*["']/i.test(src), "reset route imports no openai sdk");
});
