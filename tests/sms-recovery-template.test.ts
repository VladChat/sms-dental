import assert from "node:assert/strict";
import test from "node:test";

import { smsRecoveryConfig } from "../config/sms-recovery.config";
import {
  buildMissedCallRecoverySmsBody,
  getDuplicateSuppressionWindowMs,
} from "../lib/sms-recovery/templates";

test("template includes the clinic name", () => {
  const body = buildMissedCallRecoverySmsBody("Fairstone Dental Smile");
  assert.ok(body.includes("Fairstone Dental Smile"));
  assert.ok(body.startsWith("Hi, this is Fairstone Dental Smile."));
});

test("template includes the STOP opt-out instruction", () => {
  const body = buildMissedCallRecoverySmsBody("Fairstone Dental Smile");
  assert.ok(body.includes("Reply STOP to opt out"));
});

test("missing or empty clinic name falls back to a safe identity", () => {
  for (const name of [null, undefined, "", "   ", "{{}}"]) {
    const body = buildMissedCallRecoverySmsBody(name);
    assert.ok(body.includes(smsRecoveryConfig.fallbackClinicIdentity));
    assert.ok(!body.includes("{{"));
    assert.ok(!body.includes("}}"));
  }
});

test("clinic name whitespace is collapsed and trimmed", () => {
  const body = buildMissedCallRecoverySmsBody("  Lakeview \n  Family   Dental  ");
  assert.ok(body.includes("Lakeview Family Dental"));
});

test("template braces in a clinic name cannot inject placeholders", () => {
  const body = buildMissedCallRecoverySmsBody("Evil {{clinic_name}} Dental");
  assert.ok(!body.includes("{{"));
  assert.ok(!body.includes("}}"));
});

test("body stays within the configured SMS length for very long clinic names", () => {
  const longName = "Super Long Dental Practice Name ".repeat(20);
  const body = buildMissedCallRecoverySmsBody(longName);
  assert.ok(body.length <= smsRecoveryConfig.maxSmsBodyLength);
});

test("template avoids prohibited marketing/medical wording", () => {
  const body = buildMissedCallRecoverySmsBody("Fairstone Dental Smile").toLowerCase();
  for (const banned of [
    "urgent",
    "guarantee",
    "limited time",
    "click now",
    "discount",
    "% off",
    "diagnos",
    "treatment",
    "prescription",
  ]) {
    assert.ok(!body.includes(banned), `template must not contain "${banned}"`);
  }
});

test("duplicate suppression window comes from config", () => {
  assert.equal(
    getDuplicateSuppressionWindowMs(),
    smsRecoveryConfig.duplicateSuppressionHours * 60 * 60 * 1000,
  );
});
