// Pure decision logic for exact-number live-send readiness. No DB or Twilio
// access here — lib/db/sms-readiness.ts loads the rows and delegates, and the
// unit tests exercise every branch directly.
//
// Reason codes are stable machine-readable strings. They surface in webhook
// logs, the admin clinic console, and the operator readiness audit, so renaming
// one is a breaking diagnostic change.

export const SMS_READINESS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type LiveSendNumberRow = {
  number_type: "toll_free" | "local";
  is_active: boolean;
  removal_status: string;
  texting_status: string;
};

export type LiveSendNumberReadiness = {
  messagingServiceSenderStatus: "unknown" | "covered" | "missing" | "error";
  a2pCampaignCoverageStatus: "unknown" | "covered" | "missing" | "error";
  productionSafe: boolean;
  launchBlockingReason: string | null;
  lastSyncedAt: string | null;
  lastSyncErrorCode: string | null;
};

export function isReadinessTimestampFresh(
  iso: string | null,
  nowMs: number = Date.now(),
  maxAgeMs: number = SMS_READINESS_MAX_AGE_MS,
): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && nowMs - t <= maxAgeMs;
}

// Lifecycle/routing/approval state of the exact called number. Returns the
// blocking reason or null when the row itself permits texting.
export function blockingReasonForNumberRow(row: LiveSendNumberRow): string | null {
  if (!row.is_active || row.removal_status !== "active") {
    return "phone_number_not_active";
  }
  if (row.texting_status !== "active") {
    return "phone_number_texting_not_active";
  }
  return null;
}

// Toll-free numbers: toll-free verification is reflected in texting_status (the
// row check above), but the number must ALSO be a sender on our Messaging
// Service. Missing/stale/errored coverage data fails closed. A2P campaign
// coverage is intentionally NOT required — toll-free is never part of a local
// A2P campaign.
export function blockingReasonForTollfreeCoverage(
  readiness: LiveSendNumberReadiness | null,
  nowMs: number = Date.now(),
): string | null {
  if (!readiness) return "number_readiness_missing";
  if (!isReadinessTimestampFresh(readiness.lastSyncedAt, nowMs)) {
    return "number_sms_readiness_stale";
  }
  if (readiness.lastSyncErrorCode) return "number_sms_readiness_sync_error";
  if (readiness.messagingServiceSenderStatus !== "covered") {
    return "number_not_in_messaging_service";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mode gate for the recovery send path
// ---------------------------------------------------------------------------
// One shared, pure decision for the mode-dependent guards in sendRecoverySms()
// and the voice-greeting prediction. Exact-number readiness is required in
// BOTH owner_test and live mode — the owner-test caller allowlist is an
// additional gate, never a substitute for the called number being ready.
// Per-patient guards (opt-out, duplicate suppression) are NOT decided here;
// they always run after this gate in sendRecoverySms().

export type RecoverySendMode = "disabled" | "owner_test" | "live";

export type RecoverySendGateInput = {
  mode: RecoverySendMode;
  // SMS_TEST_ALLOWED_TO allowlist (owner_test mode only).
  allowedTestNumbers: readonly string[];
  patientPhone: string;
  clinicSmsRecoveryEnabled: boolean;
  // clinics.sms_status — required to be "active" for LOCAL numbers in live mode.
  clinicSmsStatus: string | undefined;
  // Result of evaluateSmsReadinessForLiveSend for the exact called number.
  numberReadiness: { ok: boolean; reason: string; numberType?: "toll_free" | "local" };
};

export type RecoverySendGateResult = { ok: true } | { ok: false; reason: string };

export function evaluateRecoverySendGate(
  input: RecoverySendGateInput,
): RecoverySendGateResult {
  // Disabled (or any unknown) mode never sends.
  if (input.mode !== "owner_test" && input.mode !== "live") {
    return { ok: false, reason: `sms_mode_${input.mode}` };
  }
  // Exact-number readiness applies to both send modes.
  if (!input.numberReadiness.ok) {
    return { ok: false, reason: input.numberReadiness.reason };
  }
  if (input.mode === "live") {
    if (!input.clinicSmsRecoveryEnabled) {
      return { ok: false, reason: "clinic_sms_disabled" };
    }
    if (
      input.numberReadiness.numberType === "local" &&
      input.clinicSmsStatus !== "active"
    ) {
      return { ok: false, reason: "sms_status_not_active" };
    }
  }
  if (
    input.mode === "owner_test" &&
    !input.allowedTestNumbers.includes(input.patientPhone)
  ) {
    return { ok: false, reason: "caller_not_allowlisted" };
  }
  return { ok: true };
}

// Local numbers: Messaging Service sender coverage AND approved-campaign
// coverage are both required, fresh and error-free.
export function blockingReasonForLocalNumberReadiness(
  readiness: LiveSendNumberReadiness | null,
  nowMs: number = Date.now(),
): string | null {
  if (!readiness) return "number_readiness_missing";
  if (!isReadinessTimestampFresh(readiness.lastSyncedAt, nowMs)) {
    return "number_sms_readiness_stale";
  }
  if (readiness.lastSyncErrorCode) return "number_sms_readiness_sync_error";
  if (readiness.messagingServiceSenderStatus !== "covered") {
    return "number_not_in_messaging_service";
  }
  if (readiness.a2pCampaignCoverageStatus !== "covered") {
    return "number_not_campaign_covered";
  }
  if (!readiness.productionSafe) {
    return readiness.launchBlockingReason ?? "number_sms_readiness_not_production_safe";
  }
  return null;
}
