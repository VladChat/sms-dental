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
  const showingSamples = cards.length === 0;
  const displayCards = showingSamples ? SAMPLE_REQUESTS : cards;
  const [selectedId, setSelectedId] = useState<string | null>(displayCards[0]?.id ?? null);
  const selected = displayCards.find((c) => c.id === selectedId) ?? displayCards[0] ?? null;

  return (
    <main className="ws-page">
      <header className="ws-header">
        <h1 className="t-h2">Front desk workspace</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Review missed-call replies and patient requests.
        </p>
      </header>

      {showingSamples && <SampleStateCallout />}

      <div className="ws-layout">
        <nav className="ws-list" aria-label={showingSamples ? "Sample requests" : "Patient requests"}>
          {displayCards.map((c) => {
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
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                    {c.isSample && <span className="badge badge-info">Sample</span>}
                    <span className={`badge ${m.badge}`}><span className="dot" aria-hidden="true" />{m.label}</span>
                  </span>
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
          <RequestDetail key={selected.id} card={selected} />
        ) : (
          <section className="card card-pad" aria-live="polite">
            <p className="t-small" style={{ color: "var(--text-muted)" }}>
              Select a request to see details.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function SampleStateCallout() {
  return (
    <section className="ws-sample-callout card card-pad" aria-label="Sample requests">
      <h2 className="t-h4">Sample requests</h2>
      <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
        No real patient requests are available yet. These sample cards show how front desk outcomes will look.
      </p>
    </section>
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
        <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
          {card.isSample && <span className="badge badge-info">Sample</span>}
          <StatusBadge status={card.status} />
        </div>
      </header>

      <dl className="ws-detail-rows">
        <Row label="Patient name" value={card.patientName ?? NOT_PROVIDED} />
        <Row label="Request type" value={card.requestType ?? NOT_PROVIDED} />
        <Row label="Preferred time" value={card.preferredTime ?? NOT_PROVIDED} />
        <Row label="Summary" value={card.summary ?? NOT_PROVIDED} />
        <Row label="First seen" value={formatDateTime(card.createdAt)} />
        <Row label="Last activity" value={formatDateTime(card.lastActivityAt)} />
      </dl>

      {card.sampleNote && (
        <div className="ws-sample-note">
          <p className="t-small" style={{ margin: 0 }}>{card.sampleNote}</p>
        </div>
      )}

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

      {card.isSample && <SampleResultPreview />}

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

function SampleResultPreview() {
  const [result, setResult] = useState<string>("");
  const [note, setNote] = useState("");

  return (
    <section className="ws-result-preview" aria-labelledby="ws-result-preview-title">
      <h3 id="ws-result-preview-title" className="t-h4">Result</h3>
      <div className="ws-result-options">
        <label className="check">
          <input
            type="radio"
            name="sample_result"
            value="Appointment booked"
            checked={result === "Appointment booked"}
            onChange={(event) => setResult(event.target.value)}
          />
          <span>Appointment booked</span>
        </label>
        <label className="check">
          <input
            type="radio"
            name="sample_result"
            value="No appointment booked"
            checked={result === "No appointment booked"}
            onChange={(event) => setResult(event.target.value)}
          />
          <span>No appointment booked</span>
        </label>
        <label className="check">
          <input
            type="radio"
            name="sample_result"
            value="Could not reach patient"
            checked={result === "Could not reach patient"}
            onChange={(event) => setResult(event.target.value)}
          />
          <span>Could not reach patient</span>
        </label>
      </div>
      <div className="field">
        <label htmlFor="sample-result-note">Note</label>
        <textarea
          id="sample-result-note"
          className="textarea"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional short note"
        />
      </div>
      <p className="t-helper" style={{ margin: 0 }}>
        Preview only. Results are not saved in this phase.
      </p>
    </section>
  );
}

const SAMPLE_REQUESTS: PatientRequestCard[] = [
  {
    id: "sample-needs-follow-up",
    callerPhone: "+1 (555) 010-1001",
    patientName: "Jordan Lee",
    requestType: "Cleaning appointment",
    preferredTime: "Tuesday morning",
    summary: "Requested a cleaning appointment.",
    latestMessage: "Hi, can I book a cleaning for Tuesday morning?",
    latestMessageDirection: "inbound",
    status: "needs_follow_up",
    createdAt: "2026-05-24T14:30:00.000Z",
    lastActivityAt: "2026-05-24T14:36:00.000Z",
    timeline: [
      {
        id: "sample-needs-follow-up-1",
        direction: "inbound",
        body: "Hi, can I book a cleaning for Tuesday morning?",
        at: "2026-05-24T14:36:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Patient asked for a cleaning appointment Tuesday morning.",
  },
  {
    id: "sample-waiting-for-patient",
    callerPhone: "+1 (555) 010-1002",
    patientName: "Avery Chen",
    requestType: "Tooth pain consult",
    preferredTime: "Next available",
    summary: "Office replied and is waiting for confirmation.",
    latestMessage: "We can help. Does tomorrow at 10:00 AM work for you?",
    latestMessageDirection: "outbound",
    status: "waiting_for_patient",
    createdAt: "2026-05-24T13:10:00.000Z",
    lastActivityAt: "2026-05-24T13:22:00.000Z",
    timeline: [
      {
        id: "sample-waiting-for-patient-1",
        direction: "inbound",
        body: "I have tooth pain and need an appointment.",
        at: "2026-05-24T13:18:00.000Z",
      },
      {
        id: "sample-waiting-for-patient-2",
        direction: "outbound",
        body: "We can help. Does tomorrow at 10:00 AM work for you?",
        at: "2026-05-24T13:22:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Waiting for patient reply.",
  },
  {
    id: "sample-booked",
    callerPhone: "+1 (555) 010-1003",
    patientName: "Taylor Brooks",
    requestType: "New patient exam",
    preferredTime: "Tuesday morning",
    summary: "Appointment confirmed.",
    latestMessage: "Great, please put me down for Tuesday morning.",
    latestMessageDirection: "inbound",
    status: "booked",
    createdAt: "2026-05-23T15:00:00.000Z",
    lastActivityAt: "2026-05-23T15:16:00.000Z",
    timeline: [
      {
        id: "sample-booked-1",
        direction: "outbound",
        body: "We have Tuesday at 9:00 AM available.",
        at: "2026-05-23T15:11:00.000Z",
      },
      {
        id: "sample-booked-2",
        direction: "inbound",
        body: "Great, please put me down for Tuesday morning.",
        at: "2026-05-23T15:16:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Appointment booked for Tuesday morning.",
  },
  {
    id: "sample-no-book",
    callerPhone: "+1 (555) 010-1004",
    patientName: "Morgan Patel",
    requestType: "Whitening consult",
    preferredTime: "Not provided",
    summary: "Patient declined to schedule.",
    latestMessage: "Thanks, but I’m not ready to book yet.",
    latestMessageDirection: "inbound",
    status: "no_appointment_booked",
    createdAt: "2026-05-23T11:00:00.000Z",
    lastActivityAt: "2026-05-23T11:18:00.000Z",
    timeline: [
      {
        id: "sample-no-book-1",
        direction: "outbound",
        body: "Would you like to schedule a whitening consult this week?",
        at: "2026-05-23T11:12:00.000Z",
      },
      {
        id: "sample-no-book-2",
        direction: "inbound",
        body: "Thanks, but I’m not ready to book yet.",
        at: "2026-05-23T11:18:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Patient did not book an appointment.",
  },
  {
    id: "sample-could-not-reach",
    callerPhone: "+1 (555) 010-1005",
    patientName: "Riley Nguyen",
    requestType: "Follow-up call",
    preferredTime: "Afternoon",
    summary: "No contact after follow-up attempts.",
    latestMessage: "Left voicemail after two call attempts.",
    latestMessageDirection: "outbound",
    status: "could_not_reach_patient",
    createdAt: "2026-05-22T16:20:00.000Z",
    lastActivityAt: "2026-05-22T16:44:00.000Z",
    timeline: [
      {
        id: "sample-could-not-reach-1",
        direction: "outbound",
        body: "Tried calling and left a voicemail.",
        at: "2026-05-22T16:44:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Could not reach patient, left voicemail.",
  },
];
