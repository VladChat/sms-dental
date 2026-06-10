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
