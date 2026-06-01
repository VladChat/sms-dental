import Link from "next/link";
import { listAdminAuditEvents } from "../../../../lib/db/admin/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SP = Record<string, string | string[] | undefined>;
function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function summarize(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    const s = JSON.stringify(value);
    return s.length > 80 ? `${s.slice(0, 80)}…` : s;
  } catch {
    return "—";
  }
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const adminEmail = one(sp.admin).trim();
  const action = one(sp.action).trim();
  const clinic = one(sp.clinic).trim();

  const events = await listAdminAuditEvents({
    adminEmail: adminEmail || null,
    action: action || null,
    clinicId: clinic || null,
  }).catch(() => null);

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <header>
        <h1 className="t-h2">Audit log</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}>
          Every platform-admin action. Redacted before/after snapshots; no secrets.
        </p>
      </header>

      <form method="get" className="card card-pad adm-filters" aria-label="Filter audit log">
        <div className="field">
          <label htmlFor="admin">Admin email</label>
          <input id="admin" name="admin" className="input" defaultValue={adminEmail} placeholder="admin@example.com" spellCheck={false} />
        </div>
        <div className="field">
          <label htmlFor="action">Action</label>
          <input id="action" name="action" className="input" defaultValue={action} placeholder="clinic.deactivate" spellCheck={false} />
        </div>
        <div className="adm-filters-actions">
          <button type="submit" className="btn btn-primary">Apply</button>
          <Link className="btn btn-secondary" href="/admin/audit">Clear</Link>
        </div>
      </form>

      {!events ? (
        <section className="card card-pad">
          <p className="t-small" style={{ color: "var(--text-muted)" }}>Couldn&apos;t load the audit log. Please retry.</p>
        </section>
      ) : events.length === 0 ? (
        <section className="card card-pad">
          <p className="t-body" style={{ margin: 0 }}>No audit events yet.</p>
        </section>
      ) : (
        <div className="adm-table-wrap card">
          <table className="acct-team-table adm-table">
            <thead>
              <tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Clinic</th><th>After</th></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="t-helper">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="t-mono">{e.admin_email}</td>
                  <td>{e.action}</td>
                  <td>{e.target_type}</td>
                  <td>{e.clinic_id ? <Link className="link" href={`/admin/clinics/${e.clinic_id}`}>open</Link> : "—"}</td>
                  <td className="t-mono t-helper">{summarize(e.after_state)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
