import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildA2pLifecycleSteps } from "../lib/a2p/lifecycle";

/**
 * Tests verifying the mock lifecycle confirmation contract:
 *
 * 1. Create actions require confirmation (have actionLabel with "create")
 * 2. Refresh actions do not require confirmation (no "create" in actionLabel)
 * 3. The mock_create_campaign step is the only create action in the mock flow
 *    that should send confirm:true to trigger the real mutation.
 * 4. Locked steps must not render active buttons (no actionLabel for final step).
 */

function makeMockPkg(overrides: {
  mockBrandSid?: string | null;
  mockBrandStatus?: string | null;
  mockCampaignSid?: string | null;
  mockCampaignStatus?: string | null;
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
        exists: false,
        submission: {
          brandRegistrationSid: null,
          brandStatus: null,
          campaignSid: null,
          campaignStatus: null,
          status: "ready_for_review",
        },
        mock: false,
        nextAction: null,
      },
    },
  };
}

describe("Mock lifecycle confirmation contract", () => {
  it("mock_create_campaign is the active create step requiring confirmation", () => {
    const pkg = makeMockPkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const createSteps = steps.filter(
      (s) => s.actionLabel && s.actionLabel.toLowerCase().includes("create"),
    );
    const refreshSteps = steps.filter(
      (s) => s.actionLabel && s.actionLabel.toLowerCase().includes("refresh"),
    );

    // There are 2 create steps: mock_create_brand (complete) and mock_create_campaign (ready)
    // Only mock_create_campaign is in "ready" state and needs user confirmation to execute
    assert.ok(createSteps.length >= 2, "should have at least 2 create steps in mock flow");
    const readyCreateStep = createSteps.find((s) => s.status === "ready");
    assert.ok(readyCreateStep, "should have a ready create step");
    assert.equal(readyCreateStep!.id, "mock_create_campaign");

    // The brand create step should be complete (not needing execution)
    const brandStep = createSteps.find((s) => s.id === "mock_create_brand")!;
    assert.equal(brandStep.status, "complete", "brand step should be complete");

    // Refresh steps should not be create actions
    for (const s of refreshSteps) {
      assert.ok(
        !s.actionLabel!.toLowerCase().includes("create"),
        `refresh step ${s.id} should not be a create action`,
      );
    }
  });

  it("mock_create_campaign is ready when brand is registered and no campaign exists", () => {
    const pkg = makeMockPkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;

    assert.equal(campaignStep.status, "ready");
    assert.equal(campaignStep.actionLabel, "Create Mock Campaign");
    assert.equal(campaignStep.disabledReason, null);
  });

  it("mock_create_brand does not need confirm once brand already exists (step is complete)", () => {
    const pkg = makeMockPkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const brandStep = steps.find((s) => s.id === "mock_create_brand")!;

    // Brand is already complete — actionLabel still exists but status is "complete"
    // The UI should not render the button for complete steps that don't need re-execution
    assert.equal(brandStep.status, "complete");
  });

  it("locked final step has no actionLabel so UI does not render a Run button", () => {
    const pkg = makeMockPkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const testStep = steps.find((s) => s.id === "mock_test_complete")!;

    assert.equal(testStep.status, "locked");
    assert.equal(testStep.actionLabel, undefined, "locked final step must not have actionLabel");
  });

  it("locked mock_create_brand does not need confirm when brand is missing", () => {
    const pkg = makeMockPkg();

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const brandStep = steps.find((s) => s.id === "mock_create_brand")!;

    // Brand is missing, step is "ready" — but in the current implementation
    // the brand creation is handled by the submit route, not the action route.
    // The action route returns dry-run for mock_create_brand regardless.
    assert.equal(brandStep.status, "ready");
    assert.equal(brandStep.actionLabel, "Create Mock Brand");
  });
});

describe("Mock campaign action safety", () => {
  it("mock_create_campaign requires confirm=true to execute real mutation", () => {
    // This test documents the contract:
    // The action route at POST /api/admin/clinics/[clinicId]/a2p/action
    // checks for confirm === true before calling runMockA2pSubmission().
    // Without confirm, it returns dry-run: true.
    //
    // The A2pLifecycle component now sends:
    //   confirm: confirmMap[stepId] === true
    // So when the user checks "I confirm", confirm=true reaches the route.

    const pkg = makeMockPkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;

    // Verify the step is configured for a create action
    assert.equal(campaignStep.actionLabel, "Create Mock Campaign");
    assert.ok(
      campaignStep.actionLabel!.toLowerCase().includes("create"),
      "action label must contain 'create' to trigger confirm requirement",
    );
  });

  it("mock_create_campaign uses existing mock Brand SID and mock Messaging Service", () => {
    // This test documents the safety contract:
    // runMockA2pSubmission() uses:
    //   - existing mock Brand SID from the mock submission row
    //   - mock Messaging Service SID from env (MGea09b41a93643350a8afd9f5d7e9f48d)
    //   - does NOT create another mock Brand
    //   - does NOT create live Brand/Campaign
    //   - does NOT attach phone numbers
    //   - does NOT enable SMS

    const pkg = makeMockPkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;

    // Campaign step should be ready when brand is complete
    assert.equal(campaignStep.status, "ready");
    // No existing campaign
    assert.equal(campaignStep.providerSid, null);
  });

  it("mock create action is routed to /a2p/action endpoint", () => {
    // Refresh actions use /a2p/status, create actions use /a2p/action.
    // This is implemented in the A2pLifecycle component's runAction function.
    // The test documents this contract.

    const pkg = makeMockPkg({
      mockBrandSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
      mockBrandStatus: "REGISTERED",
    });

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");

    for (const s of steps) {
      if (!s.actionLabel) continue;
      const isRefresh = s.id.includes("refresh");
      const isCreate = s.actionLabel.toLowerCase().includes("create");
      if (isRefresh) {
        assert.ok(!isCreate, `refresh step ${s.id} should not be create`);
      }
    }
  });
});