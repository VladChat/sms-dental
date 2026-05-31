"use client";

import { useState } from "react";
import {
  WORKSPACE_STATUS_META,
  NOT_PROVIDED,
  formatDateTime,
  type PatientRequestCard,
} from "./workspace-types";

function StatusBadge({ status }: { status: PatientRequestCard["status"] }) {
  const m = WORKSPACE_STATUS_META[status];
  return <span className={`badge ${m.badge}`}><span className="dot" aria-hidden="true" />{m.label}</span>;
}

export function Workspace({ cards }: { cards: PatientRequestCard[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(cards[0]?.id ?? null);
  const selected = cards.find((c) => c.id === selectedId) ?? null;

  return (
    <main className="ws-page">
      <header className="ws-header">
        <h1 className="t-h2">Front desk workspace</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Review missed-call replies and patient requests.
        </p>
      </header>

      {cards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="ws-layout">
          <nav className="ws-list" aria-label="Patient requests">
            {cards.map((c) => {
              const m = WORKSPACE_STATUS_META[c.status];
              return (
                <button
                  key={c.id}
                  type="button"
                  className="ws-list-item"
                  aria-current={c.id === selectedId ? "true" : undefined}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className="ws-list-top">
                    <span className="ws-list-name">{c.patientName ?? c.callerPhone}</span>
                    <span className={`badge ${m.badge}`}><span className="dot" aria-hidden="true" />{m.label}</span>
                  </span>
                  {c.patientName && (
                    <span className="t-small ws-meta t-mono">{c.callerPhone}</span>
                  )}
                  <span className="t-small ws-snippet">
                    {c.latestMessage ?? "No messages yet"}
                  </span>
                  <span className="t-helper ws-meta">
                    Last activity · {formatDateTime(c.lastActivityAt)}
                  </span>
                </button>
              );
            })}
          </nav>

          {selected ? (
            <RequestDetail card={selected} />
          ) : (
            <section className="card card-pad" aria-live="polite">
              <p className="t-small" style={{ color: "var(--text-muted)" }}>
                Select a request to see details.
              </p>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function RequestDetail({ card }: { card: PatientRequestCard }) {
  return (
    <section className="card card-pad ws-detail" aria-labelledby="ws-detail-title">
      <header className="acct-section-head">
        <div>
          <h2 id="ws-detail-title" className="t-h3">
            {card.patientName ?? card.callerPhone}
          </h2>
          <p className="t-small t-mono" style={{ marginTop: "var(--space-1)", color: "var(--text-secondary)" }}>
            {card.callerPhone}
          </p>
        </div>
        <StatusBadge status={card.status} />
      </header>

      <dl className="ws-detail-rows">
        <Row label="Patient name" value={card.patientName ?? NOT_PROVIDED} />
        <Row label="Request type" value={card.requestType ?? NOT_PROVIDED} />
        <Row label="Preferred time" value={card.preferredTime ?? NOT_PROVIDED} />
        <Row label="Summary" value={card.summary ?? NOT_PROVIDED} />
        <Row label="First seen" value={formatDateTime(card.createdAt)} />
        <Row label="Last activity" value={formatDateTime(card.lastActivityAt)} />
      </dl>

      <div>
        <h3 className="t-h4" style={{ marginBottom: "var(--space-3)" }}>Conversation</h3>
        {card.timeline.length === 0 ? (
          <p className="t-small" style={{ color: "var(--text-muted)" }}>No messages yet.</p>
        ) : (
          <div className="ws-timeline">
            {card.timeline.map((t) => (
              <div key={t.id} className={`ws-bubble${t.direction === "inbound" ? " is-inbound" : ""}`}>
                <div className="ws-bubble-head">
                  <span className="t-helper" style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                    {t.direction === "inbound" ? "Patient" : "Your office"}
                  </span>
                  <span className="t-helper ws-meta">{formatDateTime(t.at)}</span>
                </div>
                <p className="t-small" style={{ margin: 0, color: "var(--text-body)", overflowWrap: "anywhere" }}>
                  {t.body || NOT_PROVIDED}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ws-notes">
        Internal notes and follow-up tools will appear here in a future update.
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const muted = value === NOT_PROVIDED;
  return (
    <div className="ws-row">
      <dt>{label}</dt>
      <dd style={muted ? { color: "var(--text-muted)", fontWeight: 400 } : undefined}>{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="ws-empty">
      <h2 className="t-h4">No patient requests yet</h2>
      <p className="t-small" style={{ color: "var(--text-muted)", maxWidth: 420 }}>
        When patients reply to a missed-call text, their requests will show up here for your front
        desk to review.
      </p>
    </div>
  );
}
