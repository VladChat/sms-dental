"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Row, humanizeToken } from "../../../_components/AdminUI";
import type {
  A2pIncludedSender,
  A2pPayloadResource,
  A2pReviewNumber,
  A2pReviewPackage,
  NumberCoverageDisplay,
} from "../../../../../../lib/a2p/types";

type Tone = "success" | "neutral" | "warning" | "info" | "brand";

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

const COVERAGE_LABEL: Record<NumberCoverageDisplay, string> = {
  covered: "Approved / covered",
  not_in_messaging_service: "Not covered yet — not in Messaging Service",
  not_campaign_covered: "Not covered yet — campaign coverage missing",
  readiness_missing: "Not approved yet — readiness not synced",
  readiness_unavailable: "Not approved yet — readiness unavailable",
  stale: "Not covered yet — readiness stale",
  error: "Not covered yet — sync error",
  blocked: "Not covered yet — blocked",
  unknown: "Not approved yet",
};

const REVIEW_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready_for_review: "Ready for review",
  missing_info: "Missing information",
  submit_disabled: "Submission disabled",
  readiness_unavailable: "SMS readiness data unavailable",
  dry_run_reviewed: "Reviewed (dry run)",
  ready_for_manual_submission: "Ready for manual submission",
  submitted: "Submitted to Twilio",
  pending: "Pending carrier review",
  approved: "Approved",
  rejected: "Rejected",
  failed: "Failed — safe to retry",
  blocked: "Blocked",
  not_found: "Clinic not found",
};

function reviewStatusTone(status: string): Tone {
  switch (status) {
    case "approved":
    case "dry_run_reviewed":
    case "ready_for_manual_submission":
      return "success";
    case "submitted":
    case "pending":
    case "ready_for_review":
      return "info";
    case "submit_disabled":
    case "draft":
      return "neutral";
    default:
      return "warning";
  }
}

const MODE_LABEL: Record<string, string> = {
  disabled: "Disabled",
  dry_run: "Dry run (review-only)",
  live: "Live (real Twilio submission)",
};

