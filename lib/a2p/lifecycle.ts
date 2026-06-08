import { isMockBrandCompleteStatus } from "../twilio/brand-status-classification";
import type { A2pReviewPackage, A2pStoredSubmissionMode } from "./types";

export type A2pLifecycleStep = {
  id: string;
  mode: A2pStoredSubmissionMode | "shared";
  title: string;
  status: "locked" | "ready" | "pending" | "complete" | "failed";
  description?: string;
  actionLabel?: string;
  disabledReason?: string | null;
  providerSid?: string | null;
  providerStatus?: string | null;
  warning?: string | null;
};

// Build lifecycle steps for the selected mode using the review package.
export function buildA2pLifecycleSteps(
  pkg: A2pReviewPackage,
  selectedMode: A2pStoredSubmissionMode,
): A2pLifecycleStep[] {
  const steps: A2pLifecycleStep[] = [];
  const mock = pkg.submissions.mock;
  const live = pkg.submissions.live;

  if (selectedMode === "mock") {
    // Create Mock Brand
    const brandExists = Boolean(mock.submission.brandRegistrationSid);
    const brandStatus = mock.submission.brandStatus ?? null;
    const brandTerminalFail = brandStatus ? brandStatus.toLowerCase().includes("failed") || brandStatus.toLowerCase().includes("rejected") : false;
    const brandComplete = isMockBrandCompleteStatus(brandStatus);
    const brandStepComplete = brandExists && brandComplete;
    steps.push({
      id: "mock_create_brand",
      mode: "mock",
      title: "Create Mock Brand",
      status: brandStepComplete ? "complete" : brandExists ? (brandTerminalFail ? "failed" : "pending") : "ready",
      description: brandStepComplete ? "Mock Brand already created." : "Register a Mock Brand with Twilio (mock:true).",
      actionLabel: brandStepComplete ? undefined : "Create Mock Brand",
      providerSid: mock.submission.brandRegistrationSid ?? null,
      providerStatus: brandStatus,
      disabledReason: brandExists ? null : undefined,
    });

    // Refresh Mock Brand Status
    steps.push({
      id: "mock_refresh_brand",
      mode: "mock",
      title: "Refresh Mock Brand Status",
      status: brandExists ? (brandTerminalFail ? "failed" : brandComplete ? "complete" : "ready") : "locked",
      description: "Read-only refresh of the Mock Brand status from Twilio.",
      actionLabel: brandComplete ? undefined : "Refresh Mock Brand Status",
      disabledReason: brandExists ? null : "No mock Brand exists",
      providerSid: mock.submission.brandRegistrationSid ?? null,
      providerStatus: brandStatus,
    });

    // Create Mock Campaign
    const campaignExists = Boolean(mock.submission.campaignSid);
    const campaignStatus = mock.submission.campaignStatus ?? null;
    const campaignComplete = campaignExists && (campaignStatus === "registered" || campaignStatus === "approved" || campaignStatus === "verified" || campaignStatus === "complete");
    const campaignLocked = !brandExists || brandTerminalFail || !brandComplete;
    steps.push({
      id: "mock_create_campaign",
      mode: "mock",
      title: "Create Mock Campaign",
      status: campaignComplete ? "complete" : campaignExists ? "pending" : campaignLocked ? "locked" : "ready",
      description: campaignComplete ? "Mock Campaign already created under the mock Brand." : "Create the Mock Campaign under the Mock Brand using the configured Mock Messaging Service.",
      actionLabel: campaignComplete ? undefined : "Create Mock Campaign",
      disabledReason: campaignLocked ? "Mock Brand not registered/approved" : null,
      providerSid: mock.submission.campaignSid ?? null,
      providerStatus: campaignStatus,
    });

    // Refresh Mock Campaign
    steps.push({
      id: "mock_refresh_campaign",
      mode: "mock",
      title: "Refresh Mock Campaign Status",
      status: campaignExists ? (campaignComplete ? "complete" : "ready") : "locked",
      description: "Read-only refresh of the Mock Campaign status from Twilio.",
      actionLabel: campaignComplete ? undefined : "Refresh Mock Campaign Status",
      disabledReason: campaignExists ? null : "No mock Campaign exists",
      providerSid: mock.submission.campaignSid ?? null,
      providerStatus: campaignStatus,
    });

    // Final test-complete step
    const testComplete = brandComplete && campaignComplete;
    steps.push({
      id: "mock_test_complete",
      mode: "mock",
      title: "Mock A2P Test Complete",
      status: testComplete ? "complete" : "locked",
      description: testComplete
        ? "Mock A2P test complete. This validates the mock Brand and Campaign flow only. Real patient SMS remains blocked until Live A2P approval and sender coverage are verified."
        : "Mock A2P is complete for testing only. Real patient SMS remains blocked until Live A2P approval.",
    });
  }

  if (selectedMode === "live") {
    // Live flow is shown but typically locked/blocked depending on live state
    const liveBrandExists = Boolean(live.submission.brandRegistrationSid);
    const liveBrandStatus = live.submission.brandStatus ?? null;
    const liveBrandFailed = liveBrandStatus ? liveBrandStatus.toLowerCase().includes("failed") || liveBrandStatus.toLowerCase().includes("rejected") : false;

    steps.push({
      id: "live_submit_brand",
      mode: "live",
      title: "Submit Live Brand",
      status: liveBrandExists ? (liveBrandFailed ? "failed" : liveBrandStatus === "approved" || liveBrandStatus === "verified" ? "complete" : "pending") : "ready",
      description: "Submit a billable live Brand to Twilio for TCR vetting.",
      actionLabel: "Submit Live Brand",
      providerSid: live.submission.brandRegistrationSid ?? null,
      providerStatus: liveBrandStatus,
      disabledReason: liveBrandFailed ? "Existing live Brand failed; do not continue without correcting business identity." : null,
    });

    steps.push({
      id: "live_refresh_brand",
      mode: "live",
      title: "Refresh Live Brand Status",
      status: liveBrandExists ? "ready" : "locked",
      description: "Read-only refresh of the Live Brand status.",
      actionLabel: "Refresh Live Brand Status",
      disabledReason: liveBrandExists ? null : "No live Brand exists",
      providerSid: live.submission.brandRegistrationSid ?? null,
      providerStatus: liveBrandStatus,
    });

    steps.push({
      id: "live_create_campaign",
      mode: "live",
      title: "Create Live A2P Campaign",
      status: live.submission.campaignSid ? "complete" : "locked",
      description: "Create a billable Live Campaign after Brand approval. Requires explicit confirmation.",
      actionLabel: "Create Live Campaign",
      disabledReason: "Live Campaign creation is locked until Brand is approved and explicit confirmation is provided.",
      providerSid: live.submission.campaignSid ?? null,
    });

    steps.push({
      id: "live_refresh_campaign",
      mode: "live",
      title: "Refresh Live Campaign Status",
      status: live.submission.campaignSid ? "ready" : "locked",
      description: "Read-only refresh of the Live Campaign status.",
      actionLabel: "Refresh Live Campaign Status",
      disabledReason: live.submission.campaignSid ? null : "No live Campaign exists",
      providerSid: live.submission.campaignSid ?? null,
    });

    steps.push({
      id: "live_attach_numbers",
      mode: "live",
      title: "Attach Numbers / Enable SMS",
      status: "locked",
      description: "Attach numbers and enable SMS only after live Campaign approval and sender coverage verification.",
      disabledReason: "Requires live Campaign approval and explicit confirmation.",
    });
  }

  if (selectedMode === "dry_run") {
    // Dry run shows the same major steps but all locked/disabled and read-only
    steps.push({ id: "dry_preview", mode: "shared", title: "Dry run preview", status: "ready", description: "Dry run creates no Twilio resources.", actionLabel: "Record dry-run review" });
  }

  return steps;
}

export default buildA2pLifecycleSteps;
