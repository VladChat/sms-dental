"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Row, humanizeToken } from "../../../_components/AdminUI";
import type {
  A2pPayloadResource,
  A2pReviewNumber,
  A2pReviewPackage,
  NumberCoverageDisplay,
} from "../../../../../../lib/a2p/types";

type Tone = "success" | "neutral" | "warning" | "info" | "brand";

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

// Per-number coverage → label + tone. ONLY "covered" reads as approved/covered.
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
const coverageTone = (d: NumberCoverageDisplay): Tone => (d === "covered" ? "success" : "warning");

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
    setSyncing(true); setMessage(null); setError(null);
    const r = await post(`/api/admin/clinics/${clinicId}/sms-readiness/sync`, "Could not run readiness sync.");
    if (r.ok) { setMessage("Read-only readiness sync complete."); router.refresh(); } else setError(r.message);
    setSyncing(false);
  }
  async function refreshProviderStatus() {
    setRefreshing(true); setMessage(null); setError(null);
    const r = await post(`/api/admin/clinics/${clinicId}/a2p/status`, "Could not refresh A2P provider status.");
    if (r.ok) { setMessage("Read-only A2P provider status refreshed."); router.refresh(); } else setError(r.message);
    setRefreshing(false);
  }
  async function submit() {
    setSubmitting(true); setMessage(null); setError(null);
    const r = await post(`/api/admin/clinics/${clinicId}/a2p/submit`, "Could not record the A2P submission.");
    if (r.ok) { setMessage(r.message); setConfirmLive(false); router.refresh(); } else setError(r.message);
    setSubmitting(false);
  }

  const sub = pkg.submission;
  const status = sub.status;
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const isResume = status === "pending" || status === "submitted" || status === "failed";
  const isLive = pkg.submissionMode === "live";
  const isDryRun = pkg.submissionMode === "dry_run";

  const canSubmitNow =
    !isApproved && !isRejected && pkg.submissionMode !== "disabled" && pkg.submitEligible &&
    (isDryRun || (isLive && pkg.liveSubmitArmed));

  const mainBlocker = isApproved
    ? "Already approved — no submission needed."
    : isRejected
      ? "Previous submission rejected — operator review required."
      : pkg.submissionMode === "disabled"
        ? "A2P submission is disabled in this environment."
        : !pkg.submitEligible
          ? pkg.submitBlockedReason
          : isLive && !pkg.liveSubmitArmed
            ? pkg.liveSubmitBlockedReason
            : null;

  const nextAction = canSubmitNow
    ? isLive
      ? "Review the payload below, tick the authorization checkbox, then click “Submit to Twilio for A2P Review”."
      : "Click “Submit for A2P review (dry run)” to record a review (no Twilio change)."
    : isApproved
      ? "Run the readiness sync to confirm per-number coverage, then (separately) enable SMS."
      : mainBlocker ?? "Resolve the blocker above.";

  return (
    <div>
      <div className="adm-section-head">
        <h2 className="t-h3">A2P / 10DLC approval review</h2>
        <Badge tone={reviewStatusTone(pkg.reviewStatus)}>
          {REVIEW_STATUS_LABEL[pkg.reviewStatus] ?? humanizeToken(pkg.reviewStatus)}
        </Badge>
      </div>
      <p className="t-helper" style={{ margin: "var(--space-1) 0 var(--space-2)" }}>
        Platform-admin only. The clinic owner enters this information; you review the minimal package
        below and submit. Submit is never a blind action.
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

      {/* ---- Top summary ---- */}
      <dl className="adm-rows">
        <Row label="Can submit now">
          <Badge tone={canSubmitNow ? "success" : "warning"}>{canSubmitNow ? "Yes" : "No"}</Badge>
        </Row>
        <Row label="Mode">
          <Badge tone={pkg.submissionMode === "disabled" ? "neutral" : isLive ? "brand" : "info"}>
            {MODE_LABEL[pkg.submissionMode] ?? humanizeToken(pkg.submissionMode)}
          </Badge>
        </Row>
        <Row label="Main blocker">{mainBlocker ? <span style={{ color: "var(--warning)" }}>{mainBlocker}</span> : "None"}</Row>
        <Row label="Next action">{nextAction}</Row>
      </dl>

      {(message || error) && (
        <div className={`alert ${error ? "alert-error" : "alert-success"}`} role="status" aria-live="polite" style={{ marginTop: "var(--space-3)" }}>
          <span>{error ?? message}</span>
        </div>
      )}

      {/* ---- Submit action ---- */}
      <div style={{ marginTop: "var(--space-4)" }}>
        {isApproved ? (
          <p className="t-body"><Badge tone="success">Approved / covered</Badge> A2P registration is approved. No further submission is required.</p>
        ) : isRejected ? (
          <div className="adm-blocked" role="note">
            <Badge tone="warning">Rejected</Badge>
            <span className="t-small" style={{ color: "var(--text-muted)" }}>
              {sub.rejectionReason ?? "A previous submission was rejected."} Operator review is required before resubmitting.
            </span>
          </div>
        ) : pkg.submissionMode === "disabled" || !pkg.submitEligible ? (
          <DisabledSubmit reason={mainBlocker ?? "Not eligible for submission yet."} />
        ) : isDryRun ? (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={submitting} onClick={submit}>
              {submitting ? "Recording…" : "Submit for A2P review (dry run)"}
            </button>
            <p className="t-helper" style={{ margin: "var(--space-2) 0 0", color: "var(--text-muted)" }}>
              Dry-run mode: records a reviewed status. No Twilio submission, no SMS, no provider change.
            </p>
          </>
        ) : isLive && pkg.liveSubmitArmed ? (
          <>
            <label className="t-small" style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start", maxWidth: 640 }}>
              <input type="checkbox" checked={confirmLive} onChange={(e) => setConfirmLive(e.target.checked)} style={{ marginTop: 3 }} />
              <span>I have reviewed “What will be submitted to Twilio” below and authorize a <strong>real</strong> A2P submission for this clinic. This creates billable, externally-vetted Twilio resources.</span>
            </label>
            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: "var(--space-3)" }} disabled={submitting || !confirmLive} onClick={submit}>
              {submitting ? "Submitting…" : isResume ? "Resume A2P submission" : "Submit to Twilio for A2P Review"}
            </button>
            <p className="t-helper" style={{ margin: "var(--space-2) 0 0", color: "var(--text-muted)" }}>
              Runs every currently-allowed Twilio step and stops at any async approval point. Never enables patient SMS. Re-click to resume after approval.
            </p>
          </>
        ) : (
          <DisabledSubmit reason={pkg.liveSubmitBlockedReason ?? "Real submission is not armed for this clinic."} />
        )}
      </div>

      {!pkg.readinessAvailable && (
        <div className="adm-banner tone-warning" role="status" style={{ marginTop: "var(--space-3)" }}>
          <div className="adm-banner-main">
            <span className="adm-banner-title">SMS readiness data unavailable</span>
            <span className="adm-banner-body">Per-number coverage cannot be confirmed; submission and SMS enablement stay blocked.</span>
          </div>
        </div>
      )}

      {/* ---- What will be submitted to Twilio ---- */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 var(--space-1)" }}>What will be submitted to Twilio</h3>
      <p className="t-helper" style={{ margin: "0 0 var(--space-2)" }}>
        Minimal required payload only. Optional provider fields are omitted; internal diagnostics are not submitted.
      </p>
      {pkg.providerPayload.resources.length === 0 ? (
        <p className="t-body"><Muted>Nothing to submit yet.</Muted></p>
      ) : (
        pkg.providerPayload.resources.map((r) => <PayloadResource key={r.step} r={r} />)
      )}

      {/* ---- Required information ---- */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Required information</h3>
      {pkg.missingFields.length === 0 ? (
        <p className="t-body"><Badge tone="success">Complete</Badge> All required A2P fields are present.</p>
      ) : (
        <ul className="t-body" style={{ margin: "var(--space-2) 0 0", paddingLeft: "var(--space-5)" }}>
          {pkg.missingFields.map((f) => (
            <li key={f.key} style={{ color: "var(--warning)", fontWeight: 600 }}>{f.label}</li>
          ))}
        </ul>
      )}

      {/* ---- Numbers included ---- */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Numbers included</h3>
      {pkg.numbers.length === 0 ? (
        <p className="t-body"><Muted>No active SMS numbers on file for this clinic.</Muted></p>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          {pkg.numbers.map((n) => <NumberCard key={n.twilioPhoneNumberSid ?? n.phoneNumber} n={n} />)}
        </div>
      )}

      {/* ---- Internal diagnostics (collapsed) ---- */}
      <details className="adm-fold" style={{ marginTop: "var(--space-5)" }}>
        <summary>Internal diagnostics (not submitted to Twilio)</summary>

        <dl className="adm-rows" style={{ marginTop: "var(--space-2)" }}>
          <Row label="Real submission (platform)"><Badge tone={pkg.realSubmissionEnabled ? "info" : "neutral"}>{pkg.realSubmissionEnabled ? "Enabled" : "Disabled"}</Badge></Row>
          <Row label="Live armed for this clinic">{pkg.liveSubmitArmed ? <Badge tone="success">Armed</Badge> : <Badge tone="neutral">Not armed</Badge>}</Row>
          <Row label="Messaging Service status">{pkg.clinicReadiness ? humanizeToken(pkg.clinicReadiness.messagingServiceStatus) : <Muted>Not synced</Muted>}</Row>
          <Row label="A2P brand status">{pkg.clinicReadiness ? humanizeToken(pkg.clinicReadiness.brandStatus) : <Muted>Not synced</Muted>}</Row>
          <Row label="A2P campaign status">{pkg.clinicReadiness ? humanizeToken(pkg.clinicReadiness.campaignStatus) : <Muted>Not synced</Muted>}</Row>
          <Row label="Last readiness sync">{fmtDateTime(pkg.clinicReadiness?.lastSyncedAt ?? null)}</Row>
          <Row label="Local submission status"><Badge tone={reviewStatusTone(status ?? pkg.reviewStatus)}>{REVIEW_STATUS_LABEL[status ?? pkg.reviewStatus] ?? humanizeToken(status ?? pkg.reviewStatus)}</Badge></Row>
          {sub.submissionStep && <Row label="Current step">{humanizeToken(sub.submissionStep)}</Row>}
          <Row label="Last submitted/updated">{fmtDateTime(sub.submittedAt)}</Row>
          {sub.customerProfileSid && <Row label="Customer Profile">{statusLine(sub.customerProfileSid, sub.customerProfileStatus)}</Row>}
          {sub.trustProductSid && <Row label="A2P Trust Product">{statusLine(sub.trustProductSid, sub.trustProductStatus)}</Row>}
          {sub.brandRegistrationSid && <Row label="Brand Registration">{statusLine(sub.brandRegistrationSid, sub.brandStatus)}</Row>}
          {sub.campaignSid && <Row label="A2P Campaign">{statusLine(sub.campaignSid, sub.campaignStatus)}</Row>}
          {sub.lastErrorCode && <Row label="Last error">{humanizeToken(sub.lastErrorCode)}</Row>}
        </dl>

        <h4 className="adm-subhead" style={{ margin: "var(--space-3) 0 0" }}>Planned Twilio resources</h4>
        <dl className="adm-rows">
          {pkg.plannedResources.map((r) => (
            <Row key={r.key} label={r.label}>
              {r.reuseSid ? <span><Badge tone="success">Reuse</Badge> <span className="t-mono">{r.reuseSid}</span></span> : <Badge tone="info">{r.willCreate ? "Will create" : "—"}</Badge>}
            </Row>
          ))}
        </dl>

        {pkg.urls.businessPage && (
          <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
            Compliance pages (internal context — not submitted):{" "}
            <a className="link" href={pkg.urls.businessPage} target="_blank" rel="noreferrer noopener">Business</a>{" · "}
            <a className="link" href={pkg.urls.privacyPolicy ?? "#"} target="_blank" rel="noreferrer noopener">Privacy</a>{" · "}
            <a className="link" href={pkg.urls.smsTerms ?? "#"} target="_blank" rel="noreferrer noopener">SMS terms</a>
          </p>
        )}

        {pkg.feesRiskNotice.length > 0 && (
          <>
            <h4 className="adm-subhead" style={{ margin: "var(--space-3) 0 0" }}>Fees &amp; risk</h4>
            <ul className="t-small" style={{ margin: "var(--space-1) 0 0", paddingLeft: "var(--space-5)", color: "var(--text-secondary)" }}>
              {pkg.feesRiskNotice.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </>
        )}

        {pkg.warnings.length > 0 && (
          <>
            <h4 className="adm-subhead" style={{ margin: "var(--space-3) 0 0" }}>Warnings</h4>
            <ul className="t-small" style={{ margin: "var(--space-1) 0 0", paddingLeft: "var(--space-5)", color: "var(--text-secondary)" }}>
              {pkg.warnings.map((w, i) => <li key={i}>{w}</li>)}
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
      </details>
    </div>
  );
}

function PayloadResource({ r }: { r: A2pPayloadResource }) {
  return (
    <div className="adm-phone-card" style={{ marginBottom: "var(--space-2)" }}>
      <div className="adm-phone-card-head"><span style={{ fontWeight: 700 }}>{r.step}</span></div>
      <dl className="adm-rows">
        {r.fields.map((f, i) => (
          <Row key={`${f.label}-${i}`} label={f.label}>
            <span className="t-small">{f.value}</span>
          </Row>
        ))}
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

function NumberCard({ n }: { n: A2pReviewNumber }) {
  return (
    <div className="adm-phone-card">
      <div className="adm-phone-card-head">
        <span className="t-mono" style={{ fontWeight: 700 }}>{n.phoneNumber}</span>
        <Badge tone={coverageTone(n.coverageDisplay)}>{COVERAGE_LABEL[n.coverageDisplay]}</Badge>
      </div>
      <dl className="adm-rows">
        <Row label="PN SID">{n.twilioPhoneNumberSid ? <span className="t-mono">{n.twilioPhoneNumberSid}</span> : <Muted>Missing</Muted>}</Row>
        <Row label="Included in this submission"><Badge tone="success">Yes</Badge></Row>
        <Row label="Current coverage">{COVERAGE_LABEL[n.coverageDisplay]}</Row>
      </dl>
    </div>
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