export function AdminA2pReviewPanel({ pkg, clinicId }: { pkg: A2pReviewPackage; clinicId: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, fallbackError: string): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(path, { method: "POST", credentials: "include" });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; nextAction?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) return { ok: false, message: json?.error?.message ?? fallbackError };
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

  async function refreshProviderStatus() {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    const r = await post(`/api/admin/clinics/${clinicId}/a2p/status`, "Could not refresh A2P provider status.");
    if (r.ok) {
      setMessage("Read-only A2P provider status refreshed.");
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
    const r = await post(`/api/admin/clinics/${clinicId}/a2p/submit`, "Could not record the A2P submission.");
    if (r.ok) {
      setMessage(r.message);
      setConfirmLive(false);
      router.refresh();
    } else {
      setError(r.message);
    }
    setSubmitting(false);
  }

  const auth = pkg.authorizationState;
  const diagnostics = pkg.internalDiagnostics;
  const sub = diagnostics.submission;
  const status = sub.status;
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const isResume = status === "pending" || status === "submitted" || status === "failed";
  const isLive = auth.submissionMode === "live";
  const isDryRun = auth.submissionMode === "dry_run";

  const canSubmitNow =
    !isApproved &&
    !isRejected &&
    auth.submissionMode !== "disabled" &&
    auth.submitEligible &&
    (isDryRun || (isLive && auth.liveSubmitArmed));

  const mainBlocker = isApproved
    ? "Already approved — no submission needed."
    : isRejected
      ? "Previous submission rejected — operator review required."
      : auth.submissionMode === "disabled"
        ? "A2P submission is disabled in this environment."
        : !auth.submitEligible
          ? auth.submitBlockedReason
          : isLive && !auth.liveSubmitArmed
            ? auth.liveSubmitBlockedReason
            : null;

  const nextAction = canSubmitNow
    ? isLive
      ? "Review the provider payload below, authorize the live action, then submit."
      : "Record the dry-run review. No Twilio resources will change."
    : isApproved
      ? "Run the readiness sync to confirm per-number coverage, then enable SMS separately."
      : mainBlocker ?? "Resolve the blocker above.";

  return (
    <div>
      <div className="adm-section-head">
        <h2 className="t-h3">A2P / 10DLC approval review</h2>
        <Badge tone={reviewStatusTone(auth.reviewStatus)}>
          {REVIEW_STATUS_LABEL[auth.reviewStatus] ?? humanizeToken(auth.reviewStatus)}
        </Badge>
      </div>
      <p className="t-helper" style={{ margin: "var(--space-1) 0 var(--space-2)" }}>
        Platform-admin only. This page separates the real Twilio submission payload from internal readiness and troubleshooting data.
      </p>
      <p className="t-small" style={{ margin: "0 0 var(--space-4)", color: "var(--text-secondary)" }}>
        {pkg.localNumberCount > 0 ? (
          <>Applies to <strong>Local (A2P 10DLC)</strong> numbers only. Toll-free numbers use toll-free verification and are not part of this package.</>
        ) : pkg.tollFreeActiveCount > 0 ? (
          <>This clinic has only toll-free numbers. Local A2P 10DLC registration is not required — toll-free numbers use toll-free verification instead.</>
        ) : (
          <>Applies to <strong>Local (A2P 10DLC)</strong> numbers only.</>
        )}
      </p>

      <SectionCard title="Submission status & authorization" subtitle="Safety and control only. This section is not the Twilio payload.">
        <dl className="adm-rows">
          <Row label="Can submit now">
            <Badge tone={canSubmitNow ? "success" : "warning"}>{canSubmitNow ? "Yes" : "No"}</Badge>
          </Row>
          <Row label="Mode">
            <Badge tone={auth.submissionMode === "disabled" ? "neutral" : isLive ? "brand" : "info"}>
              {MODE_LABEL[auth.submissionMode] ?? humanizeToken(auth.submissionMode)}
            </Badge>
          </Row>
          <Row label="Main blocker">{mainBlocker ? <span style={{ color: "var(--warning)" }}>{mainBlocker}</span> : "None"}</Row>
          <Row label="Next action">{nextAction}</Row>
        </dl>

        {auth.feesRiskNotice.length > 0 && (
          <div className="adm-banner tone-warning" role="note" style={{ marginTop: "var(--space-3)" }}>
            <div className="adm-banner-main">
              <span className="adm-banner-title">Real submission creates billable external Twilio resources</span>
              <ul className="t-small" style={{ margin: "var(--space-1) 0 0", paddingLeft: "var(--space-4)" }}>
                {auth.feesRiskNotice.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {(message || error) && (
          <div
            className={`alert ${error ? "alert-error" : "alert-success"}`}
            role="status"
            aria-live="polite"
            style={{ marginTop: "var(--space-3)" }}
          >
            <span>{error ?? message}</span>
          </div>
        )}

        <div style={{ marginTop: "var(--space-4)" }}>
          {isApproved ? (
            <p className="t-body">
              <Badge tone="success">Approved / covered</Badge> A2P registration is approved. No further submission is required.
            </p>
          ) : isRejected ? (
            <div className="adm-blocked" role="note">
              <Badge tone="warning">Rejected</Badge>
              <span className="t-small" style={{ color: "var(--text-muted)" }}>
                {sub.rejectionReason ?? "A previous submission was rejected."} Operator review is required before resubmitting.
              </span>
            </div>
          ) : auth.submissionMode === "disabled" || !auth.submitEligible ? (
            <DisabledSubmit reason={mainBlocker ?? "Not eligible for submission yet."} />
          ) : isDryRun ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" disabled={submitting} onClick={submit}>
                {submitting ? "Recording…" : "Submit for A2P review (dry run)"}
              </button>
              <p className="t-helper" style={{ margin: "var(--space-2) 0 0", color: "var(--text-muted)" }}>
                Dry-run mode records operator review only. No Twilio submission, no SMS, and no provider mutation occur.
              </p>
            </>
          ) : isLive && auth.liveSubmitArmed ? (
            <>
              <label
                className="t-small"
                style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start", maxWidth: 720 }}
              >
                <input
                  type="checkbox"
                  checked={confirmLive}
                  onChange={(e) => setConfirmLive(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  I have reviewed the provider payload below and authorize a <strong>real</strong> A2P submission for this clinic.
                  This creates billable, externally reviewed Twilio resources.
                </span>
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: "var(--space-3)" }}
                disabled={submitting || !confirmLive}
                onClick={submit}
              >
                {submitting ? "Submitting…" : isResume ? "Resume A2P submission" : "Submit to Twilio for A2P Review"}
              </button>
              <p className="t-helper" style={{ margin: "var(--space-2) 0 0", color: "var(--text-muted)" }}>
                Runs every currently allowed Twilio step and stops at asynchronous approval points. It never enables patient SMS.
              </p>
            </>
          ) : (
            <DisabledSubmit reason={auth.liveSubmitBlockedReason ?? "Real submission is not armed for this clinic."} />
          )}
        </div>

        {!pkg.readinessAvailable && (
          <div className="adm-banner tone-warning" role="status" style={{ marginTop: "var(--space-3)" }}>
            <div className="adm-banner-main">
              <span className="adm-banner-title">SMS readiness data unavailable</span>
              <span className="adm-banner-body">
                Per-number coverage cannot be confirmed; submission and SMS enablement stay blocked.
              </span>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Submitted to Twilio for A2P review"
        subtitle="Provider-facing payload only. This section matches the real submit handler and omits optional fields by default."
      >
        {pkg.providerPayload.resources.length === 0 ? (
          <p className="t-body">
            <Muted>Nothing to submit yet.</Muted>
          </p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {pkg.providerPayload.resources.map((resource) => (
              <PayloadResource key={resource.step} r={resource} />
            ))}
          </div>
        )}

        <h4 className="adm-subhead" style={{ margin: "var(--space-4) 0 0" }}>Required information</h4>
        {pkg.missingFields.length === 0 ? (
          <p className="t-body">
            <Badge tone="success">Complete</Badge> All required A2P fields are present.
          </p>
        ) : (
          <ul className="t-body" style={{ margin: "var(--space-2) 0 0", paddingLeft: "var(--space-5)" }}>
            {pkg.missingFields.map((field) => (
              <li key={field.key} style={{ color: "var(--warning)", fontWeight: 600 }}>
                {field.label}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Local senders included in this submission"
        subtitle="These local numbers are the senders the live flow adds to the Messaging Service for this campaign."
      >
        {pkg.includedSenders.numbers.length === 0 ? (
          <p className="t-body">
            <Muted>No active local SMS senders are included for this clinic.</Muted>
          </p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {pkg.includedSenders.numbers.map((sender) => (
              <IncludedSenderCard key={sender.twilioPhoneNumberSid ?? sender.phoneNumber} sender={sender} />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Internal diagnostics — not submitted to Twilio"
        subtitle="These values are for platform-admin review only and are not sent in the Twilio approval payload."
      >
        <dl className="adm-rows">
          <Row label="Real submission (platform)">
            <Badge tone={auth.realSubmissionEnabled ? "info" : "neutral"}>
              {auth.realSubmissionEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </Row>
          <Row label="Live armed for this clinic">
            {auth.liveSubmitArmed ? <Badge tone="success">Armed</Badge> : <Badge tone="neutral">Not armed</Badge>}
          </Row>
          <Row label="Messaging Service SID">
            {diagnostics.messagingServiceSid ? (
              <span className="t-mono">{diagnostics.messagingServiceSid}</span>
            ) : (
              <Muted>Missing</Muted>
            )}
          </Row>
          <Row label="Messaging Service status">
            {diagnostics.clinicReadiness ? humanizeToken(diagnostics.clinicReadiness.messagingServiceStatus) : <Muted>Not synced</Muted>}
          </Row>
          <Row label="A2P brand status">
            {diagnostics.clinicReadiness ? humanizeToken(diagnostics.clinicReadiness.brandStatus) : <Muted>Not synced</Muted>}
          </Row>
          <Row label="A2P campaign status">
            {diagnostics.clinicReadiness ? humanizeToken(diagnostics.clinicReadiness.campaignStatus) : <Muted>Not synced</Muted>}
          </Row>
          <Row label="Clinic readiness blocker">
            {diagnostics.clinicReadiness?.blockingReason ? humanizeToken(diagnostics.clinicReadiness.blockingReason) : <Muted>None</Muted>}
          </Row>
          <Row label="Last readiness sync">{fmtDateTime(diagnostics.clinicReadiness?.lastSyncedAt ?? null)}</Row>
          <Row label="Local submission status">
            <Badge tone={reviewStatusTone(status ?? auth.reviewStatus)}>
              {REVIEW_STATUS_LABEL[status ?? auth.reviewStatus] ?? humanizeToken(status ?? auth.reviewStatus)}
            </Badge>
          </Row>
          {sub.submissionStep && <Row label="Current step">{humanizeToken(sub.submissionStep)}</Row>}
          <Row label="Last submitted / updated">{fmtDateTime(sub.submittedAt)}</Row>
          {sub.customerProfileSid && <Row label="Customer Profile">{statusLine(sub.customerProfileSid, sub.customerProfileStatus)}</Row>}
          {sub.trustProductSid && <Row label="A2P Trust Product">{statusLine(sub.trustProductSid, sub.trustProductStatus)}</Row>}
          {sub.brandRegistrationSid && <Row label="Brand Registration">{statusLine(sub.brandRegistrationSid, sub.brandStatus)}</Row>}
          {sub.campaignSid && <Row label="A2P Campaign">{statusLine(sub.campaignSid, sub.campaignStatus)}</Row>}
          {sub.lastErrorCode && <Row label="Last error">{humanizeToken(sub.lastErrorCode)}</Row>}
        </dl>

        <h4 className="adm-subhead" style={{ margin: "var(--space-4) 0 0" }}>Per-number coverage diagnostics</h4>
        {diagnostics.numberDiagnostics.length === 0 ? (
          <p className="t-body">
            <Muted>No local number diagnostics available.</Muted>
          </p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {diagnostics.numberDiagnostics.map((number) => (
              <NumberDiagnosticCard key={number.twilioPhoneNumberSid ?? number.phoneNumber} n={number} />
            ))}
          </div>
        )}

        <h4 className="adm-subhead" style={{ margin: "var(--space-4) 0 0" }}>Planned Twilio resources</h4>
        <dl className="adm-rows">
          {diagnostics.plannedResources.map((resource) => (
            <Row key={resource.key} label={resource.label}>
              {resource.reuseSid ? (
                <span>
                  <Badge tone="success">Reuse</Badge> <span className="t-mono">{resource.reuseSid}</span>
                </span>
              ) : (
                <Badge tone="info">{resource.willCreate ? "Will create" : "—"}</Badge>
              )}
            </Row>
          ))}
        </dl>

        {diagnostics.complianceUrls.businessPage && (
          <p className="t-small" style={{ marginTop: "var(--space-3)" }}>
            Internal compliance pages:{" "}
            <a className="link" href={diagnostics.complianceUrls.businessPage} target="_blank" rel="noreferrer noopener">
              Business
            </a>{" · "}
            <a className="link" href={diagnostics.complianceUrls.privacyPolicy ?? "#"} target="_blank" rel="noreferrer noopener">
              Privacy
            </a>{" · "}
            <a className="link" href={diagnostics.complianceUrls.smsTerms ?? "#"} target="_blank" rel="noreferrer noopener">
              SMS terms
            </a>
          </p>
        )}

        {diagnostics.warnings.length > 0 && (
          <>
            <h4 className="adm-subhead" style={{ margin: "var(--space-4) 0 0" }}>Warnings</h4>
            <ul className="t-small" style={{ margin: "var(--space-1) 0 0", paddingLeft: "var(--space-5)", color: "var(--text-secondary)" }}>
              {diagnostics.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </>
        )}

        <div style={{ marginTop: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={syncing} onClick={runReadinessSync}>
            {syncing ? "Checking…" : "Run read-only readiness sync"}
          </button>
          {(sub.customerProfileSid || sub.brandRegistrationSid) && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing} onClick={refreshProviderStatus}>
              {refreshing ? "Refreshing…" : "Refresh A2P provider status"}
            </button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="adm-phone-card" style={{ marginTop: "var(--space-4)" }}>
      <div className="adm-phone-card-head">
        <span style={{ fontWeight: 700 }}>{title}</span>
      </div>
      <p className="t-helper" style={{ margin: "0 0 var(--space-3)" }}>{subtitle}</p>
      {children}
    </section>
  );
}

function PayloadResource({ r }: { r: A2pPayloadResource }) {
  return (
    <div className="adm-phone-card">
      <div className="adm-phone-card-head">
        <span style={{ fontWeight: 700 }}>{r.step}</span>
      </div>
      <dl className="adm-rows">
        {r.fields.map((field, idx) => (
          <Row key={`${field.label}-${idx}`} label={field.label}>
            <span className="t-small">{field.value}</span>
          </Row>
        ))}
      </dl>
    </div>
  );
}

function IncludedSenderCard({ sender }: { sender: A2pIncludedSender }) {
  return (
    <div className="adm-phone-card">
      <div className="adm-phone-card-head">
        <span className="t-mono" style={{ fontWeight: 700 }}>{sender.phoneNumber}</span>
        <Badge tone="success">Included</Badge>
      </div>
      <dl className="adm-rows">
        <Row label="PN SID">
          {sender.twilioPhoneNumberSid ? <span className="t-mono">{sender.twilioPhoneNumberSid}</span> : <Muted>Missing</Muted>}
        </Row>
        <Row label="Included in this submission">
          <Badge tone={sender.includedInSubmission ? "success" : "neutral"}>
            {sender.includedInSubmission ? "Yes" : "No"}
          </Badge>
        </Row>
      </dl>
    </div>
  );
}

function NumberDiagnosticCard({ n }: { n: A2pReviewNumber }) {
  const tone: Tone = n.coverageDisplay === "covered" ? "success" : "warning";
  return (
    <div className="adm-phone-card">
      <div className="adm-phone-card-head">
        <span className="t-mono" style={{ fontWeight: 700 }}>{n.phoneNumber}</span>
        <Badge tone={tone}>{COVERAGE_LABEL[n.coverageDisplay]}</Badge>
      </div>
      <dl className="adm-rows">
        <Row label="PN SID">{n.twilioPhoneNumberSid ? <span className="t-mono">{n.twilioPhoneNumberSid}</span> : <Muted>Missing</Muted>}</Row>
        <Row label="Messaging Service sender status">{humanizeToken(n.messagingServiceSenderStatus)}</Row>
        <Row label="A2P campaign coverage">{humanizeToken(n.a2pCampaignCoverageStatus)}</Row>
        <Row label="Current coverage">{COVERAGE_LABEL[n.coverageDisplay]}</Row>
        <Row label="Eligible for live SMS">
          <Badge tone={n.eligibleForLiveSms ? "success" : "warning"}>{n.eligibleForLiveSms ? "Yes" : "No"}</Badge>
        </Row>
        <Row label="Blocking reason">{n.blockingReason ? humanizeToken(n.blockingReason) : <Muted>None</Muted>}</Row>
        <Row label="Last synced">{fmtDateTime(n.lastSyncedAt)}</Row>
      </dl>
    </div>
  );
}

function statusLine(sid: string, status: string | null) {
  return (
    <span>
      <span className="t-mono">{sid}</span>
      {status && <Badge tone={status.toLowerCase().includes("approv") ? "success" : "info"}>{humanizeToken(status)}</Badge>}
    </span>
  );
}

function DisabledSubmit({ reason }: { reason: string }) {
  return (
    <div className="adm-blocked" role="note">
      <button type="button" className="btn btn-secondary btn-sm" disabled aria-disabled="true">Submit for A2P review</button>
      <span className="t-small" style={{ color: "var(--text-muted)" }}>{reason}</span>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--text-muted)" }}>{children}</span>;
}
