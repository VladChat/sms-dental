import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildA2pLifecycleSteps } from "../lib/a2p/lifecycle";

function makePkg(overrides: {
  mockBrandSid?: string | null;
  mockBrandStatus?: string | null;
  mockCampaignSid?: string | null;
  mockCampaignStatus?: string | null;
  liveBrandSid?: string | null;
  liveBrandStatus?: string | null;
} = {}) {
  return {
    submissions: {
      mock: {
        mode: "mock",
        title: "Mock",
        exists: Boolean(overrides.mockBrandSid),
        submission: {
          brandRegistrationSid: overrides.mockBrandSid ?? null,
          brandStatus: overrides.mockBrandStatus ?? null,
          campaignSid: overrides.mockCampaignSid ?? null,
          campaignStatus: overrides.mockCampaignStatus ?? null,
          status: overrides.mockBrandSid ? "pending" : "ready_for_review",
        },
        mock: true,
        nextAction: null,
      },
      live: {
        mode: "live",
        title: "Live",
        exists: Boolean(overrides.liveBrandSid),
        submission: {
          brandRegistrationSid: overrides.liveBrandSid ?? null,
          brandStatus: overrides.liveBrandStatus ?? null,
          campaignSid: null,
          campaignStatus: null,
          status: overrides.liveBrandStatus === "FAILED" ? "blocked" : "ready_for_review",
        },
        mock: false,
        nextAction: null,
      },
    },
  };
}

describe("A2P lifecycle builder (mock)", () => {
  it("shows mock brand complete and create campaign ready when REGISTERED and no campaign", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const brandStep = steps.find((s) => s.id === "mock_create_brand")!;
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;
    const refreshBrandStep = steps.find((s) => s.id === "mock_refresh_brand")!;
    const testStep = steps.find((s) => s.id === "mock_test_complete")!;

    assert.equal(brandStep.status, "complete", "brand step should be complete when REGISTERED");
    assert.equal(refreshBrandStep.status, "complete", "refresh brand should be complete when REGISTERED");
    assert.equal(campaignStep.status, "ready", "campaign step should be ready when brand complete and no campaign");
    assert.equal(campaignStep.actionLabel, "Create Mock Campaign");
    assert.equal(testStep.status, "locked", "test complete should be locked when no campaign");
  });

  it("handles Registered (mixed case) as mock brand complete", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "Registered",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const brandStep = steps.find((s) => s.id === "mock_create_brand")!;
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;

    assert.equal(brandStep.status, "complete");
    assert.equal(campaignStep.status, "ready");
  });

  it("handles approved status as mock brand complete", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "approved",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const brandStep = steps.find((s) => s.id === "mock_create_brand")!;
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;

    assert.equal(brandStep.status, "complete");
    assert.equal(campaignStep.status, "ready");
  });

  it("shows campaign complete when both brand and campaign exist", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
      mockCampaignSid: "CM12345",
      mockCampaignStatus: "registered",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;
    const testStep = steps.find((s) => s.id === "mock_test_complete")!;

    assert.equal(campaignStep.status, "complete");
    assert.equal(testStep.status, "complete", "test complete should be complete when brand and campaign both exist");
  });

  it("shows campaign complete with verified status", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
      mockCampaignSid: "CM12345",
      mockCampaignStatus: "verified",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;
    const testStep = steps.find((s) => s.id === "mock_test_complete")!;

    assert.equal(campaignStep.status, "complete");
    assert.equal(testStep.status, "complete", "test complete should be complete with verified campaign");
  });

  it("shows brand as pending when brand exists but status is pending", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "PENDING",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const brandStep = steps.find((s) => s.id === "mock_create_brand")!;
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;

    assert.equal(brandStep.status, "pending");
    assert.equal(campaignStep.status, "locked", "campaign should be locked when brand is pending");
  });

  it("shows brand as failed when brand status is FAILED", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "FAILED",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const brandStep = steps.find((s) => s.id === "mock_create_brand")!;
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;

    assert.equal(brandStep.status, "failed");
    assert.equal(campaignStep.status, "locked");
  });

  it("locked final step does not have actionLabel", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
      // no campaign
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const testStep = steps.find((s) => s.id === "mock_test_complete")!;

    assert.equal(testStep.status, "locked");
    assert.equal(testStep.actionLabel, undefined, "locked final step should not have actionLabel");
  });

  it("locked refresh campaign is locked when no campaign exists", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
      // no campaign
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const refreshCampaignStep = steps.find((s) => s.id === "mock_refresh_campaign")!;

    assert.equal(refreshCampaignStep.status, "locked", "refresh campaign should be locked when no campaign exists");
    assert.equal(refreshCampaignStep.disabledReason, "No mock Campaign exists");
  });

  it("complete steps have no actionLabel (no create button rendered)", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
      mockCampaignSid: "CM12345",
      mockCampaignStatus: "verified",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");

    for (const s of steps) {
      if (s.status === "complete") {
        assert.equal(s.actionLabel, undefined, `complete step ${s.id} should not have actionLabel`);
      }
    }
  });

  it("all steps complete when brand registered and campaign verified", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
      mockCampaignSid: "CM12345",
      mockCampaignStatus: "verified",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const nonRefreshSteps = steps.filter((s) => !s.id.includes("refresh"));

    for (const s of nonRefreshSteps) {
      assert.equal(s.status, "complete", `step ${s.id} should be complete`);
    }
  });
});

describe("A2P lifecycle builder (live contamination isolation)", () => {
  it("mock workflow does not show live FAILED status when mock is registered", () => {
    const pkg = makePkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
      liveBrandSid: "BNe8c3a43091282b3c14f3182da6e69bce",
      liveBrandStatus: "FAILED",
    });

    // Mock lifecycle steps should show mock as complete, not affected by live FAILED
    const mockSteps = buildA2pLifecycleSteps(pkg as any, "mock");
    const mockBrandStep = mockSteps.find((s) => s.id === "mock_create_brand")!;
    assert.equal(mockBrandStep.status, "complete", "mock brand should be complete regardless of live FAILED");

    // Live lifecycle steps should show live as failed
    const liveSteps = buildA2pLifecycleSteps(pkg as any, "live");
    const liveBrandStep = liveSteps.find((s) => s.id === "live_submit_brand")!;
    assert.equal(liveBrandStep.status, "failed", "live brand should show failed");
  });
});

describe("A2P lifecycle builder (live mode)", () => {
  it("live brand with approved status shows complete (lowercase from DB)", () => {
    const pkg = makePkg({
      liveBrandSid: "BNe8c3a43091282b3c14f3182da6e69bce",
      liveBrandStatus: "approved",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "live");
    const brandStep = steps.find((s) => s.id === "live_submit_brand")!;
    assert.equal(brandStep.status, "complete");
  });

  it("live brand with REGISTERED status does NOT show complete (only mock uses REGISTERED)", () => {
    const pkg = makePkg({
      liveBrandSid: "BNe8c3a43091282b3c14f3182da6e69bce",
      liveBrandStatus: "REGISTERED",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "live");
    const brandStep = steps.find((s) => s.id === "live_submit_brand")!;
    assert.equal(brandStep.status, "pending", "live brand with REGISTERED should NOT be complete");
  });
});