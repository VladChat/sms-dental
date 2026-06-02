"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "../../../_components/AdminUI";
import type {
  AdminClinicDetail,
  AdminClinicEvents,
} from "../../../../../../lib/db/admin/types";
import { AdminClinicActions } from "./AdminClinicActions";
import { AdminBusinessProfileForm } from "./AdminBusinessProfileForm";
import { AdminA2pForm } from "./AdminA2pForm";
import { AdminPhoneNumberManager } from "./AdminPhoneNumberManager";

type Tone = "success" | "neutral" | "warning" | "info" | "brand";

export type PhoneSearchDefaults = {
  areaCode: string;
  postal: string;
};

export type AdminConsoleData = {
  detail: AdminClinicDetail;
  smsMode: string;
  appBaseUrl: string;
  purchaseEnabled: boolean;
  phoneDefaults: PhoneSearchDefaults;
  recentActivity: { id: string; action: string; adminEmail: string; createdAt: string }[];
  events: AdminClinicEvents;
};

type SectionId = "phone" | "business" | "sms" | "billing" | "behavior" | "admin";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "phone", label: "Phone number" },
  { id: "business", label: "Business profile" },
  { id: "sms", label: "SMS approval" },
  { id: "billing", label: "Billing" },
  { id: "behavior", label: "SMS behavior" },
  { id: "admin", label: "Admin tools" },
];

const SMS_MODE_LABELS: Record<string, string> = { disabled: "Disabled", owner_test: "Owner test", live: "Live" };
const PHONE_ROLE_LABELS: Record<string, string> = { office_texting: "Office texting" };

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}
// Card brand label, e.g. "visa" -> "Visa". Falls back to "Card" when absent.
function pmBrandLabel(brand: string | null): string {
  if (!brand) return "Card";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}
