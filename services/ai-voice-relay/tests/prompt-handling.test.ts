import test from "node:test";
import assert from "node:assert/strict";

import {
  handlePrompt,
  handleDtmf,
  FINAL_CAPTURE_REPLY,
  DTMF_REPLY,
  HANDOFF_DATA_CAPTURED,
  type HandlerDeps,
  type RelayOutbound,
  type SessionLifecycle,
} from "../src/conversation-handler";
import { createRelaySessionState, type RelaySessionState } from "../src/session-state";
import type { BrainResult, FrontDeskBrain } from "../src/openai-brain";

function startedState(): RelaySessionState {
  const state = createRelaySessionState({
    clinicId: "clinic-1",
    callSid: "CA123",
    from: "+12245329236",
    to: "+18447234944",
  });
  state.started = true;
  return state;
}

function fakeBrain(result: BrainResult): { brain: FrontDeskBrain; tracker: { calls: number } } {
  const tracker = { calls: 0 };
  const brain: FrontDeskBrain = {
    async respond() {
      tracker.calls += 1;
      return result;
    },
  };
  return { brain, tracker };
}

function recordingLifecycle() {
  const calls: Array<{ method: string; input: unknown }> = [];
  const lifecycle: SessionLifecycle = {
    async start(input) {
      calls.push({ method: "start", input });
    },
    async complete(input) {
      calls.push({ method: "complete", input });
    },
  };
  return { lifecycle, calls };
}

function recordingSend() {
  const texts: Array<{ text: string; last: boolean }> = [];
  const ends: string[] = [];
  const send: RelayOutbound = {
    sendText(text, opts) {
      texts.push({ text, last: opts?.last ?? true });
    },
    sendEnd(handoffData) {
      ends.push(handoffData);
    },
  };
  return { send, texts, ends };
}

const NON_COMPLETING: BrainResult = {
  reply: "What's your name?",
  capturedPatientName: null,
  capturedReason: null,
  capturedPreferredTime: null,
  readyToComplete: false,
  safetySignal: false,
  handoffNote: null,
};

const COMPLETING: BrainResult = {
  reply: "Great, I have everything.",
  capturedPatientName: "Jane Doe",
  capturedReason: "Wants a cleaning",
  capturedPreferredTime: "Friday morning",
  readyToComplete: true,
  safetySignal: false,
  handoffNote: null,
};

test("partial prompts (last=false) are ignored: no brain call, no output", async () => {
  const { brain, tracker } = fakeBrain(NON_COMPLETING);
  const { lifecycle, calls } = recordingLifecycle();
  const { send, texts, ends } = recordingSend();
  const deps: HandlerDeps = { brain, lifecycle };
  const state = startedState();

  await handlePrompt(deps, state, { text: "I want", last: false }, send);

  assert.equal(tracker.calls, 0);
  assert.equal(texts.length, 0);
  assert.equal(ends.length, 0);
  assert.equal(calls.length, 0);
});

test("a final prompt sends the brain reply as a Twilio text frame", async () => {
  const { brain } = fakeBrain(NON_COMPLETING);
  const { lifecycle, calls } = recordingLifecycle();
  const { send, texts, ends } = recordingSend();
  const deps: HandlerDeps = { brain, lifecycle };
  const state = startedState();

  await handlePrompt(deps, state, { text: "Hi there", last: true }, send);

  assert.deepEqual(texts, [{ text: "What's your name?", last: true }]);
  assert.equal(ends.length, 0);
  // No completion for a non-ready turn.
  assert.equal(calls.filter((c) => c.method === "complete").length, 0);
  assert.equal(state.completed, false);
});

test("a completing turn completes the session, speaks the fixed final line, and ends", async () => {
  const { brain } = fakeBrain(COMPLETING);
  const { lifecycle, calls } = recordingLifecycle();
  const { send, texts, ends } = recordingSend();
  const deps: HandlerDeps = { brain, lifecycle };
  const state = startedState();

  await handlePrompt(deps, state, { text: "Jane, cleaning, Friday morning", last: true }, send);

  const completeCall = calls.find((c) => c.method === "complete");
  assert.ok(completeCall, "lifecycle.complete was called");
  assert.deepEqual(completeCall!.input, {
    clinicId: "clinic-1",
    externalSessionId: "CA123",
    status: "captured",
    capturedPatientName: "Jane Doe",
    capturedReason: "Wants a cleaning",
    capturedPreferredTime: "Friday morning",
    handoffNote: null,
    safetySignal: false,
  });
  // The final spoken line is the fixed hand-off line, not the brain's reply.
  assert.deepEqual(texts, [{ text: FINAL_CAPTURE_REPLY, last: true }]);
  assert.deepEqual(ends, [HANDOFF_DATA_CAPTURED]);
  assert.equal(state.completed, true);
  assert.equal(state.status, "captured");
});

test("readyToComplete without enough captured fields does NOT complete", async () => {
  const { brain } = fakeBrain({
    ...COMPLETING,
    capturedPatientName: null,
    capturedPreferredTime: null, // only a reason → below threshold
    reply: "Anything else?",
  });
  const { lifecycle, calls } = recordingLifecycle();
  const { send, texts } = recordingSend();
  const deps: HandlerDeps = { brain, lifecycle };
  const state = startedState();

  await handlePrompt(deps, state, { text: "I have a question", last: true }, send);

  assert.equal(calls.filter((c) => c.method === "complete").length, 0);
  assert.equal(state.completed, false);
  assert.deepEqual(texts, [{ text: "Anything else?", last: true }]);
});

test("dtmf returns a short, safe spoken notice", () => {
  const { send, texts } = recordingSend();
  handleDtmf(send);
  assert.deepEqual(texts, [{ text: DTMF_REPLY, last: true }]);
});
