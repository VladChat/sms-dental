import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  getAiAnsweringRuntimeConfig,
  isAiAnsweringRuntimeEnabled,
  parseClinicIdList,
} from "../lib/ai-answering/runtime-config";
import { evaluateAiAnsweringRuntimeGate } from "../lib/ai-answering/runtime-gate";
import {
  normalizeRuntimeSessionPhones,
  sanitizeCapturedRuntimeFields,
} from "../lib/db/ai-voice-runtime-sessions";
import { AiVoiceSessionValidationError } from "../lib/db/ai-voice-sessions";
import {
  AI_VOICE_TRANSCRIPT_RETENTION_DAYS,
  normalizeAiVoiceTranscriptTurns,
  transcriptExpiresAtFrom,
} from "../lib/ai-answering/transcript";
import {
  AI_FRONT_DESK_SAFETY_POLICY,
  buildAiFrontDeskContextFromFacts,
  toRuntimeInstructionText,
} from "../lib/ai-answering/front-desk-context";
import { AI_VOICE_FIELD_LIMITS } from "../config/ai-answering.config";
import type { AiFactsView } from "../lib/db/ai-knowledge";

const REPO_ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

// Snapshot + restore specific env vars around a test body so config reads are
// deterministic and never leak between tests.
function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const keys = Object.keys(vars);
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

const ALLOWED_CLINIC = "f37f24a1-070f-436b-b803-956f55466093";
const ALLOWED_CALLER = "+12245329236";

// ----------------------------------------------------------- runtime config

test("runtime config: missing env defaults to disabled with empty allowlists", () => {
  withEnv(
    {
      AI_ANSWERING_RUNTIME_MODE: undefined,
      AI_ANSWERING_TEST_CLINIC_IDS: undefined,
      AI_ANSWERING_TEST_CALLER_NUMBERS: undefined,
    },
    () => {
      const config = getAiAnsweringRuntimeConfig();
      assert.equal(config.mode, "disabled");
      assert.deepEqual(config.testClinicIds, []);
      assert.deepEqual(config.testCallerNumbers, []);
      assert.equal(isAiAnsweringRuntimeEnabled(), false);
    },
  );
});

test("runtime config: invalid/unknown mode falls back to disabled", () => {
  for (const raw of ["live", "enabled", "TEST_ONLY", "", "  "]) {
    withEnv({ AI_ANSWERING_RUNTIME_MODE: raw }, () => {
      assert.equal(getAiAnsweringRuntimeConfig().mode, "disabled");
    });
  }
});

test("runtime config: test_only parses + normalizes allowlists safely", () => {
  withEnv(
    {
      AI_ANSWERING_RUNTIME_MODE: "test_only",
      AI_ANSWERING_TEST_CLINIC_IDS: `  ${ALLOWED_CLINIC.toUpperCase()} , , other-clinic `,
      AI_ANSWERING_TEST_CALLER_NUMBERS: "2245329236, +1 (312) 555-0000 ,",
    },
    () => {
      const config = getAiAnsweringRuntimeConfig();
      assert.equal(config.mode, "test_only");
      assert.deepEqual(config.testClinicIds, [ALLOWED_CLINIC, "other-clinic"]);
      assert.deepEqual(config.testCallerNumbers, [ALLOWED_CALLER, "+13125550000"]);
      assert.equal(isAiAnsweringRuntimeEnabled(), true);
    },
  );
});

test("parseClinicIdList trims, lowercases, and drops empties", () => {
  assert.deepEqual(parseClinicIdList(" A , b ,, C "), ["a", "b", "c"]);
  assert.deepEqual(parseClinicIdList(null), []);
  assert.deepEqual(parseClinicIdList(""), []);
});

// ------------------------------------------------------------- runtime gate

const baseAllowGateInput = {
  mode: "test_only" as const,
  clinicId: ALLOWED_CLINIC,
  clinicActive: true,
  callerPhone: ALLOWED_CALLER,
  numberRoutingStatus: "active" as const,
  testClinicIds: [ALLOWED_CLINIC],
  testCallerNumbers: [ALLOWED_CALLER],
};

test("runtime gate: disabled mode always blocks", () => {
  const decision = evaluateAiAnsweringRuntimeGate({ ...baseAllowGateInput, mode: "disabled" });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "ai_answering_disabled");
  assert.equal(decision.mode, "disabled");
});