// "MM/YYYY" expiration label, or null when either part is missing.
function pmExpLabel(month: number | null, year: number | null): string | null {
  if (!month || !year) return null;
  return `${String(month).padStart(2, "0")}/${year}`;
}
// Owner-requested-number status → label + badge tone.
function requestLabel(status: string): string {
  switch (status) {
    case "pending": return "Pending review";
    case "reviewed": return "In review";
    case "fulfilled": return "Completed";
    case "rejected": return "Not available";
    case "cancelled": return "Superseded";
    default: return humanizeToken(status);
  }
}
function requestTone(status: string): Tone {
  switch (status) {
    case "fulfilled": return "success";
    case "rejected": return "warning";
    case "cancelled": return "neutral";
    default: return "info";
  }
}
function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export function AdminClinicConsole({ data }: { data: AdminConsoleData }) {
  const d = data.detail;
  const router = useRouter();
  const [active, setActive] = useState<SectionId>("phone");
  const [isAddingNumber, setIsAddingNumber] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const launchBlockedReason = !d.isActive
    ? "Clinic is paused. Reactivate it before launching service."
    : !d.hasAssignedNumber
      ? "No phone number assigned. Assign a number before launching."
      : !d.a2pInfoCompleted
        ? "SMS approval information is not complete yet."
        : null;

  const ownerEmail = d.ownerContactEmail ?? d.members.find((m) => m.role === "owner")?.email ?? null;
  const publicBase = d.slug && data.appBaseUrl ? `${data.appBaseUrl}/business/${d.slug}` : null;
  const banner = bannerFor(d, launchBlockedReason);

  function goTo(id: SectionId) {
    setActive(id);
    const idx = SECTIONS.findIndex((s) => s.id === id);
    if (idx >= 0) requestAnimationFrame(() => tabRefs.current[idx]?.focus());
  }

  function onTabKeyDown(e: React.KeyboardEvent, idx: number) {
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % SECTIONS.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (idx - 1 + SECTIONS.length) % SECTIONS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = SECTIONS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      const sec = SECTIONS[next]!;
      setActive(sec.id);
      tabRefs.current[next]?.focus();
    }
  }

  const navStatus = sectionStatuses(d);

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      {/* Header — no status pills */}
      <header className="adm-detail-head">
        <div>
          <p className="t-small"><Link className="link" href="/admin/clinics">← Clinics</Link></p>
          <h1 className="t-h2" style={{ marginTop: "var(--space-1)" }}>{d.name}</h1>
          <dl className="adm-meta" aria-label="Clinic metadata">
            <MetaItem label="Owner"><span className="t-mono">{ownerEmail ?? "—"}</span></MetaItem>
            <MetaItem label="Setup">{setupStatusLabel(d.setupStatus)}</MetaItem>
            <MetaItem label="Updated">{fmtDate(d.updatedAt)}</MetaItem>
          </dl>
        </div>
        <div className="adm-detail-head-links">
          <Link className="btn btn-secondary btn-sm" href={`/admin/clinics/${d.id}/events`}>Diagnostics</Link>
          {publicBase && <a className="btn btn-secondary btn-sm" href={publicBase} target="_blank" rel="noreferrer noopener">Public page</a>}
        </div>
      </header>

      {/* One compact launch banner */}
      <div className={`adm-banner tone-${banner.tone}`} role="status">
        <div className="adm-banner-main">
          <span className="adm-banner-title">{banner.title}</span>
          <span className="adm-banner-body">{banner.body}</span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => goTo(banner.target)}>
          {banner.actionLabel}
        </button>
      </div>

      {/* Owner-dashboard-style layout: left nav + focused panel */}
      <div className="acct-layout">
        <nav className="acct-nav">
          <div className="acct-nav-group" role="tablist" aria-orientation="vertical" aria-label="Clinic sections">
            {SECTIONS.map((s, i) => {
              const st = navStatus[s.id];
              const isActive = active === s.id;
              return (
                <button
                  key={s.id}
                  ref={(el) => { tabRefs.current[i] = el; }}
                  type="button"
                  role="tab"
                  id={`adm-tab-${s.id}`}
                  aria-selected={isActive}
                  aria-controls={`adm-panel-${s.id}`}
                  tabIndex={isActive ? 0 : -1}
                  className="acct-nav-item"
                  onClick={() => setActive(s.id)}
                  onKeyDown={(e) => onTabKeyDown(e, i)}
                >
                  <span className="acct-nav-main"><span className="acct-nav-text">{s.label}</span></span>
                  {st && <span className={`adm-nav-status tone-${st.tone}`}>{st.text}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="acct-panel">
          {/* Phone number (default) */}
          <Panel id="phone" active={active}>
            <div className="adm-section-head">
              <h2 className="t-h3">Phone number</h2>
              <BoolBadge value={d.hasAssignedNumber} yes="Assigned" no="Missing" noTone="warning" />
            </div>
            {d.phoneNumbers.length === 0 ? (
              <p className="t-body" style={{ marginTop: "var(--space-3)" }}>No tracking number is assigned to this clinic yet.</p>
            ) : (
              <div className="adm-phone-list">
                {d.phoneNumbers.map((p) => (
                  <div className="adm-phone-card" key={p.id}>
                    <div className="adm-phone-card-head">
                      <span className="t-mono" style={{ fontWeight: 700 }}>{p.phoneE164 ?? "—"}</span>
                      <span style={{ display: "inline-flex", gap: "var(--space-2)" }}>
                        <Badge tone="neutral">{PHONE_ROLE_LABELS[p.role] ?? humanizeToken(p.role)}</Badge>
                        <BoolBadge value={p.isActive} yes="Active" no="Inactive" noTone="neutral" />
                      </span>
                    </div>
                    <dl className="adm-rows">
                      <Row label="Provider reference">{p.sidTail ? <span className="t-mono">{p.sidTail}</span> : <Muted>Not available</Muted>}</Row>
                      <Row label="Assigned">{fmtDateTime(p.createdAt)}</Row>
                    </dl>
                  </div>
                ))}
              </div>
            )}
            <dl className="adm-rows" style={{ marginTop: "var(--space-3)" }}>
              <Row label="Local number status">{localNumberStatusLabel(d.localNumberStatus)}</Row>
              <Row label="SMS recovery gate"><BoolBadge value={d.smsRecoveryEnabled} yes="Enabled" no="Disabled" noTone="neutral" /></Row>
              <Row label="Global SMS mode">{SMS_MODE_LABELS[data.smsMode] ?? humanizeToken(data.smsMode)}</Row>
            </dl>
            {!d.hasAssignedNumber && (
              <p className="t-small" style={{ color: "var(--warning)", marginTop: "var(--space-2)", fontWeight: 600 }}>
                Blocker: no number assigned — add one to continue launch.
              </p>
            )}

            {d.requestedNumber && (
              <div
                style={{
                  marginTop: "var(--space-4)",
                  padding: "var(--space-4)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-sunken)",
                }}
              >
                <div className="adm-section-head">
                  <h3 className="adm-subhead">Owner requested number</h3>
                  <Badge tone={requestTone(d.requestedNumber.status)}>{requestLabel(d.requestedNumber.status)}</Badge>
                </div>
                <dl className="adm-rows" style={{ marginTop: "var(--space-2)" }}>
                  <Row label="Number"><span className="t-mono">{d.requestedNumber.phoneNumber}</span></Row>
                  {(d.requestedNumber.locality || d.requestedNumber.region) && (
                    <Row label="Location">{[d.requestedNumber.locality, d.requestedNumber.region].filter(Boolean).join(", ")}</Row>
                  )}
                  <Row label="Requested">{fmtDateTime(d.requestedNumber.createdAt)}</Row>
                  {d.requestedNumber.requestedByEmail && (
                    <Row label="Requested by"><span className="t-mono">{d.requestedNumber.requestedByEmail}</span></Row>
                  )}
                </dl>
                <p className="t-helper" style={{ margin: "var(--space-2) 0 0", color: "var(--text-muted)" }}>
                  This is an owner preference only. Purchase and assignment remain admin-controlled.
                </p>
              </div>
            )}

            {!isAddingNumber ? (
              <div style={{ marginTop: "var(--space-4)" }}>
                {d.requestedNumber && d.requestedNumber.status === "pending" && (
                  <p className="t-small" style={{ margin: "0 0 var(--space-2)", color: "var(--text-secondary)" }}>
                    Requested by owner: <span className="t-mono">{d.requestedNumber.phoneNumber}</span> — review, then add it through the normal flow.
                  </p>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsAddingNumber(true)}>
                  Add number
                </button>
              </div>
            ) : (
              <div
                style={{
                  marginTop: "var(--space-4)",
                  padding: "var(--space-4)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-sunken)",
                }}
              >
                <h3 className="adm-subhead">Add a number</h3>
                <p className="t-helper" style={{ margin: "var(--space-1) 0 var(--space-2)" }}>
                  Search for an available tracking number for this clinic.
                </p>
                <AdminPhoneNumberManager
                  clinicId={d.id}
                  purchaseEnabled={data.purchaseEnabled}
                  defaults={data.phoneDefaults}
                  onCancel={() => setIsAddingNumber(false)}
                  onAssigned={() => { setIsAddingNumber(false); router.refresh(); }}
                />
              </div>
            )}
          </Panel>

          {/* Business profile (editable — preserved) */}
          <Panel id="business" active={active}>
            <div className="adm-section-head">
              <h2 className="t-h3">Business profile</h2>
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
          </Panel>

          {/* SMS approval (editable — preserved) */}
          <Panel id="sms" active={active}>
            <div className="adm-section-head">
              <h2 className="t-h3">SMS approval</h2>
              <Badge tone={smsStatusTone(d.smsStatus)}>{smsStatusLabel(d.smsStatus)}</Badge>
            </div>
            <p className="t-helper" style={{ margin: "var(--space-1) 0 var(--space-4)" }}>
              Edit and save the carrier-registration packet. Saving stores the data only — it does not submit to a carrier.
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
            <h3 className="adm-subhead" style={{ margin: "var(--space-5) 0 0" }}>Carrier submission</h3>
            <dl className="adm-rows">
              <Row label="Submission status"><Badge tone="neutral">Not submitted</Badge></Row>
              <Row label="Messaging brand reference"><Muted>Not available</Muted></Row>
              <Row label="Messaging campaign reference"><Muted>Not available</Muted></Row>
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
          </Panel>

          {/* Billing (compact) */}
          <Panel id="billing" active={active}>
            <div className="adm-section-head">
              <h2 className="t-h3">Billing</h2>
              <Badge tone={billingTone(d.billingStatus)}>{billingStatusLabel(d.billingStatus)}</Badge>
            </div>
            <dl className="adm-rows">
              <Row label="Payment method">
                {d.stripePaymentMethodPresent ? <Badge tone="success">Added</Badge> : <Badge tone="neutral">None</Badge>}
              </Row>
              {d.stripePaymentMethodPresent && (
                <Row label="Card">
                  <span className="t-mono">{pmBrandLabel(d.paymentMethodBrand)} •••• {d.paymentMethodLast4 ?? "••••"}</span>
                  {pmExpLabel(d.paymentMethodExpMonth, d.paymentMethodExpYear) && (
                    <span className="t-small" style={{ color: "var(--text-muted)" }}> · Exp {pmExpLabel(d.paymentMethodExpMonth, d.paymentMethodExpYear)}</span>
                  )}
                </Row>
              )}
              <Row label="Subscription"><BoolBadge value={d.stripeSubscriptionPresent} yes="Present" no="None" /></Row>
              <Row label="Trial">{d.trialStartedAt || d.trialEndsAt ? `${fmtDate(d.trialStartedAt)} → ${fmtDate(d.trialEndsAt)}` : "—"}</Row>
            </dl>
            <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
              Billing starts only after SMS recovery is active; it does not block launch in this MVP.
            </p>
            <DisabledAction label="Manage billing" reason="Stripe billing backend required" />
          </Panel>

          {/* SMS behavior (read-only) */}
          <Panel id="behavior" active={active}>
            <h2 className="t-h3">SMS behavior</h2>
            <dl className="adm-rows" style={{ marginTop: "var(--space-3)" }}>
              <Row label="First missed-call text"><span className="t-small">“Hi, this is {d.name || "Your clinic"}. We missed your call. Would you like us to help schedule an appointment?”</span></Row>
              <Row label="Repeat caller">No repeat recovery text within 24 hours (duplicate suppression)</Row>
              <Row label="STOP / START / HELP">STOP→opt out · START→opt back in · HELP→help reply</Row>
              <Row label="SMS recovery gate"><BoolBadge value={d.smsRecoveryEnabled} yes="Enabled" no="Disabled" noTone="neutral" /></Row>
              <Row label="Global SMS mode">{SMS_MODE_LABELS[data.smsMode] ?? humanizeToken(data.smsMode)}</Row>
            </dl>
            <p className="t-helper" style={{ marginTop: "var(--space-2)" }}>
              Templates are fixed in code. Per-clinic SMS settings are not editable yet (no settings backend).
            </p>
          </Panel>

          {/* Admin tools */}
          <Panel id="admin" active={active}>
            <h2 className="t-h3">Admin tools</h2>
            <div style={{ marginTop: "var(--space-4)" }}>
              <AdminClinicActions
                clinicId={d.id}
                isActive={d.isActive}
                smsRecoveryEnabled={d.smsRecoveryEnabled}
                adminInternalNote={d.adminInternalNote}
                launchBlockedReason={launchBlockedReason}
              />
            </div>

            <details className="adm-fold">
              <summary>Recent admin activity</summary>
              {data.recentActivity.length === 0 ? (
                <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>No admin actions recorded for this clinic yet.</p>
              ) : (
                <div className="adm-activity" style={{ marginTop: "var(--space-2)" }}>
                  {data.recentActivity.map((e) => (
                    <div className="adm-activity-item" key={e.id}>
                      <span className="t-small">{describeAuditAction(e.action)}</span>
                      <span className="t-helper" style={{ color: "var(--text-muted)" }}>{e.adminEmail} · {fmtDateTime(e.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </details>

            <details className="adm-fold">
              <summary>Diagnostics</summary>
              <dl className="adm-rows" style={{ marginTop: "var(--space-2)" }}>
                <Row label="Active opt-outs">{d.optOutCount}</Row>
              </dl>
              <h3 className="adm-subhead" style={{ margin: "var(--space-3) 0 0" }}>Recent messages</h3>
              {data.events.messages.length === 0 ? (
                <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>No recent messages.</p>
              ) : (
                <div className="adm-activity">
                  {data.events.messages.map((m) => (
                    <div className="adm-activity-item" key={m.id}>
                      <span className="t-small">{humanizeToken(m.direction)} · {m.status ? humanizeToken(m.status) : "—"}{m.errored ? <Badge tone="warning">Error</Badge> : null}</span>
                      <span className="t-helper" style={{ color: "var(--text-muted)" }}>{m.sidTail ?? "—"} · {fmtDateTime(m.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
              <h3 className="adm-subhead" style={{ margin: "var(--space-3) 0 0" }}>Recent calls</h3>
              {data.events.calls.length === 0 ? (
                <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>No recent calls.</p>
              ) : (
                <div className="adm-activity">
                  {data.events.calls.map((c) => (
                    <div className="adm-activity-item" key={c.id}>
                      <span className="t-small">{c.direction ? humanizeToken(c.direction) : "Call"} · {c.callStatus ? humanizeToken(c.callStatus) : "—"}{c.isMissed ? <Badge tone="warning">Missed</Badge> : null}</span>
                      <span className="t-helper" style={{ color: "var(--text-muted)" }}>{c.fromMasked ?? "—"} → {c.toMasked ?? "—"} · {fmtDateTime(c.occurredAt)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="t-small" style={{ marginTop: "var(--space-3)" }}>
                <Link className="link" href={`/admin/clinics/${d.id}/events`}>Open full call / message diagnostics →</Link>
              </p>
              <p className="t-helper" style={{ marginTop: "var(--space-2)" }}>Caller numbers are masked. Webhook ingress is logged globally (not per clinic).</p>
            </details>

            <details className="adm-fold">
              <summary>Technical details</summary>
              <dl className="adm-rows" style={{ marginTop: "var(--space-2)" }}>
                <Row label="Clinic ID"><span className="t-mono">{d.id}</span></Row>
                <Row label="Slug"><span className="t-mono">{d.slug ?? "—"}</span></Row>
                <Row label="Country / timezone">{d.country} · {d.timezone ?? "—"}</Row>
                <Row label="Setup status (raw)"><span className="t-mono">{d.setupStatus}</span></Row>
                <Row label="Stripe customer ID">{d.stripeCustomerId ? <span className="t-mono">{d.stripeCustomerId}</span> : <Muted>Not available</Muted>}</Row>
                <Row label="Stripe payment method ID">{d.stripePaymentMethodId ? <span className="t-mono">{d.stripePaymentMethodId}</span> : <Muted>Not available</Muted>}</Row>
                <Row label="Stripe subscription ID">{d.stripeSubscriptionId ? <span className="t-mono">{d.stripeSubscriptionId}</span> : <Muted>Not available</Muted>}</Row>
                {d.phoneNumbers.map((p) => (
                  <Row key={p.id} label={`Provider reference (${p.phoneE164 ?? "number"})`}>
                    {p.twilioSid ? <span className="t-mono">{p.twilioSid}</span> : <Muted>Not available</Muted>}
                  </Row>
                ))}
                <Row label="Created">{fmtDateTime(d.createdAt)}</Row>
                <Row label="Updated">{fmtDateTime(d.updatedAt)}</Row>
              </dl>
            </details>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ id, active, children }: { id: SectionId; active: SectionId; children: React.ReactNode }) {
  // Panels stay mounted (forms keep unsaved input); inactive ones are hidden
  // from layout + the accessibility tree via the `hidden` attribute.
  return (
    <section
      id={`adm-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`adm-tab-${id}`}
      hidden={active !== id}
      tabIndex={0}
      className="card card-pad adm-section"
    >
      {children}
    </section>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="adm-meta-item">
      <dt className="adm-meta-label">{label}</dt>
      <dd className="adm-meta-value">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--text-muted)" }}>{children}</span>;
}

function DisabledAction({ label, reason }: { label: string; reason: React.ReactNode }) {
  return (
    <div className="adm-blocked" role="note" style={{ marginTop: "var(--space-3)" }}>
      <button type="button" className="btn btn-secondary btn-sm" disabled aria-disabled="true">{label}</button>
      <span className="t-small" style={{ color: "var(--text-muted)" }}>{reason}</span>
    </div>
  );
}

function sectionStatuses(d: AdminClinicDetail): Partial<Record<SectionId, { text: string; tone: Tone }>> {
  const a2p: { text: string; tone: Tone } =
    d.a2pInfoCompleted && d.a2pAuthorized
      ? { text: "Ready", tone: "success" }
      : d.a2pInfoCompleted
        ? { text: "Waiting", tone: "info" }
        : { text: "Needs setup", tone: "warning" };
  return {
    phone: d.hasAssignedNumber ? { text: "Assigned", tone: "success" } : { text: "Missing", tone: "warning" },
    business: d.businessInfoCompleted ? { text: "Complete", tone: "success" } : { text: "Needs setup", tone: "warning" },
    sms: a2p,
    billing: d.stripeCustomerPresent ? { text: "Connected", tone: "success" } : { text: "Not connected", tone: "neutral" },
    behavior: { text: "Read-only", tone: "neutral" },
  };
}

function bannerFor(
  d: AdminClinicDetail,
  launchBlockedReason: string | null,
): { tone: Tone; title: string; body: string; target: SectionId; actionLabel: string } {
  if (d.smsRecoveryEnabled) {
    return { tone: "success", title: "SMS recovery is live", body: "This clinic is launched. Manage it from Admin tools.", target: "admin", actionLabel: "Go to Admin tools" };
  }
  if (!d.isActive) {
    return { tone: "warning", title: "Launch blocked: clinic paused", body: "Reactivate the clinic before launching SMS recovery.", target: "admin", actionLabel: "Go to Admin tools" };
  }
  if (!d.hasAssignedNumber) {
    return { tone: "warning", title: "Launch blocked: phone number required", body: "Assign a tracking number before launching SMS recovery for this clinic.", target: "phone", actionLabel: "Go to Phone number" };
  }
  if (!d.a2pInfoCompleted) {
    return { tone: "warning", title: "Launch blocked: SMS approval incomplete", body: "Complete SMS approval before launching SMS recovery.", target: "sms", actionLabel: "Go to SMS approval" };
  }
  void launchBlockedReason;
  return { tone: "info", title: "Ready to launch", body: "All prerequisites met. Launch from Admin tools.", target: "admin", actionLabel: "Go to Admin tools" };
}
