// Pure, client-safe view-model builders for the platform-admin A2P/10DLC
// workflow. This module has NO server imports (no DB/Twilio/env) — it depends
// only on ./types and pure status-classification helpers — so both the client
// admin panel and the test suite can import it.
//
// Design goal: SEPARATE the four meanings that were previously collapsed into a
// single status field, so the UI can never confuse them:
//
//   1. mockTestState        — test-only Brand/Campaign result. NEVER approval.
//   2. liveSubmissionState  — real carrier/TCR Brand + Campaign result.
//   3. realSmsLaunchState   — whether patient SMS can actually go live. Ignores
//                              mock Brand/Campaign entirely.
//   4. (diagnostics)        — raw technical detail, rendered separately.
//
// Critical product rule enforced here: a complete Mock A2P test must NEVER mark
// real SMS as ready. Real readiness is derived only from the LIVE submission
// (live Brand approved + live Campaign verified) plus live sender coverage.

import {
  isBrandApprovedStatus,
  isBrandTerminalFailureStatus,
  isMockBrandCompleteStatus,
} from "../twilio/brand-status-classification";
import type { A2pReviewPackage } from "./types";

export type A2pViewTone = "success" | "warning" | "danger" | "info" | "neutral";

// Launch context the panel already has from the clinic detail. Kept here so the
// builders stay pure and independently testable.
export type A2pLaunchStatus = {
  smsRecoveryEnabled: boolean;
  launchReady: boolean;
  smsStatus: string;
  launchBlockedReason: string | null;
};

const CAMPAIGN_COMPLETE_STATUSES = new Set(["registered", "approved", "verified", "complete"]);

function isCampaignCompleteStatus(value: string | null | undefined): boolean {
  return CAMPAIGN_COMPLETE_STATUSES.has((value ?? "").trim().toLowerCase());
}

