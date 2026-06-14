// AI Answering — non-live foundation vocabulary and limits.
//
// AI Answering is a PLANNED MVP channel that is NOT live yet (no AI voice
// runtime, no Twilio ConversationRelay, no OpenAI). This file only defines the
// small, explicit vocabulary that the database helpers, API validation, and UI
// share so an AI answered call can be REPRESENTED in the data model and the
// Workspace. It must never enable live AI behavior.
//
// Safe to import from BOTH server and client code: no secrets, no provider IDs,
// no environment reads, no OpenAI/Twilio runtime logic, no billing literals.
// Included AI minutes / overage rates are NEVER duplicated here — anything that
// needs them imports from config/billing.config.ts (see BILLING-AND-USAGE-POLICY).
//
// The default AI voice preference reuses the curated voice list in
// config/voice-greeting.config.ts as the single source of truth; this file does
// not invent a second voice catalog.

import { voiceGreetingConfig } from "./voice-greeting.config";

// Where an AI voice session came from. `mock` = a platform-admin foundation/test
// session created without any provider. `future_twilio` is reserved for the
// not-yet-built live runtime; nothing produces it today.
export const AI_VOICE_SESSION_SOURCES = ["mock", "future_twilio"] as const;
export type AiVoiceSessionSource = (typeof AI_VOICE_SESSION_SOURCES)[number];

// Outcome of capturing the caller's request.
//   captured   — name/reason/preferred-time were collected into a request
//   incomplete — the call ended before a usable request was captured
//   failed     — the session could not capture anything
export const AI_VOICE_SESSION_STATUSES = ["captured", "incomplete", "failed"] as const;
export type AiVoiceSessionStatus = (typeof AI_VOICE_SESSION_STATUSES)[number];

// How a Workspace patient request reached the office. A single request can mix
// channels once AI voice and SMS are stitched into one conversation thread.
export const WORKSPACE_SOURCE_CHANNELS = ["sms", "ai_voice", "mixed"] as const;
export type WorkspaceSourceChannel = (typeof WORKSPACE_SOURCE_CHANNELS)[number];

// Maximum stored lengths. These mirror the CHECK constraints in the
// ai_voice_sessions migration so API validation and the DB agree. Keep them in
// sync if the migration changes.
export const AI_VOICE_FIELD_LIMITS = {
  capturedPatientName: 80,
  capturedReason: 240,
  capturedPreferredTime: 120,
  summaryHeadline: 240,
  handoffNote: 500,
  patientPhone: 32,
  clinicPhone: 32,
  externalSessionId: 200,
} as const;

// Customer-facing source line copy for the Workspace detail panel. Never reveals
// providers, models, SIDs, or internal IDs.
export const WORKSPACE_SOURCE_CHANNEL_LABEL: Record<WorkspaceSourceChannel, string> = {
  sms: "SMS conversation",
  ai_voice: "AI answered call",
  mixed: "AI answered call + SMS",
};

// Admin-facing labels (platform-admin AI Answering tab). Customer-facing copy
// elsewhere uses "AI answered call" wording; these are internal admin labels.
export const AI_VOICE_STATUS_LABEL: Record<AiVoiceSessionStatus, string> = {
  captured: "Captured",
  incomplete: "Incomplete",
  failed: "Failed",
};

export const AI_VOICE_SOURCE_LABEL: Record<AiVoiceSessionSource, string> = {
  mock: "Mock (test)",
  future_twilio: "Future (Twilio)",
};

export function aiVoiceStatusLabel(status: string): string {
  return isAiVoiceSessionStatus(status) ? AI_VOICE_STATUS_LABEL[status] : status;
}

export function aiVoiceSourceLabel(source: string): string {
  return isAiVoiceSessionSource(source) ? AI_VOICE_SOURCE_LABEL[source] : source;
}

export function isAiVoiceSessionSource(value: unknown): value is AiVoiceSessionSource {
  return typeof value === "string" && (AI_VOICE_SESSION_SOURCES as readonly string[]).includes(value);
}

export function isAiVoiceSessionStatus(value: unknown): value is AiVoiceSessionStatus {
  return typeof value === "string" && (AI_VOICE_SESSION_STATUSES as readonly string[]).includes(value);
}

// Future AI voice preference default. Reuses the curated default voice id so the
// account UI and any future settings agree on one source of truth. This is a
// PREFERENCE only — it does not enable or run any AI voice.
export const DEFAULT_AI_VOICE_ID = voiceGreetingConfig.defaultVoiceId;

// Validate a voice id against the curated voice list. Used by the future AI
// answering settings helper so an invalid/unknown voice is rejected.
export function isValidAiVoiceId(value: unknown): boolean {
  return (
    typeof value === "string" &&
    voiceGreetingConfig.options.some((option) => option.id === value)
  );
}
