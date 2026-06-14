// Single import surface for the repo's existing, Next-free library code that the
// relay reuses. Centralizing the relative paths here keeps the rest of the
// service readable and makes the reuse explicit. These modules contain NO
// Next/React/`@/`-alias coupling (verified) — they use only `postgres`, `zod`,
// and Node built-ins — so they compile and run inside this standalone service.
//
// Reusing them (instead of vendoring copies) means the relay shares the EXACT
// runtime gate, session lifecycle, captured-field sanitization, and token
// scheme as the Next app, so the two deployables can never drift on safety
// rules.

export {
  getAiAnsweringRuntimeConfig,
  type AiAnsweringRuntimeConfig,
} from "../../../lib/ai-answering/runtime-config";

export {
  evaluateAiAnsweringRuntimeGate,
  type AiAnsweringRuntimeGateInput,
  type AiAnsweringRuntimeDecision,
} from "../../../lib/ai-answering/runtime-gate";

export {
  verifyRelayToken,
  DEFAULT_RELAY_TOKEN_MAX_AGE_MS,
  type RelayTokenPayload,
  type RelayTokenVerifyResult,
} from "../../../lib/ai-answering/relay-token";

export {
  getAiFrontDeskRuntimeContext,
  buildAiFrontDeskContextFromFacts,
  toRuntimeInstructionText,
  AI_FRONT_DESK_SAFETY_POLICY,
  AI_FRONT_DESK_FALLBACK_POLICY,
  type AiFrontDeskRuntimeContext,
} from "../../../lib/ai-answering/front-desk-context";

export {
  startAiVoiceRuntimeSession,
  completeAiVoiceRuntimeSession,
  failAiVoiceRuntimeSession,
  type AiVoiceRuntimeSessionResult,
} from "../../../lib/db/ai-voice-runtime-sessions";

export { AiAnsweringUnavailableError } from "../../../lib/db/ai-voice-sessions";

export { normalizePhone, isValidE164 } from "../../../lib/phone/normalize";

export {
  AI_VOICE_FIELD_LIMITS,
  type AiVoiceSessionStatus,
} from "../../../config/ai-answering.config";

export { logger } from "../../../lib/logging/logger";
