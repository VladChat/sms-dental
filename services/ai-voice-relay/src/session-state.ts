// In-memory state for one ConversationRelay session. Holds ONLY what is needed
// to run the capture flow for the duration of the call. The caller-text turns
// live here transiently to give the model context; they are NEVER persisted —
// only the narrow captured request (name/reason/preferred time/handoff/safety)
// is ever written to the database, by the shared session lifecycle.

import type { AiVoiceSessionStatus } from "./shared-lib";
import type { BrainResult, CapturedSoFar, Turn } from "./openai-brain";

export type CapturedFields = {
  name: string | null;
  reason: string | null;
  preferredTime: string | null;
  handoffNote: string | null;
  safetySignal: boolean;
};

export type RelaySessionState = {
  clinicId: string;
  callSid: string;
  from: string;
  to: string;
  started: boolean;
  completed: boolean;
  status: AiVoiceSessionStatus;
  captured: CapturedFields;
  turns: Turn[];
  context: import("./shared-lib").AiFrontDeskRuntimeContext | null;
};

export function createRelaySessionState(init: {
  clinicId: string;
  callSid: string;
  from: string;
  to: string;
}): RelaySessionState {
  return {
    clinicId: init.clinicId,
    callSid: init.callSid,
    from: init.from,
    to: init.to,
    started: false,
    completed: false,
    status: "incomplete",
    captured: {
      name: null,
      reason: null,
      preferredTime: null,
      handoffNote: null,
      safetySignal: false,
    },
    turns: [],
    context: null,
  };
}

export function appendUserTurn(state: RelaySessionState, text: string): void {
  state.turns.push({ role: "user", text });
}

export function appendAssistantTurn(state: RelaySessionState, text: string): void {
  state.turns.push({ role: "assistant", text });
}

export function capturedSoFar(state: RelaySessionState): CapturedSoFar {
  return {
    name: state.captured.name,
    reason: state.captured.reason,
    preferredTime: state.captured.preferredTime,
  };
}

// Merge a brain result into the captured fields. New non-null values win;
// previously-captured values are never wiped by a later null. The safety flag is
// sticky (once raised it stays raised for the session).
export function mergeCaptured(state: RelaySessionState, result: BrainResult): void {
  if (result.capturedPatientName) state.captured.name = result.capturedPatientName;
  if (result.capturedReason) state.captured.reason = result.capturedReason;
  if (result.capturedPreferredTime) state.captured.preferredTime = result.capturedPreferredTime;
  if (result.handoffNote) state.captured.handoffNote = result.handoffNote;
  if (result.safetySignal) state.captured.safetySignal = true;
}

// Enough captured to create a Workspace request: a reason PLUS at least a name or
// a preferred time. Mirrors the completion rule in the task spec.
export function meetsCaptureThreshold(captured: CapturedFields): boolean {
  const hasReason = !!captured.reason && captured.reason.trim().length > 0;
  const hasName = !!captured.name && captured.name.trim().length > 0;
  const hasTime = !!captured.preferredTime && captured.preferredTime.trim().length > 0;
  return hasReason && (hasName || hasTime);
}
