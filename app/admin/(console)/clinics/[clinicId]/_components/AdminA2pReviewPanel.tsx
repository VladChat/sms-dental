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
  failed: "Failed",
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
  live: "Live (not implemented)",
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
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runReadinessSync() {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/sms-readiness/sync`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? "Could not run readiness sync.");
        return;
      }
      setMessage("Read-only readiness sync complete. Coverage status refreshed below.");
      router.refresh();
    } catch {
      setError("Could not run readiness sync.");
    } finally {
      setSyncing(false);
    }
  }

  async function submitForReview() {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/a2p/submit`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? "Could not record the A2P review.");
        return;
      }
      setMessage(json.message ?? "Recorded a dry-run review.");
      router.refresh();
    } catch {
      setError("Could not record the A2P review.");
    } finally {
      setSubmitting(false);
    }
  }

  const b = pkg.business;
  const rep = pkg.representative;
  const cr = pkg.clinicReadiness;
  const sub = pkg.submission;

  return (
    <div>
      <div className="adm-section-head">
        <h2 className="t-h3">A2P / 10DLC approval review</h2>
        <Badge tone={reviewStatusTone(pkg.reviewStatus)}>
          {REVIEW_STATUS_LABEL[pkg.reviewStatus] ?? humanizeToken(pkg.reviewStatus)}
        </Badge>
      </div>
      <p className="t-helper" style={{ margin: "var(--space-1) 0 var(--space-4)" }}>
        Platform-admin review of the exact A2P/10DLC package for this clinic and its local
        Twilio numbers. The clinic owner enters this information; only a platform admin reviews
        and submits it. Submitting here is review-only — it never sends SMS and never changes
        Twilio.
      </p>

      {/* Mode / real-submission status */}
      <dl className="adm-rows">
        <Row label="Submission mode">
          <Badge tone={pkg.submissionMode === "disabled" ? "neutral" : "info"}>
            {MODE_LABEL[pkg.submissionMode] ?? humanizeToken(pkg.submissionMode)}
          </Badge>
        </Row>
        <Row label="Real Twilio A2P submission">
          <Badge tone="neutral">{pkg.realSubmissionEnabled ? "Enabled" : "Disabled"}</Badge>
        </Row>
      </dl>

      {(message || error) && (
        <div className={`alert ${error ? "alert-error" : "alert-success"}`} role="status" aria-live="polite" style={{ marginTop: "var(--space-3)" }}>
          <span>{error ?? message}</span>
        </div>
      )}

      {/* Readiness unavailable hard-stop notice */}
      {!pkg.readinessAvailable && (
        <div className="adm-banner tone-warning" role="status" style={{ marginTop: "var(--space-3)" }}>
          <div className="adm-banner-main">
            <span className="adm-banner-title">SMS readiness data unavailable</span>
            <span className="adm-banner-body">
              The readiness tables are not reachable (the additive migration may not be applied).
              Per-number coverage cannot be confirmed, so submission and SMS enablement stay blocked.
            </span>
          </div>
        </div>
      )}

      {/* Business identity / packet */}
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

      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Campaign &amp; service</h3>
      <dl className="adm-rows">
        <Row label="Messaging Service SID">
          {pkg.messagingServiceSid ? <span className="t-mono">{pkg.messagingServiceSid}</span> : <Muted>Not configured</Muted>}
        </Row>
        <Row label="Messaging Service status">{cr ? humanizeToken(cr.messagingServiceStatus) : <Muted>Not synced</Muted>}</Row>
        <Row label="A2P brand status">{cr ? humanizeToken(cr.brandStatus) : <Muted>Not synced</Muted>}</Row>
        <Row label="A2P campaign status">{cr ? humanizeToken(cr.campaignStatus) : <Muted>Not synced</Muted>}</Row>
        <Row label="Overall A2P status">{cr ? humanizeToken(cr.a2pStatus) : <Muted>Not synced</Muted>}</Row>
        <Row label="Last readiness sync">{fmtDateTime(cr?.lastSyncedAt ?? null)}</Row>
        {pkg.urls.businessPage && (
          <Row label="Compliance pages">
            <a className="link" href={pkg.urls.businessPage} target="_blank" rel="noreferrer noopener">Business</a>{" · "}
            <a className="link" href={pkg.urls.privacyPolicy ?? "#"} target="_blank" rel="noreferrer noopener">Privacy</a>{" · "}
            <a className="link" href={pkg.urls.smsTerms ?? "#"} target="_blank" rel="noreferrer noopener">SMS terms</a>
          </Row>
        )}
      </dl>

      {/* Per-number coverage — explicit for every active number */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Numbers &amp; coverage</h3>
      <p className="t-helper" style={{ margin: "var(--space-1) 0 var(--space-3)" }}>
        Each active local number is shown with its current Messaging Service sender coverage and
        A2P campaign coverage. A number is marked “Approved / covered” only when readiness confirms
        verified service, campaign, and per-number coverage.
      </p>
      {pkg.numbers.length === 0 ? (
        <p className="t-body"><Muted>No active SMS numbers on file for this clinic.</Muted></p>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          {pkg.numbers.map((n) => (
            <NumberCard key={n.twilioPhoneNumberSid ?? n.phoneNumber} n={n} />
          ))}
        </div>
      )}

      {/* Missing fields checklist */}
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

      {/* Warnings */}
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

      {/* Submission status */}
      <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Submission status</h3>
      <dl className="adm-rows">
        <Row label="Local status">
          <Badge tone={reviewStatusTone(sub.status ?? pkg.reviewStatus)}>
            {REVIEW_STATUS_LABEL[sub.status ?? pkg.reviewStatus] ?? humanizeToken(sub.status ?? pkg.reviewStatus)}
          </Badge>
        </Row>
        <Row label="Tracking table">
          {sub.trackingAvailable ? <Badge tone="success">Available</Badge> : <Badge tone="warning">Unavailable (migration pending)</Badge>}
        </Row>
        <Row label="Last reviewed/submitted">{fmtDateTime(sub.submittedAt)}</Row>
        {sub.submittedByEmail && <Row label="By"><span className="t-mono">{sub.submittedByEmail}</span></Row>}
        {sub.brandRegistrationSid && <Row label="Brand registration SID"><span className="t-mono">{sub.brandRegistrationSid}</span></Row>}
        {sub.campaignSid && <Row label="Campaign SID"><span className="t-mono">{sub.campaignSid}</span></Row>}
        {sub.rejectionReason && <Row label="Rejection reason">{sub.rejectionReason}</Row>}
        {sub.lastErrorCode && <Row label="Last error">{humanizeToken(sub.lastErrorCode)}</Row>}
      </dl>

      {/* Actions */}
      <div style={{ marginTop: "var(--space-5)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
        <button type="button" className="btn btn-secondary btn-sm" disabled={syncing} onClick={runReadinessSync}>
          {syncing ? "Checking…" : "Run read-only readiness sync"}
        </button>

        {pkg.submitEligible ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={submitting} onClick={submitForReview}>
            {submitting ? "Recording…" : "Submit for A2P review (dry run)"}
          </button>
        ) : (
          <div className="adm-blocked" role="note">
            <button type="button" className="btn btn-secondary btn-sm" disabled aria-disabled="true">
              Submit for A2P review
            </button>
            <span className="t-small" style={{ color: "var(--text-muted)" }}>
              {pkg.submitBlockedReason ?? "Not eligible for submission yet."}
            </span>
          </div>
        )}
      </div>
      <p className="t-helper" style={{ margin: "var(--space-3) 0 0", color: "var(--text-muted)" }}>
        Real Twilio A2P submission is disabled. In dry-run mode, submitting records that the package
        was reviewed and is ready for manual submission in the Twilio console. It does not submit a
        registration, does not change Twilio, and does not enable patient SMS.
      </p>
    </div>
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

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--text-muted)" }}>{children}</span>;
}
