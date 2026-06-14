import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  AI_VOICE_SESSION_SOURCES,
  AI_VOICE_SESSION_STATUSES,
  WORKSPACE_SOURCE_CHANNELS,
  WORKSPACE_SOURCE_CHANNEL_LABEL,
  DEFAULT_AI_VOICE_ID,
  isAiVoiceSessionSource,
  isAiVoiceSessionStatus,
  isValidAiVoiceId,
} from "../config/ai-answering.config";
import {
  AI_VOICE_REVIEW_FALLBACK,
  buildAiVoiceCallSummary,
  deriveWorkspaceSourceChannel,
  workspaceSourceChannelLabel,
} from "../lib/workspace/ai-voice-summary";
import { buildWorkspaceRequestSummary } from "../lib/workspace/request-summary";

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

// --------------------------------------------------------------- db helpers

test("ai-voice-sessions DB helpers are degradation-safe and provider-free", () => {
  const src = read(path.join("lib", "db", "ai-voice-sessions.ts"));
  assert.ok(src.includes("export async function getClinicAiAnsweringSettings"));
  assert.ok(src.includes("export async function upsertClinicAiAnsweringSettings"));
  assert.ok(src.includes("export async function createMockAiVoiceSession"));
  assert.ok(src.includes("export async function listLatestAiVoiceSessionsForConversations"));
  // 42P01 (undefined_table) → defaults / typed unavailable error, not a crash.
  assert.ok(src.includes('=== "42P01"'));
  assert.ok(src.includes("AiAnsweringUnavailableError"));
  // Reuses the existing conversation thread + safe display-name helper.
  assert.ok(src.includes("getOrCreateConversation"));
  assert.ok(src.includes("setPatientDisplayNameIfEmpty"));
  assert.ok(src.includes("normalizeWorkspaceDisplayName"));
  // No live AI / SMS / provider calls (code usage, not the doc comment that
  // documents the exclusion). No transcript/payload columns are written.
  assert.ok(!/from ["'][^"']*openai[^"']*["']/i.test(src), "db helper imports no openai sdk");
  assert.ok(!src.includes("getTwilioClient"), "db helper makes no Twilio client");
  assert.ok(!src.includes("messages.create"), "db helper sends no SMS");
  assert.ok(!src.includes("sendRecoverySms"), "db helper sends no recovery SMS");
  assert.ok(!src.includes("transcript "), "db helper writes no transcript column");
  assert.ok(!src.includes("raw_payload"), "db helper writes no raw payload column");
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
});
