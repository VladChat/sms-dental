import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildA2pLifecycleSteps } from "../lib/a2p/lifecycle";

describe("A2P lifecycle builder (mock)", () => {
  it("shows mock brand complete and create campaign ready when campaign missing", () => {
    const pkg: any = {
      submissions: {
        mock: {
          mode: "mock",
          title: "Mock",
          exists: true,
          submission: {
            brandRegistrationSid: "BN588a99e6ecaf81cc0d8b3baad6cd7cdc",
            brandStatus: "REGISTERED",
            campaignSid: null,
            campaignStatus: null,
          },
          mock: true,
          nextAction: null,
        },
        live: {
          mode: "live",
          title: "Live",
          exists: true,
          submission: {
            brandRegistrationSid: "BNe8c3a43091282b3c14f3182da6e69bce",
            brandStatus: "FAILED",
            campaignSid: null,
            campaignStatus: null,
          },
          mock: false,
          nextAction: null,
        },
      },
    };

    const steps = buildA2pLifecycleSteps(pkg as any, "mock");
    const ids = steps.map((s) => s.id);
    assert(ids.includes("mock_create_brand"));
    assert(ids.includes("mock_create_campaign"));

    const brandStep = steps.find((s) => s.id === "mock_create_brand")!;
    const campaignStep = steps.find((s) => s.id === "mock_create_campaign")!;

    // Brand exists and registered -> brand step should be complete/pending (not locked)
    assert.notStrictEqual(brandStep.status, "locked");
    // Campaign missing and brand approved -> campaign should be ready
    assert.strictEqual(campaignStep.status, "ready");
  });
});
