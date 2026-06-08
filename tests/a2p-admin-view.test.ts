import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  badgeToneFor,
  buildA2pAdminOverview,
  buildAdvancedDiagnosticsView,
  buildLiveA2pApprovalView,
  buildMockA2pTestView,
  buildSmsLaunchReadinessView,
} from "../lib/a2p/admin-view";

// Fixture mirrors the real production state of the Fairstone clinic:
//   - Mock Brand APPROVED + Mock Campaign VERIFIED  => mock test complete
//   - Live Brand FAILED (invalid EIN), no live campaign => live failed
//   - clinic_sms_readiness contaminated with the mock Brand (approved) while the
//     live Brand is not approved => mock identifiers leaked into readiness
function makePkg(overrides: {
  mockBrandStatus?: string | null;
  mockCampaignSid?: string | null;
  mockCampaignStatus?: string | null;
  liveBrandStatus?: string | null;
  liveCampaignSid?: string | null;
  liveCampaignStatus?: string | null;
  submissionMode?: string;
  liveSubmitArmed?: boolean;
  readinessBrandStatus?: string;
  numbersCovered?: boolean;
  smsRecoveryEnabled?: boolean;
} = {}) {
  const mockSubmission = {
    brandRegistrationSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
    brandStatus: overrides.mockBrandStatus ?? "APPROVED",
    campaignSid: overrides.mockCampaignSid ?? "QE2c6890da8086d771620e9b13fadeba0b",
    campaignStatus: overrides.mockCampaignStatus ?? "VERIFIED",
    messagingServiceSid: "MGea09b41a93643350a8afd9f5d7e9f48d",
    status: "pending",
    customerProfileStatus: null,
    trustProductStatus: null,
    brandFailureReason: null,
    brandFailureCode: null,
    rejectionReason: null,
    submittedAt: null,
    lastStatusSyncedAt: null,
    submissionStep: "awaiting_campaign_approval",
  };
  const liveSubmission = {
    brandRegistrationSid: "BNe8c3a43091282b3c14f3182da6e69bce",
    brandStatus: overrides.liveBrandStatus ?? "FAILED",
    campaignSid: overrides.liveCampaignSid ?? null,
    campaignStatus: overrides.liveCampaignStatus ?? null,
    messagingServiceSid: "MG83239dc7dfdf8aa6c9b397e8258f7d93",
    status: (overrides.liveBrandStatus ?? "FAILED") === "FAILED" ? "blocked" : "ready_for_review",
    customerProfileStatus: null,
    trustProductStatus: null,
    brandFailureReason: "Brand Registration Feedback: The submitted US EIN is invalid.",
    brandFailureCode: null,
    rejectionReason: "Brand registration failed. The submitted US EIN is invalid.",
    submittedAt: "2026-06-07T19:18:22.836Z",
    lastStatusSyncedAt: "2026-06-07T22:18:02.621Z",
    submissionStep: "brand_registration_failed",
  };
  const covered = overrides.numbersCovered ?? false;
  return {
    clinicName: "Fairstone Dental Smile",
    submissions: {
      mock: { exists: true, mock: true, submission: mockSubmission },
      live: { exists: true, mock: false, submission: liveSubmission },
    },
    authorizationState: {
      submissionMode: overrides.submissionMode ?? "live",
      mockMessagingServiceSid: "MGea09b41a93643350a8afd9f5d7e9f48d",
      liveSubmitArmed: overrides.liveSubmitArmed ?? false,
      liveSubmitBlockedReason: "Do not continue this live attempt for fake-company testing. The submitted US EIN is invalid.",
      feesRiskNotice: ["Brand Registration incurs a one-time Twilio/TCR fee."],
    },
    numbers: [
      { phoneNumber: "+12244009986", eligibleForLiveSms: covered, coverageDisplay: covered ? "covered" : "not_campaign_covered" },
      { phoneNumber: "+12243442685", eligibleForLiveSms: covered, coverageDisplay: covered ? "covered" : "not_campaign_covered" },
    ],
    clinicReadiness: {
      messagingServiceStatus: "verified",
      brandStatus: overrides.readinessBrandStatus ?? "approved",
      campaignStatus: "unknown",
      a2pStatus: "blocked",
      lastSyncedAt: "2026-06-08T01:19:58.942Z",
      blockingReason: "a2p_campaign_not_verified",
    },
    providerPayload: { resources: [{ step: "Brand Registration", fields: [] }] },
    internalDiagnostics: {
      plannedResources: [{ key: "a" }, { key: "b" }],
      numberDiagnostics: [{ phoneNumber: "+12244009986" }, { phoneNumber: "+12243442685" }],
      warnings: [],
    },
  };
}

const launchBlocked = { smsRecoveryEnabled: false, launchReady: false, smsStatus: "preparing", launchBlockedReason: null };

