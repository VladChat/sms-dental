import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultVoiceOption,
  voiceGreetingConfig,
} from "../config/voice-greeting.config";
import {
  buildInactiveNumberVoiceTwiml,
  buildMissedCallVoiceTwiml,
} from "../lib/sms-recovery/voice-twiml";

const OLD_BASIC_VOICES = new Set(["alice", "man", "woman"]);

test("curated voice options stay small and balanced", () => {
  assert.equal(voiceGreetingConfig.options.length, 10);
  assert.equal(
    voiceGreetingConfig.options.filter((voice) => voice.genderPresentation === "female").length,
    5,
  );
  assert.equal(
    voiceGreetingConfig.options.filter((voice) => voice.genderPresentation === "male").length,
    5,
  );
});

test("voice options are English US and exclude old basic voices", () => {
  for (const option of voiceGreetingConfig.options) {
    assert.equal(option.language, "en-US");
    assert.ok(option.twilioVoice.startsWith("Google.") || option.twilioVoice.startsWith("Polly."));
    assert.ok(!OLD_BASIC_VOICES.has(option.twilioVoice.toLowerCase()));
  }
});

test("default voice id exists in the curated options", () => {
  const option = getDefaultVoiceOption();
  assert.equal(option.id, voiceGreetingConfig.defaultVoiceId);
  assert.equal(option.language, voiceGreetingConfig.defaultLanguage);
});

test("missed-call TwiML uses configured voice and language", () => {
  const option = getDefaultVoiceOption();
  const twiml = buildMissedCallVoiceTwiml("Fairstone Dental Smile", "will_send");

  assert.ok(twiml.includes(`language="${voiceGreetingConfig.defaultLanguage}"`));
  assert.ok(twiml.includes(`voice="${option.twilioVoice}"`));
  assert.ok(!twiml.includes('voice="alice"'));
  assert.ok(twiml.includes("We&apos;ll send you a text now so our team can follow up."));
});

test("missed-call TwiML escapes clinic names", () => {
  const twiml = buildMissedCallVoiceTwiml('A&B <Dental> "Smile"', "duplicate");

  assert.ok(twiml.includes("A&amp;B &lt;Dental&gt; &quot;Smile&quot;"));
  assert.ok(!twiml.includes("<Dental>"));
  assert.ok(twiml.includes("We already sent a text, and our team will follow up shortly."));
});

test("missed-call TwiML uses saved voice greeting templates", () => {
  const twiml = buildMissedCallVoiceTwiml("Fairstone Dental Smile", "none", {
    will_send: { body: null },
    duplicate: { body: null },
    none: { body: "Hello {{clinic_name}}. The office will follow up." },
  });

  assert.ok(twiml.includes("Hello Fairstone Dental Smile. The office will follow up."));
  assert.ok(!twiml.includes("Our team will follow up shortly."));
});

test("fallback and inactive-number TwiML use the configured voice", () => {
  const option = getDefaultVoiceOption();
  const noSmsTwiml = buildMissedCallVoiceTwiml(null, "none");
  const inactiveTwiml = buildInactiveNumberVoiceTwiml();

  assert.ok(noSmsTwiml.includes("Hi, thanks for calling us."));
  assert.ok(noSmsTwiml.includes(`voice="${option.twilioVoice}"`));
  assert.ok(inactiveTwiml.includes(`voice="${option.twilioVoice}"`));
  assert.ok(inactiveTwiml.includes("This number is no longer in service."));
});
