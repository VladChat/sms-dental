// Relay service configuration — read lazily from the environment. Never throws
// at import, never logs secret VALUES (only booleans / safe reason strings).
//
// Required for real operation:
//   PORT                                (optional, default 8080)
//   SUPABASE_DB_URL                     (persist AI voice sessions)
//   AI_ANSWERING_RELAY_SIGNING_SECRET   (verify the ConversationRelay token)
//   OPENAI_API_KEY                      (text brain) OR the deterministic
//                                       fallback brain opt-in below
//   AI_ANSWERING_OPENAI_MODEL           (model id; falls back to a default)
//   AI_ANSWERING_RUNTIME_MODE           (must be "test_only" to answer)
//   AI_ANSWERING_TEST_CLINIC_IDS        (allowlist)
//   AI_ANSWERING_TEST_CALLER_NUMBERS    (allowlist)
//
// Optional:
//   AI_ANSWERING_RELAY_WS_PATH          (default /twilio/conversation-relay)
//   AI_ANSWERING_RELAY_FALLBACK_BRAIN   ("true" → deterministic brain when no key)
//   AI_ANSWERING_RELAY_TOKEN_MAX_AGE_MS (token acceptance window)
//   TWILIO_AUTH_TOKEN                   (best-effort X-Twilio-Signature check)
//   AI_ANSWERING_RELAY_ENFORCE_TWILIO_SIGNATURE ("true" → reject on mismatch)

import { DEFAULT_RELAY_TOKEN_MAX_AGE_MS } from "./shared-lib";

// Conservative default model. Override with AI_ANSWERING_OPENAI_MODEL.
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_WS_PATH = "/twilio/conversation-relay";
const DEFAULT_PORT = 8080;

export type RelayServiceConfig = {
  port: number;
  wsPath: string;
  hasDbUrl: boolean;
  signingSecret: string | null;
  openaiApiKey: string | null;
  openaiModel: string;
  allowFallbackBrain: boolean;
  tokenMaxAgeMs: number;
  twilioAuthToken: string | null;
  enforceTwilioSignature: boolean;
};

function present(name: string): string | null {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export function getRelayServiceConfig(): RelayServiceConfig {
  const portRaw = Number(process.env.PORT);
  const port = Number.isFinite(portRaw) && portRaw > 0 ? Math.trunc(portRaw) : DEFAULT_PORT;
  const maxAgeRaw = Number(process.env.AI_ANSWERING_RELAY_TOKEN_MAX_AGE_MS);
  const tokenMaxAgeMs =
    Number.isFinite(maxAgeRaw) && maxAgeRaw > 0 ? Math.trunc(maxAgeRaw) : DEFAULT_RELAY_TOKEN_MAX_AGE_MS;

  return {
    port,
    wsPath: present("AI_ANSWERING_RELAY_WS_PATH") ?? DEFAULT_WS_PATH,
    hasDbUrl: present("SUPABASE_DB_URL") !== null,
    signingSecret: present("AI_ANSWERING_RELAY_SIGNING_SECRET"),
    openaiApiKey: present("OPENAI_API_KEY"),
    openaiModel: present("AI_ANSWERING_OPENAI_MODEL") ?? DEFAULT_OPENAI_MODEL,
    allowFallbackBrain: present("AI_ANSWERING_RELAY_FALLBACK_BRAIN") === "true",
    tokenMaxAgeMs,
    twilioAuthToken: present("TWILIO_AUTH_TOKEN"),
    enforceTwilioSignature: present("AI_ANSWERING_RELAY_ENFORCE_TWILIO_SIGNATURE") === "true",
  };
}

// Returns a safe, value-free reason string when the service is misconfigured for
// real operation, or null when it can run. Used by /health and the WS gate.
export function getRelayConfigError(config: RelayServiceConfig): string | null {
  if (!config.signingSecret) return "relay_signing_secret_missing";
  if (!config.hasDbUrl) return "supabase_db_url_missing";
  if (!config.openaiApiKey && !config.allowFallbackBrain) return "openai_api_key_missing";
  return null;
}

// Whether the deterministic (no-OpenAI) brain should be used: explicitly when no
// API key is present and the fallback is opted in.
export function shouldUseFallbackBrain(config: RelayServiceConfig): boolean {
  return !config.openaiApiKey && config.allowFallbackBrain;
}
