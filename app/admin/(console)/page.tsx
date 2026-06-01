import Link from "next/link";
import { getAdminOverview } from "../../../lib/db/admin/overview";
import { Kpi } from "./_components/AdminUI";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminOverviewPage() {
  const o = await getAdminOverview().catch(() => null);

  if (!o) {
    return (
      <section className="card card-pad">
        <h1 className="t-h2">Overview</h1>
        <p className="t-small" style={{ marginTop: "var(--space-3)", color: "var(--text-muted)" }}>
          Couldn&apos;t load admin metrics right now. Please retry.
        </p>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <header>
        <h1 className="t-h2">Overview</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}>
          Platform-wide operational state. All counts are live.
        </p>
      </header>

      <div className="adm-kpis">
        <Kpi label="Total clinics" value={o.totalClinics} />
        <Kpi label="Active" value={o.activeClinics} />
        <Kpi label="Inactive" value={o.inactiveClinics} />
        <Kpi label="SMS recovery on" value={o.smsRecoveryEnabled} />
        <Kpi label="SMS recovery off" value={o.smsRecoveryDisabled} />
        <Kpi label="Number assigned" value={o.withAssignedNumber} />
        <Kpi label="Number missing" value={o.withoutAssignedNumber} />
        <Kpi label="Needs action" value={o.clinicsNeedingAction} hint="Active, profile/SMS-approval incomplete" />
        <Kpi label="Calls (7d)" value={o.recentCalls} />
        <Kpi label="Message failures (7d)" value={o.recentMessageFailures} />
      </div>

      <section className="card card-pad">
        <h2 className="t-h4">Next</h2>
        <p className="t-small" style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}>
          Open <Link className="link" href="/admin/clinics">Clinics</Link> to review a clinic and run
          admin actions, or the <Link className="link" href="/admin/audit">Audit</Link> log to see recent
          admin activity.
        </p>
      </section>
    </div>
  );
}
