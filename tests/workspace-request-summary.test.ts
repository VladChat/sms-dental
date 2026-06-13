import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRequestSummary,
  buildWorkspaceRequestSummary,
  deriveRequestCategory,
  derivePaymentInsurance,
  derivePreferredTime,
  deriveSafetyConcern,
  NO_SAFETY_SIGNAL,
  REVIEW_CONVERSATION,
  SAFETY_SIGNAL,
  UNKNOWN_VALUE,
} from "../lib/workspace/request-summary";
import {
  NAME_NOT_PROVIDED,
  normalizeWorkspaceDisplayName,
  validateWorkspaceDisplayNameInput,
} from "../lib/workspace/display-name";

// ------------------------------------------------------------- categories

test("request category detection covers the front-desk vocabulary", () => {
  assert.equal(deriveRequestCategory(["I need a cleaning appointment"]), "Cleaning appointment");
  assert.equal(deriveRequestCategory(["Can I book an appointment?"]), "Appointment request");
  assert.equal(deriveRequestCategory(["I want to schedule a visit"]), "Appointment request");
  assert.equal(deriveRequestCategory(["I need to reschedule my appointment"]), "Reschedule request");
  assert.equal(deriveRequestCategory(["Please cancel my appointment"]), "Cancel request");
  assert.equal(deriveRequestCategory(["How much does a crown cost?"]), "Payment question");
  assert.equal(deriveRequestCategory(["Do you take Delta Dental insurance?"]), "Insurance question");
  assert.equal(deriveRequestCategory(["I have severe tooth pain"]), "Pain / urgent concern");
  assert.equal(deriveRequestCategory(["This is an emergency"]), "Pain / urgent concern");
  assert.equal(deriveRequestCategory(["Hello there"]), "General message");
  assert.equal(deriveRequestCategory([]), "Unknown");
  assert.equal(deriveRequestCategory(["", "   "]), "Unknown");
});

test("category priority: safety wins, then specific intents over generic appointment", () => {
  // Pain trumps appointment words.
  assert.equal(
    deriveRequestCategory(["I have tooth pain and need an appointment"]),
    "Pain / urgent concern",
  );
  // Reschedule trumps the cleaning/appointment words inside the same text.
  assert.equal(
    deriveRequestCategory(["I need to reschedule my cleaning appointment"]),
    "Reschedule request",
  );
  // Insurance trumps generic appointment words.
  assert.equal(
    deriveRequestCategory(["Do you take Aetna? I want to book a visit"]),
    "Insurance question",
  );
});

// ---------------------------------------------------------- preferred time

test("preferred time detection finds explicit simple phrases only", () => {
  assert.equal(derivePreferredTime(["Can you see me today?"]), "Today");
  assert.equal(derivePreferredTime(["appointment need tomorrow"]), "Tomorrow");
  assert.equal(derivePreferredTime(["Tuesday morning works best"]), "Tuesday morning");
  assert.equal(derivePreferredTime(["maybe in the afternoon"]), "Afternoon");
  assert.equal(derivePreferredTime(["how about next week"]), "Next week");
  assert.equal(derivePreferredTime(["10am works"]), "10am");
  assert.equal(derivePreferredTime(["I can do 2:30 PM on Friday"]), "2:30 pm friday");
  assert.equal(derivePreferredTime(["I need an appointment"]), UNKNOWN_VALUE);
  assert.equal(derivePreferredTime([]), UNKNOWN_VALUE);
});

test("preferred time uses the most recent inbound message with a time phrase", () => {
  assert.equal(
    derivePreferredTime(["Tuesday morning please", "actually tomorrow is better"]),
    "Tomorrow",
  );
  // Older message wins only when the newest has no time signal.
  assert.equal(
    derivePreferredTime(["Tuesday morning please", "use Alex Sikorsky as my name"]),
    "Tuesday morning",
  );
});

// ----------------------------------------------------------- safety signal

