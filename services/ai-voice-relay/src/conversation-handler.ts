// The relay's message → action logic, decoupled from the WebSocket and the
// database via injected dependencies so it is directly unit-testable.
//
//   - setup:  start (idempotent) the future_twilio session; load grounding
//             context best-effort. (The welcome greeting is spoken by Twilio's
//             welcomeGreeting attribute, so no opening text is sent here.)
//   - prompt: only final prompts are processed; the brain produces a reply and
//             the captured request; on completion the session is completed,
//             a fixed final line is spoken, and an `end` frame is sent.
//   - dtmf:   a short, safe spoken notice (keypad not supported).
//   - close:  complete if enough was captured, otherwise mark incomplete.
//   - error:  fail the session safely if it was started and not yet completed.

import type { AiVoiceSessionStatus, AiVoiceTranscriptTurn } from "./shared-lib";
import type { FrontDeskBrain } from "./openai-brain";
import {
  appendAssistantTurn,
  appendUserTurn,
  capturedSoFar,
  meetsCaptureThreshold,
  mergeCaptured,
  type RelaySessionState,
} from "./session-state";

// Fixed spoken lines (never model-generated).
export const FINAL_CAPTURE_REPLY =
  "Thanks. I'll pass this to the office so they can follow up.";
export const DTMF_REPLY =
  "I'm sorry, keypad input is not supported here. Please tell me how we can help.";
export const HANDOFF_DATA_CAPTURED = JSON.stringify({ reason: "request captured" });

export interface SessionLifecycle {
  start(input: {
    clinicId: string;
    externalSessionId: string;
    patientPhone: string;
    clinicPhone: string | null;
  }): Promise<void>;
  complete(input: {
    clinicId: string;
    externalSessionId: string;
    status: AiVoiceSessionStatus;
    capturedPatientName: string | null;
    capturedReason: string | null;
    capturedPreferredTime: string | null;
    handoffNote: string | null;
    safetySignal: boolean;
    transcriptTurns?: AiVoiceTranscriptTurn[];
  }): Promise<void>;
}

// Outbound sink to Twilio. Implemented over the WebSocket in server.ts; a fake
// in tests records what would be sent.
export interface RelayOutbound {
  sendText(text: string, opts?: { last?: boolean }): void;
  sendEnd(handoffData: string): void;
}

export type HandlerDeps = {
  brain: FrontDeskBrain;
  lifecycle: SessionLifecycle;
  // Best-effort grounding context loader. Failures are tolerated (the brain
  // still runs with the fixed safety policy + clinic name).
  loadContext?: (
    clinicId: string,
    clinicName: string | null,
  ) => Promise<RelaySessionState["context"]>;
  onWarn?: (code: string) => void;
};

export async function handleSetup(deps: HandlerDeps, state: RelaySessionState): Promise<void> {
  await deps.lifecycle.start({
    clinicId: state.clinicId,
    externalSessionId: state.callSid,
    patientPhone: state.from,
    clinicPhone: state.to || null,
  });
  state.started = true;

  if (deps.loadContext) {
    try {
      state.context = await deps.loadContext(state.clinicId, null);
    } catch {
      deps.onWarn?.("context_load_failed");
      state.context = null;
    }
  }
}

export async function handlePrompt(
  deps: HandlerDeps,
  state: RelaySessionState,
  prompt: { text: string; last: boolean },
  send: RelayOutbound,
): Promise<void> {
  // Ignore partial prompts and empty/closed sessions.
  if (!prompt.last) return;
  if (!state.started || state.completed) return;
  const text = (prompt.text ?? "").trim();
  if (text.length === 0) return;

  appendUserTurn(state, text);

  const result = await deps.brain.respond({
    context: state.context,
    captured: capturedSoFar(state),
    turns: state.turns,
  });
  mergeCaptured(state, result);
  appendAssistantTurn(state, result.reply);

  const ready = result.readyToComplete && meetsCaptureThreshold(state.captured);
  if (ready) {
    state.status = "captured";
    state.completed = true;
    await deps.lifecycle.complete({
      clinicId: state.clinicId,
      externalSessionId: state.callSid,
      status: "captured",
      capturedPatientName: state.captured.name,
      capturedReason: state.captured.reason,
      capturedPreferredTime: state.captured.preferredTime,
      handoffNote: state.captured.handoffNote,
      safetySignal: state.captured.safetySignal,
      transcriptTurns: state.transcriptTurns,
    });
    send.sendText(FINAL_CAPTURE_REPLY, { last: true });
    send.sendEnd(HANDOFF_DATA_CAPTURED);
    return;
  }

  send.sendText(result.reply, { last: true });
}

export function handleDtmf(send: RelayOutbound): void {
  send.sendText(DTMF_REPLY, { last: true });
}

// Caller hung up / session closed. Complete if enough was captured, otherwise
// record an incomplete outcome (no Workspace request is created for incomplete).
export async function handleClose(deps: HandlerDeps, state: RelaySessionState): Promise<void> {
  if (!state.started || state.completed) return;
  const status: AiVoiceSessionStatus = meetsCaptureThreshold(state.captured)
    ? "captured"
    : "incomplete";
  state.completed = true;
  state.status = status;
  await deps.lifecycle.complete({
    clinicId: state.clinicId,
    externalSessionId: state.callSid,
    status,
    capturedPatientName: state.captured.name,
    capturedReason: state.captured.reason,
    capturedPreferredTime: state.captured.preferredTime,
    handoffNote: state.captured.handoffNote,
    safetySignal: state.captured.safetySignal,
    transcriptTurns: state.transcriptTurns,
  });
}

// Provider/protocol error. Fail the session safely if it was started and not yet
// completed; never store the raw error.
export async function handleError(deps: HandlerDeps, state: RelaySessionState): Promise<void> {
  if (!state.started || state.completed) return;
  state.completed = true;
  state.status = "failed";
  await deps.lifecycle.complete({
    clinicId: state.clinicId,
    externalSessionId: state.callSid,
    status: "failed",
    capturedPatientName: state.captured.name,
    capturedReason: state.captured.reason,
    capturedPreferredTime: state.captured.preferredTime,
    handoffNote: state.captured.handoffNote,
    safetySignal: state.captured.safetySignal,
    transcriptTurns: state.transcriptTurns,
  });
}
