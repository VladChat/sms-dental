// Database-backed SessionLifecycle: thin adapter over the EXISTING shared
// session lifecycle helpers (lib/db/ai-voice-runtime-sessions.ts). Reusing them
// guarantees the relay writes sessions with the same idempotent start, the same
// captured-field sanitization, and the same Workspace-request creation rule as
// the rest of the system — and never stores transcripts/audio/raw payloads.

import {
  completeAiVoiceRuntimeSession,
  startAiVoiceRuntimeSession,
} from "./shared-lib";
import type { SessionLifecycle } from "./conversation-handler";

export function createDbSessionLifecycle(): SessionLifecycle {
  return {
    async start(input) {
      await startAiVoiceRuntimeSession({
        clinicId: input.clinicId,
        externalSessionId: input.externalSessionId,
        patientPhone: input.patientPhone,
        clinicPhone: input.clinicPhone,
      });
    },
    async complete(input) {
      await completeAiVoiceRuntimeSession({
        clinicId: input.clinicId,
        externalSessionId: input.externalSessionId,
        status: input.status,
        capturedPatientName: input.capturedPatientName,
        capturedReason: input.capturedReason,
        capturedPreferredTime: input.capturedPreferredTime,
        handoffNote: input.handoffNote,
        safetySignal: input.safetySignal,
        transcriptTurns: input.transcriptTurns,
      });
    },
  };
}
