"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, humanizeToken } from "../../../_components/AdminUI";
import {
  hasValidationErrors,
  type A2pValidationResult,
  validateA2pPreflight,
} from "../../../../../../lib/a2p/validation";
import type {
  A2pIncludedSender,
  A2pStoredSubmissionMode,
  A2pTrackedSubmission,
  A2pPayloadField,
  A2pPayloadResource,
  A2pReviewNumber,
  A2pReviewPackage,
  NumberCoverageDisplay,
} from "../../../../../../lib/a2p/types";
import { A2pLifecycle } from "./A2pLifecycle";
import { isLiveCampaignCreationPending } from "../../../../../../lib/a2p/submission-modes";

type Tone = "success" | "neutral" | "warning" | "info" | "brand";
type ChecklistTone = "present" | "missing" | "warning";

type LaunchStatus = {
  smsRecoveryEnabled: boolean;
  launchReady: boolean;
  smsStatus: string;
  launchBlockedReason: string | null;
};

type ProviderReviewSections = {
  businessIdentity: A2pPayloadField[];
  representative: A2pPayloadField[];
  address: A2pPayloadField[];
  campaign: A2pPayloadField[];
  messageSamples: string[];
  technicalResources: A2pPayloadResource[];
};

type SubmissionHistorySummary = {
  hasSubmission: boolean;
  approvalStageLabel: string;
  providerStatusLabel: string;
  items: Array<{ label: string; value: React.ReactNode }>;
};

type ChecklistItem = {
  id: string;
  label: string;
  tone: ChecklistTone;
  summary: string;
  href?: string;
};

const REVIEW_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready_for_review: "Not submitted yet",
  missing_info: "Missing information",
  submit_disabled: "Submission disabled",
  readiness_unavailable: "Readiness unavailable",
  dry_run_reviewed: "Reviewed (dry run)",
  ready_for_manual_submission: "Ready for manual submission",
  submitted: "Submitted",
  pending: "Pending carrier review",
  approved: "Approved",
  rejected: "Rejected",
  failed: "Failed",
  blocked: "Blocked",
  not_found: "Clinic not found",
};

const COVERAGE_LABEL: Record<NumberCoverageDisplay, string> = {
  covered: "Covered",
  not_in_messaging_service: "Not in Messaging Service",
  not_campaign_covered: "Campaign coverage missing",
  readiness_missing: "Readiness not synced",
  readiness_unavailable: "Readiness unavailable",
  stale: "Readiness stale",
  error: "Sync error",
  blocked: "Blocked",
  unknown: "Unknown",
};

const MODE_SHORT_LABEL: Record<string, string> = {
  disabled: "Disabled",
  dry_run: "Dry run",
  mock: "Mock A2P",
  live: "Live mode",
};

const MODE_CARD_LABEL: Record<string, string> = {
  disabled: "Disabled",
  dry_run: "Dry run",
  mock: "Mock A2P",
  live: "Live",
};

const TECHNICAL_RESOURCE_STEPS = new Set([
  "A2P messaging profile (EndUser)",
  "Secondary Customer Profile",
  "A2P Trust Product",
  "Brand Registration",
  "Messaging Service senders",
]);

const HUMAN_PROVIDER_LABELS = {
  business: new Set([
    "Business name",
    "Business Type",
    "Industry",
    "Registration number (EIN)",
    "Regions of operation",
    "Business identity",
    "Website",
  ]),
  representative: new Set([
    "First name",
    "Last name",
    "Email",
    "Phone",
    "Business title",
  ]),
  address: new Set(["Customer name", "Street", "Street 2", "City", "Region", "Postal code", "Country"]),
  campaign: new Set([
    "Use case",
    "Embedded links",
    "Embedded phone",
    "Description",
    "Opt-in / message flow",
  ]),
};

function authDefaultMode(mode: string): A2pStoredSubmissionMode {
  return mode === "live" || mode === "mock" ? mode : "dry_run";
}

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function findResource(pkg: A2pReviewPackage, step: string): A2pPayloadResource | null {
  return pkg.providerPayload.resources.find((resource) => resource.step === step) ?? null;
}

function pickFields(resource: A2pPayloadResource | null, allowed: Set<string>): A2pPayloadField[] {
  return (resource?.fields ?? []).filter((field) => allowed.has(field.label));
}

function fieldMap(fields: A2pPayloadField[]): Map<string, string> {
  return new Map(fields.map((field) => [field.label, field.value]));
}

function providerSectionsFromPackage(pkg: A2pReviewPackage): ProviderReviewSections {
  const businessResource = findResource(pkg, "Business information (EndUser)");
  const repResource = findResource(pkg, "Authorized representative (EndUser)");
  const addressResource = findResource(pkg, "Business address");
  const campaignResource = findResource(pkg, "A2P Campaign");
  const a2pProfileResource = findResource(pkg, "A2P messaging profile (EndUser)");

  const businessFields = pickFields(businessResource, HUMAN_PROVIDER_LABELS.business);
  const companyType = (a2pProfileResource?.fields ?? []).find((field) => field.label === "Company type");
  if (companyType) businessFields.push(companyType);

  const campaignFields = pickFields(campaignResource, HUMAN_PROVIDER_LABELS.campaign);
  const messageSamples = (campaignResource?.fields ?? [])
    .filter((field) => field.label.startsWith("Sample message "))
    .map((field) => field.value);

  const technicalResources = pkg.providerPayload.resources.filter((resource) =>
    TECHNICAL_RESOURCE_STEPS.has(resource.step),
  );

  return {
    businessIdentity: businessFields,
    representative: pickFields(repResource, HUMAN_PROVIDER_LABELS.representative),
    address: pickFields(addressResource, HUMAN_PROVIDER_LABELS.address),
    campaign: campaignFields,
    messageSamples,
    technicalResources,
  };
}

function firstValidationForField(
  validations: A2pValidationResult[],
  fields: string[],
): A2pValidationResult | null {
  return validations.find((validation) => fields.includes(validation.field)) ?? null;
}

function deriveLaunchReadiness(pkg: A2pReviewPackage, launchStatus: LaunchStatus, selectedMode?: A2pStoredSubmissionMode): {
  label: string;
  tone: Tone;
  detail: string;
  headerBadge: string;
} {
  const submissionStatus = pkg.internalDiagnostics.submission.status;
  const clinicReadiness = pkg.internalDiagnostics.clinicReadiness;
  const allNumbersReady =
    pkg.internalDiagnostics.numberDiagnostics.length > 0 &&
    pkg.internalDiagnostics.numberDiagnostics.every((number) => number.eligibleForLiveSms);

  // Mock mode always blocks real SMS regardless of submission status
  if (selectedMode === "mock") {
    return {
      label: "Real SMS blocked",
      tone: "warning",
      detail: "Mock A2P does not unlock patient SMS. Live A2P approval and sender coverage are required.",
      headerBadge: "Real SMS blocked",
    };
  }

  if (launchStatus.smsRecoveryEnabled) {
    return {
      label: "Active",
      tone: "success",
      detail: "Patient SMS is already enabled for this clinic.",
      headerBadge: "Active",
    };
  }

  if (submissionStatus === "approved" && allNumbersReady) {
    return {
      label: "Ready after approval",
      tone: "success",
      detail: "Approval and sender coverage are in place. Patient SMS still remains a separate enable step.",
      headerBadge: "Ready after approval",
    };
  }

  if (submissionStatus === "approved" && launchStatus.launchBlockedReason) {
    return {
      label: "Launch blocked",
      tone: "warning",
      detail: launchStatus.launchBlockedReason,
      headerBadge: "Launch blocked",
    };
  }

  const expectedBrandNotVerified =
    !launchStatus.smsRecoveryEnabled &&
    submissionStatus !== "approved" &&
    clinicReadiness?.brandStatus &&
    clinicReadiness.brandStatus !== "approved" &&
    clinicReadiness.brandStatus !== "covered";

  return {
    label: "Blocked until approval",
    tone: "warning",
    detail: expectedBrandNotVerified
      ? "Expected before approval: A2P brand not verified yet. This does not block A2P submission."
      : "Patient SMS cannot go live until A2P approval and sender coverage are verified.",
    headerBadge: "Launch blocked until approval",
  };
}

