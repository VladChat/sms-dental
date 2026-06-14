import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSystemInstruction,
  parseBrainResult,
  createOpenAiBrain,
  createDeterministicBrain,
  safeFallbackResult,
  SAFE_FALLBACK_REPLY,
  type BrainResult,
  type OpenAiResponsesClient,
} from "../src/openai-brain";
import { buildAiFrontDeskContextFromFacts } from "../../../lib/ai-answering/front-desk-context";
import type { AiFactsView } from "../../../lib/db/ai-knowledge";

// Minimal saved-but-empty AiFactsView (mirrors the Next-side test helper).
function makeFacts(): AiFactsView {
  return {
    hours: { timezone: "America/Chicago", persisted: false, suggested: false, days: [] },
    services: [],
    insurancePlans: [],
    appointments: {
      acceptingNewPatients: null,
      cleaningAppointments: null,
      sameDayAppointments: null,
      emergencyAppointments: null,
      rescheduleCancelRequests: null,
      preferredTimeQuestion: "What name should we use, and what day or time works best?",
      persisted: false,
      suggested: false,
    },
    payment: {
      methods: { cash: null, creditDebitCards: null, personalChecks: null, hsaFsaCards: null, bankTransferAch: null },
      financing: { inOfficePaymentPlans: null, carecredit: null, alphaeonCredit: null, membershipPlan: null, customOptions: [] },
      persisted: false,
      suggested: false,
    },
    policies: {
      newPatientForms: null,
      whatToBring: null,
      cancellationPolicy: null,
      parkingNotes: null,
      accessibilityNotes: null,
      persisted: false,
      suggested: false,
    },
    languages: { items: [], persisted: false },
    reviewedSections: {} as AiFactsView["reviewedSections"],
    lastScan: null,
  };
}

const VALID_JSON = JSON.stringify({
  reply: "Sure — what's your name?",
  capturedPatientName: null,
  capturedReason: "Tooth cleaning",
  capturedPreferredTime: null,
  readyToComplete: false,
  safetySignal: false,
  handoffNote: null,
});

function mockClient(output: string | (() => Promise<string>)): OpenAiResponsesClient {
  return {
    responses: {
      async create() {
        const text = typeof output === "function" ? await output() : output;
        return { output_text: text };
      },
    },
  };
}

// ---------------------------------------------------------- system instruction

test("system instruction states the safety prohibitions and the exact 911 line", () => {
  const context = buildAiFrontDeskContextFromFacts(makeFacts(), "Test Dental Clinic");
  const instruction = buildSystemInstruction(context);
  assert.ok(instruction.includes("Test Dental Clinic"));
  // Prohibitions are present (it instructs the model NOT to do clinical work).
  assert.ok(/never provide a diagnosis/i.test(instruction));
  assert.ok(/never give treatment advice/i.test(instruction));
  assert.ok(/never give medication instructions/i.test(instruction));
  assert.ok(/triage/i.test(instruction));
  assert.ok(instruction.includes('"If this is a medical emergency, call 911."'));
  // It collects the three target fields and demands strict JSON output.
  assert.ok(/name/i.test(instruction) && /reason/i.test(instruction));
  assert.ok(instruction.includes('"readyToComplete"'));
  assert.ok(instruction.includes('"safetySignal"'));
});

// ------------------------------------------------------------- JSON parsing

test("parseBrainResult accepts valid JSON", () => {
  const parsed = parseBrainResult(VALID_JSON);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.capturedReason, "Tooth cleaning");
});

test("parseBrainResult accepts JSON wrapped in markdown code fences", () => {
  const parsed = parseBrainResult("```json\n" + VALID_JSON + "\n```");
  assert.equal(parsed.ok, true);
});

test("parseBrainResult rejects non-JSON and schema-invalid output", () => {
  assert.equal(parseBrainResult("I cannot help with that.").ok, false);
  assert.equal(parseBrainResult("").ok, false);
  assert.equal(parseBrainResult(JSON.stringify({ reply: "hi" })).ok, false); // missing required keys
});

// --------------------------------------------------------------- OpenAI brain

test("OpenAI brain returns the parsed result on valid model JSON", async () => {
  const brain = createOpenAiBrain({ client: mockClient(VALID_JSON), model: "test-model" });
  const result = await brain.respond({
    context: null,
    captured: { name: null, reason: null, preferredTime: null },
    turns: [{ role: "user", text: "I need a cleaning" }],
  });
  assert.equal(result.capturedReason, "Tooth cleaning");
  assert.equal(result.readyToComplete, false);
});

test("OpenAI brain falls back safely on invalid model JSON (never completes from it)", async () => {
  const brain = createOpenAiBrain({ client: mockClient("totally not json"), model: "test-model" });
  const result = await brain.respond({
    context: null,
    captured: { name: null, reason: null, preferredTime: null },
    turns: [{ role: "user", text: "hello" }],
  });
  assert.equal(result.reply, SAFE_FALLBACK_REPLY);
  assert.equal(result.readyToComplete, false);
  assert.deepEqual(result, safeFallbackResult());
});

test("OpenAI brain falls back safely when the API call throws", async () => {
  const brain = createOpenAiBrain({
    client: mockClient(async () => {
      throw new Error("network down");
    }),
    model: "test-model",
  });
  const result = await brain.respond({
    context: null,
    captured: { name: null, reason: null, preferredTime: null },
    turns: [{ role: "user", text: "hello" }],
  });
  assert.equal(result.readyToComplete, false);
  assert.equal(result.reply, SAFE_FALLBACK_REPLY);
});

// ----------------------------------------------------- deterministic fallback

test("deterministic brain captures name, then reason, then preferred time", async () => {
  const brain = createDeterministicBrain();
  let captured = { name: null as string | null, reason: null as string | null, preferredTime: null as string | null };
  const turns: Array<{ role: "user" | "assistant"; text: string }> = [];

  async function turn(text: string): Promise<BrainResult> {
    turns.push({ role: "user", text });
    const r = await brain.respond({ context: null, captured, turns });
    captured = {
      name: r.capturedPatientName,
      reason: r.capturedReason,
      preferredTime: r.capturedPreferredTime,
    };
    turns.push({ role: "assistant", text: r.reply });
    return r;
  }

  const r1 = await turn("Jane Doe");
  assert.equal(r1.capturedPatientName, "Jane Doe");
  assert.equal(r1.readyToComplete, false);

  const r2 = await turn("I need a cleaning");
  assert.equal(r2.capturedReason, "I need a cleaning");
  assert.equal(r2.readyToComplete, false);

  const r3 = await turn("Friday morning");
  assert.equal(r3.capturedPreferredTime, "Friday morning");
  assert.equal(r3.readyToComplete, true);
});

test("deterministic brain raises a safety flag on urgent words without giving advice", async () => {
  const brain = createDeterministicBrain();
  const result = await brain.respond({
    context: null,
    captured: { name: null, reason: null, preferredTime: null },
    turns: [{ role: "user", text: "I have severe tooth pain and swelling" }],
  });
  assert.equal(result.safetySignal, true);
  for (const banned of ["diagnos", "prescri", "take ibuprofen", "treatment"]) {
    assert.ok(!result.reply.toLowerCase().includes(banned), `safety reply avoids "${banned}"`);
  }
});
