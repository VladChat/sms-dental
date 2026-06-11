import assert from "node:assert/strict";
import test from "node:test";

import { smsRecoveryConfig } from "../config/sms-recovery.config";
import { buildMissedCallRecoverySmsBody } from "../lib/sms-recovery/templates";
import {
  DEFAULT_FOLLOW_UP_SUGGESTIONS,
  DEFAULT_INITIAL_MIDDLE,
  buildInitialSmsBody,
  renderConversationTemplate,
} from "../lib/sms-recovery/conversation-templates";
import {
  validateFollowUpBody,
  validateInitialMiddle,
} from "../lib/sms-recovery/template-safety";

const CLINIC = "Fairstone Dental Smile";

// ----------------------------------------------------------- initial SMS body

test("default initial message equals the current production message exactly", () => {
  const expected =
    "Hi, this is Fairstone Dental Smile. We missed your call. Reply here and our team will follow up. Reply STOP to opt out.";
  // No admin middle (null) and empty string both produce the fixed default.
  assert.equal(buildInitialSmsBody(CLINIC, null), expected);
  assert.equal(buildInitialSmsBody(CLINIC, ""), expected);
  assert.equal(buildInitialSmsBody(CLINIC, "   "), expected);
  // And it matches the existing fixed builder byte-for-byte.
  assert.equal(buildInitialSmsBody(CLINIC, null), buildMissedCallRecoverySmsBody(CLINIC));
  // The committed default middle is what produces that message.
  assert.ok(smsRecoveryConfig.missedCallTemplate.includes(DEFAULT_INITIAL_MIDDLE));
});

test("custom initial middle composes the correct final SMS with locked parts", () => {
  const body = buildInitialSmsBody(CLINIC, "Sorry we missed you. How can we help?");
  assert.equal(
    body,
    "Hi, this is Fairstone Dental Smile. Sorry we missed you. How can we help? Reply STOP to opt out.",
  );
  // Clinic identity prefix and STOP suffix are always present.
  assert.ok(body.startsWith("Hi, this is Fairstone Dental Smile."));
  assert.ok(body.endsWith("Reply STOP to opt out."));
});

test("missing clinic name falls back to a neutral identity, never broken text", () => {
  const body = buildInitialSmsBody("", null);
  assert.ok(body.startsWith("Hi, this is your dental office."));
  assert.ok(!body.includes("{{"));
});

test("initial middle validation rejects overlong and unsafe text", () => {
  assert.equal(validateInitialMiddle("x".repeat(241)).ok, false);
  assert.equal(validateInitialMiddle("Limited time discount!").ok, false);
  assert.equal(validateInitialMiddle("Call us at 224-532-9236").ok, false);
  assert.equal(validateInitialMiddle("Visit https://example.com").ok, false);
  // {{patient_name}} is not available at first contact.
  assert.equal(validateInitialMiddle("Hi {{patient_name}}").ok, false);
  // {{clinic_name}} is allowed; a normal neutral middle passes.
  assert.ok(validateInitialMiddle("We missed your call. How can we help?").ok);
  assert.ok(validateInitialMiddle("").ok); // empty => default
});

// ---------------------------------------------------------- follow-up render

test("{{clinic_name}} and {{patient_name}} render when present", () => {
  const out = renderConversationTemplate("Thanks, {{patient_name}}. — {{clinic_name}}", {
    clinicName: CLINIC,
    patientName: "John",
  });
  assert.equal(out, "Thanks, John. — Fairstone Dental Smile");
});

test("missing patient name produces natural text, not broken placeholders", () => {
  const out = renderConversationTemplate(DEFAULT_FOLLOW_UP_SUGGESTIONS[2], {
    clinicName: CLINIC,
    patientName: null,
  });
  // "Thanks, {{patient_name}}. I’ll pass…" -> "Thanks. I’ll pass…"
  assert.equal(out, "Thanks. I’ll pass this to the office so they can follow up.");
  assert.ok(!out.includes("{{"));
  assert.ok(!out.includes(",  "));
});

test("unknown placeholders are rejected in follow-up validation", () => {
  assert.equal(validateFollowUpBody("Hi {{first_name}}").ok, false);
  assert.equal(validateFollowUpBody("We can book you tomorrow").ok, false); // banned phrase
  assert.equal(validateFollowUpBody("Email us at a@b.com").ok, false);
  assert.ok(validateFollowUpBody("Thanks, {{patient_name}}. We'll follow up.").ok);
  assert.ok(validateFollowUpBody("").ok); // empty => disabled slot
});

test("rendered follow-up never leaves an unresolved placeholder", () => {
  for (const slot of [1, 2, 3] as const) {
    const withName = renderConversationTemplate(DEFAULT_FOLLOW_UP_SUGGESTIONS[slot], {
      clinicName: CLINIC,
      patientName: "Sam",
    });
    const withoutName = renderConversationTemplate(DEFAULT_FOLLOW_UP_SUGGESTIONS[slot], {
      clinicName: CLINIC,
      patientName: null,
    });
    assert.ok(!withName.includes("{{") && !withName.includes("}}"));
    assert.ok(!withoutName.includes("{{") && !withoutName.includes("}}"));
  }
});

test("safety validation allows normal dental-office-neutral language", () => {
  for (const ok of [
    "We missed your call. How can we help?",
    "Thanks. The office will follow up.",
    "What name should we use?",
    "We’ll pass this to the office.",
  ]) {
    assert.ok(validateFollowUpBody(ok).ok, `should allow: ${ok}`);
  }
});

test("safety validation rejects shouting and excessive punctuation", () => {
  assert.equal(validateFollowUpBody("CALL US RIGHT NOW PLEASE").ok, false);
  assert.equal(validateFollowUpBody("Hurry!!!").ok, false);
});
