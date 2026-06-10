import { textingStatusSyncConfig } from "../../config/texting-status-sync.config";
import {
  listPhoneNumbersDueForTextingStatusSync,
  recordPhoneNumberTextingSyncDiagnostic,
  updatePhoneNumberTextingStatus,
  type TextingStatusSyncPhoneNumberRow,
} from "../db/clinic-phone-numbers";
import { syncClinicSmsReadinessFromTwilio } from "../twilio/sms-readiness-sync";
import { readTollfreeVerificationForPhoneNumberSid } from "../twilio/tollfree-verification";
import { logger } from "../logging/logger";
import {
  mapLocalReadinessToTextingStatus,
  mapMissingTollfreeVerification,
  mapTollfreeVerificationStatus,
  normalizeTextingStatusSyncLimit,
} from "./status-mapping";

export type PhoneNumberTextingStatusSyncSummary = {
  checked: number;
  updatedToActive: number;
  remainedPending: number;
  failed: number;
  skipped: number;
};

export async function syncPhoneNumberTextingStatuses(params: {
  clinicId?: string | null;
  phoneNumberId?: string | null;
  force?: boolean;
  limit?: number;
} = {}): Promise<PhoneNumberTextingStatusSyncSummary> {
  const now = new Date();
  const limit = normalizeTextingStatusSyncLimit(
    params.limit ?? textingStatusSyncConfig.cron.batchSize,
    params.clinicId ? textingStatusSyncConfig.singleClinicBatchSize : textingStatusSyncConfig.cron.batchSize,
  );
  const rows = await listPhoneNumbersDueForTextingStatusSync({
    limit,
    clinicId: params.clinicId ?? null,
    phoneNumberId: params.phoneNumberId ?? null,
    force: params.force === true,
    includeActiveReconciliation: textingStatusSyncConfig.activeTollfreeReconciliationEnabled,
    pendingStaleBefore: new Date(now.getTime() - textingStatusSyncConfig.staleAgeMs.pending),
    activeStaleBefore: new Date(now.getTime() - textingStatusSyncConfig.staleAgeMs.active),
  });

  const summary: PhoneNumberTextingStatusSyncSummary = {
    checked: rows.length,
    updatedToActive: 0,
    remainedPending: 0,
    failed: 0,
    skipped: 0,
  };

  const localRows = rows.filter((row) => row.number_type === "local");
  const localClinicIds = [...new Set(localRows.map((row) => row.clinic_id))];
  const localReadinessByClinic = new Map<string, Awaited<ReturnType<typeof syncClinicSmsReadinessFromTwilio>> | null>();

  for (const clinicId of localClinicIds) {
    try {
      localReadinessByClinic.set(clinicId, await syncClinicSmsReadinessFromTwilio(clinicId));
    } catch (err) {
      localReadinessByClinic.set(clinicId, null);
      logger.warn("texting_status.sync.local_readiness_failed", {
        clinicId,
        message: safeMessage(err),
      });
    }
  }

  for (const row of rows) {
    if (!row.twilio_phone_number_sid) {
      summary.skipped += 1;
      await recordPhoneNumberTextingSyncDiagnostic({
        phoneNumberId: row.id,
        clinicId: row.clinic_id,
        providerStatus: textingStatusSyncConfig.providerStatusLabels.missingTwilioSid,
        providerErrorCode: "missing_twilio_sid",
        providerErrorMessage: "Phone number row has no Twilio Phone Number SID.",
      });
      continue;
    }

    if (row.number_type === "toll_free") {
      await syncTollfreeRow(row, summary);
    } else {
      await syncLocalRow(row, localReadinessByClinic.get(row.clinic_id) ?? null, summary);
    }
  }

  logger.info("texting_status.sync.completed", {
    checked: summary.checked,
    updatedToActive: summary.updatedToActive,
    remainedPending: summary.remainedPending,
    failed: summary.failed,
    skipped: summary.skipped,
    clinicId: params.clinicId ?? null,
    phoneNumberId: params.phoneNumberId ?? null,
  });

  return summary;
}

