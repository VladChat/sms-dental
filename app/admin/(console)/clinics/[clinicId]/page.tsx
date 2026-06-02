import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminClinicDetail } from "../../../../../lib/db/admin/clinics";
import { listAdminAuditEvents } from "../../../../../lib/db/admin/audit";
import { getClinicEvents } from "../../../../../lib/db/admin/events";
import { getAppDomainsSafe, getSmsRecoveryConfig } from "../../../../../lib/env";
import {
  Badge,
  BoolBadge,
  Row,
  billingStatusLabel,
  billingTone,
  describeAuditAction,
  humanizeToken,
  localNumberStatusLabel,
  setupStatusLabel,
  smsStatusLabel,
  smsStatusTone,
} from "../../_components/AdminUI";
import { AdminClinicActions } from "./_components/AdminClinicActions";
import { AdminBusinessProfileForm } from "./_components/AdminBusinessProfileForm";
import { AdminA2pForm } from "./_components/AdminA2pForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Tone = "success" | "neutral" | "warning" | "info" | "brand";

const PHONE_ROLE_LABELS: Record<string, string> = { office_texting: "Office texting" };
function phoneRoleLabel(role: string): string {
  return PHONE_ROLE_LABELS[role] ?? humanizeToken(role);
}
const SMS_MODE_LABELS: Record<string, string> = { disabled: "Disabled", owner_test: "Owner test", live: "Live" };

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

  const [activity, events] = await Promise.all([
    listAdminAuditEvents({ clinicId: d.id }, 5).catch(() => []),
    getClinicEvents(d.id, 5).catch(() => ({ calls: [], messages: [] })),
  ]);

  const smsMode = getSmsRecoveryConfig().mode; // mode only — never the allowlist
  const appBaseUrl = getAppDomainsSafe()?.appBaseUrl ?? "";

  // Launch gate mirrors the server preconditions exactly.
  const launchBlockedReason = !d.isActive
    ? "Clinic is paused. Reactivate it before launching service."
    : !d.hasAssignedNumber
      ? "No phone number assigned. Assign a number before launching."
      : !d.a2pInfoCompleted
        ? "SMS approval information is not complete yet."
        : null;
  const launch = launchStatus(d.smsRecoveryEnabled, launchBlockedReason);

  const missingBusiness = [
    d.legalBusinessName ? null : "legal name",
    d.businessType ? null : "business type",
    d.einProvided ? null : "EIN / Tax ID",
    d.street && d.city && d.postalCode ? null : "address",
  ].filter((x): x is string => Boolean(x));

  const ownerEmail = d.ownerContactEmail ?? d.members.find((m) => m.role === "owner")?.email ?? null;
  const hasPublicPages = Boolean(d.slug && appBaseUrl);
  const publicBase = hasPublicPages ? `${appBaseUrl}/business/${d.slug}` : null;
  const recoveryTemplate = `Hi, this is ${d.name || "Your clinic"}. We missed your call. Would you like us to help schedule an appointment?`;

  // ---- launch checklist (action-oriented) ----
  const checklist: ChecklistItem[] = [
    {
      label: "Business profile",
      status: d.businessInfoCompleted ? { label: "Complete", tone: "success" } : { label: "Needs setup", tone: "warning" },
      reason: d.businessInfoCompleted ? "Business identity on file." : `Missing: ${missingBusiness.join(", ") || "required fields"}.`,
      action: <a className="link" href="#business-profile">Edit</a>,
    },
    {
      label: "Phone number",
      status: d.hasAssignedNumber ? { label: "Assigned", tone: "success" } : { label: "Missing", tone: "warning" },
      reason: d.hasAssignedNumber ? "At least one active number assigned." : "No active number assigned.",
      action: <a className="link" href="#phone">Open</a>,
    },
    {
      label: "A2P / SMS approval",
      status: d.a2pInfoCompleted && d.a2pAuthorized
        ? { label: "Complete", tone: "success" }
        : d.a2pInfoCompleted
          ? { label: "Needs authorization", tone: "warning" }
          : { label: "Needs setup", tone: "warning" },
      reason: d.a2pInfoCompleted && d.a2pAuthorized ? "Approval info complete and authorized." : "Approval info incomplete.",
      action: <a className="link" href="#a2p">Edit</a>,
    },
    {
      label: "Billing",
      status: d.stripeCustomerPresent ? { label: "Connected", tone: "success" } : { label: "Not connected", tone: "neutral" },
      reason: d.stripeCustomerPresent ? "Payment method on file." : "Not required to launch in this MVP.",
      action: <a className="link" href="#billing">Open</a>,
    },
    {
      label: "SMS launch",
      status: { label: launch.label, tone: launch.tone },
      reason: launchBlockedReason ?? (d.smsRecoveryEnabled ? "Missed-call SMS recovery is live." : "All prerequisites met."),
      action: d.smsRecoveryEnabled ? <span style={{ color: "var(--text-muted)" }}>—</span> : <a className="link" href="#admin-controls">Open controls</a>,
    },
  ];

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      {/* 1. Header */}
      <header className="adm-detail-head">
        <div>
          <p className="t-small"><Link className="link" href="/admin/clinics">← Clinics</Link></p>
          <h1 className="t-h2" style={{ marginTop: "var(--space-1)" }}>{d.name}</h1>
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
            <BoolBadge value={d.isActive} yes="Active" no="Paused" noTone="warning" />
            <Badge tone={launch.tone}>{launch.label}</Badge>
          </div>
          <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>{launch.detail}</p>
          <dl className="adm-meta" aria-label="Clinic metadata">
            <MetaItem label="Owner"><span className="t-mono">{ownerEmail ?? "—"}</span></MetaItem>
            <MetaItem label="Setup">{setupStatusLabel(d.setupStatus)}</MetaItem>
            <MetaItem label="Created">{fmtDate(d.createdAt)}</MetaItem>
            <MetaItem label="Updated">{fmtDate(d.updatedAt)}</MetaItem>
          </dl>
        </div>
        <div className="adm-detail-head-links">
          <Link className="btn btn-secondary btn-sm" href={`/admin/clinics/${d.id}/events`}>Diagnostics</Link>
          {publicBase && <a className="btn btn-secondary btn-sm" href={publicBase} target="_blank" rel="noreferrer noopener">Public page</a>}
        </div>
      </header>

      {/* 2. Launch checklist */}
      <section className="card card-pad adm-section">
        <h3 className="t-h4">Launch checklist</h3>
        <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>What blocks launch right now, and what to do next.</p>
        <div className="adm-checklist">
          {checklist.map((c) => (
            <div className="adm-checklist-row" key={c.label}>
              <div className="adm-checklist-main">
                <span className="adm-checklist-label">{c.label}</span>
                <span className="adm-checklist-reason">{c.reason}</span>
              </div>
              <Badge tone={c.status.tone}>{c.status.label}</Badge>
              <span className="adm-checklist-action">{c.action}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Editable Business Profile */}
      <section id="business-profile" className="card card-pad adm-section">
        <div className="adm-section-head">
          <h3 className="t-h4">Business profile</h3>
          <BoolBadge value={d.businessInfoCompleted} yes="Complete" no="Incomplete" noTone="warning" />
        </div>
        <p className="t-helper" style={{ margin: "var(--space-1) 0 var(--space-4)" }}>
          Edit and save the clinic’s public business identity. Saves to this clinic only and is audit-logged.
        </p>
        <AdminBusinessProfileForm
          clinicId={d.id}
          initial={{
            name: d.name,
            mainPhone: d.mainPhone ?? "",
            streetAddress: d.street ?? "",
            addressLine2: d.addressLine2 ?? "",
            city: d.city ?? "",
            stateRegion: d.stateRegion ?? "",
            postalCode: d.postalCode ?? "",
            website: d.website ?? "",
          }}
        />
      </section>

      {/* 4. Editable A2P / SMS Approval */}
      <section id="a2p" className="card card-pad adm-section">
        <div className="adm-section-head">
          <h3 className="t-h4">A2P / SMS approval</h3>
          <Badge tone={smsStatusTone(d.smsStatus)}>{smsStatusLabel(d.smsStatus)}</Badge>
        </div>
        <p className="t-helper" style={{ margin: "var(--space-1) 0 var(--space-4)" }}>
          Edit and save the carrier-registration packet for this clinic. Saving stores the data only — it does
          not submit to a carrier.
        </p>
        <AdminA2pForm
          clinicId={d.id}
          initial={{
            legalBusinessName: d.legalBusinessName ?? "",
            einTaxId: d.einTaxId ?? "",
            businessType: d.businessType ?? "",
            repFirstName: d.a2pRepFirstName ?? "",
            repLastName: d.a2pRepLastName ?? "",
            repEmail: d.a2pRepEmail ?? "",
            repPhone: d.a2pRepPhone ?? "",
            authorized: d.a2pAuthorized,
          }}
        />

        <h4 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Carrier submission</h4>
        <dl className="adm-rows">
          <Row label="Submission status"><Badge tone="neutral">Not submitted</Badge></Row>
          <Row label="Twilio Brand SID"><NotAvailable /></Row>
          <Row label="Twilio Campaign SID"><NotAvailable /></Row>
          <Row label="Last status sync"><NotAvailable /></Row>
        </dl>
        {publicBase && (
          <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
            Compliance pages:{" "}
            <a className="link" href={publicBase} target="_blank" rel="noreferrer noopener">Business</a>{" · "}
            <a className="link" href={`${publicBase}/privacy`} target="_blank" rel="noreferrer noopener">Privacy</a>{" · "}
            <a className="link" href={`${publicBase}/sms-terms`} target="_blank" rel="noreferrer noopener">SMS terms</a>
          </p>
        )}
        <DisabledAction label="Submit SMS approval" reason="A2P submission backend required" />
      </section>

      {/* 5. Phone number — action oriented */}
      <section id="phone" className="card card-pad adm-section">
        <div className="adm-section-head">
          <h3 className="t-h4">Phone number</h3>
          <BoolBadge value={d.hasAssignedNumber} yes="Assigned" no="Missing" noTone="warning" />
        </div>
        {d.phoneNumbers.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>No phone number assigned yet.</p>
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
                  <Row label="Twilio SID">{p.sidTail ? <span className="t-mono">{p.sidTail}</span> : <NotAvailable />}</Row>
                  <Row label="Assigned">{fmtDateTime(p.createdAt)}</Row>
                </dl>
              </div>
            ))}
          </div>
        )}
        <dl className="adm-rows" style={{ marginTop: "var(--space-3)" }}>
          <Row label="Local number status">{localNumberStatusLabel(d.localNumberStatus)}</Row>
          <Row label="SMS recovery gate"><BoolBadge value={d.smsRecoveryEnabled} yes="Enabled" no="Disabled" noTone="neutral" /></Row>
          <Row label="Global SMS mode">{SMS_MODE_LABELS[smsMode] ?? humanizeToken(smsMode)}</Row>
          {!d.hasAssignedNumber && <Row label="Blocker">No number assigned — purchase/assign to continue.</Row>}
        </dl>
        <DisabledAction label="Purchase and assign number" reason="Twilio purchase/assign backend required" />
      </section>

      {/* 6. Billing */}
      <section id="billing" className="card card-pad adm-section">
        <div className="adm-section-head">
          <h3 className="t-h4">Billing</h3>
          <Badge tone={billingTone(d.billingStatus)}>{billingStatusLabel(d.billingStatus)}</Badge>
        </div>
        <dl className="adm-rows">
          <Row label="Payment method"><BoolBadge value={d.stripeCustomerPresent} yes="On file" no="None" /></Row>
          <Row label="Subscription"><BoolBadge value={d.stripeSubscriptionPresent} yes="Present" no="None" /></Row>
          <Row label="Trial">{d.trialStartedAt || d.trialEndsAt ? `${fmtDate(d.trialStartedAt)} → ${fmtDate(d.trialEndsAt)}` : "—"}</Row>
        </dl>
        <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
          Billing starts only after SMS recovery is active; it does not block launch in this MVP.
        </p>
        <DisabledAction label="Manage billing" reason="Stripe billing backend required" />
      </section>

      {/* 7. SMS behavior (read-only) */}
      <section className="card card-pad adm-section">
        <h3 className="t-h4">SMS behavior</h3>
        <dl className="adm-rows">
          <Row label="First missed-call text"><span className="t-small">“{recoveryTemplate}”</span></Row>
          <Row label="Repeat caller">No repeat recovery text within 24 hours (duplicate suppression)</Row>
          <Row label="STOP / START / HELP">STOP→opt out · START→opt back in · HELP→help reply</Row>
          <Row label="SMS recovery gate"><BoolBadge value={d.smsRecoveryEnabled} yes="Enabled" no="Disabled" noTone="neutral" /></Row>
          <Row label="Global SMS mode">{SMS_MODE_LABELS[smsMode] ?? humanizeToken(smsMode)}</Row>
        </dl>
        <p className="t-helper" style={{ marginTop: "var(--space-2)" }}>
          Templates are fixed in code. Per-clinic SMS settings are not editable yet (no settings backend).
        </p>
      </section>

      {/* ===== Admin-only tools (below the management workflow) ===== */}

      {/* 8/9. Admin controls + internal note */}
      <section id="admin-controls" className="card card-pad adm-section">
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
      <section className="card card-pad adm-section">
        <h3 className="t-h4">Diagnostics</h3>
        <dl className="adm-rows">
          <Row label="Active opt-outs">{d.optOutCount}</Row>
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
                <span className="t-helper" style={{ color: "var(--text-muted)" }}>{m.sidTail ?? "—"} · {fmtDateTime(m.createdAt)}</span>
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
                <span className="t-helper" style={{ color: "var(--text-muted)" }}>{c.fromMasked ?? "—"} → {c.toMasked ?? "—"} · {fmtDateTime(c.occurredAt)}</span>
              </div>
            ))}
          </div>
        )}

        <p className="t-small" style={{ marginTop: "var(--space-3)" }}>
          <Link className="link" href={`/admin/clinics/${d.id}/events`}>Open full call / message diagnostics →</Link>
        </p>
        <p className="t-helper" style={{ marginTop: "var(--space-2)" }}>Caller numbers are masked. Webhook ingress is logged globally (not per clinic).</p>
      </section>

      {/* Recent admin activity */}
      <section className="card card-pad adm-section">
        <h3 className="t-h4">Recent admin activity</h3>
        <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>Who changed what, and when — including profile/approval edits and note updates.</p>
        {activity.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>No admin actions recorded for this clinic yet.</p>
        ) : (
          <div className="adm-activity" style={{ marginTop: "var(--space-2)" }}>
            {activity.map((e) => (
              <div className="adm-activity-item" key={e.id}>
                <span className="t-small">{describeAuditAction(e.action)}</span>
                <span className="t-helper" style={{ color: "var(--text-muted)" }}>{e.admin_email} · {fmtDateTime(new Date(e.created_at).toISOString())}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Technical details (compact, collapsible) */}
      <details className="card card-pad adm-tech">
        <summary className="adm-tech-summary">Technical details</summary>
        <dl className="adm-rows" style={{ marginTop: "var(--space-3)" }}>
          <Row label="Clinic ID"><span className="t-mono">{d.id}</span></Row>
          <Row label="Slug"><span className="t-mono">{d.slug ?? "—"}</span></Row>
          <Row label="Country / timezone">{d.country} · {d.timezone ?? "—"}</Row>
          <Row label="Preferred area code">{d.preferredAreaCode ?? "—"}</Row>
          <Row label="Setup status (raw)"><span className="t-mono">{d.setupStatus}</span></Row>
          <Row label="Stripe customer ID">{d.stripeCustomerId ? <span className="t-mono">{d.stripeCustomerId}</span> : <NotAvailable />}</Row>
          <Row label="Stripe subscription ID">{d.stripeSubscriptionId ? <span className="t-mono">{d.stripeSubscriptionId}</span> : <NotAvailable />}</Row>
          {d.phoneNumbers.map((p) => (
            <Row key={p.id} label={`Twilio SID (${p.phoneE164 ?? "number"})`}>
              {p.twilioSid ? <span className="t-mono">{p.twilioSid}</span> : <NotAvailable />}
            </Row>
          ))}
          <Row label="Created">{fmtDateTime(d.createdAt)}</Row>
          <Row label="Updated">{fmtDateTime(d.updatedAt)}</Row>
        </dl>
      </details>
    </div>
  );
}

type ChecklistItem = {
  label: string;
  status: { label: string; tone: Tone };
  reason: string;
  action: ReactNode;
};

// Launch status: a separate axis from Clinic status (Active/Paused).
function launchStatus(
  launched: boolean,
  launchBlockedReason: string | null,
): { label: string; tone: Tone; detail: string } {
  if (launched) return { label: "Launched", tone: "success", detail: "Missed-call SMS recovery is on for this clinic." };
  if (launchBlockedReason) return { label: "Blocked", tone: "warning", detail: launchBlockedReason };
  return { label: "Ready to launch", tone: "info", detail: "All prerequisites met — launch from Admin controls below." };
}

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="adm-meta-item">
      <dt className="adm-meta-label">{label}</dt>
      <dd className="adm-meta-value">{children}</dd>
    </div>
  );
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