test("safety concern from inbound text or the safety-notice state", () => {
  assert.equal(
    deriveSafetyConcern({ inboundTexts: ["I have bad tooth pain"], safetyNoticeSent: false }),
    SAFETY_SIGNAL,
  );
  assert.equal(
    deriveSafetyConcern({ inboundTexts: ["swelling and bleeding"], safetyNoticeSent: false }),
    SAFETY_SIGNAL,
  );
  // State signal wins even if the visible text has no safety word.
  assert.equal(
    deriveSafetyConcern({ inboundTexts: ["call me back"], safetyNoticeSent: true }),
    SAFETY_SIGNAL,
  );
  assert.equal(
    deriveSafetyConcern({ inboundTexts: ["I need a cleaning"], safetyNoticeSent: false }),
    NO_SAFETY_SIGNAL,
  );
  assert.equal(deriveSafetyConcern({ inboundTexts: [] }), NO_SAFETY_SIGNAL);
});

// ------------------------------------------------------- payment/insurance

test("payment and insurance detection produces short labels or Unknown", () => {
  assert.equal(derivePaymentInsurance(["Do you take Delta Dental?"]), "Insurance mentioned");
  assert.equal(derivePaymentInsurance(["is my PPO coverage accepted"]), "Insurance mentioned");
  assert.equal(derivePaymentInsurance(["can I pay cash"]), "Payment mentioned");
  assert.equal(derivePaymentInsurance(["what is the price of a cleaning"]), "Payment mentioned");
  assert.equal(derivePaymentInsurance(["I need an appointment"]), UNKNOWN_VALUE);
  assert.equal(derivePaymentInsurance([]), UNKNOWN_VALUE);
});

// --------------------------------------------------------------- composite

test("buildRequestSummary fails closed and never invents values", () => {
  assert.deepEqual(buildRequestSummary({ inboundTexts: [] }), {
    request: "Unknown",
    preferredTime: UNKNOWN_VALUE,
    safetyConcern: NO_SAFETY_SIGNAL,
    paymentInsurance: UNKNOWN_VALUE,
  });

  const summary = buildRequestSummary({
    inboundTexts: [
      "I have tooth pain, can someone see me today?",
      "Do you take Delta Dental insurance?",
    ],
    safetyNoticeSent: true,
  });
  assert.equal(summary.request, "Pain / urgent concern");
  assert.equal(summary.preferredTime, "Today");
  assert.equal(summary.safetyConcern, SAFETY_SIGNAL);
  assert.equal(summary.paymentInsurance, "Insurance mentioned");
});

test("outbound office text is never used as the patient's request", () => {
  // The caller passes inbound texts only; an empty inbound list with rich
  // outbound copy still yields Unknown everywhere.
  const summary = buildRequestSummary({ inboundTexts: [], safetyNoticeSent: false });
  assert.equal(summary.request, "Unknown");
  assert.equal(summary.preferredTime, UNKNOWN_VALUE);
});

// --------------------------------------------- workspace summary headline

test("summary headline: category · time, deterministic only", () => {
  assert.equal(
    buildWorkspaceRequestSummary({ inboundTexts: ["I need a cleaning appointment tomorrow"] }).headline,
    "Cleaning appointment · Tomorrow",
  );
  assert.equal(
    buildWorkspaceRequestSummary({ inboundTexts: ["Can I book an appointment Tuesday morning?"] }).headline,
    "Appointment request · Tuesday morning",
  );
  assert.equal(
    buildWorkspaceRequestSummary({ inboundTexts: ["How much does a crown cost?"] }).headline,
    "Payment question",
  );
  assert.equal(
    buildWorkspaceRequestSummary({ inboundTexts: ["Do you take Delta Dental?"] }).headline,
    "Insurance question",
  );
  assert.equal(
    buildWorkspaceRequestSummary({
      inboundTexts: ["I have bad tooth pain, can someone see me today? Need an appointment"],
    }).headline,
    "Mentions pain/urgent concern · Wants appointment",
  );
});

