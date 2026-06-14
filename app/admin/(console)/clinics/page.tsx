import Link from "next/link";
import { listAdminClinics } from "../../../../lib/db/admin/clinics";
import {
  Badge,
  BoolBadge,
  billingTone,
  smsReadinessListLabel,
  smsReadinessListTone,
} from "../_components/AdminUI";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SP = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}
function triState(v: string): boolean | null {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

export default async function AdminClinicsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const active = one(sp.active);
  const sms = one(sp.sms);
  const phone = one(sp.phone);

  const clinics = await listAdminClinics({
    search: q || null,
    active: triState(active),
    sms: triState(sms),
    phone: triState(phone),
  }).catch(() => null);

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <header>
        <h1 className="t-h2">Clinics</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}>
          {clinics ? `${clinics.length} shown` : "—"}
        </p>
      </header>

      <form method="get" className="card card-pad adm-filters" aria-label="Filter clinics">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="Clinic name or owner email" spellCheck={false} />
        </div>
        <Select name="active" label="Active" value={active} />
        <Select name="sms" label="SMS recovery" value={sms} />
        <Select name="phone" label="Phone assigned" value={phone} />
        <div className="adm-filters-actions">
          <button type="submit" className="btn btn-primary">Apply</button>
          <Link className="btn btn-secondary" href="/admin/clinics">Clear</Link>
        </div>
      </form>

      {!clinics ? (
        <section className="card card-pad">
          <p className="t-small" style={{ color: "var(--text-muted)" }}>Couldn&apos;t load clinics. Please retry.</p>
        </section>
      ) : clinics.length === 0 ? (
        <section className="card card-pad">
          <p className="t-body" style={{ margin: 0 }}>No clinics match these filters.</p>
        </section>
      ) : (
        <div className="adm-table-wrap card">
          <table className="acct-team-table adm-table">
            <thead>
              <tr>
                <th>Clinic</th>
                <th>Owner email</th>
                <th>Active</th>
                <th>SMS recovery</th>
                <th>Phone</th>
                <th>Billing</th>
                <th>SMS readiness</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {clinics.map((c) => (
                <tr key={c.id}>
                  <td><Link className="link" href={`/admin/clinics/${c.id}`}>{c.name}</Link></td>
                  <td className="t-mono">{c.ownerEmail ?? "—"}</td>
                  <td><BoolBadge value={c.isActive} yes="Active" no="Inactive" noTone="warning" /></td>
                  <td><BoolBadge value={c.smsRecoveryEnabled} yes="On" no="Off" /></td>
                  <td>{c.hasAssignedNumber ? <span className="t-mono">{c.assignedPhoneMasked}</span> : <Badge tone="neutral">None</Badge>}</td>
                  <td><Badge tone={billingTone(c.billingStatus)}>{c.billingStatus}</Badge></td>
                  <td>
                    <Badge tone={smsReadinessListTone(c.smsReadinessStatus)}>
                      {smsReadinessListLabel(c.smsReadinessStatus)}
                    </Badge>
                  </td>
                  <td className="t-helper">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Select({ name, label, value }: { name: string; label: string; value: string }) {
  const opts: { v: string; t: string }[] = [
    { v: "", t: "All" },
    { v: "yes", t: "Yes" },
    { v: "no", t: "No" },
  ];
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} className="input" defaultValue={value}>
        {opts.map((o) => (
          <option key={o.v} value={o.v}>{o.t}</option>
        ))}
      </select>
    </div>
  );
}
