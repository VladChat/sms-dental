"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, humanizeToken } from "../../../_components/AdminUI";
import {
  hasValidationErrors,
  type A2pValidationResult,
  validateA2pPreflight,
} from "../../../../../../lib/a2p/validation";
import type {
  A2pTrackedSubmission,
  A2pPayloadField,
  A2pPayloadResource,
  A2pReviewNumber,
  A2pReviewPackage,
  NumberCoverageDisplay,
} from "../../../../../../lib/a2p/types";
import {
  badgeToneFor,
  buildA2pAdminOverview,
  buildAdvancedDiagnosticsView,
  buildLiveA2pApprovalView,
  buildMockA2pTestView,
  buildSmsLaunchReadinessView,
  type A2pLaunchStatus,
} from "../../../../../../lib/a2p/admin-view";
import { A2pLifecycle } from "./A2pLifecycle";
import { isLiveCampaignCreationPending } from "../../../../../../lib/a2p/submission-modes";

type Tone = "success" | "neutral" | "warning" | "info" | "brand";

type SubTabId = "overview" | "mock" | "live" | "launch" | "diagnostics";

const SUBTABS: { id: SubTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "mock", label: "Mock test" },
  { id: "live", label: "Live approval" },
  { id: "launch", label: "Launch readiness" },
  { id: "diagnostics", label: "Diagnostics" },
];

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

const REVIEW_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready_for_review: "Not submitted yet",
  missing_info: "Missing information",
  submit_disabled: "Submission disabled",
  readiness_unavailable: "Readiness unavailable",
  dry_run_reviewed: "Reviewed (dry run)",
  ready_for_manual_submission: "Ready for manual submission",
  submitted: "Submitted",
  pending: "In carrier review",
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
  representative: new Set(["First name", "Last name", "Email", "Phone", "Business title"]),
  address: new Set(["Customer name", "Street", "Street 2", "City", "Region", "Postal code", "Country"]),
  campaign: new Set(["Use case", "Embedded links", "Embedded phone", "Description", "Opt-in / message flow"]),
};

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

function diagnosticsSummary(pkg: A2pReviewPackage): string {
  const warningCount = pkg.internalDiagnostics.numberDiagnostics.filter(
    (number) => number.coverageDisplay !== "covered",
  ).length;
  const stale = pkg.internalDiagnostics.numberDiagnostics.some((number) => number.coverageDisplay === "stale");
  const lastSync =
    pkg.internalDiagnostics.clinicReadiness?.lastSyncedAt ??
    pkg.internalDiagnostics.numberDiagnostics.find((number) => number.lastSyncedAt)?.lastSyncedAt ??
    null;

  if (!pkg.readinessAvailable) return "Readiness data unavailable";
  if (stale) return `Readiness data stale${lastSync ? ` · last sync ${fmtDateTime(lastSync)}` : ""}`;
  if (warningCount > 0) {
    return `${warningCount} coverage ${warningCount === 1 ? "warning" : "warnings"}${lastSync ? ` · last sync ${fmtDateTime(lastSync)}` : ""}`;
  }
  return "No blocking diagnostics";
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
  const providerStatusLabel =
    providerStatuses.length > 0 ? providerStatuses.map(humanizeToken).join(" · ") : "No provider result yet.";

  const items: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Last submitted", value: fmtDateTime(sub.submittedAt) },
    { label: "Last updated", value: fmtDateTime(sub.lastStatusSyncedAt ?? sub.submittedAt) },
    { label: "Current step", value: sub.submissionStep ? humanizeToken(sub.submissionStep) : "—" },
    { label: "Brand SID", value: sub.brandRegistrationSid ? <span className="t-mono a2p-cc-wrap">{sub.brandRegistrationSid}</span> : "—" },
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
  if ((sub.brandStatus ?? "").toUpperCase() === "FAILED" && sub.brandFailureReason) {
    items.unshift({ label: "Brand failure reason", value: sub.brandFailureReason });
    if (sub.brandFailureCode) {
      items.splice(1, 0, { label: "Twilio Error Code", value: sub.brandFailureCode });
    }
  }

  return { hasSubmission: hasLiveSubmission, approvalStageLabel, providerStatusLabel, items };
}

