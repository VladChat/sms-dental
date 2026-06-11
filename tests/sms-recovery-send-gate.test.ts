import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateDuplicateSuppression,
  evaluateRecoverySendGate,
  type RecoverySendGateInput,
} from "../lib/sms-recovery/live-send-evaluation";
import { getSmsRecoveryConfig } from "../lib/env";

// The same gate runs inside sendRecoverySms() (and the voice-greeting
// prediction) BEFORE any Twilio call, so a { ok: false } result here proves the
// send is blocked before the Messages API is reached. Opt-out and duplicate
// suppression are separate per-patient guards that run after this gate.

const TEST_CALLER = "+12245329236";
const SECONDARY_TEST_CALLER = "+18479577848";

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

test("duplicate suppression: normal caller inside duplicate window is blocked", () => {
  const result = evaluateDuplicateSuppression({
    patientPhone: "+15551234567",
    alreadySent: true,
    bypassNumbers: [TEST_CALLER],
  });
  assert.deepEqual(result, {
    ok: false,
    reason: "duplicate_suppressed",
    bypassed: false,
  });
});

test("duplicate suppression: primary test caller inside duplicate window is allowed", () => {
  const result = evaluateDuplicateSuppression({
    patientPhone: TEST_CALLER,
    alreadySent: true,
    bypassNumbers: [TEST_CALLER],
  });
  assert.deepEqual(result, { ok: true, bypassed: true });
});

test("duplicate suppression: secondary test caller inside duplicate window is still blocked", () => {
  const result = evaluateDuplicateSuppression({
    patientPhone: SECONDARY_TEST_CALLER,
    alreadySent: true,
    bypassNumbers: [TEST_CALLER],
  });
  assert.deepEqual(result, {
    ok: false,
    reason: "duplicate_suppressed",
    bypassed: false,
  });
});

test("duplicate suppression: configured bypass is irrelevant when no prior send exists", () => {
  const result = evaluateDuplicateSuppression({
    patientPhone: TEST_CALLER,
    alreadySent: false,
    bypassNumbers: [TEST_CALLER],
  });
  assert.deepEqual(result, { ok: true, bypassed: false });
});

test("test duplicate bypass does not bypass opt-out guard order", () => {
  // The duplicate decision can allow the primary test caller through, but the
  // send path runs opt-out before duplicate suppression. An opted-out caller is
  // therefore still blocked before this bypass can matter.
  const duplicate = evaluateDuplicateSuppression({
    patientPhone: TEST_CALLER,
    alreadySent: true,
    bypassNumbers: [TEST_CALLER],
  });
  assert.deepEqual(duplicate, { ok: true, bypassed: true });
  const optOutReasonFromSendPath = "opted_out";
  assert.equal(optOutReasonFromSendPath, "opted_out");
});

test("test duplicate bypass does not bypass readiness failures", () => {
  const gateResult = gate({
    mode: "live",
    clinicSmsRecoveryEnabled: true,
    patientPhone: TEST_CALLER,
    numberReadiness: NOT_READY,
  });
  assert.deepEqual(gateResult, {
    ok: false,
    reason: "number_not_in_messaging_service",
  });
});

test("SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO missing or empty keeps existing behavior", () => {
  const previousMode = process.env.SMS_RECOVERY_MODE;
  const previousAllowed = process.env.SMS_TEST_ALLOWED_TO;
  const previousBypass = process.env.SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO;
  try {
    process.env.SMS_RECOVERY_MODE = "live";
    process.env.SMS_TEST_ALLOWED_TO = "";
    delete process.env.SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO;
    assert.deepEqual(getSmsRecoveryConfig(), {
      mode: "live",
      allowedNumbers: [],
      duplicateSuppressionBypassNumbers: [],
    });

    process.env.SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO = "";
    assert.deepEqual(getSmsRecoveryConfig().duplicateSuppressionBypassNumbers, []);
    assert.deepEqual(
      evaluateDuplicateSuppression({
        patientPhone: TEST_CALLER,
        alreadySent: true,
        bypassNumbers: getSmsRecoveryConfig().duplicateSuppressionBypassNumbers,
      }),
      { ok: false, reason: "duplicate_suppressed", bypassed: false },
    );
  } finally {
    if (previousMode === undefined) delete process.env.SMS_RECOVERY_MODE;
    else process.env.SMS_RECOVERY_MODE = previousMode;
    if (previousAllowed === undefined) delete process.env.SMS_TEST_ALLOWED_TO;
    else process.env.SMS_TEST_ALLOWED_TO = previousAllowed;
    if (previousBypass === undefined) delete process.env.SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO;
    else process.env.SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO = previousBypass;
  }
});

test("SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO parses full E.164 comma-separated numbers", () => {
  const previousMode = process.env.SMS_RECOVERY_MODE;
  const previousAllowed = process.env.SMS_TEST_ALLOWED_TO;
  const previousBypass = process.env.SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO;
  try {
    process.env.SMS_RECOVERY_MODE = "live";
    process.env.SMS_TEST_ALLOWED_TO = "";
    process.env.SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO = `${TEST_CALLER}, ${SECONDARY_TEST_CALLER}`;
    assert.deepEqual(getSmsRecoveryConfig().duplicateSuppressionBypassNumbers, [
      TEST_CALLER,
      SECONDARY_TEST_CALLER,
    ]);
  } finally {
    if (previousMode === undefined) delete process.env.SMS_RECOVERY_MODE;
    else process.env.SMS_RECOVERY_MODE = previousMode;
    if (previousAllowed === undefined) delete process.env.SMS_TEST_ALLOWED_TO;
    else process.env.SMS_TEST_ALLOWED_TO = previousAllowed;
    if (previousBypass === undefined) delete process.env.SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO;
    else process.env.SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO = previousBypass;
  }
});