function buildChecklist(pkg: A2pReviewPackage, validations: A2pValidationResult[]): ChecklistItem[] {
  const hasWebsite = Boolean(pkg.business.website);
  const businessValidation = firstValidationForField(validations, [
    "legal_business_name",
    "business_registration_number",
    "business_type",
    "business_industry",
    "business_identity",
    "business_regions_of_operation",
    "website",
  ]);
  const repValidation = firstValidationForField(validations, [
    "rep_first_name",
    "rep_last_name",
    "rep_business_title",
    "rep_email",
    "rep_phone",
    "job_position",
    "authorized",
  ]);
  const addressValidation = firstValidationForField(validations, [
    "street_address",
    "city",
    "state_region",
    "postal_code",
    "country",
  ]);
  const campaignValidation = firstValidationForField(validations, [
    "campaign_description",
    "message_flow",
    "sample_messages",
  ]);
  const businessPresent =
    Boolean(pkg.business.legalBusinessName) &&
    pkg.business.einProvided &&
    Boolean(pkg.business.businessTypeLabel ?? pkg.business.businessType) &&
    hasWebsite;
  const representativePresent =
    Boolean(pkg.representative.firstName) &&
    Boolean(pkg.representative.lastName) &&
    Boolean(pkg.representative.phone) &&
    Boolean(pkg.representative.email);
  const addressPresent = !pkg.missingFields.some((field) => field.key === "business_address");
  const stopPresent = pkg.campaign.sampleMessages.some((message) => message.includes("STOP"));
  const helpPresent = pkg.campaign.sampleMessages.some((message) => message.includes("HELP"));
  const localSendersCount = pkg.includedSenders.numbers.length;

  return [
    {
      id: "business-identity",
      label: "Business identity",
      tone: businessValidation ? "warning" : businessPresent ? "present" : "missing",
      summary: [
        pkg.business.legalBusinessName ?? "Missing legal name",
        pkg.business.einProvided
          ? pkg.business.einFormatValid
            ? "EIN provided"
            : "EIN format invalid"
          : "EIN missing",
        hasWebsite ? "Website present" : "Website missing",
        businessValidation?.operatorMessage ?? businessValidation?.message,
      ].filter(Boolean).join(" · "),
      href: "#a2p-approval-content",
    },
    {
      id: "authorized-representative",
      label: "Authorized representative",
      tone: repValidation ? "warning" : representativePresent ? "present" : "missing",
      summary: [
        [pkg.representative.firstName, pkg.representative.lastName].filter(Boolean).join(" ") || "Representative missing",
        pkg.representative.title ?? "Title missing",
        representativePresent ? "phone/email present" : "phone/email incomplete",
        repValidation?.message,
      ].filter(Boolean).join(" · "),
      href: "#a2p-approval-content",
    },
    {
      id: "business-address",
      label: "Business address",
      tone: addressValidation ? "warning" : addressPresent ? "present" : "missing",
      summary: [pkg.business.addressLine ?? "Business address missing", addressValidation?.message].filter(Boolean).join(" · "),
      href: "#a2p-approval-content",
    },
    {
      id: "campaign-content",
      label: "Campaign content",
      tone: campaignValidation ? "warning" : "present",
      summary: campaignValidation?.message ?? "Clinic-first wording · appointment follow-up only · no marketing",
      href: "#a2p-campaign-content",
    },
    {
      id: "opt-out-language",
      label: "Opt-out language",
      tone: stopPresent && helpPresent ? "present" : "warning",
      summary: stopPresent && helpPresent ? "STOP and HELP included" : "Review STOP / HELP wording",
      href: "#a2p-campaign-content",
    },
    {
      id: "local-senders",
      label: "Local senders",
      tone: localSendersCount > 0 ? "present" : "missing",
      summary:
        localSendersCount > 0
          ? `${localSendersCount} local ${localSendersCount === 1 ? "number" : "numbers"} included · toll-free excluded`
          : "No local numbers included",
      href: "#a2p-local-senders",
    },
  ];
}

function diagnosticsSummary(pkg: A2pReviewPackage): string {
  if (!pkg.readinessAvailable) return "Readiness data unavailable — run readiness sync";
  const diags = pkg.internalDiagnostics.numberDiagnostics;
  const problems = diags.filter((number) => number.coverageDisplay !== "covered");
  if (problems.length === 0) {
    return diags.length > 0 ? "All numbers covered · no blocking diagnostics" : "No blocking diagnostics";
  }
  // Lead with the count and the dominant issue (e.g. "2 coverage warnings ·
  // not in Messaging Service") so the collapsed card already explains itself.
  const count = problems.length;
  const issue = COVERAGE_LABEL[problems[0]!.coverageDisplay];
  return `${count} coverage ${count === 1 ? "warning" : "warnings"} · ${issue.toLowerCase()}`;
}

type CoverageBlockerGroup = {
  coverage: NumberCoverageDisplay;
  label: string;
  numbers: string[];
  nextAction: string;
};

// Group per-number coverage problems by their coverageDisplay so the management
// summary shows ONE blocker per issue type (e.g. "2 local numbers are not in
// Messaging Service") instead of repeating the same meaning/action per number.
function groupCoverageBlockers(numbers: A2pReviewNumber[]): CoverageBlockerGroup[] {
  const byCoverage = new Map<NumberCoverageDisplay, string[]>();
  for (const n of numbers) {
    if (n.coverageDisplay === "covered") continue;
    const list = byCoverage.get(n.coverageDisplay) ?? [];
    list.push(n.phoneNumber);
    byCoverage.set(n.coverageDisplay, list);
  }
  // Most actionable / most severe first.
  const order: NumberCoverageDisplay[] = [
    "blocked",
    "not_in_messaging_service",
    "not_campaign_covered",
    "error",
    "readiness_unavailable",
    "readiness_missing",
    "stale",
    "unknown",
  ];
  const groups: CoverageBlockerGroup[] = [];
  for (const coverage of order) {
    const nums = byCoverage.get(coverage);
    if (!nums || nums.length === 0) continue;
    groups.push({ coverage, label: COVERAGE_LABEL[coverage], numbers: nums, nextAction: coverageNextAction(coverage) });
  }
  return groups;
}

type ControlSummary = {
  statusLabel: string;
  statusTone: Tone;
  mainBlocker: string | null;
  nextAction: string | null;
  blockerGroups: CoverageBlockerGroup[];
};

