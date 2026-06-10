import assert from "node:assert/strict";
import test from "node:test";

import {
  SMS_READINESS_MAX_AGE_MS,
  blockingReasonForLocalNumberReadiness,
  blockingReasonForNumberRow,
  blockingReasonForTollfreeCoverage,
  isReadinessTimestampFresh,
  type LiveSendNumberReadiness,
  type LiveSendNumberRow,
} from "../lib/sms-recovery/live-send-evaluation";

const NOW = Date.parse("2026-06-10T12:00:00Z");

function freshIso(ageMs = 60 * 60 * 1000): string {
  return new Date(NOW - ageMs).toISOString();
}

function readiness(
  overrides: Partial<LiveSendNumberReadiness> = {},
): LiveSendNumberReadiness {
  return {
    messagingServiceSenderStatus: "covered",
    a2pCampaignCoverageStatus: "covered",
    productionSafe: true,
    launchBlockingReason: null,
    lastSyncedAt: freshIso(),
    lastSyncErrorCode: null,
    ...overrides,
  };
}

function numberRow(overrides: Partial<LiveSendNumberRow> = {}): LiveSendNumberRow {
  return {
    number_type: "toll_free",
    is_active: true,
    removal_status: "active",
    texting_status: "active",
    ...overrides,
  };
}

test("freshness: missing, invalid, and stale timestamps are not fresh", () => {
  assert.equal(isReadinessTimestampFresh(null, NOW), false);
  assert.equal(isReadinessTimestampFresh("not-a-date", NOW), false);
  assert.equal(
    isReadinessTimestampFresh(new Date(NOW - SMS_READINESS_MAX_AGE_MS - 1000).toISOString(), NOW),
    false,
  );
  assert.equal(isReadinessTimestampFresh(freshIso(), NOW), true);
});

test("number row: inactive, scheduled-removal, and non-active texting block send", () => {
  assert.equal(blockingReasonForNumberRow(numberRow({ is_active: false })), "phone_number_not_active");
  assert.equal(
    blockingReasonForNumberRow(numberRow({ removal_status: "scheduled" })),
    "phone_number_not_active",
  );
  assert.equal(
    blockingReasonForNumberRow(numberRow({ texting_status: "waiting_for_approval" })),
    "phone_number_texting_not_active",
  );
  assert.equal(blockingReasonForNumberRow(numberRow()), null);
});

test("toll-free: covered + fresh + no error is ready", () => {
  assert.equal(blockingReasonForTollfreeCoverage(readiness(), NOW), null);
});

test("toll-free: missing readiness row fails closed", () => {
  assert.equal(blockingReasonForTollfreeCoverage(null, NOW), "number_readiness_missing");
});

test("toll-free: stale readiness fails closed", () => {
  const stale = readiness({ lastSyncedAt: freshIso(SMS_READINESS_MAX_AGE_MS + 1000) });
  assert.equal(blockingReasonForTollfreeCoverage(stale, NOW), "number_sms_readiness_stale");
});

test("toll-free: provider sync error fails closed", () => {
  const errored = readiness({ lastSyncErrorCode: "messaging_service_lookup_failed" });
  assert.equal(blockingReasonForTollfreeCoverage(errored, NOW), "number_sms_readiness_sync_error");
});

test("toll-free: not in Messaging Service sender pool fails closed", () => {
  for (const status of ["missing", "unknown", "error"] as const) {
    const notCovered = readiness({ messagingServiceSenderStatus: status });
    assert.equal(
      blockingReasonForTollfreeCoverage(notCovered, NOW),
      "number_not_in_messaging_service",
      `sender status "${status}" must block`,
    );
  }
});

test("toll-free: A2P campaign coverage is NOT required", () => {
  const tollfree = readiness({ a2pCampaignCoverageStatus: "unknown" });
  assert.equal(blockingReasonForTollfreeCoverage(tollfree, NOW), null);
});

test("local: full coverage required — campaign coverage blocks when missing", () => {
  assert.equal(blockingReasonForLocalNumberReadiness(readiness(), NOW), null);
  const noCampaign = readiness({ a2pCampaignCoverageStatus: "missing" });
  assert.equal(
    blockingReasonForLocalNumberReadiness(noCampaign, NOW),
    "number_not_campaign_covered",
  );
});

test("local: missing/stale/error/not-covered/not-production-safe all block", () => {
  assert.equal(blockingReasonForLocalNumberReadiness(null, NOW), "number_readiness_missing");
  assert.equal(
    blockingReasonForLocalNumberReadiness(
      readiness({ lastSyncedAt: freshIso(SMS_READINESS_MAX_AGE_MS + 1) }),
      NOW,
    ),
    "number_sms_readiness_stale",
  );
  assert.equal(
    blockingReasonForLocalNumberReadiness(readiness({ lastSyncErrorCode: "x" }), NOW),
    "number_sms_readiness_sync_error",
  );
  assert.equal(
    blockingReasonForLocalNumberReadiness(
      readiness({ messagingServiceSenderStatus: "missing" }),
      NOW,
    ),
    "number_not_in_messaging_service",
  );
  assert.equal(
    blockingReasonForLocalNumberReadiness(
      readiness({ productionSafe: false, launchBlockingReason: "custom_reason" }),
      NOW,
    ),
    "custom_reason",
  );
  assert.equal(
    blockingReasonForLocalNumberReadiness(
      readiness({ productionSafe: false, launchBlockingReason: null }),
      NOW,
    ),
    "number_sms_readiness_not_production_safe",
  );
});

test("toll-free error coverage with no error code still blocks on sender status", () => {
  const errorNoCode = readiness({
    messagingServiceSenderStatus: "error",
    lastSyncErrorCode: null,
  });
  assert.equal(
    blockingReasonForTollfreeCoverage(errorNoCode, NOW),
    "number_not_in_messaging_service",
  );
});