describe("A2P admin view — status separation", () => {
  it("mock Brand APPROVED + Campaign VERIFIED => mock test complete (test-only)", () => {
    const v = buildMockA2pTestView(makePkg() as any);
    assert.equal(v.testComplete, true);
    assert.equal(v.status, "complete");
    assert.equal(v.brand.complete, true);
    assert.equal(v.campaign.complete, true);
    // Completed resources are read-only — no create actions.
    assert.equal(v.showCreateActions, false);
  });

  it("live Brand FAILED => live approval failed with EIN reason", () => {
    const v = buildLiveA2pApprovalView(makePkg() as any);
    assert.equal(v.status, "failed");
    assert.equal(v.brandFailed, true);
    assert.equal(v.brandApproved, false);
    assert.equal(v.campaignCreated, false);
    assert.match(v.failureReason ?? "", /EIN is invalid/i);
    // Prefix is stripped for a clean one-liner.
    assert.ok(!(v.failureReason ?? "").startsWith("Brand Registration Feedback"));
    assert.match(v.nextAction, /EIN/i);
  });

  it("real SMS stays blocked despite mock complete", () => {
    const v = buildSmsLaunchReadinessView(makePkg() as any, launchBlocked);
    assert.equal(v.ready, false);
    assert.equal(v.status, "blocked");
    assert.equal(v.liveA2pApproved, false);
    assert.equal(v.liveCampaignVerified, false);
    assert.equal(v.senderCoverageComplete, false);
  });

  it("CRITICAL: mock completion never marks real SMS ready", () => {
    // Mock complete, but live is not approved and there is no live campaign.
    const v = buildSmsLaunchReadinessView(makePkg() as any, launchBlocked);
    assert.equal(v.ready, false);
  });

  it("live approved alone (no campaign, no coverage) does not make real SMS ready", () => {
    const v = buildSmsLaunchReadinessView(
      makePkg({ liveBrandStatus: "APPROVED" }) as any,
      launchBlocked,
    );
    assert.equal(v.liveA2pApproved, true);
    assert.equal(v.liveCampaignVerified, false);
    assert.equal(v.ready, false);
  });

  it("real SMS ready only when live approved + live campaign verified + coverage", () => {
    const v = buildSmsLaunchReadinessView(
      makePkg({
        liveBrandStatus: "APPROVED",
        liveCampaignSid: "CMxxxx",
        liveCampaignStatus: "VERIFIED",
        numbersCovered: true,
      }) as any,
      launchBlocked,
    );
    assert.equal(v.liveA2pApproved, true);
    assert.equal(v.liveCampaignVerified, true);
    assert.equal(v.senderCoverageComplete, true);
    assert.equal(v.ready, true);
  });
});

describe("A2P admin view — mock/live readiness contamination safety", () => {
  it("flags readiness that includes mock identifiers (mock brand approved, live not approved)", () => {
    const v = buildSmsLaunchReadinessView(makePkg() as any, launchBlocked);
    assert.equal(v.readinessIncludesMockIdentifiers, true);
  });

  it("does NOT flag contamination once the live brand is genuinely approved", () => {
    const v = buildSmsLaunchReadinessView(
      makePkg({ liveBrandStatus: "APPROVED", readinessBrandStatus: "approved" }) as any,
      launchBlocked,
    );
    assert.equal(v.readinessIncludesMockIdentifiers, false);
  });
});

describe("A2P admin view — mock references never invent a CM SID", () => {
  it("labels a stored QE campaign SID as a provider reference, not a console SID", () => {
    const v = buildMockA2pTestView(makePkg() as any);
    assert.equal(v.campaign.sid, "QE2c6890da8086d771620e9b13fadeba0b");
    assert.equal(v.campaign.sidLabel, "Stored provider campaign SID");
  });

  it("labels a real CM console SID correctly when the app actually holds one", () => {
    const v = buildMockA2pTestView(makePkg({ mockCampaignSid: "CM47f2abxxxx" }) as any);
    assert.equal(v.campaign.sidLabel, "Twilio Console Campaign SID");
  });
});

describe("A2P admin view — overview cards", () => {
  it("produces four cards: mock, live, realSms, nextAction", () => {
    const ov = buildA2pAdminOverview(makePkg() as any, launchBlocked);
    assert.deepEqual(ov.cards.map((c) => c.id), ["mock", "live", "realSms", "nextAction"]);
  });

  it("overview reflects mock complete / live failed / real SMS blocked", () => {
    const ov = buildA2pAdminOverview(makePkg() as any, launchBlocked);
    const byId = Object.fromEntries(ov.cards.map((c) => [c.id, c]));
    assert.equal(byId.mock.status, "Complete");
    assert.equal(byId.live.status, "Failed");
    assert.equal(byId.realSms.status, "Blocked");
    assert.match(byId.nextAction.body, /EIN/i);
  });

  it("notes when live submission is disabled in this environment", () => {
    const ov = buildA2pAdminOverview(makePkg({ submissionMode: "disabled" }) as any, launchBlocked);
    assert.match(ov.liveSubmissionDisabledNote ?? "", /disabled/i);
  });
});

describe("A2P admin view — diagnostics + tone mapping", () => {
  it("diagnostics view summarizes raw provider state and counts", () => {
    const d = buildAdvancedDiagnosticsView(makePkg() as any);
    assert.equal(d.hasLiveHistory, true);
    assert.equal(d.hasMockHistory, true);
    assert.equal(d.perNumberCount, 2);
    assert.equal(d.plannedResourceCount, 2);
    assert.ok(d.providerStatusChain.length > 0);
  });

  it("badgeToneFor maps danger -> warning (Badge has no danger tone)", () => {
    assert.equal(badgeToneFor("danger"), "warning");
    assert.equal(badgeToneFor("success"), "success");
    assert.equal(badgeToneFor("info"), "info");
  });
});