test("runtime gate: test_only blocks a non-allowlisted clinic", () => {
  const decision = evaluateAiAnsweringRuntimeGate({
    ...baseAllowGateInput,
    clinicId: "00000000-0000-0000-0000-000000000000",
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "clinic_not_allowlisted");
  assert.equal(decision.meta.clinicAllowlisted, false);
});

test("runtime gate: test_only blocks a non-allowlisted caller", () => {
  const decision = evaluateAiAnsweringRuntimeGate({
    ...baseAllowGateInput,
    callerPhone: "+13125550000",
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "caller_not_allowlisted");
  assert.equal(decision.meta.callerAllowlisted, false);
});

test("runtime gate: test_only allows the exact allowlisted clinic + caller", () => {
  const decision = evaluateAiAnsweringRuntimeGate(baseAllowGateInput);
  assert.equal(decision.ok, true);
  assert.equal(decision.reason, "allowed_test_only");
  assert.equal(decision.meta.clinicAllowlisted, true);
  assert.equal(decision.meta.callerAllowlisted, true);
  assert.equal(decision.meta.numberRoutable, true);
});

test("runtime gate: an inactive clinic blocks before allowlist passes", () => {
  const decision = evaluateAiAnsweringRuntimeGate({ ...baseAllowGateInput, clinicActive: false });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "clinic_inactive");
});

test("runtime gate: an invalid/missing caller phone blocks", () => {
  assert.equal(
    evaluateAiAnsweringRuntimeGate({ ...baseAllowGateInput, callerPhone: "not-a-phone" }).reason,
    "invalid_caller_phone",
  );
  assert.equal(
    evaluateAiAnsweringRuntimeGate({ ...baseAllowGateInput, callerPhone: null }).reason,
    "invalid_caller_phone",
  );
});

test("runtime gate: a scheduled or removed number is never routable", () => {
  for (const status of ["scheduled", "removed"] as const) {
    const decision = evaluateAiAnsweringRuntimeGate({
      ...baseAllowGateInput,
      numberRoutingStatus: status,
    });
    assert.equal(decision.ok, false);
    assert.equal(decision.reason, "number_not_routable");
    assert.equal(decision.meta.numberRoutable, false);
  }
});

test("runtime gate: a missing clinic id blocks in test_only", () => {
  assert.equal(
    evaluateAiAnsweringRuntimeGate({ ...baseAllowGateInput, clinicId: "" }).reason,
    "missing_clinic",
  );
});

// ------------------------------------------------- runtime session (pure)

test("sanitizeCapturedRuntimeFields cleans placeholders and derives a headline", () => {
  const fields = sanitizeCapturedRuntimeFields({
    status: "captured",
    capturedPatientName: "  Jane Doe  ",
    capturedReason: "Wants a cleaning",
    capturedPreferredTime: "Friday morning",
    // Label-like placeholder must be dropped exactly like the mock route does.
    handoffNote: "Handoff note (optional)",
    safetySignal: true,
  });
  assert.equal(fields.capturedPatientName, "Jane Doe");
  assert.equal(fields.capturedReason, "Wants a cleaning");
  assert.equal(fields.capturedPreferredTime, "Friday morning");
  assert.equal(fields.handoffNote, null);
  assert.equal(fields.safetySignal, true);
  // Deterministic summary derived from reason + preferred time.
  assert.equal(fields.summaryHeadline, "Wants a cleaning · Friday morning");
});

test("sanitizeCapturedRuntimeFields truncates overlong fields and fails closed on summary", () => {
  const longReason = "x".repeat(AI_VOICE_FIELD_LIMITS.capturedReason + 50);
  const fields = sanitizeCapturedRuntimeFields({ status: "incomplete", capturedReason: longReason });
  assert.equal(fields.capturedReason?.length, AI_VOICE_FIELD_LIMITS.capturedReason);
  // No reason headline derivation keeps the generic fallback out of storage.
  const empty = sanitizeCapturedRuntimeFields({ status: "incomplete" });
  assert.equal(empty.summaryHeadline, null);
  assert.equal(empty.capturedReason, null);
});

test("normalizeRuntimeSessionPhones rejects an invalid caller phone", () => {
  assert.throws(
    () => normalizeRuntimeSessionPhones({ patientPhone: "12" }),
    AiVoiceSessionValidationError,
  );
  assert.throws(
    () => normalizeRuntimeSessionPhones({ patientPhone: ALLOWED_CALLER, clinicPhone: "nope" }),
    AiVoiceSessionValidationError,
  );
  const ok = normalizeRuntimeSessionPhones({ patientPhone: "2245329236" });
  assert.equal(ok.patientPhone, ALLOWED_CALLER);
  assert.equal(ok.clinicPhone, null);
});

test("transcript helper stores normalized text turns only with bounded retention", () => {
  const turns = normalizeAiVoiceTranscriptTurns([
    { speaker: "user", text: "  Hi, my name is Alex.  ", at: "2026-06-15T03:14:00.000Z" },
    { role: "assistant", text: "How can the office help?", timestamp: "2026-06-15T03:14:05.000Z" },
    { speaker: "system", text: "drop this" },
    { speaker: "patient", text: "   " },
  ]);
  assert.deepEqual(turns, [
    {
      speaker: "patient",
      text: "Hi, my name is Alex.",
      sequence: 1,
      at: "2026-06-15T03:14:00.000Z",
    },
    {
      speaker: "ai",
      text: "How can the office help?",
      sequence: 2,
      at: "2026-06-15T03:14:05.000Z",
    },
  ]);

  const base = new Date("2026-06-15T00:00:00.000Z");
  assert.equal(
    transcriptExpiresAtFrom(base).toISOString(),
    new Date(base.getTime() + AI_VOICE_TRANSCRIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  );
});

// ---------------------------------------- runtime session (source guards)

test("runtime session helper is idempotent, provider-free, SMS-free, and stores normalized transcript turns", () => {
  const src = read(path.join("lib", "db", "ai-voice-runtime-sessions.ts"));
  // Only ever writes the reserved future source — never `mock`.
  assert.ok(src.includes("'future_twilio'"));
  assert.ok(!src.includes("'mock'"), "runtime helper never writes the mock source");
  // Idempotent start via the (clinic, source, external id) unique index, as an
  // incomplete session with started_at = now().
  assert.ok(src.includes("on conflict (clinic_id, source, external_session_id)"));
  assert.ok(src.includes("'incomplete', now()"));
  // Reuses the shared sanitizer limits, not a private copy.
  assert.ok(src.includes("trimToLimit"));
  assert.ok(src.includes("AI_VOICE_FIELD_LIMITS"));
  // No live AI / SMS / provider calls. Transcripts are normalized text only.
  assert.ok(!/from ["'][^"']*openai[^"']*["']/i.test(src), "runtime helper imports no openai sdk");
  assert.ok(!src.includes("getTwilioClient"), "runtime helper makes no Twilio client");
  assert.ok(!src.includes("messages.create"), "runtime helper sends no SMS");
  assert.ok(!src.includes("sendRecoverySms"), "runtime helper sends no recovery SMS");
  assert.ok(!src.includes("raw_payload"), "runtime helper writes no raw payload column");
  assert.ok(src.includes("normalizeAiVoiceTranscriptTurns"));
  assert.ok(src.includes("transcript_turns = ${transcriptJson}::jsonb"));
  assert.ok(src.includes("transcript_expires_at = ${transcriptExpiresAt}"));
  assert.ok(!/\baudio\s*[=,]/.test(src), "runtime helper writes no audio column");
});

test("captured completion links + touches a conversation; incomplete/failed does not create one", () => {
  const src = read(path.join("lib", "db", "ai-voice-runtime-sessions.ts"));
  const conversationSrc = read(path.join("lib", "db", "conversations.ts"));
  // The incomplete/failed branch returns BEFORE any conversation is created.
  const guardIdx = src.indexOf('if (input.status !== "captured")');
  const getOrCreateIdx = src.indexOf("getOrCreateConversation(input.clinicId, session.patient_phone)");
  const touchIdx = src.indexOf("await touchConversation(conversation.id)");
  assert.ok(guardIdx >= 0, "non-captured branch exists");
  assert.ok(getOrCreateIdx > guardIdx, "conversation is only created in the captured path");
  assert.ok(touchIdx > getOrCreateIdx, "conversation is touched after it is linked");
  // Exactly one get-or-create call (the captured path).
  assert.equal(
    src.split("getOrCreateConversation(").length - 1,
    1,
    "only the captured path creates a conversation",
  );
  // Secondary failures are logged with safe metadata only (no patient phone).
  assert.ok(src.includes('logger.warn("ai_answering.runtime_session.touch_conversation_failed"'));
  assert.ok(src.includes("failAiVoiceRuntimeSession"));
  // Patient name is stored as a caller-level fact only when blank.
  assert.ok(src.includes("setPatientDisplayNameIfEmpty(conversation.id, safeName)"));
  assert.ok(conversationSrc.includes("and (patient_display_name is null or patient_display_name = '')"));
});

// -------------------------------------------------- AI front desk context

// Minimal AiFactsView builder. Defaults to a saved-but-empty clinic; override
// any section for a specific case.
function makeFacts(overrides: Partial<AiFactsView> = {}): AiFactsView {
  const base: AiFactsView = {
    hours: {
      timezone: "America/Chicago",
      persisted: false,
      suggested: false,
      days: [],
    },
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
      methods: {
        cash: null,
        creditDebitCards: null,
        personalChecks: null,
        hsaFsaCards: null,
        bankTransferAch: null,
      },
      financing: {
        inOfficePaymentPlans: null,
        carecredit: null,
        alphaeonCredit: null,
        membershipPlan: null,
        customOptions: [],
      },
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
  return { ...base, ...overrides };
}

function entry(key: string, label: string, selected: boolean, suggested = false) {
  return { key, label, selected, isCustom: false, suggested };
}

test("front desk context includes selected approved facts and omits the rest", () => {
  const facts = makeFacts({
    services: [
      entry("cleanings", "Cleanings", true),
      entry("crowns", "Crowns", false), // unselected → omitted
      entry("whitening", "Whitening", true, true), // suggested (needs_review) → omitted
    ],
    insurancePlans: [entry("delta_dental", "Delta Dental", true)],
    payment: {
      methods: {
        cash: true,
        creditDebitCards: true,
        personalChecks: null,
        hsaFsaCards: null,
        bankTransferAch: null,
      },
      financing: {
        inOfficePaymentPlans: true,
        carecredit: null,
        alphaeonCredit: null,
        membershipPlan: null,
        customOptions: [],
      },
      persisted: true,
      suggested: false,
    },
    languages: {
      items: [entry("lang_english", "English", true), entry("lang_spanish", "Spanish", false)],
      persisted: true,
    },
  });

  const context = buildAiFrontDeskContextFromFacts(facts, "  Test Dental Clinic  ");
  assert.equal(context.clinicName, "Test Dental Clinic");
  assert.deepEqual(context.services, ["Cleanings"]);
  assert.deepEqual(context.insurancePlans, ["Delta Dental"]);
  assert.deepEqual(context.paymentMethods, ["Credit/debit cards", "Cash"]);
  assert.deepEqual(context.financingOptions, ["In-office payment plans"]);
  assert.deepEqual(context.languages, ["English"]);
});

test("front desk context omits suggested/unsaved sections (no invented answers)", () => {
  const suggestedHours = makeFacts({
    hours: {
      timezone: "America/Chicago",
      persisted: true,
      suggested: true, // website draft not saved → excluded
      days: [{ weekday: 1, closed: false, opensAt: "08:00", closesAt: "17:00" }],
    },
    appointments: {
      acceptingNewPatients: true,
      cleaningAppointments: null,
      sameDayAppointments: null,
      emergencyAppointments: null,
      rescheduleCancelRequests: null,
      preferredTimeQuestion: "What time works?",
      persisted: false, // never saved → excluded
      suggested: false,
    },
  });
  const context = buildAiFrontDeskContextFromFacts(suggestedHours, null);
  assert.equal(context.hours, null);
  assert.equal(context.appointmentSettings, null);
  assert.equal(context.officePolicies, null);
  assert.equal(context.clinicName, null);
  // Nothing invented: every fact-derived collection is empty.
  assert.deepEqual(context.services, []);
  assert.deepEqual(context.paymentMethods, []);
  assert.deepEqual(context.financingOptions, []);
});

test("front desk context always carries the fixed safety + fallback policy", () => {
  const context = buildAiFrontDeskContextFromFacts(makeFacts(), null);
  assert.equal(context.safetyPolicy, AI_FRONT_DESK_SAFETY_POLICY);
  assert.equal(context.fallbackPolicy.unknownAnswer, "send to office");
  const joined = context.safetyPolicy.rules.join(" ").toLowerCase();
  assert.ok(joined.includes("never provide a diagnosis"));
  assert.ok(joined.includes("never give treatment advice"));
  assert.ok(joined.includes("clinical triage"));
  assert.equal(context.safetyPolicy.emergencyPhrase, "If this is a medical emergency, call 911.");
});

test("front desk instruction text only states policy medical language, never invents clinical advice", () => {
  const facts = makeFacts({
    services: [entry("cleanings", "Cleanings", true), entry("fillings", "Fillings", true)],
  });
  const text = toRuntimeInstructionText(buildAiFrontDeskContextFromFacts(facts, "Clinic"));
  assert.ok(text.includes("Services offered: Cleanings, Fillings."));
  assert.ok(text.includes("send to office"));
  // Strip the fixed safety-rules section; the remaining (fact-derived) text must
  // contain no diagnosis/treatment/triage/medication language.
  const beforeSafety = text.slice(0, text.indexOf("Safety rules:"));
  for (const banned of ["diagnos", "treatment", "triage", "medication", "prescri"]) {
    assert.ok(
      !beforeSafety.toLowerCase().includes(banned),
      `fact-derived instruction text avoids "${banned}"`,
    );
  }
});
