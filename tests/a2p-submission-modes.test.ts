import test from "node:test";
import assert from "node:assert/strict";

import {
  buildA2pModeOptions,
  chooseDefaultA2pMode,
  isLiveCampaignCreationPending,
  isTerminalBrandFailure,
  nextActionForSubmission,
} from "../lib/a2p/submission-modes";

test("chooseDefaultA2pMode prefers mock when live failed and mock is configured", () => {
  assert.equal(
    chooseDefaultA2pMode({
      environmentMode: "live",
      mockConfigured: true,
      liveFailed: true,
    }),
    "mock",
  );
});

test("chooseDefaultA2pMode falls back to environment mode when mock is unavailable", () => {
  assert.equal(
    chooseDefaultA2pMode({
      environmentMode: "live",
      mockConfigured: false,
      liveFailed: true,
    }),
    "live",
  );
});

test("buildA2pModeOptions blocks mock when no separate mock messaging service is configured", () => {
  const options = buildA2pModeOptions({
    environmentMode: "mock",
    defaultMode: "dry_run",
    trackingReady: true,
    mockConfigured: false,
    liveSubmitArmed: false,
    liveBlockedReason: "Live is not armed.",
  });
  const mock = options.find((option) => option.mode === "mock");
  assert.ok(mock);
  assert.equal(mock?.available, false);
  assert.match(mock?.disabledReason ?? "", /mock/i);
});

test("buildA2pModeOptions blocks every mode until submission-mode tracking migration is applied", () => {
  const options = buildA2pModeOptions({
    environmentMode: "mock",
    defaultMode: "mock",
    trackingReady: false,
    mockConfigured: true,
    liveSubmitArmed: true,
    liveBlockedReason: null,
  });

  for (const option of options) {
    assert.equal(option.available, false);
    assert.match(option.disabledReason ?? "", /20260611000100/);
  }
});

test("isLiveCampaignCreationPending requires approved brand and missing campaign sid", () => {
  assert.equal(
    isLiveCampaignCreationPending({
      status: "pending",
      brandStatus: "APPROVED",
      campaignSid: null,
      brandFailureReason: null,
    }),
    true,
  );
  assert.equal(
    isLiveCampaignCreationPending({
      status: "pending",
      brandStatus: "FAILED",
      campaignSid: null,
      brandFailureReason: "Invalid EIN",
    }),
    false,
  );
});

test("isTerminalBrandFailure treats blocked live brand state as terminal", () => {
  assert.equal(
    isTerminalBrandFailure({
      status: "blocked",
      brandStatus: "FAILED",
      campaignSid: null,
      brandFailureReason: "Invalid EIN",
    }),
    true,
  );
});

test("nextActionForSubmission warns against continuing failed live fake-company testing", () => {
  const nextAction = nextActionForSubmission({
    status: "blocked",
    brandStatus: "FAILED",
    campaignSid: null,
    brandFailureReason: "The submitted US EIN is invalid.",
  }, "live");
  assert.match(nextAction ?? "", /Do not continue this live attempt/i);
});