export async function syncPhoneNumberTextingStatusesBestEffort(params: {
  clinicId?: string | null;
  phoneNumberId?: string | null;
  force?: boolean;
  limit?: number;
  event: string;
}): Promise<void> {
  try {
    await syncPhoneNumberTextingStatuses(params);
  } catch (err) {
    logger.warn("texting_status.sync.best_effort_failed", {
      event: params.event,
      clinicId: params.clinicId ?? null,
      phoneNumberId: params.phoneNumberId ?? null,
      message: safeMessage(err),
    });
  }
}

async function syncTollfreeRow(
  row: TextingStatusSyncPhoneNumberRow,
  summary: PhoneNumberTextingStatusSyncSummary,
): Promise<void> {
  try {
    const read = await readTollfreeVerificationForPhoneNumberSid(row.twilio_phone_number_sid!);
    const decision = read.found
      ? mapTollfreeVerificationStatus(read.providerStatus)
      : mapMissingTollfreeVerification();
    await updatePhoneNumberTextingStatus({
      phoneNumberId: row.id,
      clinicId: row.clinic_id,
      status: decision.textingStatus,
      source: textingStatusSyncConfig.sourceLabels.tollfreeVerificationSync,
      providerStatus: decision.providerStatus,
      providerErrorCode: null,
      providerErrorMessage: null,
    });
    countDecision(row, decision.textingStatus, summary);
  } catch (err) {
    summary.failed += 1;
    await recordPhoneNumberTextingSyncDiagnostic({
      phoneNumberId: row.id,
      clinicId: row.clinic_id,
      providerStatus: row.texting_provider_status,
      providerErrorCode: "twilio_tollfree_verification_lookup_failed",
      providerErrorMessage: safeMessage(err),
    });
    logger.warn("texting_status.sync.tollfree_failed", {
      clinicId: row.clinic_id,
      phoneNumberId: row.id,
      message: safeMessage(err),
    });
  }
}

async function syncLocalRow(
  row: TextingStatusSyncPhoneNumberRow,
  readiness: Awaited<ReturnType<typeof syncClinicSmsReadinessFromTwilio>> | null,
  summary: PhoneNumberTextingStatusSyncSummary,
): Promise<void> {
  if (!readiness?.clinic) {
    summary.failed += 1;
    await recordPhoneNumberTextingSyncDiagnostic({
      phoneNumberId: row.id,
      clinicId: row.clinic_id,
      providerStatus: row.texting_provider_status,
      providerErrorCode: "local_readiness_sync_failed",
      providerErrorMessage: "Local A2P readiness sync did not return readiness data.",
    });
    return;
  }

  const number = readiness.numbers.find((n) => n.clinicPhoneNumberId === row.id);
  const decision = mapLocalReadinessToTextingStatus({
    a2pStatus: readiness.clinic.a2pStatus,
    messagingServiceSenderStatus: number?.messagingServiceSenderStatus ?? "missing",
    a2pCampaignCoverageStatus: number?.a2pCampaignCoverageStatus ?? "missing",
    productionSafe: Boolean(number?.productionSafe && readiness.clinic.productionSafe),
    lastSyncErrorCode: number?.lastSyncErrorCode ?? readiness.clinic.lastSyncErrorCode,
  });
  await updatePhoneNumberTextingStatus({
    phoneNumberId: row.id,
    clinicId: row.clinic_id,
    status: decision.textingStatus,
    source: textingStatusSyncConfig.sourceLabels.localReadinessSync,
    providerStatus: decision.providerStatus,
    providerErrorCode: number?.lastSyncErrorCode ?? readiness.clinic.lastSyncErrorCode,
    providerErrorMessage: number?.lastSyncErrorMessage ?? readiness.clinic.lastSyncErrorMessage,
  });
  countDecision(row, decision.textingStatus, summary);
}

function countDecision(
  row: TextingStatusSyncPhoneNumberRow,
  nextStatus: string,
  summary: PhoneNumberTextingStatusSyncSummary,
): void {
  if (nextStatus === "active" && row.texting_status !== "active") {
    summary.updatedToActive += 1;
  } else if (nextStatus === "failed") {
    summary.failed += 1;
  } else if (nextStatus !== "active") {
    summary.remainedPending += 1;
  }
}

function safeMessage(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 500) : "unknown";
}