test("summary headline falls back to Review conversation with no signal", () => {
  assert.equal(buildWorkspaceRequestSummary({ inboundTexts: [] }).headline, REVIEW_CONVERSATION);
  assert.equal(buildWorkspaceRequestSummary({ inboundTexts: [] }).source, "fallback");
  assert.equal(
    buildWorkspaceRequestSummary({ inboundTexts: ["Hello there"] }).headline,
    REVIEW_CONVERSATION,
  );
  assert.equal(
    buildWorkspaceRequestSummary({ inboundTexts: ["I need a cleaning"] }).source,
    "deterministic",
  );
});

test("summary chips never duplicate signals already present in the headline", () => {
  assert.deepEqual(buildWorkspaceRequestSummary({ inboundTexts: ["Hello"] }).chips, []);
  assert.deepEqual(
    buildWorkspaceRequestSummary({ inboundTexts: ["I have tooth pain"] }).chips,
    [],
  );
  assert.deepEqual(
    buildWorkspaceRequestSummary({ inboundTexts: ["Do you take Aetna?"] }).chips,
    [],
  );
  assert.deepEqual(
    buildWorkspaceRequestSummary({ inboundTexts: ["can I pay cash"] }).chips,
    [],
  );
  // A state-only safety signal can still surface as a non-redundant helper chip
  // when the fallback headline does not already say pain/urgent.
  assert.deepEqual(
    buildWorkspaceRequestSummary({ inboundTexts: ["call me"], safetyNoticeSent: true }).chips,
    [{ id: "pain_urgent", label: "Pain/urgent" }],
  );
});

test("future AI summary hook wins over the deterministic line but nothing produces it", () => {
  const ai = buildWorkspaceRequestSummary({
    inboundTexts: ["I need a cleaning"],
    aiSummary: "Wants a cleaning next week, prefers mornings.",
  });
  assert.equal(ai.headline, "Wants a cleaning next week, prefers mornings.");
  assert.equal(ai.source, "ai");
  // Blank AI summary falls straight through to the deterministic line.
  assert.equal(
    buildWorkspaceRequestSummary({ inboundTexts: ["I need a cleaning"], aiSummary: "  " }).source,
    "deterministic",
  );
});

// ------------------------------------------------- display name sanitizing

test("missing or request-like stored names render as Not provided", () => {
  assert.equal(NAME_NOT_PROVIDED, "Not provided");
  assert.equal(normalizeWorkspaceDisplayName(null), null);
  assert.equal(normalizeWorkspaceDisplayName("   "), null);
  // Request text must never display as a name.
  assert.equal(normalizeWorkspaceDisplayName("I Need Appointment"), null);
  assert.equal(normalizeWorkspaceDisplayName("Need Cleaning"), null);
  assert.equal(normalizeWorkspaceDisplayName("Appointment Tomorrow"), null);
  assert.equal(normalizeWorkspaceDisplayName("Tooth Pain"), null);
  // Safe names still display (title-cased).
  assert.equal(normalizeWorkspaceDisplayName("Alex Sikorsky"), "Alex Sikorsky");
  assert.equal(normalizeWorkspaceDisplayName("vlad"), "Vlad");
  assert.equal(normalizeWorkspaceDisplayName("o'brien"), "O'Brien");
});

test("save_name validation: clear on empty, reject unsafe, normalize safe", () => {
  assert.deepEqual(validateWorkspaceDisplayNameInput(""), { ok: true, value: null });
  assert.deepEqual(validateWorkspaceDisplayNameInput("   "), { ok: true, value: null });
  assert.deepEqual(validateWorkspaceDisplayNameInput(undefined), { ok: true, value: null });
  assert.deepEqual(validateWorkspaceDisplayNameInput("alex sikorsky"), {
    ok: true,
    value: "Alex Sikorsky",
  });

  for (const bad of [
    "I Need Appointment",
    "call me at 2245329236",
    "john@example.com",
    "https://example.com",
    "STOP",
    "help",
    "Need Cleaning Tomorrow",
    "John Smith Williams Junior",
    123 as unknown as string,
  ]) {
    const result = validateWorkspaceDisplayNameInput(bad);
    assert.equal(result.ok, false, `must reject: ${String(bad)}`);
  }
});
