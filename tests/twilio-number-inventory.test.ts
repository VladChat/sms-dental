import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUnassignedInventory,
  classifyDetachEligibility,
  classifyNumberType,
  webhookConfigStatus,
  type DetachEligibilityInput,
  type OwnedNumberInput,
} from "../lib/phone-numbers/twilio-number-inventory";

const EXPECTED = {
  voiceUrl: "https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming",
  smsUrl: "https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming",
};

const caps = (voice: boolean, sms: boolean, mms = false) => ({ voice, sms, mms });

function owned(partial: Partial<OwnedNumberInput> & { sid: string; phoneNumber: string }): OwnedNumberInput {
  return {
    friendlyName: null,
    twilioPurchasedAt: null,
    capabilities: caps(true, true),
    voiceUrl: EXPECTED.voiceUrl,
    smsUrl: EXPECTED.smsUrl,
    ...partial,
  };
}

test("classifyNumberType detects toll-free prefixes", () => {
  for (const p of ["800", "833", "844", "855", "866", "877", "888"]) {
    assert.equal(classifyNumberType(`+1${p}5551234`), "toll_free", p);
  }
});

test("classifyNumberType treats normal NANP + non-US as local", () => {
  assert.equal(classifyNumberType("+12245551234"), "local");
  assert.equal(classifyNumberType("+13125550000"), "local");
  assert.equal(classifyNumberType("+447911123456"), "local");
});

test("webhookConfigStatus: empty -> needs_setup, exact (trailing slash tolerant) -> ok, other -> needs_setup", () => {
  assert.equal(webhookConfigStatus(null, EXPECTED.voiceUrl), "needs_setup");
  assert.equal(webhookConfigStatus("", EXPECTED.voiceUrl), "needs_setup");
  assert.equal(webhookConfigStatus(EXPECTED.voiceUrl, EXPECTED.voiceUrl), "ok");
  assert.equal(webhookConfigStatus(`${EXPECTED.voiceUrl}/`, EXPECTED.voiceUrl), "ok");
  assert.equal(webhookConfigStatus("https://example.com/other", EXPECTED.voiceUrl), "needs_setup");
});

test("buildUnassignedInventory excludes numbers already held by phone or SID", () => {
  const items = buildUnassignedInventory({
    owned: [
      owned({ sid: "PN_a", phoneNumber: "+18445550001" }),
      owned({ sid: "PN_b", phoneNumber: "+18445550002" }), // excluded by phone
      owned({ sid: "PN_c", phoneNumber: "+18445550003" }), // excluded by sid
    ],
    assignedKeys: new Set(["+18445550002", "PN_c"]),
    expected: EXPECTED,
  });
  assert.deepEqual(items.map((i) => i.sid), ["PN_a"]);
});

test("buildUnassignedInventory: toll-free with Voice+SMS is assignable; config reflects URLs", () => {
  const [item] = buildUnassignedInventory({
    owned: [owned({ sid: "PN_tf", phoneNumber: "+18335550000", smsUrl: null })],
    assignedKeys: new Set(),
    expected: EXPECTED,
  });
  assert.equal(item.numberType, "toll_free");
  assert.equal(item.assignableHere, true);
  assert.equal(item.notAssignableReason, null);
  assert.equal(item.voiceConfig, "ok");
  assert.equal(item.smsConfig, "needs_setup");
});

test("buildUnassignedInventory: local numbers are not assignable here yet", () => {
  const [item] = buildUnassignedInventory({
    owned: [owned({ sid: "PN_loc", phoneNumber: "+12245550000" })],
    assignedKeys: new Set(),
    expected: EXPECTED,
  });
  assert.equal(item.numberType, "local");
  assert.equal(item.assignableHere, false);
  assert.match(item.notAssignableReason ?? "", /local/i);
});

test("buildUnassignedInventory: toll-free missing SMS capability is blocked", () => {
  const [item] = buildUnassignedInventory({
    owned: [owned({ sid: "PN_v", phoneNumber: "+18555550000", capabilities: caps(true, false) })],
    assignedKeys: new Set(),
    expected: EXPECTED,
  });
  assert.equal(item.numberType, "toll_free");
  assert.equal(item.assignableHere, false);
  assert.match(item.notAssignableReason ?? "", /Voice \+ SMS/i);
});

function detachInput(partial: Partial<DetachEligibilityInput> = {}): DetachEligibilityInput {
  return {
    numberType: "toll_free",
    billingClass: "included",
    monthlyUnitAmountCents: 0,
    removalStatus: "active",
    ...partial,
  };
}

test("classifyDetachEligibility: unpaid active toll-free (included/legacy, $0) is eligible", () => {
  assert.deepEqual(classifyDetachEligibility(detachInput()), { eligible: true, reason: null });
  assert.equal(classifyDetachEligibility(detachInput({ billingClass: "legacy" })).eligible, true);
});

test("classifyDetachEligibility: local numbers are blocked", () => {
  const r = classifyDetachEligibility(detachInput({ numberType: "local" }));
  assert.equal(r.eligible, false);
  assert.match(r.reason ?? "", /local/i);
});

test("classifyDetachEligibility: paid / additional toll-free is blocked", () => {
  assert.equal(classifyDetachEligibility(detachInput({ billingClass: "additional" })).eligible, false);
  assert.equal(classifyDetachEligibility(detachInput({ monthlyUnitAmountCents: 2000 })).eligible, false);
});

test("classifyDetachEligibility: already detached / scheduled / removed are blocked", () => {
  assert.match(
    classifyDetachEligibility(detachInput({ removalStatus: "detached" })).reason ?? "",
    /already detached/i,
  );
  assert.match(
    classifyDetachEligibility(detachInput({ removalStatus: "scheduled" })).reason ?? "",
    /scheduled/i,
  );
  assert.match(
    classifyDetachEligibility(detachInput({ removalStatus: "permanently_removed" })).reason ?? "",
    /permanently removed/i,
  );
});

test("buildUnassignedInventory sorts assignable first, then by phone number", () => {
  const items = buildUnassignedInventory({
    owned: [
      owned({ sid: "PN_loc", phoneNumber: "+12245550000" }), // local -> not assignable
      owned({ sid: "PN_tf2", phoneNumber: "+18885550000" }), // assignable
      owned({ sid: "PN_tf1", phoneNumber: "+18445550000" }), // assignable
    ],
    assignedKeys: new Set(),
    expected: EXPECTED,
  });
  assert.deepEqual(items.map((i) => i.phoneNumber), ["+18445550000", "+18885550000", "+12245550000"]);
});