function titleCaseStatus(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "Unknown";
  return raw
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Map an internal tone to one of the shared Badge tones (which has no "danger").
export function badgeToneFor(tone: A2pViewTone): "success" | "neutral" | "warning" | "info" | "brand" {
  return tone === "danger" ? "warning" : tone;
}

// ---------------------------------------------------------------------------
// 1. Mock A2P test state (test-only — never real approval)
// ---------------------------------------------------------------------------

export type A2pMockTestView = {
  status: "complete" | "in_progress" | "not_started";
  statusLabel: string;
  tone: A2pViewTone;
  testComplete: boolean;
  // Whether the staged create flow (Create Mock Brand/Campaign) should be shown.
  // Once the test is complete this is false — completed resources are read-only.
  showCreateActions: boolean;
  brand: { present: boolean; complete: boolean; label: string; sid: string | null; rawStatus: string | null };
  campaign: {
    present: boolean;
    complete: boolean;
    label: string;
    sid: string | null;
    sidLabel: string;
    rawStatus: string | null;
  };
  messagingServiceSid: string | null;
};

// The stored campaign SID may be a TCR campaign reference (QE…) rather than the
// Twilio Console Campaign SID (CM…). Label it for exactly what it is — never
// invent a CM value the app does not actually hold.
function campaignSidLabel(sid: string | null): string {
  if (!sid) return "Campaign SID";
  if (sid.startsWith("CM")) return "Twilio Console Campaign SID";
  if (sid.startsWith("QE")) return "Stored provider campaign SID";
  return "Campaign SID";
}

export function buildMockA2pTestView(pkg: A2pReviewPackage): A2pMockTestView {
  const m = pkg.submissions.mock.submission;
  const brandPresent = Boolean(m.brandRegistrationSid);
  const brandComplete = brandPresent && isMockBrandCompleteStatus(m.brandStatus);
  const campaignPresent = Boolean(m.campaignSid);
  const campaignComplete = campaignPresent && isCampaignCompleteStatus(m.campaignStatus);
  const testComplete = brandComplete && campaignComplete;

  const anyResource = brandPresent || campaignPresent;
  const status: A2pMockTestView["status"] = testComplete
    ? "complete"
    : anyResource
      ? "in_progress"
      : "not_started";

  return {
    status,
    statusLabel: status === "complete" ? "Complete" : status === "in_progress" ? "In progress" : "Not started",
    tone: status === "complete" ? "success" : status === "in_progress" ? "info" : "neutral",
    testComplete,
    showCreateActions: !testComplete,
    brand: {
      present: brandPresent,
      complete: brandComplete,
      label: brandComplete ? `Complete · ${titleCaseStatus(m.brandStatus)}` : brandPresent ? "In progress" : "Not created",
      sid: m.brandRegistrationSid,
      rawStatus: m.brandStatus,
    },
    campaign: {
      present: campaignPresent,
      complete: campaignComplete,
      label: campaignComplete
        ? `Complete · ${titleCaseStatus(m.campaignStatus)}`
        : campaignPresent
          ? "In progress"
          : "Not created",
      sid: m.campaignSid,
      sidLabel: campaignSidLabel(m.campaignSid),
      rawStatus: m.campaignStatus,
    },
    messagingServiceSid: m.messagingServiceSid ?? pkg.authorizationState.mockMessagingServiceSid,
  };
}

// ---------------------------------------------------------------------------
// 2. Live A2P approval state (real carrier/TCR)
// ---------------------------------------------------------------------------

export type A2pLiveApprovalView = {
  exists: boolean;
  status: "failed" | "approved" | "pending" | "not_started";
  statusLabel: string;
  tone: A2pViewTone;
  brandApproved: boolean;
  brandFailed: boolean;
  brandSid: string | null;
  failureReason: string | null;
  failureCode: string | null;
  campaignCreated: boolean;
  campaignSid: string | null;
  // Environment / arming context.
  liveSubmissionEnabled: boolean;
  liveSubmitArmed: boolean;
  liveSubmitBlockedReason: string | null;
  feesRiskNotice: string[];
  nextAction: string;
};

// Strip Twilio's "Brand Registration Feedback: " prefix for a cleaner one-line
// failure reason, keeping the substantive message.
function cleanFailureReason(reason: string | null): string | null {
  if (!reason) return null;
  return reason.replace(/^\s*Brand Registration Feedback:\s*/i, "").trim() || reason;
}

export function buildLiveA2pApprovalView(pkg: A2pReviewPackage): A2pLiveApprovalView {
  const live = pkg.submissions.live;
  const s = live.submission;
  const auth = pkg.authorizationState;

  const brandApproved = isBrandApprovedStatus(s.brandStatus);
  const brandFailed = isBrandTerminalFailureStatus(s.brandStatus) || s.status === "blocked";
  const campaignCreated = Boolean(s.campaignSid);

  let status: A2pLiveApprovalView["status"];
  if (!live.exists) status = "not_started";
  else if (brandFailed) status = "failed";
  else if (brandApproved) status = "approved";
  else status = "pending";

  const statusLabel =
    status === "failed" ? "Failed" : status === "approved" ? "Approved" : status === "pending" ? "Pending" : "Not started";
  const tone: A2pViewTone =
    status === "failed" ? "danger" : status === "approved" ? "success" : status === "pending" ? "info" : "neutral";

  let nextAction: string;
  if (brandFailed) {
    nextAction = "Fix the clinic's legal business identity / EIN, then retry Live A2P. Do not retry with the current invalid identity.";
  } else if (!live.exists) {
    nextAction = "Begin Live A2P only after the business identity (legal name, EIN, address) is verified.";
  } else if (brandApproved && !campaignCreated) {
    nextAction = "Brand approved. Create the live A2P Campaign with the separate explicit confirmation.";
  } else if (status === "pending") {
    nextAction = "Wait for carrier vetting, then refresh live provider status.";
  } else {
    nextAction = "Confirm live sender coverage before enabling patient SMS.";
  }

  return {
    exists: live.exists,
    status,
    statusLabel,
    tone,
    brandApproved,
    brandFailed,
    brandSid: s.brandRegistrationSid,
    failureReason: cleanFailureReason(s.brandFailureReason ?? s.rejectionReason),
    failureCode: s.brandFailureCode,
    campaignCreated,
    campaignSid: s.campaignSid,
    liveSubmissionEnabled: auth.submissionMode === "live",
    liveSubmitArmed: auth.liveSubmitArmed,
    liveSubmitBlockedReason: auth.liveSubmitBlockedReason,
    feesRiskNotice: auth.feesRiskNotice,
    nextAction,
  };
}

// ---------------------------------------------------------------------------
// 3. Real SMS launch readiness (ignores mock Brand/Campaign)
// ---------------------------------------------------------------------------

export type A2pLaunchNumberView = {
  phoneNumber: string;
  covered: boolean;
  statusLabel: string;
};

export type A2pSmsLaunchView = {
  status: "active" | "ready" | "blocked";
  statusLabel: string;
  tone: A2pViewTone;
  ready: boolean;
  smsRecoveryEnabled: boolean;
  liveA2pApproved: boolean;
  liveCampaignVerified: boolean;
  senderCoverageComplete: boolean;
  numbers: A2pLaunchNumberView[];
  // True when the readiness sync wrote mock/test identifiers into the live
  // readiness record (e.g. mock Brand SID appears as "approved" while the live
  // Brand is not approved). Surface a safe note; never treat it as real approval.
  readinessIncludesMockIdentifiers: boolean;
  blockingSummary: string;
};

const NUMBER_COVERAGE_LABEL: Record<string, string> = {
  covered: "Covered",
  not_in_messaging_service: "Not in live Messaging Service",
  not_campaign_covered: "Not covered by live A2P campaign",
  readiness_missing: "Coverage not synced",
  readiness_unavailable: "Readiness unavailable",
  stale: "Readiness stale",
  error: "Sync error",
  blocked: "Not covered",
  unknown: "Unknown",
};

export function buildSmsLaunchReadinessView(
  pkg: A2pReviewPackage,
  launchStatus: A2pLaunchStatus,
): A2pSmsLaunchView {
  const live = pkg.submissions.live.submission;
  const liveA2pApproved = isBrandApprovedStatus(live.brandStatus);
  const liveCampaignVerified =
    Boolean(live.campaignSid) && isCampaignCompleteStatus(live.campaignStatus);

  const numbers: A2pLaunchNumberView[] = pkg.numbers.map((n) => ({
    phoneNumber: n.phoneNumber,
    covered: n.eligibleForLiveSms,
    statusLabel: NUMBER_COVERAGE_LABEL[n.coverageDisplay] ?? "Unknown",
  }));
  const senderCoverageComplete = numbers.length > 0 && numbers.every((n) => n.covered);

  // Detect mock contamination of the live readiness record: readiness reports an
  // approved/covered Brand while the LIVE submission is not actually approved and
  // a complete mock Brand exists. (The clinic readiness summary only carries
  // statuses, not the Brand SID, so this is the safe client-side heuristic.)
  const readiness = pkg.clinicReadiness;
  const readinessBrand = (readiness?.brandStatus ?? "").trim().toLowerCase();
  const readinessShowsApprovedBrand =
    readinessBrand === "approved" || readinessBrand === "verified" || readinessBrand === "covered";
  const mockBrandComplete = isMockBrandCompleteStatus(pkg.submissions.mock.submission.brandStatus);
  const readinessIncludesMockIdentifiers =
    readinessShowsApprovedBrand && !liveA2pApproved && mockBrandComplete;

  const ready = liveA2pApproved && liveCampaignVerified && senderCoverageComplete;
  const status: A2pSmsLaunchView["status"] = launchStatus.smsRecoveryEnabled
    ? "active"
    : ready
      ? "ready"
      : "blocked";
  const statusLabel = status === "active" ? "Active" : status === "ready" ? "Ready after enable" : "Blocked";
  const tone: A2pViewTone = status === "active" ? "success" : status === "ready" ? "info" : "danger";

  let blockingSummary: string;
  if (status === "active") {
    blockingSummary = "Patient SMS is enabled for this clinic.";
  } else if (status === "ready") {
    blockingSummary = "Live A2P approval and sender coverage are verified. Enabling patient SMS remains a separate step.";
  } else if (!liveA2pApproved) {
    blockingSummary = "Live A2P approval is missing or failed.";
  } else if (!liveCampaignVerified) {
    blockingSummary = "Live A2P campaign is not verified.";
  } else {
    blockingSummary = "Live sender coverage is missing for one or more numbers.";
  }

  return {
    status,
    statusLabel,
    tone,
    ready,
    smsRecoveryEnabled: launchStatus.smsRecoveryEnabled,
    liveA2pApproved,
    liveCampaignVerified,
    senderCoverageComplete,
    numbers,
    readinessIncludesMockIdentifiers,
    blockingSummary,
  };
}

// ---------------------------------------------------------------------------
// Overview (composes the three states into short, above-the-fold cards)
// ---------------------------------------------------------------------------

export type A2pOverviewCardId = "mock" | "live" | "realSms" | "nextAction";

export type A2pOverviewCard = {
  id: A2pOverviewCardId;
  title: string;
  status: string;
  tone: A2pViewTone;
  body: string;
};

export type A2pAdminOverview = {
  cards: A2pOverviewCard[];
  liveSubmissionDisabledNote: string | null;
};

export function buildA2pAdminOverview(
  pkg: A2pReviewPackage,
  launchStatus: A2pLaunchStatus,
): A2pAdminOverview {
  const mock = buildMockA2pTestView(pkg);
  const live = buildLiveA2pApprovalView(pkg);
  const sms = buildSmsLaunchReadinessView(pkg, launchStatus);

  const mockBody =
    mock.status === "complete"
      ? "Mock Brand and Mock Campaign were created successfully. This validates the test flow only — it does not enable real SMS."
      : mock.status === "in_progress"
        ? "A mock Brand/Campaign test is in progress. Mock results never enable real SMS."
        : "No mock A2P test has been run yet. Mock is test-only.";

  const liveBody = live.brandFailed
    ? `Existing live Brand failed: ${live.failureReason ?? "the submitted business identity is invalid."}`
    : live.status === "approved"
      ? "Live Brand is approved by the carrier/TCR."
      : live.status === "pending"
        ? "Live Brand is in carrier vetting."
        : "No live A2P submission exists yet.";

  const smsBody =
    sms.status === "active"
      ? "Patient SMS is enabled for this clinic."
      : sms.status === "ready"
        ? "Live A2P approval and sender coverage are verified. Enabling SMS is a separate step."
        : "Patient SMS cannot go live until Live A2P approval and sender coverage are verified.";

  // Next real action mirrors the live-approval next action, but stays product-level.
  let nextActionBody: string;
  if (live.brandFailed) {
    nextActionBody = "Fix the legal business identity / EIN before attempting Live A2P again.";
  } else if (sms.status === "active") {
    nextActionBody = "Monitor delivery. No further A2P action is required.";
  } else if (live.status === "approved" && !live.campaignCreated) {
    nextActionBody = "Create the live A2P campaign, then verify sender coverage.";
  } else if (sms.ready) {
    nextActionBody = "Enable patient SMS from the clinic controls when ready.";
  } else if (!live.exists) {
    nextActionBody = "Verify the business identity, then begin Live A2P approval.";
  } else {
    nextActionBody = "Complete Live A2P approval and verify sender coverage.";
  }

  const liveSubmissionDisabledNote = live.liveSubmissionEnabled
    ? null
    : "Live A2P submission is disabled in this environment.";

  return {
    cards: [
      { id: "mock", title: "Mock A2P test", status: mock.statusLabel, tone: mock.tone, body: mockBody },
      { id: "live", title: "Live A2P approval", status: live.statusLabel, tone: live.tone, body: liveBody },
      { id: "realSms", title: "Real SMS launch", status: sms.statusLabel, tone: sms.tone, body: smsBody },
      { id: "nextAction", title: "Next real action", status: "Action", tone: "info", body: nextActionBody },
    ],
    liveSubmissionDisabledNote,
  };
}

// ---------------------------------------------------------------------------
// 5. Advanced diagnostics view (summary of raw technical detail)
// ---------------------------------------------------------------------------

export type A2pAdvancedDiagnosticsView = {
  providerStatusChain: string;
  technicalResourceCount: number;
  plannedResourceCount: number;
  perNumberCount: number;
  warningCount: number;
  hasLiveHistory: boolean;
  hasMockHistory: boolean;
};

export function buildAdvancedDiagnosticsView(pkg: A2pReviewPackage): A2pAdvancedDiagnosticsView {
  const live = pkg.submissions.live.submission;
  const chain = [live.customerProfileStatus, live.trustProductStatus, live.brandStatus, live.campaignStatus]
    .filter(Boolean)
    .map((s) => titleCaseStatus(s))
    .join(" · ");
  return {
    providerStatusChain: chain || "No provider result yet.",
    technicalResourceCount: pkg.providerPayload.resources.length,
    plannedResourceCount: pkg.internalDiagnostics.plannedResources.length,
    perNumberCount: pkg.internalDiagnostics.numberDiagnostics.length,
    warningCount: pkg.internalDiagnostics.warnings.length,
    hasLiveHistory: pkg.submissions.live.exists,
    hasMockHistory: pkg.submissions.mock.exists,
  };
}
