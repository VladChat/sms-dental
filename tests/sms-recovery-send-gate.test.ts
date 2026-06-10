import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateRecoverySendGate,
  type RecoverySendGateInput,
} from "../lib/sms-recovery/live-send-evaluation";

// The same gate runs inside sendRecoverySms() (and the voice-greeting
// prediction) BEFORE any Twilio call, so a { ok: false } result here proves the
// send is blocked before the Messages API is reached. Opt-out and duplicate
// suppression are separate per-patient guards that run after this gate.

const TEST_CALLER = "+12245329236";

const READY_TOLLFREE = {
  ok: true,
  reason: "verified",
  numberType: "toll_free" as const,
};
const READY_LOCAL = { ok: true, reason: "verified", numberType: "local" as const };
const NOT_READY = {
  ok: false,
  reason: "number_not_in_messaging_service",
  numberType: "toll_free" as const,
};

function gate(overrides: Partial<RecoverySendGateInput> = {}) {
  return evaluateRecoverySendGate({
    mode: "owner_test",
    allowedTestNumbers: [TEST_CALLER],
    patientPhone: TEST_CALLER,
    clinicSmsRecoveryEnabled: false,
    clinicSmsStatus: "waiting_for_approval",
    numberReadiness: READY_TOLLFREE,
    ...overrides,
  });
}

test("disabled mode never sends", () => {
  const result = gate({ mode: "disabled" });
  assert.deepEqual(result, { ok: false, reason: "sms_mode_disabled" });
});

test("owner_test: allowlisted caller + ready number passes the gate", () => {
  assert.deepEqual(gate(), { ok: true });
});

test("owner_test: allowlisted caller + number NOT ready is blocked by the readiness reason", () => {
  const result = gate({ numberReadiness: NOT_READY });
  assert.deepEqual(result, { ok: false, reason: "number_not_in_messaging_service" });
});

test("owner_test: every readiness blocking reason fails closed", () => {
  for (const reason of [
    "phone_number_mapping_missing",
    "phone_number_not_active",
    "phone_number_texting_not_active",
    "number_readiness_missing",
    "number_sms_readiness_stale",
    "number_sms_readiness_sync_error",
    "sms_readiness_check_failed",
  ]) {
    const result = gate({ numberReadiness: { ok: false, reason } });
    assert.deepEqual(result, { ok: false, reason }, `reason "${reason}" must block`);
  }
});

test("owner_test: non-allowlisted caller + ready number is blocked by caller_not_allowlisted", () => {
  const result = gate({ patientPhone: "+15551234567" });
  assert.deepEqual(result, { ok: false, reason: "caller_not_allowlisted" });
});

test("owner_test: readiness is evaluated before the allowlist", () => {
  const result = gate({ patientPhone: "+15551234567", numberReadiness: NOT_READY });
  assert.deepEqual(result, { ok: false, reason: "number_not_in_messaging_service" });
});

test("owner_test: allowlist is an additional gate, not a substitute — clinic flags are not required", () => {
  // sms_recovery_enabled=false and a non-active local clinic sms_status do not
  // gate owner_test; only readiness + allowlist (+ per-patient guards) do.
  const result = gate({
    numberReadiness: READY_LOCAL,
    clinicSmsRecoveryEnabled: false,
    clinicSmsStatus: "waiting_for_approval",
  });
  assert.deepEqual(result, { ok: true });
});

test("live: clinic with SMS recovery disabled is blocked", () => {
  const result = gate({ mode: "live", clinicSmsRecoveryEnabled: false });
  assert.deepEqual(result, { ok: false, reason: "clinic_sms_disabled" });
});

test("live: number not ready is blocked by the readiness reason", () => {
  const result = gate({
    mode: "live",
    clinicSmsRecoveryEnabled: true,
    numberReadiness: NOT_READY,
  });
  assert.deepEqual(result, { ok: false, reason: "number_not_in_messaging_service" });
});

test("live: local number with clinic sms_status not active is blocked", () => {
  const result = gate({
    mode: "live",
    clinicSmsRecoveryEnabled: true,
    numberReadiness: READY_LOCAL,
    clinicSmsStatus: "waiting_for_approval",
  });
  assert.deepEqual(result, { ok: false, reason: "sms_status_not_active" });
});

test("live: local number with clinic sms_status active passes", () => {
  const result = gate({
    mode: "live",
    clinicSmsRecoveryEnabled: true,
    numberReadiness: READY_LOCAL,
    clinicSmsStatus: "active",
  });
  assert.deepEqual(result, { ok: true });
});

test("live: toll-free number does not require clinic sms_status active", () => {
  const result = gate({
    mode: "live",
    clinicSmsRecoveryEnabled: true,
    numberReadiness: READY_TOLLFREE,
    clinicSmsStatus: "waiting_for_approval",
  });
  assert.deepEqual(result, { ok: true });
});

test("live: the allowlist does not apply", () => {
  const result = gate({
    mode: "live",
    clinicSmsRecoveryEnabled: true,
    numberReadiness: READY_TOLLFREE,
    patientPhone: "+15551234567",
  });
  assert.deepEqual(result, { ok: true });
});
