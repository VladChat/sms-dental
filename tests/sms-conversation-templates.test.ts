import assert from "node:assert/strict";
import test from "node:test";

import { smsRecoveryConfig } from "../config/sms-recovery.config";
import { buildMissedCallRecoverySmsBody } from "../lib/sms-recovery/templates";
import {
  DEFAULT_FOLLOW_UP_SUGGESTIONS,
  DEFAULT_INITIAL_TEMPLATE,
  SUGGESTED_INITIAL_TEMPLATE,
  buildInitialSmsBody,
  initialTemplateForEditor,
  renderConversationTemplate,
} from "../lib/sms-recovery/conversation-templates";
import { buildRecoverySmsBodyFromConversationConfig } from "../lib/sms-recovery/send-body";
import {
  validateFollowUpBody,
  validateInitialTemplate,
  validateVoiceGreetingTemplate,
} from "../lib/sms-recovery/template-safety";
import {
  DEFAULT_VOICE_GREETING_TEMPLATES,
  renderVoiceGreetingTemplate,
} from "../lib/sms-recovery/voice-greeting-templates";

const CLINIC = "Fairstone Dental Smile";

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

// ----------------------------------------------------------- initial SMS body

test("default initial message equals the current production message exactly", () => {
  const expected =
    "Hi, this is Fairstone Dental Smile. We missed your call. Reply here and our team will follow up. Reply STOP to opt out.";
  assert.equal(buildInitialSmsBody(CLINIC, null), expected);
  assert.equal(buildInitialSmsBody(CLINIC, ""), expected);
  assert.equal(buildInitialSmsBody(CLINIC, "   "), expected);
  assert.equal(buildInitialSmsBody(CLINIC, null), buildMissedCallRecoverySmsBody(CLINIC));
  assert.equal(DEFAULT_INITIAL_TEMPLATE, smsRecoveryConfig.missedCallTemplate);
});

test("platform admin full initial template renders directly", () => {
  const template =
    "Hello, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.";
  const body = buildInitialSmsBody(CLINIC, template);
  assert.equal(
    body,
    "Hello, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.",
  );
  assert.equal(count(body, CLINIC), 1);
  assert.equal(count(body, "Reply STOP to opt out"), 1);
});

test("legacy middle-only initial rows are still wrapped safely", () => {
  const body = buildInitialSmsBody(CLINIC, "Sorry we missed you. How can we help?");
  assert.equal(
    body,
    "Hi, this is Fairstone Dental Smile. Sorry we missed you. How can we help? Reply STOP to opt out.",
  );
  assert.equal(count(body, CLINIC), 1);
  assert.equal(count(body, "Reply STOP to opt out"), 1);
});

test("saved full initial text no longer duplicates clinic identity or STOP", () => {
  const fullTemplate =
    "Hi, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.";
  const body = buildInitialSmsBody(CLINIC, fullTemplate);
  assert.equal(
    body,
    "Hi, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.",
  );
  assert.equal(count(body, CLINIC), 1);
  assert.equal(count(body, "Reply STOP to opt out"), 1);
});

test("real recovery SMS send body helper uses the saved initial template", () => {
  const fullTemplate =
    "Hello, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.";
  const body = buildRecoverySmsBodyFromConversationConfig(CLINIC, {
    initialTemplate: fullTemplate,
  });
  assert.equal(
    body,
    "Hello, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.",
  );
});

test("duplicated initial template text is normalized before final render", () => {
  const duplicated =
    "Hi, this is {{clinic_name}}. Hi, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out. Reply STOP to opt out.";
  const body = buildInitialSmsBody(CLINIC, duplicated);
  assert.equal(
    body,
    "Hi, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.",
  );
  assert.equal(count(body, CLINIC), 1);
  assert.equal(count(body, "Reply STOP to opt out"), 1);
});

test("literal clinic identity rows do not keep a stale clinic name after rename", () => {
  const savedWithOldName =
    "Hello, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.";
  const body = buildInitialSmsBody("Renamed Dental Office", savedWithOldName);
  assert.equal(
    body,
    "Hi, this is Renamed Dental Office. We missed your call. How can we help? Reply STOP to opt out.",
  );
  assert.equal(count(body, "Fairstone Dental Smile"), 0);
  assert.equal(count(body, "Renamed Dental Office"), 1);
  assert.equal(count(body, "Reply STOP to opt out"), 1);
});

test("initial editor shows a full template for defaults and legacy rows", () => {
  assert.equal(initialTemplateForEditor(null, CLINIC), DEFAULT_INITIAL_TEMPLATE);
  assert.equal(
    initialTemplateForEditor("We missed your call. How can we help?", CLINIC),
    "Hi, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.",
  );
  assert.equal(
    initialTemplateForEditor(SUGGESTED_INITIAL_TEMPLATE, CLINIC),
    SUGGESTED_INITIAL_TEMPLATE,
  );
});

