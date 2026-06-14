import test from "node:test";
import assert from "node:assert/strict";

import {
  handleSetup,
  handleClose,
  handleError,
  type HandlerDeps,
  type SessionLifecycle,
} from "../src/conversation-handler";
import { createRelaySessionState, type RelaySessionState } from "../src/session-state";
import type { FrontDeskBrain } from "../src/openai-brain";

const NOOP_BRAIN: FrontDeskBrain = {
  async respond() {
    return {
      reply: "ok",
      capturedPatientName: null,
      capturedReason: null,
      capturedPreferredTime: null,
      readyToComplete: false,
      safetySignal: false,
      handoffNote: null,
    };
  },
};

function recordingLifecycle() {
  const calls: Array<{ method: "start" | "complete"; input: any }> = [];
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

function freshState(): RelaySessionState {
  return createRelaySessionState({
    clinicId: "clinic-1",
    callSid: "CA999",
    from: "+12245329236",
    to: "+18447234944",
  });
}

test("handleSetup starts the session keyed on the call sid (idempotent external id)", async () => {
  const { lifecycle, calls } = recordingLifecycle();
  const deps: HandlerDeps = { brain: NOOP_BRAIN, lifecycle };
  const state = freshState();

  await handleSetup(deps, state);

  assert.equal(state.started, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "start");
  assert.deepEqual(calls[0].input, {
    clinicId: "clinic-1",
    externalSessionId: "CA999",
    patientPhone: "+12245329236",
    clinicPhone: "+18447234944",
  });
});

test("handleSetup tolerates a context load failure (still starts)", async () => {
  const { lifecycle, calls } = recordingLifecycle();
  let warned = "";
  const deps: HandlerDeps = {
    brain: NOOP_BRAIN,
    lifecycle,
    loadContext: async () => {
      throw new Error("db unavailable");
    },
    onWarn: (code) => {
      warned = code;
    },
  };
  const state = freshState();

  await handleSetup(deps, state);

  assert.equal(state.started, true);
  assert.equal(state.context, null);
  assert.equal(warned, "context_load_failed");
  assert.equal(calls.filter((c) => c.method === "start").length, 1);
});

test("captured completion on close persists a captured request (Workspace request path)", async () => {
  const { lifecycle, calls } = recordingLifecycle();
  const deps: HandlerDeps = { brain: NOOP_BRAIN, lifecycle };
  const state = freshState();
  state.started = true;
  // Enough captured to create a request: reason + (name or preferred time).
  state.captured.reason = "Wants a cleaning";
  state.captured.name = "Jane Doe";

  await handleClose(deps, state);

  const complete = calls.find((c) => c.method === "complete");
  assert.ok(complete, "complete was called");
  assert.equal(complete!.input.status, "captured");
  assert.equal(complete!.input.capturedReason, "Wants a cleaning");
  assert.equal(state.status, "captured");
});

test("incomplete close (insufficient capture) marks incomplete and creates no captured request", async () => {
  const { lifecycle, calls } = recordingLifecycle();
  const deps: HandlerDeps = { brain: NOOP_BRAIN, lifecycle };
  const state = freshState();
  state.started = true;
  // Only a name — below the capture threshold (needs a reason).
  state.captured.name = "Jane";

  await handleClose(deps, state);

  const complete = calls.find((c) => c.method === "complete");
  assert.ok(complete, "complete was called");
  assert.equal(complete!.input.status, "incomplete");
  assert.equal(state.status, "incomplete");
});

test("close on an already-completed session is a no-op", async () => {
  const { lifecycle, calls } = recordingLifecycle();
  const deps: HandlerDeps = { brain: NOOP_BRAIN, lifecycle };
  const state = freshState();
  state.started = true;
  state.completed = true;
  state.status = "captured";

  await handleClose(deps, state);

  assert.equal(calls.length, 0);
});

test("close before setup completed is a no-op (no session was started)", async () => {
  const { lifecycle, calls } = recordingLifecycle();
  const deps: HandlerDeps = { brain: NOOP_BRAIN, lifecycle };
  const state = freshState(); // started = false

  await handleClose(deps, state);

  assert.equal(calls.length, 0);
});

test("handleError fails the session safely when started and not completed", async () => {
  const { lifecycle, calls } = recordingLifecycle();
  const deps: HandlerDeps = { brain: NOOP_BRAIN, lifecycle };
  const state = freshState();
  state.started = true;

  await handleError(deps, state);

  const complete = calls.find((c) => c.method === "complete");
  assert.ok(complete, "complete was called");
  assert.equal(complete!.input.status, "failed");
  assert.equal(state.status, "failed");
});