// The single source of "where are we / what's blocking / what's next" for the
// Control summary. Current saved state only — historical provider errors are NOT
// used as the main blocker (they live in Previous submission history, possibly
// stale). Coverage problems are grouped into one blocker per issue type.
function buildControlSummary(args: {
  pkg: A2pReviewPackage;
  numberDiagnostics: A2pReviewNumber[];
  canSubmitNow: boolean;
  submitBlocker: string | null;
  hasPreflightErrors: boolean;
  primaryPreflightError: A2pValidationResult | null;
  isApproved: boolean;
  submissionStatus: string | null;
}): ControlSummary {
  const { pkg, numberDiagnostics, canSubmitNow, submitBlocker, hasPreflightErrors, primaryPreflightError, isApproved, submissionStatus } = args;
  const blockerGroups = groupCoverageBlockers(numberDiagnostics);

  let statusLabel = "Blocked";
  let statusTone: Tone = "warning";
  if (submissionStatus === "approved") {
    statusLabel = "Approved";
    statusTone = "success";
  } else if (submissionStatus === "submitted") {
    statusLabel = "Submitted";
    statusTone = "info";
  } else if (submissionStatus === "pending") {
    statusLabel = "Waiting";
    statusTone = "info";
  } else if (submissionStatus === "rejected") {
    statusLabel = "Blocked";
    statusTone = "warning";
  } else if (canSubmitNow) {
    statusLabel = "Ready";
    statusTone = "success";
  }

  let mainBlocker: string | null = null;
  let nextAction: string | null = null;

  if (!pkg.readinessAvailable) {
    mainBlocker = "Readiness data is unavailable, so SMS launch status can't be confirmed.";
    nextAction = "Run readiness sync and review provider status.";
  } else if (hasPreflightErrors) {
    mainBlocker = primaryPreflightError?.operatorMessage ?? primaryPreflightError?.message ?? "Approval information is incomplete.";
    nextAction = "Complete the highlighted approval fields, then retry the workflow.";
  } else if (!canSubmitNow && !isApproved && submitBlocker) {
    mainBlocker = submitBlocker;
    nextAction = "Resolve the blocker above, then submit or resume the workflow.";
  } else if (blockerGroups.length > 0) {
    const g = blockerGroups[0]!;
    mainBlocker = `${g.numbers.length} local ${g.numbers.length === 1 ? "number is" : "numbers are"} ${g.label.toLowerCase()}.`;
    nextAction = g.nextAction;
  } else if (submissionStatus === "approved") {
    nextAction = "Approval complete. Confirm sender coverage, then enable patient SMS separately.";
  } else if (submissionStatus === "submitted" || submissionStatus === "pending") {
    nextAction = "Wait for provider review, then refresh provider status.";
  } else if (canSubmitNow) {
    nextAction = "Review the approval package, choose a submission mode, and submit.";
  }

  return { statusLabel, statusTone, mainBlocker, nextAction, blockerGroups };
}

function buildSubmissionHistory(pkg: A2pReviewPackage): SubmissionHistorySummary {
  const sub = pkg.submissions.live.submission;
  const status = sub.status ?? pkg.authorizationState.reviewStatus;
  const hasLiveSubmission = pkg.submissions.live.exists;
  const approvalStageLabel = REVIEW_STATUS_LABEL[status] ?? humanizeToken(status);
  const providerStatuses = [
    sub.customerProfileStatus,
    sub.trustProductStatus,
    sub.brandStatus,
    sub.campaignStatus,
  ].filter(Boolean);
  const providerStatusLabel = providerStatuses.length > 0 ? providerStatuses.map(humanizeToken).join(" · ") : "No provider result yet.";

  const items: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Last submitted", value: fmtDateTime(sub.submittedAt) },
    { label: "Last updated", value: fmtDateTime(sub.lastStatusSyncedAt ?? sub.submittedAt) },
    { label: "Current step", value: sub.submissionStep ? humanizeToken(sub.submissionStep) : "—" },
    { label: "Provider status", value: providerStatusLabel },
  ];

  if (sub.lastErrorCode || sub.lastErrorMessage) {
    items.push({
      label: "Provider errors",
      value: [sub.lastErrorCode, sub.lastErrorMessage].filter(Boolean).join(" · "),
    });
  }
  if (sub.rejectionReason) {
    items.push({ label: "Rejection reason", value: sub.rejectionReason });
  }
  // Surface Brand failure reason prominently when brand registration failed.
  if ((sub.brandStatus ?? "").toUpperCase() === "FAILED" && sub.brandFailureReason) {
    items.unshift(
      { label: "Brand failure reason", value: sub.brandFailureReason },
    );
    if (sub.brandFailureCode) {
      items.splice(1, 0, { label: "Twilio Error Code", value: sub.brandFailureCode });
    }
  }
  items.push({
    label: "Next action",
    value: nextActionFromSubmissionStatus(sub.status),
  });

  return {
    hasSubmission: hasLiveSubmission,
    approvalStageLabel,
    providerStatusLabel,
    items,
  };
}

function buildTrackedSubmissionHistory(
  tracked: A2pTrackedSubmission,
): SubmissionHistorySummary {
  const sub = tracked.submission;
  const status = sub.status ?? "ready_for_review";
  const providerStatuses = [
    sub.customerProfileStatus,
    sub.trustProductStatus,
    sub.brandStatus,
    sub.campaignStatus,
  ].filter(Boolean);
  const providerStatusLabel = providerStatuses.length > 0 ? providerStatuses.map(humanizeToken).join(" · ") : "No provider result yet.";
  const items: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Last submitted", value: fmtDateTime(sub.submittedAt) },
    { label: "Last updated", value: fmtDateTime(sub.lastStatusSyncedAt ?? sub.submittedAt) },
    { label: "Current step", value: sub.submissionStep ? humanizeToken(sub.submissionStep) : "—" },
    { label: "Brand SID", value: sub.brandRegistrationSid ? <span className="t-mono a2p-cc-wrap">{sub.brandRegistrationSid}</span> : "—" },
    { label: "Campaign SID", value: sub.campaignSid ? <span className="t-mono a2p-cc-wrap">{sub.campaignSid}</span> : "—" },
    { label: "Provider status", value: providerStatusLabel },
  ];
  if (tracked.mock) {
    items.push({ label: "Mock", value: "true" });
  }
  if (sub.brandFailureReason) {
    items.push({ label: "Brand failure reason", value: sub.brandFailureReason });
  }
  if (sub.brandFailureCode) {
    items.push({ label: "Twilio Error Code", value: sub.brandFailureCode });
  }
  if (tracked.nextAction) {
    items.push({ label: "Next action", value: tracked.nextAction });
  }
  return {
    hasSubmission: tracked.exists,
    approvalStageLabel: REVIEW_STATUS_LABEL[status] ?? humanizeToken(status),
    providerStatusLabel,
    items,
  };
}

function nextActionFromSubmissionStatus(status: string | null): string {
  switch (status) {
    case "pending":
    case "submitted":
      return "Wait for provider review, then refresh provider status or resume submission if prompted.";
    case "failed":
      return "Review the provider error and technical wiring details, then retry when corrected.";
    case "blocked":
      return "Review the blocking error in Technical details. Correct the business identity/EIN, then retry.";
    case "rejected":
      return "Operator review is required before another submission attempt.";
    case "approved":
      return "Confirm sender coverage, then enable patient SMS separately when appropriate.";
    default:
      return "Review the checklist and decision summary before taking action.";
  }
}

function shouldSurfaceReadinessSync(pkg: A2pReviewPackage): boolean {
  return (
    !pkg.readinessAvailable ||
    pkg.internalDiagnostics.numberDiagnostics.some((number) =>
      ["stale", "readiness_missing", "readiness_unavailable", "error"].includes(number.coverageDisplay),
    ) ||
    pkg.internalDiagnostics.warnings.length > 0
  );
}

