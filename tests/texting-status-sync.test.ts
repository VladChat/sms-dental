import assert from "node:assert/strict";
import test from "node:test";

import { textingStatusSyncConfig } from "../config/texting-status-sync.config";
import {
  isPhoneNumberRoutableForTexting,
  isTextingStatusSyncDue,
  mapLocalReadinessToTextingStatus,
  mapMissingTollfreeVerification,
  mapTollfreeVerificationStatus,
  normalizeTextingStatusSyncLimit,
} from "../lib/texting-status/status-mapping";

test("toll-free approved provider status maps to active", () => {
  assert.equal(mapTollfreeVerificationStatus("TWILIO_APPROVED").textingStatus, "active");
  assert.equal(mapTollfreeVerificationStatus("approved").textingStatus, "active");
});

test("toll-free pending/in-review provider statuses do not map to active", () => {
  assert.equal(mapTollfreeVerificationStatus("PENDING_REVIEW").textingStatus, "waiting_for_approval");
  assert.equal(mapTollfreeVerificationStatus("IN_REVIEW").textingStatus, "waiting_for_approval");
});

test("toll-free rejected/failed provider statuses map to failed", () => {
  assert.equal(mapTollfreeVerificationStatus("TWILIO_REJECTED").textingStatus, "failed");
  assert.equal(mapTollfreeVerificationStatus("failed").textingStatus, "failed");
});

test("toll-free no verification found remains waiting", () => {
  const decision = mapMissingTollfreeVerification();
  assert.equal(decision.textingStatus, "waiting_for_approval");
  assert.equal(decision.providerStatus, textingStatusSyncConfig.providerStatusLabels.noTollfreeVerification);
});

test("local A2P verified and sender covered maps to active", () => {
  const decision = mapLocalReadinessToTextingStatus({
    a2pStatus: "verified",
    messagingServiceSenderStatus: "covered",
    a2pCampaignCoverageStatus: "covered",
    productionSafe: true,
    lastSyncErrorCode: null,
  });
  assert.equal(decision.textingStatus, "active");
});

test("local missing sender coverage remains waiting", () => {
  const decision = mapLocalReadinessToTextingStatus({
    a2pStatus: "verified",
    messagingServiceSenderStatus: "missing",
    a2pCampaignCoverageStatus: "covered",
    productionSafe: true,
    lastSyncErrorCode: null,
  });
  assert.equal(decision.textingStatus, "waiting_for_approval");
});

test("local failed/rejected provider states map to failed", () => {
  for (const a2pStatus of ["failed", "rejected", "blocked"] as const) {
    const decision = mapLocalReadinessToTextingStatus({
      a2pStatus,
      messagingServiceSenderStatus: "covered",
      a2pCampaignCoverageStatus: "covered",
      productionSafe: true,
      lastSyncErrorCode: null,
    });
    assert.equal(decision.textingStatus, "failed");
  }
});

test("scheduled-removal numbers are not routable even with active texting status", () => {
  assert.equal(
    isPhoneNumberRoutableForTexting({
      is_active: true,
      removal_status: "scheduled",
      texting_status: "active",
    }),
    false,
  );
  assert.equal(
    isPhoneNumberRoutableForTexting({
      is_active: true,
      removal_status: "active",
      texting_status: "active",
    }),
    true,
  );
});

test("active reconciliation does not over-query fresh rows", () => {
  const now = Date.UTC(2026, 5, 10, 12, 0, 0);
  assert.equal(
    isTextingStatusSyncDue(
      {
        texting_status: "active",
        texting_status_updated_at: new Date(now - textingStatusSyncConfig.staleAgeMs.active + 1000),
      },
      now,
    ),
    false,
  );
  assert.equal(
    isTextingStatusSyncDue(
      {
        texting_status: "active",
        texting_status_updated_at: new Date(now - textingStatusSyncConfig.staleAgeMs.active - 1000),
      },
      now,
    ),
    true,
  );
});

test("pending rows use the shorter pending stale window", () => {
  const now = Date.UTC(2026, 5, 10, 12, 0, 0);
  assert.equal(
    isTextingStatusSyncDue(
      {
        texting_status: "waiting_for_approval",
        texting_status_updated_at: new Date(now - textingStatusSyncConfig.staleAgeMs.pending - 1000),
      },
      now,
    ),
    true,
  );
});

test("batch limit normalization respects bounds", () => {
  assert.equal(normalizeTextingStatusSyncLimit(0, 25), 1);
  assert.equal(normalizeTextingStatusSyncLimit(1000, 25), 25);
  assert.equal(normalizeTextingStatusSyncLimit(7.9, 25), 7);
});
