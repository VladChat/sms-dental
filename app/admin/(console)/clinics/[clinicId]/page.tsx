import Link from "next/link";
import { getAdminClinicDetail } from "../../../../../lib/db/admin/clinics";
import { Badge, BoolBadge, Row, billingTone, smsStatusTone } from "../../_components/AdminUI";
import { AdminClinicActions } from "./_components/AdminClinicActions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const enableSmsBlockedReason = !d.isActive
    ? "Clinic is inactive."
    : !d.hasAssignedNumber
      ? "No assigned phone number."
      : !d.a2pInfoCompleted
        ? "SMS approval information is not completed."
        : null;

  const addressParts = [d.street, d.addressLine2, d.city, d.stateRegion, d.postalCode, d.country]
    .filter((x) => x && x.trim().length > 0);

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <header className="adm-detail-head">
        <div>
          <p className="t-small"><Link className="link" href="/admin/clinics">← Clinics</Link></p>
          <h1 className="t-h2" style={{ marginTop: "var(--space-1)" }}>{d.name}</h1>
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
            <BoolBadge value={d.isActive} yes="Active" no="Inactive" noTone="warning" />
            <BoolBadge value={d.smsRecoveryEnabled} yes="SMS recovery on" no="SMS recovery off" />
            <Badge tone={smsStatusTone(d.smsStatus)}>SMS: {d.smsStatus}</Badge>
          </div>
        </div>
        <div className="adm-detail-head-links">
          <Link className="btn btn-secondary btn-sm" href={`/admin/clinics/${d.id}/events`}>Events</Link>
          {d.slug && <Link className="btn btn-secondary btn-sm" href={`/business/${d.slug}`}>Public page</Link>}
        </div>
      </header>

      <div className="adm-detail">
        <div className="adm-detail-main">
          <section className="card card-pad">
            <h3 className="t-h4">Business identity</h3>
            <dl className="adm-rows">
              <Row label="Legal name">{d.legalBusinessName ?? "—"}</Row>
              <Row label="Business type">{d.businessType ?? "—"}</Row>
              <Row label="EIN / Tax ID"><BoolBadge value={d.einProvided} yes="Provided" no="Not provided" /></Row>
              <Row label="Address">{addressParts.length ? addressParts.join(", ") : "—"}</Row>
              <Row label="Website">{d.website ? <a className="link" href={d.website} rel="noreferrer noopener" target="_blank">{d.website}</a> : "—"}</Row>
              <Row label="Business profile"><BoolBadge value={d.businessInfoCompleted} yes="Complete" no="Incomplete" noTone="warning" /></Row>
            </dl>
          </section>

          <section className="card card-pad">
            <h3 className="t-h4">Owner &amp; members</h3>
            <dl className="adm-rows">
              <Row label="Owner contact email"><span className="t-mono">{d.ownerContactEmail ?? "—"}</span></Row>
              <Row label="Owner contact name">{d.ownerContactName ?? "—"}</Row>
            </dl>
            {d.members.length > 0 ? (
              <div className="adm-table-wrap" style={{ marginTop: "var(--space-3)" }}>
                <table className="acct-team-table">
                  <thead><tr><th>Email</th><th>Role</th><th>Status</th></tr></thead>
                  <tbody>
                    {d.members.map((m) => (
                      <tr key={`${m.email}-${m.role}`}>
                        <td className="t-mono">{m.email}</td>
                        <td>{m.role}</td>
                        <td>{m.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>No linked members.</p>
            )}
          </section>

          <section className="card card-pad">
            <h3 className="t-h4">Billing readiness</h3>
            <dl className="adm-rows">
              <Row label="Billing status"><Badge tone={billingTone(d.billingStatus)}>{d.billingStatus}</Badge></Row>
              <Row label="Payment method"><BoolBadge value={d.stripeCustomerPresent} yes="On file" no="None" /></Row>
              <Row label="Subscription"><BoolBadge value={d.stripeSubscriptionPresent} yes="Present" no="None" /></Row>
              <Row label="Trial ends">{d.trialEndsAt ? new Date(d.trialEndsAt).toLocaleDateString() : "—"}</Row>
            </dl>
            <BlockedNote text="Collect payment method, start/pause billing — blocked until Stripe billing is connected. No charge before SMS recovery is active." />
          </section>

          <section className="card card-pad">
            <h3 className="t-h4">Phone number</h3>
            <dl className="adm-rows">
              <Row label="Assigned number">{d.hasAssignedNumber ? <span className="t-mono">{d.assignedPhoneMasked}</span> : "Not assigned yet"}</Row>
              <Row label="Local number status">{d.localNumberStatus}</Row>
            </dl>
            <BlockedNote text="Purchase / release / reassign number — blocked until the Twilio number-purchase flow is enabled." />
          </section>

          <section className="card card-pad">
            <h3 className="t-h4">SMS approval / A2P</h3>
            <dl className="adm-rows">
              <Row label="SMS status"><Badge tone={smsStatusTone(d.smsStatus)}>{d.smsStatus}</Badge></Row>
              <Row label="Approval info"><BoolBadge value={d.a2pInfoCompleted} yes="Completed" no="Incomplete" noTone="warning" /></Row>
              <Row label="Authorized"><BoolBadge value={d.a2pAuthorized} yes="Yes" no="No" /></Row>
              <Row label="Representative"><BoolBadge value={d.a2pRepProvided} yes="Provided" no="Not provided" /></Row>
            </dl>
            <BlockedNote text="A2P / carrier submission — not wired. Status is operator-tracked here; no carrier submission is sent." />
          </section>

          <section className="card card-pad">
            <h3 className="t-h4">Recovery &amp; diagnostics</h3>
            <dl className="adm-rows">
              <Row label="SMS recovery"><BoolBadge value={d.smsRecoveryEnabled} yes="Enabled" no="Disabled" /></Row>
              <Row label="Setup status">{d.setupStatus}</Row>
              <Row label="Active opt-outs">{d.optOutCount}</Row>
              <Row label="Provisioning">{d.adminProvisioningStatus ?? "none"}</Row>
            </dl>
            <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
              <Link className="link" href={`/admin/clinics/${d.id}/events`}>View call / message diagnostics →</Link>
            </p>
          </section>
        </div>

        <aside className="adm-detail-side">
          <section className="card card-pad">
            <h3 className="t-h4">Admin actions</h3>
            <AdminClinicActions
              clinicId={d.id}
              isActive={d.isActive}
              smsRecoveryEnabled={d.smsRecoveryEnabled}
              adminInternalNote={d.adminInternalNote}
              adminProvisioningStatus={d.adminProvisioningStatus}
              adminProvisioningNote={d.adminProvisioningNote}
              enableSmsBlockedReason={enableSmsBlockedReason}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}

function BlockedNote({ text }: { text: string }) {
  return (
    <div className="adm-blocked" role="note">
      <span className="badge badge-neutral">Blocked</span>
      <span className="t-small" style={{ color: "var(--text-muted)" }}>{text}</span>
    </div>
  );
}
