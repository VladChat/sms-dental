"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Row, humanizeToken } from "../../../_components/AdminUI";
import type {
  A2pReviewNumber,
  A2pReviewPackage,
  NumberCoverageDisplay,
} from "../../../../../../lib/a2p/types";

type Tone = "success" | "neutral" | "warning" | "info" | "brand";

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

// Per-number coverage → operator label + tone. ONLY "covered" is presented as
// approved/covered. Everything else is "Not approved yet" / "Not covered yet".
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

function coverageTone(display: NumberCoverageDisplay): Tone {
  return display === "covered" ? "success" : "warning";
}

const REVIEW_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready_for_review: "Ready for review",
  missing_info: "Missing information",
  submit_disabled: "Submission disabled",
  readiness_unavailable: "SMS readiness data unavailable",
  dry_run_reviewed: "Reviewed (dry run) — ready for manual submission",
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

export function AdminA2pReviewPanel({
  pkg,
  clinicId,
}: {
  pkg: A2pReviewPackage;
  clinicId: string;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  type PostResult = { ok: boolean; message: string };
  async function post(path: string, fallbackError: string): Promise<PostResult> {
    try {
      const res = await fetch(path, { method: "POST", credentials: "include" });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; nextAction?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        return { ok: false, message: json?.error?.message ?? fallbackError };
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
      setMessage("Read-only readiness sync complete. Coverage status refreshed below.");
      router.refresh();
    } else setError(r.message);
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
    } else setError(r.message);
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
    } else setError(r.message);
    setSubmitting(false);
  }

  const b = pkg.business;
  const rep = pkg.representative;
  const cr = pkg.clinicReadiness;
  const sub = pkg.submission;
  const c = pkg.campaign;

  const isLive = pkg.submissionMode === "live";
  const isDryRun = pkg.submissionMode === "dry_run";
  const status = sub.status;
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const isResume = status === "pending" || status === "submitted" || status === "failed";

  return (
    <div>
      <div className="adm-section-head">
        <h2 className="t-h3">A2P / 10DLC approval review</h2>
        <Badge tone={reviewStatusTone(pkg.reviewStatus)}>
          {REVIEW_STATUS_LABEL[pkg.reviewStatus] ?? humanizeToken(pkg.reviewStatus)}
        </Badge>
      </div>
      <p className="t-helper" style={{ margin: "var(--space-1) 0 var(--space-4)" }}>
        Platform-admin review of the exact A2P/10DLC package for this clinic and its local Twilio
        numbers. The clinic owner enters this information; only a platform admin reviews and submits
        it. Review the full package below before clicking Submit — submit is never a blind action.
      </p>

      <dl className="adm-rows">
        <Row label="Submission mode">
          <Badge tone={pkg.submissionMode === "disabled" ? "neutral" : isLive ? "brand" : "info"}>
            {MODE_LABEL[pkg.submissionMode] ?? humanizeToken(pkg.submissionMode)}
          </Badge>
        </Row>
        <Row label="Real Twilio A2P submission">
          <Badge tone={pkg.realSubmissionEnabled ? "info" : "neutral"}>
            {pkg.realSubmissionEnabled ? "Enabled (platform)" : "Disabled"}
          </Badge>
        </Row>
        <Row label="Live submit armed for this clinic">
          {pkg.liveSubmitArmed ? (
            <Badge tone="success">Armed</Badge>
          ) : (
            <>
              <Badge tone="neutral">Not armed</Badge>
              {pkg.liveSubmitBlockedReason && (
                <span className="t-small" style={{ color: "var(--text-muted)", marginLeft: "var(--space-2)" }}>
                  {pkg.liveSubmitBlockedReason}
                </span>
              )}
            </>
          )}
        </Row>
      </dl>

      {(message || error) && (
        <div className={`alert ${error ? "alert-error" : "alert-success"}`} role="status" aria-live="polite" style={{ marginTop: "var(--space-3)" }}>
          <span>{error ?? message}</span>
        </div>
      )}

      {!pkg.readinessAvailable && (
        <div className="adm-banner tone-warning" role="status" style={{ marginTop: "var(--space-3)" }}>
          <div className="adm-banner-main">
            <span className="adm-banner-title">SMS readiness data unavailable</span>
            <span className="adm-banner-body">
              The readiness tables are not reachable. Per-number coverage cannot be confirmed, so
              submission and SMS enablement stay blocked.
            </span>
          </div>
        </div>
      )}

      {/* Business identity */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Business identity</h3>
      <dl className="adm-rows">
        <Row label="Legal business name">{b.legalBusinessName ?? <Muted>Missing</Muted>}</Row>
        <Row label="Business type">{b.businessTypeLabel ?? (b.businessType ? humanizeToken(b.businessType) : <Muted>Missing</Muted>)}</Row>
        <Row label="EIN / Tax ID">
          {b.einProvided ? <span className="t-mono">Provided ··· {b.einLast4 ?? "••••"}</span> : <Muted>Missing</Muted>}
        </Row>
        <Row label="Business address">{b.addressLine ?? <Muted>Missing</Muted>}</Row>
        <Row label="Main office phone">{b.mainPhone ? <span className="t-mono">{b.mainPhone}</span> : <Muted>Missing</Muted>}</Row>
        <Row label="Website">
          {b.website ? <a className="link" href={b.website} target="_blank" rel="noreferrer noopener">{b.website}</a> : <Muted>Not provided</Muted>}
        </Row>
      </dl>

      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Authorized representative</h3>
      <dl className="adm-rows">
        <Row label="Name">{[rep.firstName, rep.lastName].filter(Boolean).join(" ") || <Muted>Missing</Muted>}</Row>
        <Row label="Title">{rep.title ?? <Muted>—</Muted>}</Row>
        <Row label="Email">{rep.email ? <span className="t-mono">{rep.email}</span> : <Muted>Missing</Muted>}</Row>
        <Row label="Phone">{rep.phone ? <span className="t-mono">{rep.phone}</span> : <Muted>Missing</Muted>}</Row>
        <Row label="Authorized">{rep.authorized ? <Badge tone="success">Yes</Badge> : <Badge tone="warning">No</Badge>}</Row>
      </dl>

      {/* Use case + campaign content */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Use case &amp; campaign content</h3>
      <dl className="adm-rows">
        <Row label="Use case">{c.usecase}</Row>
        <Row label="Messaging Service SID">
          {pkg.messagingServiceSid ? <span className="t-mono">{pkg.messagingServiceSid}</span> : <Muted>Not configured</Muted>}
        </Row>
        <Row label="Campaign description">{c.description}</Row>
        <Row label="Opt-in / consent">{c.messageFlow}</Row>
        <Row label="STOP / HELP">{c.stopHelpStatement}</Row>
        <Row label="Embedded links / phone">{c.hasEmbeddedLinks ? "Links: yes" : "Links: no"} · {c.hasEmbeddedPhone ? "Phone: yes" : "Phone: no"}</Row>
      </dl>
      <p className="t-small" style={{ margin: "var(--space-2) 0 0", color: "var(--text-secondary)" }}>Sample messages submitted to Twilio:</p>
      <ul className="t-small" style={{ margin: "var(--space-1) 0 0", paddingLeft: "var(--space-5)" }}>
        {c.sampleMessages.map((m, i) => (
          <li key={i} style={{ marginBottom: "var(--space-1)" }}>“{m}”</li>
        ))}
      </ul>
      {pkg.urls.businessPage && (
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Compliance pages:{" "}
          <a className="link" href={pkg.urls.businessPage} target="_blank" rel="noreferrer noopener">Business</a>{" · "}
          <a className="link" href={pkg.urls.privacyPolicy ?? "#"} target="_blank" rel="noreferrer noopener">Privacy</a>{" · "}
          <a className="link" href={pkg.urls.smsTerms ?? "#"} target="_blank" rel="noreferrer noopener">SMS terms</a>
        </p>
      )}

      {/* Readiness summary */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Provider readiness</h3>
      <dl className="adm-rows">
        <Row label="Messaging Service status">{cr ? humanizeToken(cr.messagingServiceStatus) : <Muted>Not synced</Muted>}</Row>
        <Row label="A2P brand status">{cr ? humanizeToken(cr.brandStatus) : <Muted>Not synced</Muted>}</Row>
        <Row label="A2P campaign status">{cr ? humanizeToken(cr.campaignStatus) : <Muted>Not synced</Muted>}</Row>
        <Row label="Last readiness sync">{fmtDateTime(cr?.lastSyncedAt ?? null)}</Row>
      </dl>

      {/* Per-number coverage */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Numbers &amp; coverage</h3>
      {pkg.numbers.length === 0 ? (
        <p className="t-body"><Muted>No active SMS numbers on file for this clinic.</Muted></p>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          {pkg.numbers.map((n) => (
            <NumberCard key={n.twilioPhoneNumberSid ?? n.phoneNumber} n={n} />
          ))}
        </div>
      )}

      {/* Planned Twilio resources */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Twilio resources this submit will create or reuse</h3>
      <dl className="adm-rows">
        {pkg.plannedResources.map((r) => (
          <Row key={r.key} label={r.label}>
            {r.reuseSid ? (
              <span><Badge tone="success">Reuse</Badge> <span className="t-mono">{r.reuseSid}</span></span>
            ) : (
              <Badge tone="info">{r.willCreate ? "Will create" : "—"}</Badge>
            )}
          </Row>
        ))}
      </dl>

      {/* Fees / risk */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Fees &amp; risk</h3>
      <ul className="t-small" style={{ margin: "var(--space-2) 0 0", paddingLeft: "var(--space-5)", color: "var(--text-secondary)" }}>
        {pkg.feesRiskNotice.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>

      {/* Required info checklist */}
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

      {pkg.warnings.length > 0 && (
        <>
          <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Warnings</h3>
          <ul className="t-small" style={{ margin: "var(--space-2) 0 0", paddingLeft: "var(--space-5)", color: "var(--text-secondary)" }}>
            {pkg.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </>
      )}

      {/* Submission status + resource SIDs */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Submission status</h3>
      <dl className="adm-rows">
        <Row label="Local status">
          <Badge tone={reviewStatusTone(status ?? pkg.reviewStatus)}>
            {REVIEW_STATUS_LABEL[status ?? pkg.reviewStatus] ?? humanizeToken(status ?? pkg.reviewStatus)}
          </Badge>
        </Row>
        {sub.submissionStep && <Row label="Current step">{humanizeToken(sub.submissionStep)}</Row>}
        <Row label="Tracking table">
          {sub.trackingAvailable ? <Badge tone="success">Available</Badge> : <Badge tone="warning">Unavailable (migration pending)</Badge>}
        </Row>
        <Row label="Last submitted/updated">{fmtDateTime(sub.submittedAt)}</Row>
        {sub.submittedByEmail && <Row label="By"><span className="t-mono">{sub.submittedByEmail}</span></Row>}
        {sub.customerProfileSid && <Row label="Customer Profile">{statusLine(sub.customerProfileSid, sub.customerProfileStatus)}</Row>}
        {sub.trustProductSid && <Row label="A2P Trust Product">{statusLine(sub.trustProductSid, sub.trustProductStatus)}</Row>}
        {sub.brandRegistrationSid && <Row label="Brand Registration">{statusLine(sub.brandRegistrationSid, sub.brandStatus)}</Row>}
        {sub.campaignSid && <Row label="A2P Campaign">{statusLine(sub.campaignSid, sub.campaignStatus)}</Row>}
        {sub.rejectionReason && <Row label="Rejection reason">{sub.rejectionReason}</Row>}
        {sub.lastErrorCode && <Row label="Last error">{humanizeToken(sub.lastErrorCode)}</Row>}
      </dl>

      {/* Actions */}
      <div style={{ marginTop: "var(--space-5)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
        <button type="button" className="btn btn-secondary btn-sm" disabled={syncing} onClick={runReadinessSync}>
          {syncing ? "Checking…" : "Run read-only readiness sync"}
        </button>
        {(sub.customerProfileSid || sub.brandRegistrationSid) && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing} onClick={refreshProviderStatus}>
            {refreshing ? "Refreshing…" : "Refresh A2P provider status"}
          </button>
        )}
      </div>

      {/* Submit area */}
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
        ) : pkg.submissionMode === "disabled" ? (
          <DisabledSubmit reason="A2P submission is disabled in this environment." />
        ) : !pkg.submitEligible ? (
          <DisabledSubmit reason={pkg.submitBlockedReason ?? "Not eligible for submission yet."} />
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
              <span>
                I have reviewed the complete package above and authorize a <strong>real</strong> Twilio
                A2P submission for this clinic. This creates billable, externally-vetted Twilio resources.
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
              Live mode runs every currently-allowed Twilio step and stops at any async approval point
              (e.g. brand vetting). It never enables patient SMS. Re-click to resume after approval.
            </p>
          </>
        ) : (
          <DisabledSubmit reason={pkg.liveSubmitBlockedReason ?? "Real submission is not armed for this clinic."} />
        )}
      </div>
    </div>
  );
}

function statusLine(sid: string, status: string | null) {
  return (
    <span>
      <span className="t-mono">{sid}</span>
      {status && <Badge tone={status.toLowerCase().includes("approv") || status === "twilio-approved" ? "success" : "info"}>{humanizeToken(status)}</Badge>}
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
        <Row label="Messaging Service sender">{humanizeToken(n.messagingServiceSenderStatus)}</Row>
        <Row label="A2P campaign coverage">{humanizeToken(n.a2pCampaignCoverageStatus)}</Row>
        <Row label="Eligible for live SMS">
          {n.eligibleForLiveSms ? <Badge tone="success">Yes</Badge> : <Badge tone="warning">No</Badge>}
        </Row>
        {n.blockingReason && <Row label="Blocking reason">{humanizeToken(n.blockingReason)}</Row>}
        <Row label="Last sync">{fmtDateTime(n.lastSyncedAt)}</Row>
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