test("initial full-template validation preserves identity and STOP requirements", () => {
  assert.equal(validateInitialTemplate("x".repeat(241), CLINIC).ok, false);
  assert.equal(validateInitialTemplate("Limited time discount!", CLINIC).ok, false);
  assert.equal(validateInitialTemplate("Call us at 224-532-9236", CLINIC).ok, false);
  assert.equal(validateInitialTemplate("Visit https://example.com", CLINIC).ok, false);
  assert.equal(validateInitialTemplate("Hi {{patient_name}}", CLINIC).ok, false);

  assert.equal(
    validateInitialTemplate(
      "We missed your call. How can we help? Reply STOP to opt out.",
      CLINIC,
    ).ok,
    false,
  );
  assert.equal(
    validateInitialTemplate(
      "Hi, this is {{clinic_name}}. We missed your call. How can we help?",
      CLINIC,
    ).ok,
    false,
  );
  assert.ok(validateInitialTemplate(SUGGESTED_INITIAL_TEMPLATE, CLINIC).ok);
  assert.ok(
    validateInitialTemplate(
      "Hello, this is Fairstone Dental Smile. We missed your call. How can we help? Reply STOP to opt out.",
      CLINIC,
    ).ok,
  );
  assert.ok(validateInitialTemplate("", CLINIC).ok);
});

test("suggested English copy is current", () => {
  assert.equal(
    SUGGESTED_INITIAL_TEMPLATE,
    "Hi, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.",
  );
  assert.equal(
    DEFAULT_FOLLOW_UP_SUGGESTIONS[1],
    "Thanks. What name should we use when our office follows up?",
  );
  assert.equal(
    DEFAULT_FOLLOW_UP_SUGGESTIONS[2],
    "Thanks, {{patient_name}}. I’ll pass this to the office so they can follow up.",
  );
  assert.equal(
    DEFAULT_FOLLOW_UP_SUGGESTIONS[3],
    "Got it. We’ll include that note for the office.",
  );
});

test("missing clinic name falls back to a neutral identity, never broken text", () => {
  const body = buildInitialSmsBody("", null);
  assert.ok(body.startsWith("Hi, this is your dental office."));
  assert.ok(!body.includes("{{"));
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
  assert.equal(out, "Thanks. I’ll pass this to the office so they can follow up.");
  assert.ok(!out.includes("{{"));
  assert.ok(!out.includes(",  "));
});

test("unknown placeholders are rejected in follow-up validation", () => {
  assert.equal(validateFollowUpBody("Hi {{first_name}}").ok, false);
  assert.equal(validateFollowUpBody("We can book you tomorrow").ok, false);
  assert.equal(validateFollowUpBody("Email us at a@b.com").ok, false);
  assert.ok(validateFollowUpBody("Thanks, {{patient_name}}. We'll follow up.").ok);
  assert.ok(validateFollowUpBody("").ok);
});

test("voice greeting defaults render with clinic identity", () => {
  assert.equal(
    renderVoiceGreetingTemplate(DEFAULT_VOICE_GREETING_TEMPLATES.will_send, { clinicName: CLINIC }),
    "Hi, thanks for calling Fairstone Dental Smile. We're sorry we missed you. We'll send you a text now, so our team can follow up.",
  );
  assert.equal(
    renderVoiceGreetingTemplate(DEFAULT_VOICE_GREETING_TEMPLATES.duplicate, { clinicName: CLINIC }),
    "Hi, thanks for calling Fairstone Dental Smile. We're sorry we missed you. We already sent a text, and our team will follow up shortly.",
  );
  assert.equal(
    renderVoiceGreetingTemplate(DEFAULT_VOICE_GREETING_TEMPLATES.none, { clinicName: CLINIC }),
    "Hi, thanks for calling Fairstone Dental Smile. We're sorry we missed you. Our team will follow up shortly.",
  );
});

test("voice greeting validation permits only safe clinic-name templates", () => {
  assert.ok(validateVoiceGreetingTemplate(DEFAULT_VOICE_GREETING_TEMPLATES.will_send, "will_send").ok);
  assert.equal(validateVoiceGreetingTemplate("Hi {{patient_name}}", "will_send").ok, false);
  assert.equal(validateVoiceGreetingTemplate("Visit https://example.com", "will_send").ok, false);
  assert.equal(validateVoiceGreetingTemplate("Call 224-532-9236", "will_send").ok, false);
  assert.equal(validateVoiceGreetingTemplate("We can book you tomorrow", "will_send").ok, false);
  assert.equal(
    validateVoiceGreetingTemplate(
      "Hi, thanks for calling {{clinic_name}}. We'll send you a text now.",
      "duplicate",
    ).ok,
    false,
  );
  assert.ok(validateVoiceGreetingTemplate(DEFAULT_VOICE_GREETING_TEMPLATES.duplicate, "duplicate").ok);
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
    SUGGESTED_INITIAL_TEMPLATE,
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
