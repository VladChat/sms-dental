// Tunables for the phone-number texting-status sync.
//
// Keep schedules, batch sizes, stale windows, Twilio read limits, and source
// labels here instead of scattering literals through business logic.

const HOUR_MS = 60 * 60 * 1000;

export const textingStatusSyncConfig = {
  cron: {
    path: "/api/jobs/sync-phone-number-texting-status",
    schedule: "0 10 * * *",
    batchSize: 25,
  },
  singleClinicBatchSize: 50,
  eventBatchSize: 1,
  staleAgeMs: {
    pending: 6 * HOUR_MS,
    active: 24 * HOUR_MS,
  },
  twilio: {
    tollfreeVerificationListLimit: 5,
    tollfreeVerificationPageSize: 50,
  },
  activeTollfreeReconciliationEnabled: true,
  sourceLabels: {
    tollfreeVerificationSync: "twilio_tollfree_verification_sync",
    localReadinessSync: "twilio_a2p_readiness_sync",
    providerSyncError: "twilio_texting_status_sync_error",
  },
  providerStatusLabels: {
    noTollfreeVerification: "NO_TOLLFREE_VERIFICATION",
    localA2pVerified: "LOCAL_A2P_VERIFIED",
    localA2pWaiting: "LOCAL_A2P_WAITING",
    localA2pFailed: "LOCAL_A2P_FAILED",
    missingTwilioSid: "MISSING_TWILIO_PHONE_NUMBER_SID",
  },
} as const;

export type TextingStatusSyncConfig = typeof textingStatusSyncConfig;