function buildTrackedSubmissionHistory(tracked: A2pTrackedSubmission): SubmissionHistorySummary {
  const sub = tracked.submission;
  const status = sub.status ?? "ready_for_review";
  const providerStatuses = [
    sub.customerProfileStatus,
    sub.trustProductStatus,
    sub.brandStatus,
    sub.campaignStatus,
  ].filter(Boolean);
  const providerStatusLabel =
    providerStatuses.length > 0 ? providerStatuses.map(humanizeToken).join(" · ") : "No provider result yet.";
  const items: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Last submitted", value: fmtDateTime(sub.submittedAt) },
    { label: "Last updated", value: fmtDateTime(sub.lastStatusSyncedAt ?? sub.submittedAt) },
    { label: "Current step", value: sub.submissionStep ? humanizeToken(sub.submissionStep) : "—" },
    { label: "Brand SID", value: sub.brandRegistrationSid ? <span className="t-mono a2p-cc-wrap">{sub.brandRegistrationSid}</span> : "—" },
    { label: "Campaign SID", value: sub.campaignSid ? <span className="t-mono a2p-cc-wrap">{sub.campaignSid}</span> : "—" },
    { label: "Provider status", value: providerStatusLabel },
  ];
  if (tracked.mock) {
    items.push({ label: "Test-only (mock)", value: "Yes — does not count as live approval" });
  }
  if (sub.brandFailureReason) {
    items.push({ label: "Brand failure reason", value: sub.brandFailureReason });
  }
  return { hasSubmission: tracked.exists, approvalStageLabel: REVIEW_STATUS_LABEL[status] ?? humanizeToken(status), providerStatusLabel, items };
}

