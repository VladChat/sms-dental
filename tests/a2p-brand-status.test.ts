import test from "node:test";
import assert from "node:assert/strict";

import {
  isBrandApprovedStatus,
  isBrandPendingStatus,
  isBrandTerminalFailureStatus,
  isMockBrandCompleteStatus,
  normalizeBrandStatus,
} from "../lib/twilio/brand-status-classification";
import { isSafeBrandStatus as isSafeBrandStatusForSmsReadiness } from "../lib/db/sms-readiness";

// ---------- isBrandApprovedStatus ----------

test("isBrandApprovedStatus returns true for APPROVED", () => {
  assert.equal(isBrandApprovedStatus("APPROVED"), true);
  assert.equal(isBrandApprovedStatus("approved"), true);
  assert.equal(isBrandApprovedStatus("Approved"), true);
});

test("isBrandApprovedStatus returns true for VERIFIED", () => {
  assert.equal(isBrandApprovedStatus("VERIFIED"), true);
  assert.equal(isBrandApprovedStatus("verified"), true);
});

test("isBrandApprovedStatus returns false for FAILED", () => {
  assert.equal(isBrandApprovedStatus("FAILED"), false);
});

test("isBrandApprovedStatus returns false for PENDING", () => {
  assert.equal(isBrandApprovedStatus("PENDING"), false);
});

test("isBrandApprovedStatus returns false for null/undefined", () => {
  assert.equal(isBrandApprovedStatus(null), false);
  assert.equal(isBrandApprovedStatus(undefined), false);
  assert.equal(isBrandApprovedStatus(""), false);
});

// ---------- isBrandPendingStatus ----------

test("isBrandPendingStatus returns true for in-progress statuses", () => {
  assert.equal(isBrandPendingStatus("PENDING"), true);
  assert.equal(isBrandPendingStatus("IN_REVIEW"), true);
  assert.equal(isBrandPendingStatus("PENDING_REVIEW"), true);
  assert.equal(isBrandPendingStatus("PENDING REVIEW"), true);
  assert.equal(isBrandPendingStatus("IN REVIEW"), true);
  assert.equal(isBrandPendingStatus("pending"), true);
});

test("isBrandPendingStatus returns false for terminal/other statuses", () => {
  assert.equal(isBrandPendingStatus("FAILED"), false);
  assert.equal(isBrandPendingStatus("REJECTED"), false);
  assert.equal(isBrandPendingStatus("APPROVED"), false);
  assert.equal(isBrandPendingStatus(null), false);
  assert.equal(isBrandPendingStatus(""), false);
});

// ---------- isBrandTerminalFailureStatus ----------

test("isBrandTerminalFailureStatus returns true for terminal statuses", () => {
  assert.equal(isBrandTerminalFailureStatus("FAILED"), true);
  assert.equal(isBrandTerminalFailureStatus("REJECTED"), true);
  assert.equal(isBrandTerminalFailureStatus("DECLINED"), true);
  assert.equal(isBrandTerminalFailureStatus("SUSPENDED"), true);
  assert.equal(isBrandTerminalFailureStatus("UNVERIFIED"), true);
  assert.equal(isBrandTerminalFailureStatus("failed"), true);
});

test("isBrandTerminalFailureStatus returns false for non-terminal statuses", () => {
  assert.equal(isBrandTerminalFailureStatus("PENDING"), false);
  assert.equal(isBrandTerminalFailureStatus("APPROVED"), false);
  assert.equal(isBrandTerminalFailureStatus("IN_REVIEW"), false);
  assert.equal(isBrandTerminalFailureStatus(null), false);
  assert.equal(isBrandTerminalFailureStatus(""), false);
});

// ---------- normalizeBrandStatus ----------

test("normalizeBrandStatus maps to approved", () => {
  assert.equal(normalizeBrandStatus("APPROVED"), "approved");
  assert.equal(normalizeBrandStatus("VERIFIED"), "approved");
});

test("normalizeBrandStatus maps to pending", () => {
  assert.equal(normalizeBrandStatus("PENDING"), "pending");
  assert.equal(normalizeBrandStatus("IN_REVIEW"), "pending");
  assert.equal(normalizeBrandStatus("PENDING REVIEW"), "pending");
});

test("normalizeBrandStatus maps to failed", () => {
  assert.equal(normalizeBrandStatus("FAILED"), "failed");
  assert.equal(normalizeBrandStatus("REJECTED"), "failed");
  assert.equal(normalizeBrandStatus("DECLINED"), "failed");
  assert.equal(normalizeBrandStatus("SUSPENDED"), "failed");
  assert.equal(normalizeBrandStatus("UNVERIFIED"), "failed");
});

test("normalizeBrandStatus maps unknown to unknown", () => {
  assert.equal(normalizeBrandStatus("WTFSTATUS"), "unknown");
  assert.equal(normalizeBrandStatus(null), "unknown");
  assert.equal(normalizeBrandStatus(""), "unknown");
  assert.equal(normalizeBrandStatus(undefined), "unknown");
});

// ---------- isMockBrandCompleteStatus ----------

test("isMockBrandCompleteStatus returns true for APPROVED", () => {
  assert.equal(isMockBrandCompleteStatus("APPROVED"), true);
  assert.equal(isMockBrandCompleteStatus("approved"), true);
  assert.equal(isMockBrandCompleteStatus("Approved"), true);
});

test("isMockBrandCompleteStatus returns true for VERIFIED", () => {
  assert.equal(isMockBrandCompleteStatus("VERIFIED"), true);
  assert.equal(isMockBrandCompleteStatus("verified"), true);
});

test("isMockBrandCompleteStatus returns true for REGISTERED", () => {
  assert.equal(isMockBrandCompleteStatus("REGISTERED"), true);
  assert.equal(isMockBrandCompleteStatus("Registered"), true);
  assert.equal(isMockBrandCompleteStatus("registered"), true);
});

test("isMockBrandCompleteStatus returns false for FAILED", () => {
  assert.equal(isMockBrandCompleteStatus("FAILED"), false);
});

test("isMockBrandCompleteStatus returns false for PENDING", () => {
  assert.equal(isMockBrandCompleteStatus("PENDING"), false);
});

test("isMockBrandCompleteStatus returns false for null/undefined/empty", () => {
  assert.equal(isMockBrandCompleteStatus(null), false);
  assert.equal(isMockBrandCompleteStatus(undefined), false);
  assert.equal(isMockBrandCompleteStatus(""), false);
});

test("isMockBrandCompleteStatus does NOT treat REGISTERED as approved for live A2P (isBrandApprovedStatus)", () => {
  // isBrandApprovedStatus should NOT include REGISTERED — only mock uses it
  assert.equal(isBrandApprovedStatus("REGISTERED"), false);
  assert.equal(isBrandApprovedStatus("Registered"), false);
  assert.equal(isBrandApprovedStatus("registered"), false);
  // But isMockBrandCompleteStatus should
  assert.equal(isMockBrandCompleteStatus("REGISTERED"), true);
});

test("SMS live-send readiness does NOT treat REGISTERED as approved for local A2P", () => {
  assert.equal(isSafeBrandStatusForSmsReadiness("APPROVED"), true);
  assert.equal(isSafeBrandStatusForSmsReadiness("VERIFIED"), true);
  assert.equal(isSafeBrandStatusForSmsReadiness("REGISTERED"), false);
  assert.equal(isSafeBrandStatusForSmsReadiness("registered"), false);
});
