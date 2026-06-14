import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  buildConversationRelayTwiml,
  buildConversationRelayWelcomeGreeting,
  ConversationRelayConfigError,
} from "../lib/ai-answering/conversation-relay-twiml";
import { verifyRelayToken, signRelayToken } from "../lib/ai-answering/relay-token";
import { decideAiAnsweringIncoming } from "../lib/ai-answering/incoming-plan";
import { getAiAnsweringRelayConfigSafe, hasAiAnsweringRelayConfigured } from "../lib/env";

const REPO_ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const ALLOWED_CLINIC = "f37f24a1-070f-436b-b803-956f55466093";
const ALLOWED_CALLER = "+12245329236";
const CLINIC_NUMBER = "+18447234944";
const SECRET = "unit-test-relay-signing-secret";
const WS_URL = "wss://relay.example.com/twilio/conversation-relay";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const keys = Object.keys(vars);
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k] as string;
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

// ------------------------------------------------- ConversationRelay TwiML

test("ConversationRelay TwiML has <Connect><ConversationRelay> with the required attributes", () => {
  const xml = buildConversationRelayTwiml({
    wsUrl: WS_URL,
    signingSecret: SECRET,
    clinicId: ALLOWED_CLINIC,
    callSid: "CA00000000000000000000000000000001",
    from: ALLOWED_CALLER,
    to: CLINIC_NUMBER,
    clinicName: "Test Dental Clinic",
  });
  assert.match(xml, /<Response><Connect><ConversationRelay /);
  assert.ok(xml.includes(`url="${WS_URL}"`));
  assert.ok(xml.includes('interruptible="speech"'));
  assert.ok(xml.includes('reportInputDuringAgentSpeech="none"'));
  assert.ok(xml.includes('language="en-US"'));
  assert.ok(xml.includes("welcomeGreeting=\"Hi, this is Test Dental Clinic. How can we help you today?\""));
  assert.ok(xml.includes("</ConversationRelay></Connect></Response>"));
});

test("ConversationRelay TwiML includes the signed call parameters and a verifiable token", () => {
  const now = 1_900_000_000_000;
  const xml = buildConversationRelayTwiml({
    wsUrl: WS_URL,
    signingSecret: SECRET,
    clinicId: ALLOWED_CLINIC,
    callSid: "CA123",
    from: ALLOWED_CALLER,
    to: CLINIC_NUMBER,
    now,
  });
  assert.ok(xml.includes(`<Parameter name="clinicId" value="${ALLOWED_CLINIC}" />`));
  assert.ok(xml.includes(`<Parameter name="callSid" value="CA123" />`));
  assert.ok(xml.includes(`<Parameter name="from" value="${ALLOWED_CALLER}" />`));
  assert.ok(xml.includes(`<Parameter name="to" value="${CLINIC_NUMBER}" />`));

  const tokenMatch = xml.match(/<Parameter name="token" value="([^"]+)" \/>/);
  assert.ok(tokenMatch, "token parameter present");
  const verified = verifyRelayToken(tokenMatch![1], SECRET, { now: now + 1000 });
  assert.equal(verified.ok, true);
  if (verified.ok) {
    assert.equal(verified.payload.clinicId, ALLOWED_CLINIC);
    assert.equal(verified.payload.callSid, "CA123");
    assert.equal(verified.payload.from, ALLOWED_CALLER);
    assert.equal(verified.payload.to, CLINIC_NUMBER);
    assert.equal(verified.payload.ts, now);
  }
});

test("ConversationRelay TwiML XML-escapes all attribute values", () => {
  const xml = buildConversationRelayTwiml({
    wsUrl: WS_URL,
    signingSecret: SECRET,
    clinicId: ALLOWED_CLINIC,
    callSid: "CA<&>\"'",
    from: ALLOWED_CALLER,
    to: CLINIC_NUMBER,
    clinicName: 'Smile & "Care" <Dental>',
  });
  // Raw metacharacters never appear unescaped inside the welcome greeting.
  assert.ok(xml.includes("Smile &amp; &quot;Care&quot; &lt;Dental&gt;"));
  // The raw callSid metacharacters are escaped in the parameter value.
  assert.ok(xml.includes('value="CA&lt;&amp;&gt;&quot;&apos;"'));
  assert.ok(!xml.includes("<Dental>"), "no unescaped angle brackets leak into XML");
});