export function AdminA2pReviewPanel({
  pkg,
  clinicId,
  launchStatus,
}: {
  pkg: A2pReviewPackage;
  clinicId: string;
  launchStatus: A2pLaunchStatus;
}) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTabId>("overview");
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [confirmLiveCampaign, setConfirmLiveCampaign] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const overview = useMemo(() => buildA2pAdminOverview(pkg, launchStatus), [pkg, launchStatus]);
  const mockView = useMemo(() => buildMockA2pTestView(pkg), [pkg]);
  const liveView = useMemo(() => buildLiveA2pApprovalView(pkg), [pkg]);
  const smsView = useMemo(() => buildSmsLaunchReadinessView(pkg, launchStatus), [pkg, launchStatus]);
  const diagView = useMemo(() => buildAdvancedDiagnosticsView(pkg), [pkg]);
  const providerSections = useMemo(() => providerSectionsFromPackage(pkg), [pkg]);
  const submissionHistory = useMemo(() => buildSubmissionHistory(pkg), [pkg]);
  const mockHistory = useMemo(() => buildTrackedSubmissionHistory(pkg.submissions.mock), [pkg]);
  const preflightValidations = useMemo(
    () => validateA2pPreflight(pkg).filter((result) => result.severity === "error"),
    [pkg],
  );

  const auth = pkg.authorizationState;
  const diagnostics = pkg.internalDiagnostics;
  const sub = diagnostics.submission;

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

  async function refreshProviderStatus(mode: "mock" | "live") {
    setRefreshing(true);
    setMessage(null);
    setError(null);
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

  async function submitLive() {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    const intent = isLiveCampaignCreationPending(pkg.submissions.live.submission) ? "create_live_campaign" : "submit";
    const r = await post(
      `/api/admin/clinics/${clinicId}/a2p/submit`,
      "A2P submission failed. Check server logs before retrying.",
      { submissionMode: "live", intent, confirmLiveSubmit: confirmLive, confirmLiveCampaign },
    );
    if (r.ok) {
      setMessage(r.message);
      setConfirmLive(false);
      setConfirmLiveCampaign(false);
      router.refresh();
    } else {
      setError(r.message);
    }
    setSubmitting(false);
  }

  function onTabKeyDown(e: React.KeyboardEvent, idx: number) {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % SUBTABS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + SUBTABS.length) % SUBTABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = SUBTABS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      setSubTab(SUBTABS[next]!.id);
      tabRefs.current[next]?.focus();
    }
  }

  return (
    <div className="a2p-cc">
      <header className="a2p-cc-header">
        <div className="a2p-cc-header-main">
          <h2 className="t-h3">A2P / 10DLC</h2>
          <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
            Mock test, live carrier approval, and real SMS launch readiness are separate. Mock never enables real SMS.
          </p>
        </div>
      </header>

      <div className="a2p-subtabs" role="tablist" aria-label="A2P sections">
        {SUBTABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            type="button"
            role="tab"
            id={`a2p-subtab-${t.id}`}
            aria-selected={subTab === t.id}
            aria-controls={`a2p-subpanel-${t.id}`}
            tabIndex={subTab === t.id ? 0 : -1}
            className={`a2p-subtab${subTab === t.id ? " is-active" : ""}`}
            onClick={() => setSubTab(t.id)}
            onKeyDown={(e) => onTabKeyDown(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(message || error) && (
        <div className={`alert ${error ? "alert-error" : "alert-success"}`} role="status" aria-live="polite">
          <span>{error ?? message}</span>
        </div>
      )}

      {/* ---- Overview ---- */}
      {subTab === "overview" && (
        <section id="a2p-subpanel-overview" role="tabpanel" aria-labelledby="a2p-subtab-overview" className="a2p-cc-card">
          <div className="a2p-cc-card-head">
            <div>
              <p className="a2p-cc-kicker">At a glance</p>
              <h3 className="adm-subhead">A2P / 10DLC overview</h3>
            </div>
          </div>
          <div className="a2p-ov-grid">
            {overview.cards.map((card) => (
              <div key={card.id} className={`a2p-cc-stat a2p-cc-tone-${card.tone}`}>
                <span className="a2p-cc-stat-label">{card.title}</span>
                <span className="a2p-cc-stat-value">
                  <Badge tone={badgeToneFor(card.tone)}>{card.status}</Badge>
                </span>
                <span className="a2p-cc-stat-detail">{card.body}</span>
              </div>
            ))}
          </div>
          {overview.liveSubmissionDisabledNote && (
            <p className="t-small" style={{ color: "var(--text-muted)" }}>{overview.liveSubmissionDisabledNote}</p>
          )}
          <div className="a2p-ov-links">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSubTab("mock")}>View Mock A2P test</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSubTab("live")}>View Live A2P approval</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSubTab("launch")}>View SMS launch readiness</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSubTab("diagnostics")}>Advanced diagnostics</button>
          </div>
        </section>
      )}

      {/* ---- Mock A2P test ---- */}
      {subTab === "mock" && (
        <section id="a2p-subpanel-mock" role="tabpanel" aria-labelledby="a2p-subtab-mock" className="a2p-cc-card">
          <div className="a2p-cc-card-head">
            <div>
              <p className="a2p-cc-kicker">Test-only</p>
              <h3 className="adm-subhead">Mock A2P test</h3>
              <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
                Validates the mock Brand/Campaign flow only. It does not attach real senders and does not enable patient SMS.
              </p>
            </div>
            <Badge tone={badgeToneFor(mockView.tone)}>{mockView.statusLabel}</Badge>
          </div>

          {mockView.showCreateActions ? (
            <div className="a2p-cc-action-stack">
              <A2pLifecycle pkg={pkg} clinicId={clinicId} selectedMode="mock" />
            </div>
          ) : (
            <>
              <div className="a2p-cc-facts">
                <FactRow label="Status" value={<Badge tone="success">Complete</Badge>} />
                <FactRow label="Mock Brand" value={mockView.brand.label} />
                <FactRow label="Mock Campaign" value={mockView.campaign.label} />
                <FactRow
                  label="Mock Messaging Service"
                  value={mockView.messagingServiceSid ? <span className="t-mono a2p-cc-wrap">{mockView.messagingServiceSid}</span> : "—"}
                />
                <FactRow label="Real SMS" value={<Badge tone="neutral">Not enabled by mock</Badge>} />
              </div>

              <div className="a2p-cc-inline-actions">
                <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing} onClick={() => void refreshProviderStatus("mock")}>
                  {refreshing ? "Refreshing…" : "Refresh mock status"}
                </button>
                <span className="t-helper">Read-only. Re-reads mock Brand/Campaign status from Twilio.</span>
              </div>

              <A2pDisclosureCard
                id="a2p-mock-references"
                title="References"
                summary="Mock resource identifiers (test-only)."
                defaultOpen={false}
                tone="diagnostic"
              >
                <div className="a2p-cc-facts">
                  <FactRow label="Mock Brand SID" value={mockView.brand.sid ? <span className="t-mono a2p-cc-wrap">{mockView.brand.sid}</span> : "—"} />
                  <FactRow label={mockView.campaign.sidLabel} value={mockView.campaign.sid ? <span className="t-mono a2p-cc-wrap">{mockView.campaign.sid}</span> : "—"} />
                  <FactRow label="Mock Messaging Service SID" value={mockView.messagingServiceSid ? <span className="t-mono a2p-cc-wrap">{mockView.messagingServiceSid}</span> : "—"} />
                </div>
              </A2pDisclosureCard>
            </>
          )}
        </section>
      )}

      {/* ---- Live A2P approval ---- */}
      {subTab === "live" && (
        <section
          id="a2p-subpanel-live"
          role="tabpanel"
          aria-labelledby="a2p-subtab-live"
          className={`a2p-cc-card a2p-cc-card--decision ${liveView.status === "approved" ? "is-ready" : liveView.status === "failed" ? "is-blocked" : ""}`}
        >
          <div className="a2p-cc-card-head">
            <div>
              <p className="a2p-cc-kicker">Real carrier / TCR</p>
              <h3 className="adm-subhead">Live A2P approval</h3>
              <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
                Real Brand and Campaign vetting by the carrier. Mock results do not count as approval here.
              </p>
            </div>
            <Badge tone={badgeToneFor(liveView.tone)}>{liveView.statusLabel}</Badge>
          </div>

          <div className="a2p-cc-facts">
            <FactRow label="Current live status" value={<Badge tone={badgeToneFor(liveView.tone)}>{liveView.statusLabel}</Badge>} />
            <FactRow label="Live Brand SID" value={liveView.brandSid ? <span className="t-mono a2p-cc-wrap">{liveView.brandSid}</span> : "Not created"} />
            {liveView.failureReason && <FactRow label="Failure reason" value={liveView.failureReason} />}
            {liveView.failureCode && <FactRow label="Twilio Error Code" value={liveView.failureCode} />}
            <FactRow label="Live Campaign" value={liveView.campaignCreated ? <span className="t-mono a2p-cc-wrap">{liveView.campaignSid}</span> : "Not created"} />
            <FactRow
              label="Live submission"
              value={
                !liveView.liveSubmissionEnabled
                  ? <Badge tone="neutral">Disabled in this environment</Badge>
                  : liveView.liveSubmitArmed
                    ? <Badge tone="warning">Armed</Badge>
                    : <Badge tone="neutral">Not armed</Badge>
              }
            />
            <FactRow label="Next action" value={liveView.nextAction} />
          </div>

          <div className="a2p-cc-caution">
            <h4 className="adm-subhead">Live A2P creates billable, externally reviewed resources</h4>
            <ul className="t-small a2p-cc-list">
              {(liveView.feesRiskNotice.length > 0
                ? liveView.feesRiskNotice
                : [
                    "Live Brand registration may create billable Twilio/TCR resources.",
                    "Live Campaign registration may create recurring monthly carrier fees.",
                    "Live submissions enter real carrier vetting and cannot simply be undone.",
                  ]
              ).map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>

          <div className="a2p-cc-actions">
            {liveView.liveSubmitArmed && !hasValidationErrors(preflightValidations) ? (
              isLiveCampaignCreationPending(pkg.submissions.live.submission) ? (
                <div className="a2p-cc-action-stack">
                  <div className="a2p-cc-auth">
                    <label className="check">
                      <input type="checkbox" checked={confirmLiveCampaign} onChange={(e) => setConfirmLiveCampaign(e.target.checked)} />
                      <span>I understand this creates recurring monthly A2P Campaign fees.</span>
                    </label>
                  </div>
                  <button type="button" className="btn btn-primary" disabled={submitting || !confirmLiveCampaign} onClick={submitLive}>
                    {submitting ? "Submitting…" : "Create live A2P Campaign"}
                  </button>
                </div>
              ) : (
                <div className="a2p-cc-action-stack">
                  <div className="a2p-cc-auth">
                    <label className="check">
                      <input type="checkbox" checked={confirmLive} onChange={(e) => setConfirmLive(e.target.checked)} />
                      <span>
                        I have reviewed the provider payload below and authorize a <strong>real</strong> A2P submission for this clinic.
                      </span>
                    </label>
                  </div>
                  <button type="button" className="btn btn-primary" disabled={submitting || !confirmLive} onClick={submitLive}>
                    {submitting ? "Submitting…" : "Submit to Twilio for A2P review"}
                  </button>
                </div>
              )
            ) : (
              <DisabledSubmit
                reason={
                  hasValidationErrors(preflightValidations)
                    ? preflightValidations[0]?.operatorMessage ?? preflightValidations[0]?.message ?? "Pre-submit validation failed."
                    : liveView.liveSubmitBlockedReason ?? "Live A2P submission is not armed for this clinic."
                }
              />
            )}
          </div>

          <A2pDisclosureCard
            id="a2p-provider-payload"
            title="Provider payload preview"
            summary="Exactly what a future live submission would send to Twilio. Optional fields omitted."
            defaultOpen={false}
            tone="technical"
          >
            <div className="a2p-cc-section-grid">
              <ContentCard title="Business identity" fields={providerSections.businessIdentity} validations={preflightValidations} />
              <RepresentativeCard fields={providerSections.representative} />
              <AddressCard fields={providerSections.address} />
              <CampaignCard fields={providerSections.campaign} samples={providerSections.messageSamples} clinicName={pkg.clinicName} />
            </div>
          </A2pDisclosureCard>
        </section>
      )}

      {/* ---- SMS launch readiness ---- */}
      {subTab === "launch" && (
        <section id="a2p-subpanel-launch" role="tabpanel" aria-labelledby="a2p-subtab-launch" className="a2p-cc-card">
          <div className="a2p-cc-card-head">
            <div>
              <p className="a2p-cc-kicker">Real SMS go-live</p>
              <h3 className="adm-subhead">SMS launch readiness</h3>
              <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
                Real patient SMS only. A complete mock test does not count toward launch.
              </p>
            </div>
            <Badge tone={badgeToneFor(smsView.tone)}>{smsView.statusLabel}</Badge>
          </div>

          <div className="a2p-cc-facts">
            <FactRow label="Real SMS" value={<Badge tone={badgeToneFor(smsView.tone)}>{smsView.statusLabel}</Badge>} />
            <FactRow label="Live A2P approval" value={<Badge tone={smsView.liveA2pApproved ? "success" : "warning"}>{smsView.liveA2pApproved ? "Approved" : liveView.brandFailed ? "Failed" : "Missing"}</Badge>} />
            <FactRow label="Live campaign" value={<Badge tone={smsView.liveCampaignVerified ? "success" : "warning"}>{smsView.liveCampaignVerified ? "Verified" : "Not verified"}</Badge>} />
            <FactRow label="Sender coverage" value={<Badge tone={smsView.senderCoverageComplete ? "success" : "warning"}>{smsView.senderCoverageComplete ? "Complete" : "Missing"}</Badge>} />
          </div>

          {smsView.readinessIncludesMockIdentifiers && (
            <div className="alert alert-warning" role="note">
              <span>
                Readiness data includes mock test identifiers (a mock Brand appears as approved). Real launch remains blocked
                until <strong>live</strong> A2P approval and live sender coverage are verified.
              </span>
            </div>
          )}

          <div className="a2p-cc-subcard">
            <h4 className="adm-subhead">Numbers</h4>
            {smsView.numbers.length === 0 ? (
              <p className="t-body"><Muted>No active local SMS numbers for this clinic.</Muted></p>
            ) : (
              <div className="a2p-cc-facts">
                {smsView.numbers.map((n) => (
                  <FactRow
                    key={n.phoneNumber}
                    label={<span className="t-mono a2p-cc-wrap">{n.phoneNumber}</span>}
                    value={<Badge tone={n.covered ? "success" : "warning"}>{n.covered ? "Covered" : n.statusLabel}</Badge>}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="t-helper">
            {smsView.blockingSummary} Enabling patient SMS is a separate, manual step and is not offered here.
          </p>
        </section>
      )}

      {/* ---- Advanced diagnostics ---- */}
      {subTab === "diagnostics" && (
        <section id="a2p-subpanel-diagnostics" role="tabpanel" aria-labelledby="a2p-subtab-diagnostics" className="a2p-cc-card">
          <div className="a2p-cc-card-head">
            <div>
              <p className="a2p-cc-kicker">Engineers only</p>
              <h3 className="adm-subhead">Advanced diagnostics</h3>
              <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
                Raw provider state, technical wiring, and history. Not part of the main workflow.
              </p>
            </div>
          </div>

          <div className="a2p-cc-inline-actions">
            <button type="button" className="btn btn-secondary btn-sm" disabled={syncing} onClick={runReadinessSync}>
              {syncing ? "Running…" : "Run readiness sync"}
            </button>
            {(sub.brandRegistrationSid || sub.customerProfileSid) && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing} onClick={() => void refreshProviderStatus("live")}>
                {refreshing ? "Refreshing…" : "Refresh live provider status"}
              </button>
            )}
          </div>

          <A2pDisclosureCard
            id="a2p-technical-wiring"
            title="Twilio technical wiring"
            summary="SIDs, policy references, and generated resources used by the Twilio API."
            defaultOpen={false}
            tone="technical"
          >
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
          </A2pDisclosureCard>

          <A2pDisclosureCard
            id="a2p-diagnostics"
            title="Internal diagnostics — not submitted to Twilio"
            summary={diagnosticsSummary(pkg)}
            helper="Platform-admin troubleshooting only. Not sent in any Twilio payload."
            defaultOpen={false}
            tone="diagnostic"
          >
            <div className="a2p-cc-section-grid">
              <div className="a2p-cc-subcard">
                <h4 className="adm-subhead">Platform and readiness state</h4>
                <div className="a2p-cc-facts">
                  <FactRow
                    label="Real submission platform state"
                    value={<Badge tone={auth.realSubmissionEnabled ? "info" : "neutral"}>{auth.realSubmissionEnabled ? "Enabled" : "Disabled"}</Badge>}
                  />
                  <FactRow
                    label="Live armed state"
                    value={<Badge tone={auth.liveSubmitArmed ? "success" : "neutral"}>{auth.liveSubmitArmed ? "Armed" : "Not armed"}</Badge>}
                  />
                  <FactRow
                    label="Messaging Service status"
                    value={diagnostics.clinicReadiness ? humanizeToken(diagnostics.clinicReadiness.messagingServiceStatus) : "Not synced"}
                  />
                  <FactRow
                    label="Readiness brand status"
                    value={diagnostics.clinicReadiness ? humanizeToken(diagnostics.clinicReadiness.brandStatus) : "Not synced"}
                  />
                  <FactRow
                    label="Readiness campaign status"
                    value={diagnostics.clinicReadiness ? humanizeToken(diagnostics.clinicReadiness.campaignStatus) : "Not synced"}
                  />
                  <FactRow label="Last readiness sync" value={fmtDateTime(diagnostics.clinicReadiness?.lastSyncedAt ?? null)} />
                  <FactRow
                    label="Launch readiness blocker"
                    value={diagnostics.clinicReadiness?.blockingReason ? humanizeToken(diagnostics.clinicReadiness.blockingReason) : "None"}
                  />
                </div>
                {smsView.readinessIncludesMockIdentifiers && (
                  <p className="t-helper">
                    Note: readiness sync recorded mock test identifiers in the live readiness record. TODO: scope readiness sync to
                    live Brand/Campaign only so mock resources never appear here.
                  </p>
                )}
              </div>

              <div className="a2p-cc-subcard">
                <h4 className="adm-subhead">Per-number coverage diagnostics</h4>
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
            </div>

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
          </A2pDisclosureCard>

          <A2pDisclosureCard
            id="a2p-history"
            title="Submission history"
            summary={`Live: ${submissionHistory.hasSubmission ? submissionHistory.approvalStageLabel : "none"} · provider chain: ${diagView.providerStatusChain}`}
            defaultOpen={false}
            tone="diagnostic"
          >
            <div className="a2p-cc-section-grid">
              <div className="a2p-cc-subcard">
                <h4 className="adm-subhead">Live submission</h4>
                {submissionHistory.hasSubmission ? (
                  <div className="a2p-cc-facts">
                    {submissionHistory.items.map((item) => (
                      <FactRow key={`live-${item.label}`} label={item.label} value={item.value} />
                    ))}
                  </div>
                ) : (
                  <div className="a2p-cc-facts">
                    <FactRow label="Status" value="Not started" />
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
                  </div>
                )}
              </div>
            </div>
          </A2pDisclosureCard>
        </section>
      )}
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
    <div className="a2p-cc-subcard a2p-cc-subcard--campaign">
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

function NumberDiagnosticCard({ n }: { n: A2pReviewNumber }) {
  const tone: Tone = n.coverageDisplay === "covered" ? "success" : "warning";
  return (
    <div className="a2p-cc-diagnostic-card">
      <div className="a2p-cc-diagnostic-head">
        <span className="t-mono a2p-cc-wrap">{n.phoneNumber}</span>
        <Badge tone={tone}>{COVERAGE_LABEL[n.coverageDisplay]}</Badge>
      </div>
      <div className="a2p-cc-facts">
        <FactRow label="PN SID" value={n.twilioPhoneNumberSid ? <span className="t-mono a2p-cc-wrap">{n.twilioPhoneNumberSid}</span> : "Missing"} />
        <FactRow label="Messaging Service sender status" value={humanizeToken(n.messagingServiceSenderStatus)} />
        <FactRow label="A2P campaign coverage" value={humanizeToken(n.a2pCampaignCoverageStatus)} />
        <FactRow
          label="Eligible for live SMS"
          value={<Badge tone={n.eligibleForLiveSms ? "success" : "warning"}>{n.eligibleForLiveSms ? "Yes" : "No"}</Badge>}
        />
        <FactRow label="Launch blocking reason" value={n.blockingReason ? humanizeToken(n.blockingReason) : "None"} />
        <FactRow label="Last synced" value={fmtDateTime(n.lastSyncedAt)} />
      </div>
    </div>
  );
}

function FactRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="a2p-cc-fact-row">
      <span className="a2p-cc-fact-label">{label}</span>
      <span className="a2p-cc-fact-value">{value}</span>
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

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--text-muted)" }}>{children}</span>;
}
