import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminClinicDetail } from "../../../../../lib/db/admin/clinics";
import { listAdminAuditEvents } from "../../../../../lib/db/admin/audit";
import { getClinicEvents } from "../../../../../lib/db/admin/events";
import { getAppDomainsSafe, getSmsRecoveryConfig } from "../../../../../lib/env";
import {
  Badge,
  BoolBadge,
  CheckRow,
  Row,
  billingStatusLabel,
  billingTone,
  describeAuditAction,
  humanizeToken,
  localNumberStatusLabel,
  setupStatusLabel,
  smsStatusLabel,
  smsStatusTone,
  type ReadyState,
} from "../../_components/AdminUI";
import { AdminClinicActions } from "./_components/AdminClinicActions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Tone = "success" | "neutral" | "warning" | "info" | "brand";

const PHONE_ROLE_LABELS: Record<string, string> = {
  office_texting: "Office texting",
};
function phoneRoleLabel(role: string): string {
  return PHONE_ROLE_LABELS[role] ?? humanizeToken(role);
}

const SMS_MODE_LABELS: Record<string, string> = {
  disabled: "Disabled",
  owner_test: "Owner test",
  live: "Live",
};

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}
function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export default async function AdminClinicDetailPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const d = await getAdminClinicDetail(clinicId).catch(() => null);

  if (!d) {
    return (
      <section className="card card-pad">
        <h1 className="t-h3">Clinic not found</h1>
        <p style={{ marginTop: "var(--space-4)" }}>
          <Link className="link" href="/admin/clinics">← Back to clinics</Link>
        </p>
      </section>
    );
  }

  // Read-only context. All queries are cross-tenant reads; nothing is mutated.
  const [activity, events] = await Promise.all([
    listAdminAuditEvents({ clinicId: d.id }, 5).catch(() => []),
    getClinicEvents(d.id, 5).catch(() => ({ calls: [], messages: [] })),
  ]);

  const smsMode = getSmsRecoveryConfig().mode; // mode only — never the allowlist
  const appBaseUrl = getAppDomainsSafe()?.appBaseUrl ?? "";

  // ---- derived launch gate (mirrors the server preconditions exactly) ----
  const launchBlockedReason = !d.isActive
    ? "Clinic is paused. Reactivate it before launching service."
    : !d.hasAssignedNumber
      ? "No phone number assigned. Assign a number before launching."
      : !d.a2pInfoCompleted
        ? "SMS approval information is not complete yet."
        : null;

  // ---- readiness states ----
  const businessState: ReadyState = d.businessInfoCompleted ? "ready" : "needs_action";
  const billingState: ReadyState = d.stripeCustomerPresent ? "ready" : "not_connected";
  const phoneState: ReadyState = d.hasAssignedNumber ? "ready" : "missing";
  const a2pState: ReadyState = d.a2pInfoCompleted && d.a2pAuthorized ? "ready" : "needs_action";

  const launch = launchStatus(d.smsRecoveryEnabled, launchBlockedReason);

  const missingBusiness = [
    d.legalBusinessName ? null : "legal name",
    d.businessType ? null : "business type",
    d.einProvided ? null : "EIN / Tax ID",
    d.street && d.city && d.postalCode ? null : "address",
  ].filter((x): x is string => Boolean(x));

  const ownerEmail = d.ownerContactEmail
    ?? d.members.find((m) => m.role === "owner")?.email
    ?? null;

  const addressParts = [d.street, d.addressLine2, d.city, d.stateRegion, d.postalCode, d.country]
    .filter((x) => x && x.trim().length > 0);

  const repName = [d.a2pRepFirstName, d.a2pRepLastName].filter(Boolean).join(" ").trim();

  // Compliance pages exist once the clinic has a public slug.
  const hasPublicPages = Boolean(d.slug && appBaseUrl);
  const publicBase = hasPublicPages ? `${appBaseUrl}/business/${d.slug}` : null;

  const recoveryTemplate = `Hi, this is ${d.name || "Your clinic"}. We missed your call. Would you like us to help schedule an appointment?`;

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      {/* Header + compact internal metadata */}
      <header className="adm-detail-head">
        <div>
          <p className="t-small"><Link className="link" href="/admin/clinics">← Clinics</Link></p>
          <h1 className="t-h2" style={{ marginTop: "var(--space-1)" }}>{d.name}</h1>
          <dl className="adm-meta" aria-label="Clinic metadata">
            <MetaItem label="Clinic ID"><span className="t-mono">{d.id}</span></MetaItem>
            <MetaItem label="Owner"><span className="t-mono">{ownerEmail ?? "—"}</span></MetaItem>
            <MetaItem label="Setup">{setupStatusLabel(d.setupStatus)}</MetaItem>
            <MetaItem label="Created">{fmtDate(d.createdAt)}</MetaItem>
            <MetaItem label="Updated">{fmtDate(d.updatedAt)}</MetaItem>
          </dl>
        </div>
        <div className="adm-detail-head-links">
          <Link className="btn btn-secondary btn-sm" href={`/admin/clinics/${d.id}/events`}>Diagnostics</Link>
          {hasPublicPages && publicBase && (
            <a className="btn btn-secondary btn-sm" href={publicBase} target="_blank" rel="noreferrer noopener">Public page</a>
          )}
        </div>
      </header>

      {/* Top status overview — exactly two axes, each shown once */}
      <section className="card card-pad">
        <h3 className="t-h4">Status overview</h3>
        <dl className="adm-rows">
          <Row label="Clinic status"><BoolBadge value={d.isActive} yes="Active" no="Paused" noTone="warning" /></Row>
          <Row label="Launch status"><Badge tone={launch.tone}>{launch.label}</Badge></Row>
        </dl>
        <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>{launch.detail}</p>
      </section>

      {/* Launch readiness — concise: each category once, no repeated launch badge */}
      <section className="card card-pad">
        <h3 className="t-h4">Launch readiness</h3>
        <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
          Each prerequisite once. Full detail is in the matching section below.
        </p>
        <div style={{ marginTop: "var(--space-3)" }}>
          <CheckRow
            title="Business profile"
            hint={businessState === "ready" ? "Business identity on file" : `Missing: ${missingBusiness.join(", ") || "required fields"}`}
            state={businessState}
          />
          <CheckRow
            title="Billing"
            hint={billingState === "ready" ? "Payment method on file" : "Stripe billing not connected — not required to launch in this MVP"}
            state={billingState}
          />
          <CheckRow
            title="Phone number"
            hint={phoneState === "ready" ? "At least one active number assigned" : "No active number assigned"}
            state={phoneState}
          />
          <CheckRow
            title="A2P / SMS approval"
            hint={a2pState === "ready" ? "Approval info complete and authorized" : "Approval info incomplete"}
            state={a2pState}
          />
        </div>
      </section>

      {/* ===== Owner-dashboard mirror sections (read-only superset) ===== */}

      {/* Phone numbers */}
      <section className="card card-pad">
        <h3 className="t-h4">Phone numbers</h3>
        {d.phoneNumbers.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
            No phone number assigned yet.
          </p>
        ) : (
          <div className="adm-phone-list">
            {d.phoneNumbers.map((p) => (
              <div className="adm-phone-card" key={p.id}>
                <div className="adm-phone-card-head">
                  <span className="t-mono" style={{ fontWeight: 700 }}>{p.phoneE164 ?? "—"}</span>
                  <span style={{ display: "inline-flex", gap: "var(--space-2)" }}>
                    <Badge tone="neutral">{phoneRoleLabel(p.role)}</Badge>
                    <BoolBadge value={p.isActive} yes="Active" no="Inactive" noTone="neutral" />
                  </span>
                </div>
                <dl className="adm-rows">
                  <Row label="Twilio number SID">{p.twilioSid ? <span className="t-mono">{p.twilioSid}</span> : <NotAvailable />}</Row>
                  <Row label="Assigned">{fmtDateTime(p.createdAt)}</Row>
                  <Row label="Last updated">{fmtDateTime(p.updatedAt)}</Row>
                </dl>
              </div>
            ))}
          </div>
        )}
        <dl className="adm-rows" style={{ marginTop: "var(--space-3)" }}>
          <Row label="Local number status">{localNumberStatusLabel(d.localNumberStatus)}</Row>
          <Row label="SMS recovery (clinic gate)"><BoolBadge value={d.smsRecoveryEnabled} yes="Enabled" no="Disabled" noTone="neutral" /></Row>
          <Row label="Global SMS mode">{SMS_MODE_LABELS[smsMode] ?? humanizeToken(smsMode)}</Row>
          <Row label="Voice & SMS webhooks">Configured at number provisioning (per-clinic webhook health is not separately tracked)</Row>
          {launchBlockedReason && <Row label="Current blocker">{launchBlockedReason}</Row>}
        </dl>
        <DisabledAction label="Add phone number" reason="Twilio purchase/assign backend required" />
      </section>

      {/* Business profile */}
      <section className="card card-pad">
        <h3 className="t-h4">Business profile</h3>
        <dl className="adm-rows">
          <Row label="Public clinic name">{d.name}</Row>
          <Row label="Legal business name">{d.legalBusinessName ?? <NotProvided />}</Row>
          <Row label="Business type">{d.businessType ? humanizeToken(d.businessType) : <NotProvided />}</Row>
          <Row label="Main office phone">{d.mainPhone ? <span className="t-mono">{d.mainPhone}</span> : <NotProvided />}</Row>
          <Row label="Address">{addressParts.length ? addressParts.join(", ") : <NotProvided />}</Row>
          <Row label="Timezone">{d.timezone ?? "—"}</Row>
          <Row label="Website">{d.website ? <a className="link" href={d.website} rel="noreferrer noopener" target="_blank">{d.website}</a> : <NotProvided />}</Row>
          <Row label="Owner contact name">{d.ownerContactName ?? <NotProvided />}</Row>
          <Row label="Owner contact phone">{d.ownerContactPhone ? <span className="t-mono">{d.ownerContactPhone}</span> : <NotProvided />}</Row>
          <Row label="Profile completeness"><BoolBadge value={d.businessInfoCompleted} yes="Complete" no="Incomplete" noTone="warning" /></Row>
          {!d.businessInfoCompleted && missingBusiness.length > 0 && (
            <Row label="Missing fields">{missingBusiness.join(", ")}</Row>
          )}
        </dl>
      </section>

      {/* A2P / SMS approval */}
      <section className="card card-pad">
        <h3 className="t-h4">A2P / SMS approval</h3>
        <dl className="adm-rows">
          <Row label="SMS status"><Badge tone={smsStatusTone(d.smsStatus)}>{smsStatusLabel(d.smsStatus)}</Badge></Row>
          <Row label="Approval info"><BoolBadge value={d.a2pInfoCompleted} yes="Complete" no="Incomplete" noTone="warning" /></Row>
          <Row label="Authorization"><BoolBadge value={d.a2pAuthorized} yes="Authorized" no="Not authorized" noTone="warning" /></Row>
          <Row label="Legal business name">{d.legalBusinessName ?? <NotProvided />}</Row>
          <Row label="EIN / Tax ID">{d.einTaxId ? <span className="t-mono">{d.einTaxId}</span> : <NotProvided />}</Row>
          <Row label="Business type">{d.businessType ? humanizeToken(d.businessType) : <NotProvided />}</Row>
          <Row label="Representative">{repName ? repName : <NotProvided />}</Row>
          <Row label="Rep title">{d.a2pRepBusinessTitle ?? "—"}</Row>
          <Row label="Rep email">{d.a2pRepEmail ? <span className="t-mono">{d.a2pRepEmail}</span> : <NotProvided />}</Row>
          <Row label="Rep phone">{d.a2pRepPhone ? <span className="t-mono">{d.a2pRepPhone}</span> : <NotProvided />}</Row>
        </dl>
        <h4 className="adm-subhead" style={{ margin: "var(--space-4) 0 0" }}>Carrier submission</h4>
        <dl className="adm-rows">
          <Row label="Submission status"><Badge tone="neutral">Not submitted</Badge></Row>
          <Row label="Submitted on"><NotAvailable /></Row>
          <Row label="Last status sync"><NotAvailable /></Row>
          <Row label="Twilio Brand SID"><NotAvailable /></Row>
          <Row label="Twilio Campaign SID"><NotAvailable /></Row>
          <Row label="Rejection / error reason"><NotAvailable /></Row>
        </dl>
        <p className="t-helper" style={{ marginTop: "var(--space-2)" }}>
          Carrier registration is not wired yet, so Brand/Campaign SIDs, submission date, and sync status are
          not stored. They will populate once the A2P submission backend is connected.
        </p>
        <DisabledAction label="Submit SMS approval" reason="A2P submission backend required" />
      </section>

      {/* Billing */}
      <section className="card card-pad">
        <h3 className="t-h4">Billing</h3>
        <dl className="adm-rows">
          <Row label="Billing status"><Badge tone={billingTone(d.billingStatus)}>{billingStatusLabel(d.billingStatus)}</Badge></Row>
          <Row label="Payment method"><BoolBadge value={d.stripeCustomerPresent} yes="On file" no="None" /></Row>
          <Row label="Subscription"><BoolBadge value={d.stripeSubscriptionPresent} yes="Present" no="None" /></Row>
          <Row label="Trial started">{fmtDate(d.trialStartedAt)}</Row>
          <Row label="Trial ends">{fmtDate(d.trialEndsAt)}</Row>
          <Row label="Stripe customer ID">{d.stripeCustomerId ? <span className="t-mono">{d.stripeCustomerId}</span> : <NotAvailable />}</Row>
          <Row label="Stripe subscription ID">{d.stripeSubscriptionId ? <span className="t-mono">{d.stripeSubscriptionId}</span> : <NotAvailable />}</Row>
        </dl>
        <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
          Billing backend not connected. Billing does not block launch in this MVP — billing starts only after
          SMS recovery is active.
        </p>
        <DisabledAction label="Manage billing" reason="Stripe billing backend required" />
      </section>

      {/* Public pages / compliance */}
      <section className="card card-pad">
        <h3 className="t-h4">Public pages &amp; compliance</h3>
        {hasPublicPages && publicBase ? (
          <>
            <ul className="adm-link-list">
              <li><a className="link" href={publicBase} target="_blank" rel="noreferrer noopener">Public business page</a></li>
              <li><a className="link" href={`${publicBase}/privacy`} target="_blank" rel="noreferrer noopener">Privacy page</a></li>
              <li><a className="link" href={`${publicBase}/sms-terms`} target="_blank" rel="noreferrer noopener">SMS terms page</a></li>
              <li><span style={{ color: "var(--text-muted)" }}>SMS consent — covered within the SMS terms page (no separate page)</span></li>
            </ul>
            <dl className="adm-rows" style={{ marginTop: "var(--space-3)" }}>
              <Row label="Generation status"><Badge tone="success">Generated</Badge></Row>
              <Row label="Profile completeness"><BoolBadge value={d.businessInfoCompleted} yes="Complete" no="Incomplete" noTone="warning" /></Row>
              <Row label="Approval info"><BoolBadge value={d.a2pInfoCompleted} yes="Complete" no="Incomplete" noTone="warning" /></Row>
            </dl>
          </>
        ) : (
          <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
            Not generated yet — the clinic has no public slug. Public/privacy/SMS-terms pages appear once the
            business profile is saved and a slug is assigned.
          </p>
        )}
      </section>

      {/* SMS behavior / settings (read-only) */}
      <section className="card card-pad">
        <h3 className="t-h4">SMS behavior</h3>
        <dl className="adm-rows">
          <Row label="First missed-call text"><span className="t-small">“{recoveryTemplate}”</span></Row>
          <Row label="Repeat caller">No repeat recovery text within 24 hours (duplicate suppression)</Row>
          <Row label="Opt-out (STOP)">STOP / STOPALL / UNSUBSCRIBE / CANCEL / END / QUIT → opt out; replies suppressed</Row>
          <Row label="Opt-in (START)">START / UNSTOP / YES → opt back in</Row>
          <Row label="Help (HELP)">HELP / INFO → help reply</Row>
          <Row label="SMS recovery (clinic gate)"><BoolBadge value={d.smsRecoveryEnabled} yes="Enabled" no="Disabled" noTone="neutral" /></Row>
          <Row label="Global SMS mode">{SMS_MODE_LABELS[smsMode] ?? humanizeToken(smsMode)}</Row>
        </dl>
        <p className="t-helper" style={{ marginTop: "var(--space-2)" }}>
          Disabled = nothing sends. Owner test = only allow-listed numbers receive texts. Live = sends for
          clinics whose gate is enabled. Templates are fixed in code; no per-clinic SMS settings backend yet.
        </p>
      </section>

      {/* ===== Admin-only sections ===== */}

      {/* Admin controls (working actions; confirmations via accessible dialog) */}
      <section className="card card-pad">
        <h3 className="t-h4">Admin controls</h3>
        <AdminClinicActions
          clinicId={d.id}
          isActive={d.isActive}
          smsRecoveryEnabled={d.smsRecoveryEnabled}
          adminInternalNote={d.adminInternalNote}
          launchBlockedReason={launchBlockedReason}
        />
      </section>

      {/* Diagnostics */}
      <section className="card card-pad">
        <h3 className="t-h4">Diagnostics</h3>
        <dl className="adm-rows">
          <Row label="Active opt-outs">{d.optOutCount}</Row>
          <Row label="Test patient number">{d.testPatientPhone ? <span className="t-mono">{d.testPatientPhone}</span> : <NotProvided />}</Row>
        </dl>

        <h4 className="adm-subhead" style={{ margin: "var(--space-4) 0 0" }}>Recent messages</h4>
        {events.messages.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>No recent messages.</p>
        ) : (
          <div className="adm-activity">
            {events.messages.map((m) => (
              <div className="adm-activity-item" key={m.id}>
                <span className="t-small">
                  {humanizeToken(m.direction)} · {m.status ? humanizeToken(m.status) : "—"}
                  {m.errored ? <Badge tone="warning">Error</Badge> : null}
                </span>
                <span className="t-helper" style={{ color: "var(--text-muted)" }}>
                  {m.sidTail ?? "—"} · {fmtDateTime(m.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}

        <h4 className="adm-subhead" style={{ margin: "var(--space-4) 0 0" }}>Recent calls</h4>
        {events.calls.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>No recent calls.</p>
        ) : (
          <div className="adm-activity">
            {events.calls.map((c) => (
              <div className="adm-activity-item" key={c.id}>
                <span className="t-small">
                  {c.direction ? humanizeToken(c.direction) : "Call"} · {c.callStatus ? humanizeToken(c.callStatus) : "—"}
                  {c.isMissed ? <Badge tone="warning">Missed</Badge> : null}
                </span>
                <span className="t-helper" style={{ color: "var(--text-muted)" }}>
                  {c.fromMasked ?? "—"} → {c.toMasked ?? "—"} · {fmtDateTime(c.occurredAt)}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="t-small" style={{ marginTop: "var(--space-3)" }}>
          <Link className="link" href={`/admin/clinics/${d.id}/events`}>Open full call / message diagnostics →</Link>
        </p>
        <p className="t-helper" style={{ marginTop: "var(--space-2)" }}>
          Caller numbers are masked. Webhook ingress is logged globally (not per clinic).
        </p>
      </section>

      {/* Recent admin activity (audit) */}
      <section className="card card-pad">
        <h3 className="t-h4">Recent admin activity</h3>
        <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
          Who changed what, and when — including internal-note updates.
        </p>
        {activity.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
            No admin actions recorded for this clinic yet.
          </p>
        ) : (
          <div className="adm-activity" style={{ marginTop: "var(--space-2)" }}>
            {activity.map((e) => (
              <div className="adm-activity-item" key={e.id}>
                <span className="t-small">{describeAuditAction(e.action)}</span>
                <span className="t-helper" style={{ color: "var(--text-muted)" }}>
                  {e.admin_email} · {fmtDateTime(new Date(e.created_at).toISOString())}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Launch status: a separate axis from Clinic status (Active/Paused). Derived from
// the launch gate only.
function launchStatus(
  launched: boolean,
  launchBlockedReason: string | null,
): { label: string; tone: Tone; detail: string } {
  if (launched) {
    return { label: "Launched", tone: "success", detail: "Missed-call SMS recovery is on for this clinic." };
  }
  if (launchBlockedReason) {
    return { label: "Blocked", tone: "warning", detail: launchBlockedReason };
  }
  return {
    label: "Ready to launch",
    tone: "info",
    detail: "All prerequisites met — launch from Admin controls below.",
  };
}

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="adm-meta-item">
      <dt className="adm-meta-label">{label}</dt>
      <dd className="adm-meta-value">{children}</dd>
    </div>
  );
}

function NotProvided() {
  return <span style={{ color: "var(--text-muted)" }}>Not provided</span>;
}
function NotAvailable() {
  return <span style={{ color: "var(--text-muted)" }}>Not available</span>;
}

// Honest disabled placeholder: an essential future action whose backend is not
// wired yet. It never looks clickable and always states the exact blocker.
function DisabledAction({ label, reason }: { label: string; reason: ReactNode }) {
  return (
    <div className="adm-blocked" role="note" style={{ marginTop: "var(--space-3)" }}>
      <button type="button" className="btn btn-secondary btn-sm" disabled aria-disabled="true">{label}</button>
      <span className="t-small" style={{ color: "var(--text-muted)" }}>{reason}</span>
    </div>
  );
}