test("ConversationRelay TwiML never contains the signing secret", () => {
  const xml = buildConversationRelayTwiml({
    wsUrl: WS_URL,
    signingSecret: SECRET,
    clinicId: ALLOWED_CLINIC,
    callSid: "CA123",
    from: ALLOWED_CALLER,
    to: CLINIC_NUMBER,
  });
  assert.ok(!xml.includes(SECRET), "signing secret must never appear in TwiML");
});

test("ConversationRelay TwiML requires a wss:// URL", () => {
  for (const bad of ["https://relay.example.com/x", "ws://relay.example.com/x", ""]) {
    assert.throws(
      () =>
        buildConversationRelayTwiml({
          wsUrl: bad,
          signingSecret: SECRET,
          clinicId: ALLOWED_CLINIC,
          callSid: "CA123",
          from: ALLOWED_CALLER,
          to: CLINIC_NUMBER,
        }),
      ConversationRelayConfigError,
      `wsUrl "${bad}" must be rejected`,
    );
  }
});

test("ConversationRelay TwiML requires a signing secret", () => {
  assert.throws(
    () =>
      buildConversationRelayTwiml({
        wsUrl: WS_URL,
        signingSecret: "",
        clinicId: ALLOWED_CLINIC,
        callSid: "CA123",
        from: ALLOWED_CALLER,
        to: CLINIC_NUMBER,
      }),
    ConversationRelayConfigError,
  );
});

test("welcome greeting falls back to a generic clinic phrase when name is empty", () => {
  assert.equal(
    buildConversationRelayWelcomeGreeting("  "),
    "Hi, this is the dental office. How can we help you today?",
  );
  assert.equal(
    buildConversationRelayWelcomeGreeting("Bright Smiles"),
    "Hi, this is Bright Smiles. How can we help you today?",
  );
});

// --------------------------------------------------------- runtime wiring

const baseGate = {
  mode: "test_only" as const,
  clinicId: ALLOWED_CLINIC,
  clinicActive: true,
  callerPhone: ALLOWED_CALLER,
  clinicPhone: CLINIC_NUMBER,
  numberRoutingStatus: "active" as const,
  testClinicIds: [ALLOWED_CLINIC],
  testCallerNumbers: [ALLOWED_CALLER],
};

test("incoming decision: disabled mode falls through to the existing greeting", () => {
  const decision = decideAiAnsweringIncoming({
    gate: { ...baseGate, mode: "disabled" },
    relayConfigured: true,
  });
  assert.equal(decision.useConversationRelay, false);
  assert.equal(decision.reason, "ai_answering_disabled");
});

test("incoming decision: test_only non-allowlisted caller falls through to the greeting", () => {
  const decision = decideAiAnsweringIncoming({
    gate: { ...baseGate, callerPhone: "+13125550000" },
    relayConfigured: true,
  });
  assert.equal(decision.useConversationRelay, false);
  assert.equal(decision.reason, "caller_not_allowlisted");
});

test("incoming decision: allowlisted test_only caller uses ConversationRelay when relay configured", () => {
  const decision = decideAiAnsweringIncoming({ gate: baseGate, relayConfigured: true });
  assert.equal(decision.useConversationRelay, true);
  assert.equal(decision.reason, "allowed_test_only");
});

test("incoming decision: missing relay config falls through even when the gate passes", () => {
  const decision = decideAiAnsweringIncoming({ gate: baseGate, relayConfigured: false });
  assert.equal(decision.useConversationRelay, false);
  assert.equal(decision.reason, "relay_config_missing");
});

// ------------------------------------------------------------ env helpers

