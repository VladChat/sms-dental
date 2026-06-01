import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminClinicDetail } from "../../../../../lib/db/admin/clinics";
import { listAdminAuditEvents } from "../../../../../lib/db/admin/audit";
import {
  Badge,
  BoolBadge,
  CheckRow,
  ReadyBadge,
  Row,
  billingTone,
  describeAuditAction,
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
  return PHONE_ROLE_LABELS[role] ?? role.replace(/_/g, " ");
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

  // Recent admin activity for this clinic only (last 5). Human-readable; no JSON.
  const activity = await listAdminAuditEvents({ clinicId: d.id }, 5).catch(() => []);

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
  const launchState: ReadyState = d.smsRecoveryEnabled
    ? "launched"
    : launchBlockedReason
      ? "blocked"
      : "not_launched";

  const service = currentServiceState(d.isActive, d.smsRecoveryEnabled, launchBlockedReason);

  // Missing-field hint for the Business profile row (only when incomplete).
  const missingBusiness = [
    d.legalBusinessName ? null : "legal name",
    d.businessType ? null : "business type",
    d.einProvided ? null : "EIN / Tax ID",
    d.street && d.city && d.postalCode ? null : "address",
  ].filter((x): x is string => Boolean(x));

  const ownerEmail = d.ownerContactEmail
    ?? d.members.find((m) => m.role === "owner")?.email
    ?? null;

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <header className="adm-detail-head">
        <div>
          <p className="t-small"><Link className="link" href="/admin/clinics">← Clinics</Link></p>
          <h1 className="t-h2" style={{ marginTop: "var(--space-1)" }}>{d.name}</h1>
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
            <BoolBadge value={d.isActive} yes="Active" no="Paused" noTone="warning" />
            <Badge tone={service.tone}>{service.label}</Badge>
          </div>
        </div>
        <div className="adm-detail-head-links">
          <Link className="btn btn-secondary btn-sm" href={`/admin/clinics/${d.id}/events`}>Diagnostics</Link>
          {d.slug && <Link className="btn btn-secondary btn-sm" href={`/business/${d.slug}`}>Public page</Link>}
        </div>
      </header>

      {/* A — Clinic summary */}
      <section className="card card-pad">
        <h3 className="t-h4">Clinic summary</h3>
        <dl className="adm-rows">
          <Row label="Clinic name">{d.name}</Row>
          <Row label="Owner email"><span className="t-mono">{ownerEmail ?? "—"}</span></Row>
          <Row label="Clinic status"><BoolBadge value={d.isActive} yes="Active" no="Paused" noTone="warning" /></Row>
          <Row label="Service state"><Badge tone={service.tone}>{service.label}</Badge></Row>
        </dl>
      </section>

      {/* B — Launch readiness */}
      <section className="card card-pad">
        <h3 className="t-h4">Launch readiness</h3>
        <p className="t-helper" style={{ margin: "var(--space-1) 0 0" }}>
          One row per real prerequisite. Launch the service from Admin controls below once the gate clears.
        </p>
        <div style={{ marginTop: "var(--space-3)" }}>
          <CheckRow
            title="Business profile"
            hint={businessState === "ready" ? "Business identity on file" : `Missing: ${missingBusiness.join(", ") || "required fields"}`}
            state={businessState}
          />
          <CheckRow
            title="Billing"
            hint={billingState === "ready" ? "Payment method on file" : "Stripe billing backend not connected — not required to launch in this MVP"}
            state={billingState}
          />
          <CheckRow
            title="Phone numbers"
            hint={phoneState === "ready" ? "At least one active number assigned" : "No active number assigned"}
            state={phoneState}
          />
          <CheckRow
            title="A2P / SMS approval"
            hint={a2pState === "ready" ? "Approval info complete and authorized" : "Approval info incomplete"}
            state={a2pState}
          />
          <div className="adm-check">
            <div className="adm-check-main">
              <span className="adm-check-title">Service launch</span>
              <span className="adm-check-hint">
                {launchState === "launched"
                  ? "Service is launched (SMS recovery gate on)"
                  : launchState === "blocked"
                    ? `Blocked: ${launchBlockedReason}`
                    : "All prerequisites met — launch from Admin controls"}
              </span>
            </div>
            <ReadyBadge state={launchState} />
          </div>
        </div>
      </section>

      {/* C — Phone numbers */}
      <section className="card card-pad">
        <h3 className="t-h4">Phone numbers</h3>
        {d.phoneNumbers.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
            No phone number assigned yet.
          </p>
        ) : (
          <div className="adm-phone-list">
            {d.phoneNumbers.map((p) => (
              <div className="adm-phone-row" key={p.id}>
                <span className="t-mono">{p.phoneMasked ?? "—"}</span>
                <span className="t-small" style={{ color: "var(--text-muted)" }}>{phoneRoleLabel(p.role)}</span>
                <BoolBadge value={p.isActive} yes="Active" no="Inactive" noTone="neutral" />
              </div>
            ))}
          </div>
        )}
        <DisabledAction label="Add phone number" reason="Twilio purchase flow required" />
      </section>

      {/* D — Billing */}
      <section className="card card-pad">
        <h3 className="t-h4">Billing</h3>
        <dl className="adm-rows">
          <Row label="Billing status"><Badge tone={billingTone(d.billingStatus)}>{d.billingStatus}</Badge></Row>
          <Row label="Payment method"><BoolBadge value={d.stripeCustomerPresent} yes="On file" no="None" /></Row>
          <Row label="Subscription"><BoolBadge value={d.stripeSubscriptionPresent} yes="Present" no="None" /></Row>
          <Row label="Trial ends">{d.trialEndsAt ? new Date(d.trialEndsAt).toLocaleDateString() : "—"}</Row>
        </dl>
        <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
          Billing controls unavailable — Stripe payment flow required.
        </p>
        <DisabledAction label="Manage billing" reason="Stripe billing backend required" />
      </section>

      {/* E — A2P / SMS approval */}
      <section className="card card-pad">
        <h3 className="t-h4">A2P / SMS approval</h3>
        <dl className="adm-rows">
          <Row label="SMS status"><Badge tone={smsStatusTone(d.smsStatus)}>{d.smsStatus}</Badge></Row>
          <Row label="Approval info"><BoolBadge value={d.a2pInfoCompleted} yes="Complete" no="Incomplete" noTone="warning" /></Row>
          <Row label="Authorized"><BoolBadge value={d.a2pAuthorized} yes="Yes" no="No" /></Row>
          <Row label="Representative"><BoolBadge value={d.a2pRepProvided} yes="Provided" no="Not provided" /></Row>
        </dl>
        <DisabledAction label="Submit SMS approval" reason="A2P submission backend required" />
      </section>

      {/* F — Admin controls */}
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

      {/* G — Diagnostics */}
      <section className="card card-pad">
        <h3 className="t-h4">Diagnostics</h3>
        <dl className="adm-rows">
          <Row label="Active opt-outs">{d.optOutCount}</Row>
          <Row label="Setup status">{d.setupStatus}</Row>
        </dl>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          <Link className="link" href={`/admin/clinics/${d.id}/events`}>View call / message diagnostics →</Link>
        </p>
      </section>

      {/* H — Recent admin activity */}
      <section className="card card-pad">
        <h3 className="t-h4">Recent admin activity</h3>
        {activity.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
            No admin actions recorded for this clinic yet.
          </p>
        ) : (
          <div className="adm-activity">
            {activity.map((e) => (
              <div className="adm-activity-item" key={e.id}>
                <span className="t-small">{describeAuditAction(e.action)}</span>
                <span className="t-helper" style={{ color: "var(--text-muted)" }}>
                  {e.admin_email} · {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function currentServiceState(
  isActive: boolean,
  launched: boolean,
  launchBlockedReason: string | null,
): { label: string; tone: Tone } {
  if (!isActive) return { label: "Paused", tone: "warning" };
  if (launched) return { label: "Launched", tone: "success" };
  if (launchBlockedReason) return { label: "Blocked", tone: "neutral" };
  return { label: "Not launched", tone: "neutral" };
}

// Honest disabled placeholder: an essential future action whose backend is not
// wired yet. It never looks clickable and always states why.
function DisabledAction({ label, reason }: { label: string; reason: ReactNode }) {
  return (
    <div className="adm-blocked" role="note" style={{ marginTop: "var(--space-3)" }}>
      <button type="button" className="btn btn-secondary btn-sm" disabled aria-disabled="true">{label}</button>
      <span className="t-small" style={{ color: "var(--text-muted)" }}>{reason}</span>
    </div>
  );
}
