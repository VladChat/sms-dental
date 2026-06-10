import type { PhoneNumberTextingStatus } from "../db/clinic-phone-numbers";
import type { A2pStatus, NumberCoverageStatus } from "../db/sms-readiness";
import { textingStatusSyncConfig } from "../../config/texting-status-sync.config";

export type TollfreeVerificationDecision = {
  textingStatus: PhoneNumberTextingStatus;
  providerStatus: string;
};

export function normalizeProviderStatusToken(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return normalized || "UNKNOWN";
}

export function mapTollfreeVerificationStatus(
  providerStatus: string | null | undefined,
): TollfreeVerificationDecision {
  const status = normalizeProviderStatusToken(providerStatus);
  if (status === "TWILIO_APPROVED" || status === "APPROVED" || status === "VERIFIED") {
    return { textingStatus: "active", providerStatus: status };
  }
  if (
    status === "TWILIO_REJECTED" ||
    status === "REJECTED" ||
    status === "FAILED" ||
    status === "FAILURE"
  ) {
    return { textingStatus: "failed", providerStatus: status };
  }
  return { textingStatus: "waiting_for_approval", providerStatus: status };
}

export function mapMissingTollfreeVerification(): TollfreeVerificationDecision {
  return {
    textingStatus: "waiting_for_approval",
    providerStatus: textingStatusSyncConfig.providerStatusLabels.noTollfreeVerification,
  };
}

export function mapLocalReadinessToTextingStatus(input: {
  a2pStatus: A2pStatus | null | undefined;
  messagingServiceSenderStatus: NumberCoverageStatus | null | undefined;
  a2pCampaignCoverageStatus: NumberCoverageStatus | null | undefined;
  productionSafe: boolean;
  lastSyncErrorCode?: string | null;
}): { textingStatus: PhoneNumberTextingStatus; providerStatus: string } {
  if (
    input.a2pStatus === "failed" ||
    input.a2pStatus === "rejected" ||
    input.a2pStatus === "blocked"
  ) {
    return {
      textingStatus: "failed",
      providerStatus: textingStatusSyncConfig.providerStatusLabels.localA2pFailed,
    };
  }
  if (
    input.a2pStatus === "verified" &&
    input.messagingServiceSenderStatus === "covered" &&
    input.a2pCampaignCoverageStatus === "covered" &&
    input.productionSafe &&
    !input.lastSyncErrorCode
  ) {
    return {
      textingStatus: "active",
      providerStatus: textingStatusSyncConfig.providerStatusLabels.localA2pVerified,
    };
  }
  return {
    textingStatus: "waiting_for_approval",
    providerStatus: textingStatusSyncConfig.providerStatusLabels.localA2pWaiting,
  };
}

export type TextingStatusDueCheckRow = {
  texting_status: PhoneNumberTextingStatus;
  texting_status_updated_at: Date;
};

export type TextingRoutabilityCheckRow = {
  is_active: boolean;
  removal_status: string;
  texting_status: PhoneNumberTextingStatus | string;
};

export function isPhoneNumberRoutableForTexting(
  row: TextingRoutabilityCheckRow,
): boolean {
  return (
    row.is_active &&
    row.removal_status === "active" &&
    row.texting_status === "active"
  );
}

export function isTextingStatusSyncDue(
  row: TextingStatusDueCheckRow,
  nowMs: number,
  config = textingStatusSyncConfig,
): boolean {
  const updatedAt = row.texting_status_updated_at.getTime();
  if (!Number.isFinite(updatedAt)) return true;
  if (row.texting_status === "active") {
    return (
      config.activeTollfreeReconciliationEnabled &&
      nowMs - updatedAt >= config.staleAgeMs.active
    );
  }
  return nowMs - updatedAt >= config.staleAgeMs.pending;
}

export function normalizeTextingStatusSyncLimit(raw: number, max: number): number {
  if (!Number.isFinite(raw)) return max;
  return Math.max(1, Math.min(max, Math.floor(raw)));
}