test("relay env helper returns null when unset and parses a valid wss config", () => {
  withEnv(
    { AI_ANSWERING_RELAY_WS_URL: undefined, AI_ANSWERING_RELAY_SIGNING_SECRET: undefined },
    () => {
      assert.equal(getAiAnsweringRelayConfigSafe(), null);
      assert.equal(hasAiAnsweringRelayConfigured(), false);
    },
  );
  withEnv(
    { AI_ANSWERING_RELAY_WS_URL: WS_URL, AI_ANSWERING_RELAY_SIGNING_SECRET: SECRET },
    () => {
      assert.deepEqual(getAiAnsweringRelayConfigSafe(), { wsUrl: WS_URL, signingSecret: SECRET });
      assert.equal(hasAiAnsweringRelayConfigured(), true);
    },
  );
});

test("relay env helper rejects a non-wss URL (fails closed to null)", () => {
  withEnv(
    {
      AI_ANSWERING_RELAY_WS_URL: "https://relay.example.com/x",
      AI_ANSWERING_RELAY_SIGNING_SECRET: SECRET,
    },
    () => {
      assert.equal(getAiAnsweringRelayConfigSafe(), null);
    },
  );
});

// ---------------------------------------------- voice route source guards

test("incoming voice route connects ConversationRelay only via the gate and fails closed", () => {
  const src = read(path.join("app", "api", "webhooks", "twilio", "voice", "incoming", "route.ts"));
  // Uses the pure decision + relay config + signed TwiML builder + session start.
  assert.ok(src.includes("decideAiAnsweringIncoming"));
  assert.ok(src.includes("getAiAnsweringRelayConfigSafe"));
  assert.ok(src.includes("buildConversationRelayTwiml"));
  assert.ok(src.includes("startAiVoiceRuntimeSession"));
  // Session is keyed on the call sid and links the call event id.
  assert.ok(src.includes("externalSessionId: callSid"));
  assert.ok(src.includes("callEventId"));
  // Fails closed: a start failure is caught and falls through to the greeting.
  assert.ok(src.includes("twilio.voice.ai_answering_start_failed"));
  assert.ok(src.includes("buildMissedCallVoiceTwiml"));
  // No SMS / OpenAI / Twilio client in the incoming route. (The read-only
  // greeting prediction mirrors sendRecoverySms() guards in comments, but the
  // route never actually sends — assert the send invocation is absent.)
  assert.ok(!src.includes("await sendRecoverySms("), "incoming route never sends recovery SMS");
  assert.ok(!/from ["'][^"']*openai[^"']*["']/i.test(src), "incoming route imports no openai sdk");
  assert.ok(!src.includes("getTwilioClient"), "incoming route makes no Twilio client");
});

test("voice status route suppresses SMS recovery when an AI voice session exists", () => {
  const src = read(path.join("app", "api", "webhooks", "twilio", "voice", "status", "route.ts"));
  assert.ok(src.includes("hasAiVoiceRuntimeSessionForCall"));
  assert.ok(src.includes("twilio.voice.status.ai_answering_session_present"));
  // The AI-session check happens BEFORE the recovery SMS send.
  const checkIdx = src.indexOf("hasAiVoiceRuntimeSessionForCall");
  const sendIdx = src.indexOf("sendRecoverySms(");
  assert.ok(checkIdx >= 0 && sendIdx >= 0, "both the AI check and the SMS send exist");
  assert.ok(checkIdx < sendIdx, "AI session check runs before the recovery SMS send");
  // Normal missed-call recovery is still attempted (the existing path remains).
  assert.ok(src.includes("const smsResult = await sendRecoverySms("));
});

test("hasAiVoiceRuntimeSessionForCall is a DB-only future_twilio check, degradation-safe", () => {
  const src = read(path.join("lib", "db", "ai-voice-runtime-sessions.ts"));
  const start = src.indexOf("export async function hasAiVoiceRuntimeSessionForCall");
  assert.ok(start >= 0, "helper exists");
  const helper = src.slice(start);
  assert.ok(helper.includes("source = 'future_twilio'"));
  assert.ok(helper.includes("external_session_id = ${input.callSid}"));
  // Missing table (pre-migration) returns false instead of throwing.
  assert.ok(helper.includes("if (isUndefinedTableError(err)) return false;"));
  // No SMS / provider work in the helper.
  assert.ok(!helper.includes("sendRecoverySms"));
  assert.ok(!helper.includes("messages.create"));
});
