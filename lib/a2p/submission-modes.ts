import type {
  A2pModeOption,
  A2pStoredSubmissionMode,
  A2pSubmissionInfo,
  A2pSubmissionMode,
} from "./types";

type SubmissionLike = Pick<
  A2pSubmissionInfo,
  "status" | "brandStatus" | "campaignSid" | "brandFailureReason"
>;

export function isTerminalBrandFailure(
  submission: SubmissionLike | null | undefined,
): boolean {
  const status = (submission?.brandStatus ?? "").trim().toUpperCase();
  return (
    status === "FAILED" ||
    status === "REJECTED" ||
    status === "DECLINED" ||
    status === "SUSPENDED" ||
    status === "UNVERIFIED" ||
    submission?.status === "blocked"
  );
}

export function isLiveCampaignCreationPending(
  submission: SubmissionLike | null | undefined,
): boolean {
  const brandStatus = (submission?.brandStatus ?? "").trim().toUpperCase();
  return (brandStatus === "APPROVED" || brandStatus === "VERIFIED") && !submission?.campaignSid;
}

export function chooseDefaultA2pMode(input: {
  environmentMode: A2pSubmissionMode;
  mockConfigured: boolean;
  liveFailed: boolean;
}): A2pSubmissionMode {
  if (input.environmentMode === "disabled") return "disabled";
  if (input.mockConfigured && input.liveFailed) return "mock";
  if (input.environmentMode === "mock" && input.mockConfigured) return "mock";
  if (input.environmentMode === "live") return "live";
  return "dry_run";
}

export function buildA2pModeOptions(input: {
  environmentMode: A2pSubmissionMode;
  defaultMode: A2pSubmissionMode;
  trackingReady: boolean;
  mockConfigured: boolean;
  liveSubmitArmed: boolean;
  liveBlockedReason: string | null;
}): A2pModeOption[] {
  const disabledAll = input.environmentMode === "disabled";
  const trackingDisabledReason =
    "Apply migration 20260611000100_a2p_submission_modes.sql before using the A2P submission workflow.";
  return [
    {
      mode: "dry_run",
      label: "Dry run",
      helper: "No Twilio resources are created.",
      available: !disabledAll && input.trackingReady,
      disabledReason: disabledAll
        ? "A2P submission is disabled in this environment."
        : !input.trackingReady
          ? trackingDisabledReason
          : null,
      recommended: input.defaultMode === "dry_run",
    },
    {
      mode: "mock",
      label: "Mock A2P",
      helper: "Creates mock Brand/Campaign for testing. No real carrier vetting. No real SMS traffic.",
      available: !disabledAll && input.trackingReady && input.mockConfigured,
      disabledReason: disabledAll
        ? "A2P submission is disabled in this environment."
        : !input.trackingReady
          ? trackingDisabledReason
        : "Mock A2P requires a separate empty Messaging Service configured for testing.",
      recommended: input.defaultMode === "mock",
    },
    {
      mode: "live",
      label: "Live A2P",
      helper: "Creates billable external Twilio/TCR resources.",
      available: !disabledAll && input.trackingReady && input.liveSubmitArmed,
      disabledReason: disabledAll
        ? "A2P submission is disabled in this environment."
        : !input.trackingReady
          ? trackingDisabledReason
        : input.liveBlockedReason ?? "Real A2P submission is not armed for this clinic.",
      recommended: input.defaultMode === "live",
    },
  ];
}

export function nextActionForSubmission(
  submission: SubmissionLike | null | undefined,
  mode: A2pStoredSubmissionMode,
): string | null {
  if (!submission?.status) {
    return mode === "mock"
      ? "Mock A2P has not started yet."
      : mode === "live"
        ? "Do not continue the failed live attempt for fake-company testing. Use Mock A2P or fix the real business identity."
        : "No dry-run review recorded yet.";
  }
  if (mode === "live" && isTerminalBrandFailure(submission)) {
    return submission.brandFailureReason
      ? `Previous live submission blocked or failed: ${submission.brandFailureReason} Correct the business identity/EIN, then retry.`
      : "Previous live submission was blocked or failed. Correct the business identity/EIN, then retry.";
  }
  if (mode === "live" && isLiveCampaignCreationPending(submission)) {
    return "Brand approved. Create the live A2P Campaign only with the separate explicit confirmation.";
  }
  switch (submission.status) {
    case "approved":
      return mode === "mock"
        ? "Mock Campaign created. This does not authorize real SMS traffic."
        : "Live approval exists. Confirm sender coverage before enabling SMS.";
    case "pending":
    case "submitted":
      return "Refresh provider status later to continue tracking this attempt.";
    case "failed":
      return "Review the provider error and retry only after the blocking issue is corrected.";
    case "blocked":
      return "Fix the blocking issue before retrying this attempt.";
    default:
      return null;
  }
}
