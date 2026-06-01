import Link from "next/link";
import { getClinicEvents } from "../../../../../../lib/db/admin/events";
import { Badge } from "../../../_components/AdminUI";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminClinicEventsPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const events = await getClinicEvents(clinicId).catch(() => null);

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <header>
        <p className="t-small"><Link className="link" href={`/admin/clinics/${clinicId}`}>← Clinic detail</Link></p>
        <h1 className="t-h2" style={{ marginTop: "var(--space-1)" }}>Diagnostics</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}>
          Recent calls and messages. Phone numbers are masked; Twilio SIDs show a short tail only; no raw payloads.
        </p>
      </header>

      {!events ? (
        <section className="card card-pad">
          <p className="t-small" style={{ color: "var(--text-muted)" }}>Couldn&apos;t load diagnostics. Please retry.</p>
        </section>
      ) : (
        <>
          <section className="card card-pad">
            <h3 className="t-h4">Calls</h3>
            {events.calls.length === 0 ? (
              <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>No call events.</p>
            ) : (
              <div className="adm-table-wrap" style={{ marginTop: "var(--space-3)" }}>
                <table className="acct-team-table">
                  <thead><tr><th>When</th><th>Direction</th><th>Status</th><th>Missed</th><th>From</th><th>To</th><th>SID</th></tr></thead>
                  <tbody>
                    {events.calls.map((c) => (
                      <tr key={c.id}>
                        <td className="t-helper">{new Date(c.occurredAt).toLocaleString()}</td>
                        <td>{c.direction ?? "—"}</td>
                        <td>{c.callStatus ?? "—"}</td>
                        <td>{c.isMissed ? <Badge tone="warning">Missed</Badge> : "—"}</td>
                        <td className="t-mono">{c.fromMasked ?? "—"}</td>
                        <td className="t-mono">{c.toMasked ?? "—"}</td>
                        <td className="t-mono t-helper">{c.sidTail ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card card-pad">
            <h3 className="t-h4">Messages</h3>
            {events.messages.length === 0 ? (
              <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>No message events.</p>
            ) : (
              <div className="adm-table-wrap" style={{ marginTop: "var(--space-3)" }}>
                <table className="acct-team-table">
                  <thead><tr><th>When</th><th>Direction</th><th>Status</th><th>Keyword</th><th>Result</th><th>SID</th></tr></thead>
                  <tbody>
                    {events.messages.map((m) => (
                      <tr key={m.id}>
                        <td className="t-helper">{new Date(m.createdAt).toLocaleString()}</td>
                        <td>{m.direction}</td>
                        <td>{m.status ?? "—"}</td>
                        <td>{m.detectedKeyword ?? "—"}</td>
                        <td>{m.errored ? <Badge tone="warning">Error</Badge> : <Badge tone="success">OK</Badge>}</td>
                        <td className="t-mono t-helper">{m.sidTail ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
