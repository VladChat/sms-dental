import test from "node:test";
import assert from "node:assert/strict";

import { signRelayToken } from "../../../lib/ai-answering/relay-token";
import { validateConversationRelaySetup, parseInboundMessage } from "../src/twilio-messages";

const SECRET = "relay-test-secret";
const CLINIC = "f37f24a1-070f-436b-b803-956f55466093";
const CALL_SID = "CA00000000000000000000000000000001";
const FROM = "+12245329236";
const TO = "+18447234944";
const NOW = 1_900_000_000_000;

function token(overrides: Partial<{ clinicId: string; callSid: string; from: string; to: string; ts: number }> = {}, secret = SECRET) {
  return signRelayToken(
    {
      clinicId: overrides.clinicId ?? CLINIC,
      callSid: overrides.callSid ?? CALL_SID,
      from: overrides.from ?? FROM,
      to: overrides.to ?? TO,
      ts: overrides.ts ?? NOW,
    },
    secret,
  );
}

function setup(customParameters: Record<string, string>) {
  return { type: "setup", callSid: CALL_SID, from: FROM, to: TO, customParameters };
}

test("parseInboundMessage classifies a setup frame", () => {
  const parsed = parseInboundMessage(setup({ token: token() }));
  assert.equal(parsed.kind, "setup");
});

test("valid signed setup with matching parameters is accepted", () => {
  const result = validateConversationRelaySetup(
    setup({ clinicId: CLINIC, callSid: CALL_SID, from: FROM, to: TO, token: token() }),
    { secret: SECRET, now: NOW + 1000 },
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.payload.clinicId, CLINIC);
    assert.equal(result.customParameters.callSid, CALL_SID);
  }
});

test("missing token is rejected", () => {
  const result = validateConversationRelaySetup(
    setup({ clinicId: CLINIC, callSid: CALL_SID, from: FROM, to: TO }),
    { secret: SECRET, now: NOW + 1000 },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "missing_token");
});

test("a token signed with the wrong secret is rejected", () => {
  const result = validateConversationRelaySetup(
    setup({ clinicId: CLINIC, callSid: CALL_SID, from: FROM, to: TO, token: token({}, "wrong-secret") }),
    { secret: SECRET, now: NOW + 1000 },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "token_bad_signature");
});

test("an expired token is rejected", () => {
  const result = validateConversationRelaySetup(
    setup({ clinicId: CLINIC, callSid: CALL_SID, from: FROM, to: TO, token: token({ ts: NOW }) }),
    { secret: SECRET, now: NOW + 60 * 60 * 1000, maxAgeMs: 10 * 60 * 1000 },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "token_expired");
});

test("mismatched clinic/call/from/to custom parameters are rejected (defense in depth)", () => {
  for (const tampered of [
    { clinicId: "00000000-0000-0000-0000-000000000000" },
    { callSid: "CAdifferent" },
    { from: "+13125550000" },
    { to: "+15005550000" },
  ]) {
    const cp = { clinicId: CLINIC, callSid: CALL_SID, from: FROM, to: TO, token: token(), ...tampered };
    const result = validateConversationRelaySetup(setup(cp), { secret: SECRET, now: NOW + 1000 });
    assert.equal(result.ok, false, `tampering ${JSON.stringify(tampered)} must be rejected`);
    if (!result.ok) assert.equal(result.reason, "customparameters_mismatch");
  }
});