export function AdminA2pReviewPanel({
  pkg,
  clinicId,
  launchStatus,
}: {
  pkg: A2pReviewPackage;
  clinicId: string;
  launchStatus: LaunchStatus;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMode, setSelectedMode] = useState<A2pStoredSubmissionMode>(
    authDefaultMode(pkg.authorizationState.defaultMode),
  );
  const [confirmLive, setConfirmLive] = useState(false);
  const [confirmMock, setConfirmMock] = useState(false);
  const [confirmLiveCampaign, setConfirmLiveCampaign] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, fallbackError: string, body?: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            nextAction?: string;
            step?: string;
            providerErrors?: string[];
            lastErrorMessage?: string;
            validationErrors?: Array<{ message?: string }>;
            error?: { message?: string };
          }
        | null;
      if (!res.ok || !json?.ok) {
        const base =
          json?.error?.message
          ?? (json?.providerErrors?.[0] ? `Twilio rejected the submission: ${json.providerErrors[0]}` : null)
          ?? json?.validationErrors?.[0]?.message
          ?? json?.lastErrorMessage
          ?? "A2P submission failed. Check server logs before retrying.";
        const withStep = json?.step ? `${base} Failed at step: ${json.step}.` : base;
        return { ok: false, message: withStep || fallbackError };
      }
      const next = json.nextAction ? ` ${json.nextAction}` : "";
      return { ok: true, message: (json.message ?? "Done.") + next };
    } catch {
      return { ok: false, message: fallbackError };
    }
  }

  async function runReadinessSync() {
    setSyncing(true);
    setMessage(null);
    setError(null);
    const r = await post(`/api/admin/clinics/${clinicId}/sms-readiness/sync`, "Could not run readiness sync.");
    if (r.ok) {
      setMessage("Read-only readiness sync complete.");
      router.refresh();
    } else {
      setError(r.message);
    }
    setSyncing(false);
  }

  async function refreshProviderStatus(modeOverride?: "mock" | "live") {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    const mode = modeOverride ?? (selectedMode === "mock" ? "mock" : "live");
    const r = await post(
      `/api/admin/clinics/${clinicId}/a2p/status`,
      `Could not refresh ${mode} A2P provider status.`,
      { submissionMode: mode },
    );
    if (r.ok) {
      setMessage(`Read-only ${mode} A2P provider status refreshed.`);
      router.refresh();
    } else {
      setError(r.message);
    }
    setRefreshing(false);
  }

  async function submit() {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    const intent =
      selectedMode === "live" && isLiveCampaignCreationPending(pkg.submissions.live.submission)
        ? "create_live_campaign"
        : "submit";
    const r = await post(
      `/api/admin/clinics/${clinicId}/a2p/submit`,
      "A2P submission failed. Check server logs before retrying.",
      {
        submissionMode: selectedMode,
        intent,
        confirmMockSubmit: confirmMock,
        confirmLiveSubmit: confirmLive,
        confirmLiveCampaign,
      },
    );
    if (r.ok) {
      setMessage(r.message);
      setConfirmLive(false);
      setConfirmMock(false);
      setConfirmLiveCampaign(false);
      router.refresh();
    } else {
      setError(r.message);
    }
    setSubmitting(false);
  }

  const auth = pkg.authorizationState;
  const diagnostics = pkg.internalDiagnostics;
  const sub = diagnostics.submission;
  const liveTracked = pkg.submissions.live;
  const mockTracked = pkg.submissions.mock;
  const preflightValidations = useMemo(
    () => validateA2pPreflight(pkg).filter((result) => result.severity === "error"),
    [pkg],
  );
  const providerSections = useMemo(() => providerSectionsFromPackage(pkg), [pkg]);
  const checklist = useMemo(() => buildChecklist(pkg, preflightValidations), [pkg, preflightValidations]);
  const launchReadiness = useMemo(() => deriveLaunchReadiness(pkg, launchStatus, selectedMode), [pkg, launchStatus, selectedMode]);
  const submissionHistory = useMemo(() => buildSubmissionHistory(pkg), [pkg]);
  const mockHistory = useMemo(() => buildTrackedSubmissionHistory(mockTracked), [mockTracked]);
  const selectedOption = auth.modeOptions.find((option) => option.mode === selectedMode) ?? auth.modeOptions[0];
  const selectedSubmission =
    selectedMode === "live" ? liveTracked.submission
    : selectedMode === "mock" ? mockTracked.submission
    : null;
  const isLive = selectedMode === "live";
  const isMock = selectedMode === "mock";
  const isDryRun = selectedMode === "dry_run";
  const isApproved = selectedSubmission?.status === "approved";
  const isRejected = selectedSubmission?.status === "rejected";
  const isResume =
    selectedSubmission?.status === "pending" ||
    selectedSubmission?.status === "submitted" ||
    selectedSubmission?.status === "failed";
  const isRetry = selectedSubmission?.status === "blocked";
  const isLiveCampaignStep = isLive && isLiveCampaignCreationPending(liveTracked.submission);
  const hasPreflightErrors = hasValidationErrors(preflightValidations);
  const primaryPreflightError = preflightValidations[0] ?? null;
  const canSubmitNow =
    !isApproved &&
    !isRejected &&
    auth.submissionMode !== "disabled" &&
    auth.submitEligible &&
    !hasPreflightErrors &&
    Boolean(selectedOption?.available) &&
    (isDryRun || isMock || (isLive && auth.liveSubmitArmed));

  const submitBlocker = isApproved
    ? "Already approved — no submission needed."
    : isRejected
      ? "Previous submission rejected — operator review required."
      : auth.submissionMode === "disabled"
        ? "A2P submission is disabled in this environment."
      : hasPreflightErrors
          ? primaryPreflightError?.operatorMessage ?? primaryPreflightError?.message ?? "Pre-submit validation failed."
        : !selectedOption?.available
          ? selectedOption?.disabledReason ?? "That submission mode is not available."
        : !auth.submitEligible
          ? auth.submitBlockedReason
          : isLive && !auth.liveSubmitArmed
            ? auth.liveSubmitBlockedReason
            : null;

  // Technical details (merged SIDs + diagnostics) auto-open ONLY for a real
  // failed/blocked/rejected provider error on the latest attempt, or when
  // readiness data is unavailable. Coverage warnings do NOT force it open — they
  // surface as a grouped blocker in the Control summary instead.
  const diagnosticsOpen =
    ((sub.status === "failed" || sub.status === "blocked" || sub.status === "rejected") &&
      Boolean(sub.lastErrorCode || sub.lastErrorMessage || sub.rejectionReason || sub.brandFailureReason)) ||
    !pkg.readinessAvailable;
  const surfaceSync = shouldSurfaceReadinessSync(pkg);
  // Platform readiness state is secondary. Hide it entirely when there is nothing
  // synced and no platform flag is on (an all-"Not synced" block adds no action).
  const showPlatformState =
    Boolean(diagnostics.clinicReadiness) || auth.realSubmissionEnabled || auth.liveSubmitArmed;
  // Previous submission history may hold a provider error that reads as current
  // truth. We can't prove the saved approval data is unchanged since that attempt,
  // so it is shown as history with a "may be stale" caveat — never as the Control
  // summary main blocker.
  const hasHistoricalProviderError = Boolean(sub.brandFailureReason || sub.lastErrorMessage || sub.rejectionReason);
  const control = buildControlSummary({
    pkg,
    numberDiagnostics: diagnostics.numberDiagnostics,
    canSubmitNow,
    submitBlocker,
    hasPreflightErrors,
    primaryPreflightError,
    isApproved,
    submissionStatus: selectedSubmission?.status ?? null,
  });

  return (
    <div className="a2p-cc">
      <header className="a2p-cc-header">
        <div className="a2p-cc-header-main">
          <div className="a2p-cc-title-row">
            <h2 className="t-h3">A2P / 10DLC review</h2>
            <div className="a2p-cc-badges" aria-label="A2P review status badges">
              <Badge tone={canSubmitNow ? "success" : "warning"}>{canSubmitNow ? "Ready to submit" : "Blocked"}</Badge>
              <Badge tone={isLive ? "brand" : auth.submissionMode === "disabled" ? "neutral" : "info"}>
                {MODE_SHORT_LABEL[selectedMode] ?? humanizeToken(selectedMode)}
              </Badge>
              <Badge tone={launchReadiness.tone}>{launchReadiness.headerBadge}</Badge>
            </div>
          </div>
          <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
            Review clinic identity, campaign content, and local senders before creating external Twilio A2P resources.
          </p>
        </div>
        {surfaceSync && (
          <div className="a2p-cc-header-actions">
            <button type="button" className="btn btn-secondary btn-sm" disabled={syncing} onClick={runReadinessSync}>
              {syncing ? "Running…" : "Run SMS readiness sync"}
            </button>
            {(sub.brandRegistrationSid || sub.customerProfileSid) && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing} onClick={() => void refreshProviderStatus()}>
                {refreshing ? "Refreshing…" : "Refresh provider status"}
              </button>
            )}
          </div>
        )}
      </header>

      {(message || error) && (
        <div className={`alert ${error ? "alert-error" : "alert-success"}`} role="status" aria-live="polite">
          <span>{error ?? message}</span>
        </div>
      )}

      <section id="a2p-submit-decision" className={`a2p-cc-card a2p-cc-card--decision ${canSubmitNow ? "is-ready" : "is-blocked"}`}>
        <div className="a2p-cc-card-head">
          <div>
            <p className="a2p-cc-kicker">Control summary</p>
            <h3 className="adm-subhead">A2P management</h3>
            <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
              Current status, blocker, and next action. Submission controls are below.
            </p>
          </div>
        </div>

        <div className="a2p-cc-summary">
          <div className="a2p-cc-summary-row">
            <span className="a2p-cc-summary-label">Status</span>
            <span className="a2p-cc-summary-value"><Badge tone={control.statusTone}>{control.statusLabel}</Badge></span>
          </div>
          <div className="a2p-cc-summary-row">
            <span className="a2p-cc-summary-label">Main blocker</span>
            <span className="a2p-cc-summary-value">{control.mainBlocker ?? "None"}</span>
          </div>
          {control.nextAction && (
            <div className="a2p-cc-summary-row">
              <span className="a2p-cc-summary-label">Next action</span>
              <span className="a2p-cc-summary-value">{control.nextAction}</span>
            </div>
          )}
          <div className="a2p-cc-summary-row">
            <span className="a2p-cc-summary-label">Mode</span>
            <span className="a2p-cc-summary-value">
              <Badge tone={isLive ? "brand" : isMock ? "info" : auth.submissionMode === "disabled" ? "neutral" : "info"}>
                {MODE_CARD_LABEL[selectedMode] ?? humanizeToken(selectedMode)}
              </Badge>
            </span>
          </div>
        </div>

        {control.blockerGroups.length > 0 && (
          <div className="a2p-cc-blocker-list">
            {control.blockerGroups.map((g) => (
              <div key={g.coverage} className="a2p-cc-blocker">
                <p className="a2p-cc-blocker-head">
                  {g.numbers.length} local {g.numbers.length === 1 ? "number is" : "numbers are"} {g.label.toLowerCase()}
                </p>
                <p className="a2p-cc-blocker-nums t-mono">{g.numbers.join("   ·   ")}</p>
                <p className="t-helper" style={{ margin: 0 }}>{g.nextAction}</p>
              </div>
            ))}
          </div>
        )}

        <div className="a2p-cc-summary-actions">
          <button type="button" className="btn btn-secondary btn-sm" disabled={syncing} onClick={runReadinessSync}>
            {syncing ? "Running…" : "Run readiness sync"}
          </button>
          {(sub.brandRegistrationSid || sub.customerProfileSid) && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing} onClick={() => void refreshProviderStatus()}>
              {refreshing ? "Refreshing…" : "Refresh provider status"}
            </button>
          )}
        </div>

        {hasPreflightErrors && (
          <div className="alert alert-error" role="alert">
            <span>{primaryPreflightError?.operatorMessage ?? primaryPreflightError?.message}</span>
          </div>
        )}

          {/* When a mock attempt already exists, show a read-only current-attempt card
              instead of the full mode radio group which suggests the admin must choose. */}
          {isMock && mockTracked.exists && (mockTracked.submission.brandRegistrationSid || mockTracked.submission.campaignSid) ? (
            <div className="a2p-cc-subcard" style={{ border: "1px solid var(--color-info, #2563eb)", borderRadius: "var(--r-md)", padding: "var(--space-3)" }}>
              <h4 className="adm-subhead" style={{ marginBottom: "var(--space-1)" }}>Current A2P test attempt</h4>
              <div className="a2p-cc-facts">
                <FactRow label="Mode" value={<Badge tone="info">Mock A2P</Badge>} />
                <FactRow label="Status" value={mockTracked.submission.brandRegistrationSid && mockTracked.submission.campaignSid ? "Complete" : "In progress"} />
              </div>
              <p className="t-small" style={{ marginTop: "var(--space-2)", color: "var(--text-muted)" }}>
                This clinic already has a Mock A2P attempt. Mock mode is test-only and does not enable real SMS.
              </p>
              {/* Secondary link to switch modes if really needed */}
              {auth.modeOptions.length > 1 && (
                <details style={{ marginTop: "var(--space-2)", cursor: "pointer" }}>
                  <summary className="t-small" style={{ color: "var(--text-muted)" }}>Switch submission mode (advanced)</summary>
                  <div style={{ display: "grid", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
                    {auth.modeOptions.filter((o) => o.mode !== selectedMode).map((option) => (
                      <label
                        key={option.mode}
                        style={{
                          display: "grid",
                          gap: "var(--space-1)",
                          padding: "var(--space-2)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--r-md)",
                          opacity: option.available ? 1 : 0.7,
                          cursor: option.available ? "pointer" : "not-allowed",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <input
                            type="radio"
                            name="a2p-submission-mode-alt"
                            checked={false}
                            onChange={() => {
                              setSelectedMode(option.mode);
                              setConfirmLive(false);
                              setConfirmMock(false);
                              setConfirmLiveCampaign(false);
                            }}
                            disabled={!option.available}
                          />
                          <strong>{option.label}</strong>
                        </span>
                        <span className="t-small">{option.helper}</span>
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div className="a2p-cc-subcard">
              <h4 className="adm-subhead">Choose submission mode</h4>
              <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                {auth.modeOptions.map((option) => (
                  <label
                    key={option.mode}
                    style={{
                      display: "grid",
                      gap: "var(--space-1)",
                      padding: "var(--space-3)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      background: selectedMode === option.mode ? "var(--surface-sunken)" : "var(--surface)",
                      opacity: option.available ? 1 : 0.7,
                      cursor: option.available ? "pointer" : "not-allowed",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <input
                        type="radio"
                        name="a2p-submission-mode"
                        checked={selectedMode === option.mode}
                        onChange={() => {
                          setSelectedMode(option.mode);
                          setConfirmLive(false);
                          setConfirmMock(false);
                          setConfirmLiveCampaign(false);
                        }}
                        disabled={!option.available}
                      />
                      <strong>{option.label}</strong>
                      {option.recommended && <Badge tone="success">Recommended</Badge>}
                    </span>
                    <span className="t-small">{option.helper}</span>
                    {!option.available && option.disabledReason && (
                      <span className="t-helper">{option.disabledReason}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {isLive && (
            <div className="a2p-cc-caution">
              <h4 className="adm-subhead">Live submission creates billable external Twilio resources</h4>
              <ul className="t-small a2p-cc-list">
                {auth.feesRiskNotice.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="a2p-cc-actions">
            {isApproved ? (
              <div className="alert alert-success" role="status">
                <span>
                  {isMock
                    ? "Mock Campaign created. This does not authorize real SMS traffic."
                    : "A2P registration is approved. No further submission is required here."}
                </span>
              </div>
            ) : isRejected ? (
              <div className="adm-blocked" role="note">
              <Badge tone="warning">Rejected</Badge>
              <span className="t-small" style={{ color: "var(--text-muted)" }}>
                {sub.rejectionReason ?? "A previous submission was rejected."} Operator review is required before resubmitting.
              </span>
            </div>
          ) : auth.submissionMode === "disabled" || !auth.submitEligible || hasPreflightErrors ? (
            <DisabledSubmit reason={submitBlocker ?? "Not eligible for submission yet."} />
          ) : isDryRun ? (
            <div className="a2p-cc-action-stack">
              <button type="button" className="btn btn-primary" disabled={submitting} onClick={submit}>
                {submitting ? "Recording…" : "Submit for A2P review (dry run)"}
              </button>
              <p className="t-helper">
                Dry-run mode records operator review only. No Twilio submission, no SMS, and no provider mutation occur.
              </p>
            </div>
          ) : isMock ? (
            <div className="a2p-cc-action-stack">
              <A2pLifecycle pkg={pkg} clinicId={clinicId} selectedMode={"mock"} />
            </div>
          ) : isLive && auth.liveSubmitArmed ? (
            <div className="a2p-cc-action-stack">
              {isLiveCampaignStep ? (
                <>
                  <div className="a2p-cc-auth">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={confirmLiveCampaign}
                        onChange={(event) => setConfirmLiveCampaign(event.target.checked)}
                      />
                      <span>
                        I understand this creates recurring monthly A2P Campaign fees.
                      </span>
                    </label>
                  </div>
                  <button type="button" className="btn btn-primary" disabled={submitting || !confirmLiveCampaign} onClick={submit}>
                    {submitting ? "Submitting…" : "Create live A2P Campaign"}
                  </button>
                </>
              ) : (
                <>
                  <div className="a2p-cc-auth">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={confirmLive}
                        onChange={(event) => setConfirmLive(event.target.checked)}
                      />
                      <span>
                        I have reviewed the approval content below and authorize a <strong>real</strong> A2P submission for this clinic.
                        This creates billable, externally reviewed Twilio resources.
                      </span>
                    </label>
                  </div>
                  <button type="button" className="btn btn-primary" disabled={submitting || !confirmLive} onClick={submit}>
                    {submitting ? "Submitting…" : isResume ? "Resume live A2P submission" : isRetry ? "Retry live A2P submission" : "Submit to Twilio for A2P Review"}
                  </button>
                </>
              )}
              <p className="t-helper">
                {isLiveCampaignStep
                  ? "Separate explicit step for live Campaign creation. This does not attach numbers or enable SMS by itself."
                  : "Runs every currently allowed Twilio step and stops at asynchronous approval points. It never enables patient SMS."}
              </p>
            </div>
          ) : (
            <DisabledSubmit reason={auth.liveSubmitBlockedReason ?? "Real submission is not armed for this clinic."} />
          )}
        </div>
      </section>

      <section id="a2p-approval-content" className="a2p-cc-card a2p-cc-card--provider">
        <div className="a2p-cc-card-head">
          <div>
            <div className="a2p-cc-heading-row">
              <div>
                <p className="a2p-cc-kicker">Provider-facing</p>
                <h3 className="adm-subhead">Approval package</h3>
              </div>
              <Badge tone="info">Provider-facing</Badge>
            </div>
            <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
              Review before Twilio submission. Optional fields are omitted by default.
            </p>
          </div>
        </div>

        {/* Fast-review status as compact chips (replaces the old standalone
            "Human review checklist" card). */}
        <div className="a2p-cc-chip-row" aria-label="Approval package review status">
          {checklist.map((item) => (
            <span key={item.id} className={`a2p-cc-chip is-${item.tone}`}>{item.label}</span>
          ))}
        </div>

        <div className="a2p-cc-section-grid">
          <ContentCard title="Business identity" fields={providerSections.businessIdentity} validations={preflightValidations} />
          <RepresentativeCard fields={providerSections.representative} />
          <AddressCard fields={providerSections.address} />
          <CampaignCard
            fields={providerSections.campaign}
            samples={providerSections.messageSamples}
            clinicName={pkg.clinicName}
          />
        </div>
      </section>

      <section id="a2p-local-senders" className="a2p-cc-card a2p-cc-card--sender">
        <div className="a2p-cc-card-head">
          <div>
            <p className="a2p-cc-kicker">Local senders</p>
            <h3 className="adm-subhead">Local senders included</h3>
            <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
              These local numbers will be attached as A2P campaign senders. Toll-free numbers are excluded.
            </p>
          </div>
        </div>
        {pkg.includedSenders.numbers.length === 0 ? (
          <p className="t-body"><Muted>No active local SMS senders are included for this clinic.</Muted></p>
        ) : (
          <>
          <p className="t-small a2p-cc-sender-count">
            {pkg.includedSenders.numbers.length} local {pkg.includedSenders.numbers.length === 1 ? "number" : "numbers"} included
          </p>
          <div className="a2p-cc-sender-grid">
            {pkg.includedSenders.numbers.map((sender) => (
              <IncludedSenderCard key={sender.twilioPhoneNumberSid ?? sender.phoneNumber} sender={sender} />
            ))}
          </div>
          </>
        )}
      </section>

      <A2pDisclosureCard
        id="a2p-technical-details"
        title="Technical details"
        summary={diagnosticsSummary(pkg)}
        helper="SIDs, raw provider statuses, and per-number diagnostics for platform-admin troubleshooting. Not submitted to Twilio."
        defaultOpen={diagnosticsOpen}
        tone={diagnosticsOpen ? "warning" : "diagnostic"}
      >
        <div className="a2p-cc-subcard">
          <h4 className="adm-subhead">Per-number coverage</h4>
          {diagnostics.numberDiagnostics.length === 0 ? (
            <p className="t-body"><Muted>No local number diagnostics available.</Muted></p>
          ) : (
            <div className="a2p-cc-diagnostic-grid">
              {diagnostics.numberDiagnostics.map((number) => (
                <NumberDiagnosticCard key={number.twilioPhoneNumberSid ?? number.phoneNumber} n={number} />
              ))}
            </div>
          )}
        </div>

        {showPlatformState && (
          <details className="a2p-cc-tech-details a2p-cc-platform-state">
            <summary>Platform readiness state</summary>
            <div className="a2p-cc-facts">
              <FactRow
                stacked
                label="Real submission platform state"
                value={<Badge tone={auth.realSubmissionEnabled ? "info" : "neutral"}>{auth.realSubmissionEnabled ? "Enabled" : "Disabled"}</Badge>}
              />
              <FactRow
                stacked
                label="Live armed state"
                value={<Badge tone={auth.liveSubmitArmed ? "success" : "neutral"}>{auth.liveSubmitArmed ? "Armed" : "Not armed"}</Badge>}
              />
              {diagnostics.clinicReadiness && (
                <>
                  <FactRow stacked label="Messaging Service status" value={humanizeToken(diagnostics.clinicReadiness.messagingServiceStatus)} />
                  <FactRow stacked label="A2P brand status" value={formatBrandStatusForDiagnostics(diagnostics.clinicReadiness.brandStatus, sub.status)} />
                  <FactRow stacked label="A2P campaign status" value={humanizeToken(diagnostics.clinicReadiness.campaignStatus)} />
                  <FactRow stacked label="Last readiness sync" value={fmtDateTime(diagnostics.clinicReadiness.lastSyncedAt)} />
                  <FactRow stacked label="Launch readiness blocker" value={diagnostics.clinicReadiness.blockingReason ? humanizeToken(diagnostics.clinicReadiness.blockingReason) : "None"} />
                </>
              )}
            </div>
          </details>
        )}

        <details className="a2p-cc-tech-details">
          <summary>Twilio resources &amp; creation plan</summary>
          <div className="a2p-cc-section-grid">
            {providerSections.technicalResources.map((resource) => (
              <ResourceCard key={resource.step} title={resource.step} fields={resource.fields} />
            ))}
            <div className="a2p-cc-subcard">
              <h4 className="adm-subhead">Resource creation plan</h4>
              <div className="a2p-cc-facts">
                {diagnostics.plannedResources.map((resource) => (
                  <FactRow
                    key={resource.key}
                    stacked
                    label={resource.label}
                    value={
                      resource.reuseSid ? (
                        <span><Badge tone="success">Reuse</Badge> <span className="t-mono a2p-cc-wrap">{resource.reuseSid}</span></span>
                      ) : (
                        <Badge tone="info">{resource.willCreate ? "Will create" : "—"}</Badge>
                      )
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </details>

        {diagnostics.warnings.length > 0 && (
          <div className="a2p-cc-warning-panel">
            <h4 className="adm-subhead">Warnings</h4>
            <ul className="t-small a2p-cc-list">
              {diagnostics.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="a2p-cc-inline-actions">
          <button type="button" className="btn btn-secondary btn-sm" disabled={syncing} onClick={runReadinessSync}>
            {syncing ? "Running…" : "Run readiness sync"}
          </button>
        </div>
      </A2pDisclosureCard>

      <A2pDisclosureCard
        id="a2p-history"
        title="Previous submission history"
        summary={submissionHistory.hasSubmission ? submissionHistory.approvalStageLabel : "No live submission yet."}
        defaultOpen={false}
        tone="diagnostic"
      >
        {hasHistoricalProviderError && (
          <p className="t-small a2p-cc-stale-note">
            Previous provider error may be stale. Retry the workflow to check the current saved data.
          </p>
        )}
        <div className="a2p-cc-section-grid">
          <div className="a2p-cc-subcard">
            <h4 className="adm-subhead">Existing live submission</h4>
            {submissionHistory.hasSubmission ? (
              <div className="a2p-cc-facts">
                {submissionHistory.items.map((item) => (
                  <FactRow key={`live-${item.label}`} label={item.label} value={item.value} />
                ))}
              </div>
            ) : (
              <div className="a2p-cc-facts">
                <FactRow label="Status" value="Not started" />
                <FactRow
                  label="Next action"
                  value="No live submission yet. Review the approval package and submit when ready."
                />
              </div>
            )}
            {(liveTracked.submission.customerProfileSid || liveTracked.submission.brandRegistrationSid) && (
              <div className="a2p-cc-inline-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={refreshing}
                  onClick={() => {
                    setSelectedMode("live");
                    void refreshProviderStatus("live");
                  }}
                >
                  {refreshing && selectedMode === "live" ? "Refreshing…" : "Refresh live provider status"}
                </button>
              </div>
            )}
          </div>

          <div className="a2p-cc-subcard">
            <h4 className="adm-subhead">Mock test submission</h4>
            {mockHistory.hasSubmission ? (
              <div className="a2p-cc-facts">
                {mockHistory.items.map((item) => (
                  <FactRow key={`mock-${item.label}`} label={item.label} value={item.value} />
                ))}
              </div>
            ) : (
              <div className="a2p-cc-facts">
                <FactRow label="Status" value="Not started" />
                <FactRow label="Next action" value="Use Mock A2P to create separate test-only provider resources." />
              </div>
            )}
            {(mockTracked.submission.customerProfileSid || mockTracked.submission.brandRegistrationSid) && (
              <div className="a2p-cc-inline-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={refreshing}
                  onClick={() => {
                    setSelectedMode("mock");
                    void refreshProviderStatus("mock");
                  }}
                >
                  {refreshing && selectedMode === "mock" ? "Refreshing…" : "Refresh mock provider status"}
                </button>
              </div>
            )}
          </div>
        </div>
      </A2pDisclosureCard>
    </div>
  );
}

function ContentCard({
  title,
  fields,
  validations = [],
}: {
  title: string;
  fields: A2pPayloadField[];
  validations?: A2pValidationResult[];
}) {
  const einValidation = validations.find((validation) => validation.field === "business_registration_number");
  return (
    <div className="a2p-cc-subcard">
      <h4 className="adm-subhead">{title}</h4>
      <div className="a2p-cc-facts">
        {fields.map((field) => {
          if (field.label === "Registration number (EIN)") {
            return (
              <FactRow
                key={`${title}-${field.label}`}
                label={field.label}
                value={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <span>{field.value}</span>
                    {einValidation && <Badge tone="warning">Format invalid</Badge>}
                  </span>
                }
              />
            );
          }
          return <FactRow key={`${title}-${field.label}`} label={field.label} value={field.value} />;
        })}
      </div>
    </div>
  );
}

function RepresentativeCard({ fields }: { fields: A2pPayloadField[] }) {
  const map = fieldMap(fields);
  const name = [map.get("First name"), map.get("Last name")].filter(Boolean).join(" ");
  return (
    <div className="a2p-cc-subcard">
      <h4 className="adm-subhead">Authorized representative</h4>
      <div className="a2p-cc-facts">
        <FactRow label="Name" value={name || "—"} />
        <FactRow label="Role / business title" value={map.get("Business title") ?? "—"} />
        <FactRow label="Email" value={map.get("Email") ?? "—"} />
        <FactRow label="Phone" value={map.get("Phone") ?? "—"} />
      </div>
    </div>
  );
}

function AddressCard({ fields }: { fields: A2pPayloadField[] }) {
  const map = fieldMap(fields);
  const city = map.get("City");
  const region = map.get("Region");
  const postalCode = map.get("Postal code");
  const cityLine = [city, [region, postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <div className="a2p-cc-subcard">
      <h4 className="adm-subhead">Business address</h4>
      <div className="a2p-cc-facts">
        <FactRow label="Customer name" value={map.get("Customer name") ?? "—"} />
        <FactRow label="Street" value={map.get("Street") ?? "—"} />
        {map.get("Street 2") && <FactRow label="Street 2 / Unit" value={map.get("Street 2") ?? "—"} />}
        <FactRow label="City, State ZIP" value={cityLine || "—"} />
        <FactRow label="Country" value={map.get("Country") ?? "—"} />
      </div>
    </div>
  );
}

function CampaignCard({
  fields,
  samples,
  clinicName,
}: {
  fields: A2pPayloadField[];
  samples: string[];
  clinicName: string;
}) {
  const map = fieldMap(fields);
  return (
    <div className="a2p-cc-subcard a2p-cc-subcard--campaign" id="a2p-campaign-content">
      <h4 className="adm-subhead">Campaign content</h4>
      <div className="a2p-cc-facts">
        <FactRow label="Use case" value={map.get("Use case") ?? "—"} />
        <FactRow label="Embedded links" value={map.get("Embedded links") ?? "—"} />
        <FactRow label="Embedded phone" value={map.get("Embedded phone") ?? "—"} />
      </div>
      <div className="a2p-cc-copy-grid">
        <CopyBlock label="Description" value={map.get("Description") ?? "—"} />
        <CopyBlock label="Opt-in / message flow" value={map.get("Opt-in / message flow") ?? "—"} />
      </div>
      <div className="a2p-cc-sms-stack">
        {samples.map((sample, idx) => (
          <div className="a2p-cc-sms-card" key={`${clinicName}-sample-${idx}`}>
            <span className="a2p-cc-sms-label">Sample message {idx + 1}</span>
            <div className="a2p-cc-sms-bubble">{sample}</div>
          </div>
        ))}
      </div>
      <p className="a2p-cc-guardrails t-small">
        <span className="a2p-cc-guardrails-label">Operational guardrails:</span>{" "}
        Fixed recovery template · no repeat recovery text within 24 hours · STOP/HELP supported
      </p>
    </div>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="a2p-cc-copy-block">
      <span className="a2p-cc-copy-label">{label}</span>
      <p className="a2p-cc-copy-value">{value}</p>
    </div>
  );
}

function IncludedSenderCard({ sender }: { sender: A2pIncludedSender }) {
  return (
    <div className="a2p-cc-sender-card">
      <div className="a2p-cc-sender-head">
        <span className="t-mono a2p-cc-wrap">{sender.phoneNumber}</span>
        <Badge tone={sender.includedInSubmission ? "success" : "neutral"}>
          {sender.includedInSubmission ? "Included" : "Not included"}
        </Badge>
      </div>
      {sender.twilioPhoneNumberSid && (
        <details className="a2p-cc-tech-details">
          <summary>Show technical ID</summary>
          <div className="a2p-cc-facts">
            <TechId label="PN SID" value={sender.twilioPhoneNumberSid} />
          </div>
        </details>
      )}
    </div>
  );
}

function ResourceCard({ title, fields }: { title: string; fields: A2pPayloadField[] }) {
  return (
    <div className="a2p-cc-subcard">
      <h4 className="adm-subhead">{title}</h4>
      <div className="a2p-cc-facts">
        {fields.map((field) => (
          <FactRow key={`${title}-${field.label}`} label={field.label} value={field.value} />
        ))}
      </div>
    </div>
  );
}

// Plain-language next action for a number, derived from its coverage state.
function coverageNextAction(coverage: NumberCoverageDisplay): string {
  switch (coverage) {
    case "covered":
      return "No action required.";
    case "not_in_messaging_service":
      return "Add this number to the Messaging Service, then run readiness sync.";
    case "not_campaign_covered":
      return "Complete/refresh A2P campaign sender coverage, then run readiness sync.";
    case "blocked":
      return "Resolve the launch blocker before enabling live SMS.";
    case "readiness_missing":
    case "readiness_unavailable":
    case "stale":
    case "error":
    case "unknown":
    default:
      return "Run readiness sync and review provider status.";
  }
}

// Plain-language meaning of the current state for an operator.
function coverageMeaning(n: A2pReviewNumber): string {
  if (n.coverageDisplay === "covered") return "Ready to send once SMS is enabled.";
  return n.eligibleForLiveSms ? "Verified for live SMS." : "This number cannot send live SMS yet.";
}

function NumberDiagnosticCard({ n }: { n: A2pReviewNumber }) {
  const tone: Tone = n.coverageDisplay === "covered" ? "success" : "warning";
  return (
    <div className="a2p-cc-diagnostic-card">
      <div className="a2p-cc-diagnostic-head">
        <span className="t-mono a2p-cc-wrap">{n.phoneNumber}</span>
        <Badge tone={tone}>{COVERAGE_LABEL[n.coverageDisplay]}</Badge>
      </div>
      <div className="a2p-cc-facts">
        <FactRow stacked label="Status" value={COVERAGE_LABEL[n.coverageDisplay]} />
        <FactRow stacked label="Meaning" value={coverageMeaning(n)} />
        <FactRow stacked label="Next action" value={coverageNextAction(n.coverageDisplay)} />
        <FactRow stacked label="Last synced" value={fmtDateTime(n.lastSyncedAt)} />
      </div>
      <details className="a2p-cc-tech-details">
        <summary>Show technical IDs</summary>
        <div className="a2p-cc-facts">
          <TechId label="PN SID" value={n.twilioPhoneNumberSid ?? "Missing"} />
          <FactRow stacked label="Messaging Service sender status" value={humanizeToken(n.messagingServiceSenderStatus)} />
          <FactRow stacked label="A2P campaign coverage (raw)" value={humanizeToken(n.a2pCampaignCoverageStatus)} />
          <FactRow stacked label="Blocking reason" value={n.blockingReason ? humanizeToken(n.blockingReason) : "None"} />
        </div>
      </details>
    </div>
  );
}

function FactRow({
  label,
  value,
  stacked = false,
}: {
  label: string;
  value: React.ReactNode;
  // Stacked rows put the value on its own full-width line under the label. Used
  // in diagnostic/technical areas so long values are never squeezed into a narrow
  // right-hand column.
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "a2p-cc-fact-row is-stacked" : "a2p-cc-fact-row"}>
      <span className="a2p-cc-fact-label">{label}</span>
      <span className="a2p-cc-fact-value">{value}</span>
    </div>
  );
}

// A readable, full-width technical identifier (PN SID, Brand SID, …). The value
// renders in a code-like block that wraps with overflow-wrap:anywhere — never a
// narrow two-column row that wraps one character per line.
function TechId({ label, value }: { label: string; value: string }) {
  return (
    <div className="a2p-cc-tech-id">
      <span className="a2p-cc-tech-id-label">{label}</span>
      <code className="a2p-cc-tech-id-value">{value}</code>
    </div>
  );
}

function A2pDisclosureCard({
  id,
  title,
  summary,
  helper,
  defaultOpen,
  tone,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  helper?: string;
  defaultOpen: boolean;
  tone: "technical" | "diagnostic" | "warning";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      id={id}
      className={`a2p-cc-disclosure a2p-cc-disclosure--${tone}`}
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="a2p-cc-disclosure-summary">
        <span className="a2p-cc-disclosure-head">
          <span>
            <span className="a2p-cc-disclosure-title">{title}</span>
            <span className="a2p-cc-disclosure-copy">{summary}</span>
            {helper && <span className="a2p-cc-disclosure-helper">{helper}</span>}
          </span>
        </span>
      </summary>
      <div className="a2p-cc-disclosure-body">{children}</div>
    </details>
  );
}

function DisabledSubmit({ reason }: { reason: string }) {
  return (
    <div className="adm-blocked" role="note">
      <button type="button" className="btn btn-secondary" disabled aria-disabled="true">
        Submit for A2P review
      </button>
      <span className="t-small" style={{ color: "var(--text-muted)" }}>{reason}</span>
    </div>
  );
}

function formatBrandStatusForDiagnostics(status: string | null, submissionStatus: string | null): React.ReactNode {
  if (!status) return "Not synced";
  const upper = (status ?? "").trim().toUpperCase();
  // Terminal failure should be clearly marked as failed — NOT "expected before approval".
  if (upper === "FAILED" || upper === "REJECTED" || upper === "DECLINED") {
    return humanizeToken(status);
  }
  if (submissionStatus !== "approved" && upper !== "APPROVED" && upper !== "COVERED") {
    return (
      <span>
        {humanizeToken(status)}{" "}
        <span className="t-helper">Expected before approval. This does not block A2P submission.</span>
      </span>
    );
  }
  return humanizeToken(status);
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--text-muted)" }}>{children}</span>;
}
