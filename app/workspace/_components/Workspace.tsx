"use client";

import { useState } from "react";
import {
  WORKSPACE_STATUS_META,
  NOT_PROVIDED,
  formatDateTime,
  workspaceStatusForOutcome,
  type PatientRequestCard,
} from "./workspace-types";
import {
  FRONT_DESK_OUTCOMES,
  FRONT_DESK_OUTCOME_LABEL,
  FRONT_DESK_NOTE_MAX,
  type FrontDeskOutcome,
} from "../../../lib/workspace/outcome";

function StatusBadge({ status }: { status: PatientRequestCard["status"] }) {
  const m = WORKSPACE_STATUS_META[status];
  return <span className={`badge ${m.badge}`}><span className="dot" aria-hidden="true" />{m.label}</span>;
}

export function Workspace({ cards }: { cards: PatientRequestCard[] }) {
  const realCards = cards;
  const hasReal = realCards.length > 0;
  const [samplesHidden, setSamplesHidden] = useState(false);

  return (
    <main className="ws-page">
      <header className="ws-header">
        <h1 className="t-h2">Front desk workspace</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Review missed-call replies and patient requests.
        </p>
      </header>

      {hasReal ? (
        <RequestSection cards={realCards} kind="real" />
      ) : (
        samplesHidden && (
          <p className="ws-empty-real t-body">No real patient requests yet.</p>
        )
      )}

      {samplesHidden ? (
        <div className="ws-sample-strip">
          <span className="t-small">Sample requests hidden</span>
          <span aria-hidden="true" className="ws-sample-strip-dot">·</span>
          <button type="button" className="link" onClick={() => setSamplesHidden(false)}>
            Show samples
          </button>
        </div>
      ) : (
        <section className="ws-sample-section" aria-label="Sample requests">
          <div className="ws-sample-banner">
            <div>
              <h2 className="t-h4">Sample requests</h2>
              <p className="t-small" style={{ marginTop: "var(--space-1)" }}>
                These are sample/demo requests. They are not saved.
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSamplesHidden(true)}>
              Hide
            </button>
          </div>
          <RequestSection cards={SAMPLE_REQUESTS} kind="sample" />
        </section>
      )}
    </main>
  );
}

function RequestSection({
  cards,
  kind,
}: {
  cards: PatientRequestCard[];
  kind: "real" | "sample";
}) {
  const [items, setItems] = useState(cards);
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selected = items.find((c) => c.id === selectedId) ?? items[0] ?? null;

  function applySavedOutcome(id: string, outcome: FrontDeskOutcome, note: string) {
    setItems((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              frontDeskOutcome: outcome,
              frontDeskNote: note.length > 0 ? note : null,
              status: workspaceStatusForOutcome(outcome) ?? c.status,
            }
          : c,
      ),
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="ws-layout">
      <nav className="ws-list" aria-label={kind === "sample" ? "Sample requests" : "Patient requests"}>
        {items.map((c) => {
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
        <RequestDetail key={selected.id} card={selected} kind={kind} onSaved={applySavedOutcome} />
      ) : (
        <section className="card card-pad" aria-live="polite">
          <p className="t-small" style={{ color: "var(--text-muted)" }}>
            Select a request to see details.
          </p>
        </section>
      )}
    </div>
  );
}

function RequestDetail({
  card,
  kind,
  onSaved,
}: {
  card: PatientRequestCard;
  kind: "real" | "sample";
  onSaved: (id: string, outcome: FrontDeskOutcome, note: string) => void;
}) {
  const [showConversation, setShowConversation] = useState(false);

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

      <div className="ws-conversation">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowConversation((prev) => !prev)}
        >
          {showConversation ? "Hide conversation" : "View conversation"}
        </button>
        {showConversation && (
          <div style={{ marginTop: "var(--space-4)" }}>
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
        )}
      </div>

      {kind === "real" ? (
        <OutcomeForm card={card} onSaved={onSaved} />
      ) : (
        <SampleOutcomePreview card={card} />
      )}
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

// Real outcome form. Saves the outcome + optional note to Supabase via the
// authenticated, clinic-scoped API. The saved result persists across refreshes.
function OutcomeForm({
  card,
  onSaved,
}: {
  card: PatientRequestCard;
  onSaved: (id: string, outcome: FrontDeskOutcome, note: string) => void;
}) {
  const [outcome, setOutcome] = useState<FrontDeskOutcome | "">(card.frontDeskOutcome ?? "");
  const [note, setNote] = useState(card.frontDeskNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const noteTooLong = note.length > FRONT_DESK_NOTE_MAX;

  function clearStatus() {
    if (saved) setSaved(false);
    if (error) setError(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (!outcome) {
      setError("Please choose an outcome.");
      return;
    }
    if (noteTooLong) {
      setError("Note must be 300 characters or less.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/workspace/outcome", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: card.id, outcome, note }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; note?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? "Could not save. Please try again.");
        return;
      }
      setSaved(true);
      onSaved(card.id, outcome, data.note ?? note.trim());
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="ws-result-form" aria-labelledby="ws-outcome-title" onSubmit={onSubmit}>
      <h3 id="ws-outcome-title" className="t-h4">Outcome</h3>
      <div className="ws-result-options" role="radiogroup" aria-label="Outcome">
        {FRONT_DESK_OUTCOMES.map((value) => (
          <label className="check" key={value}>
            <input
              type="radio"
              name={`outcome-${card.id}`}
              value={value}
              checked={outcome === value}
              onChange={() => {
                setOutcome(value);
                clearStatus();
              }}
            />
            <span>{FRONT_DESK_OUTCOME_LABEL[value]}</span>
          </label>
        ))}
      </div>

      <div className="field">
        <label htmlFor={`note-${card.id}`}>Note</label>
        <textarea
          id={`note-${card.id}`}
          className="textarea"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            clearStatus();
          }}
          aria-invalid={noteTooLong ? "true" : undefined}
        />
        <div className="ws-note-meta">
          <span className="helper">Optional short note.</span>
          <span className={`helper ws-note-count${noteTooLong ? " is-over" : ""}`}>
            {note.length}/{FRONT_DESK_NOTE_MAX}
          </span>
        </div>
        {noteTooLong && (
          <p className="t-helper" style={{ color: "var(--error-text)" }}>
            Note must be 300 characters or less.
          </p>
        )}
      </div>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{error}</span>
        </div>
      )}
      {saved && !error && (
        <p className="t-small" role="status" style={{ color: "var(--success-text)", margin: 0 }}>
          Result saved.
        </p>
      )}

      <div>
        <button type="submit" className="btn btn-primary" disabled={saving || noteTooLong}>
          {saving ? "Saving…" : "Save result"}
        </button>
      </div>
    </form>
  );
}

// Sample outcome preview. Non-persistent: disabled inputs, no save, clearly
// labeled as demo content. Never writes to the database.
function SampleOutcomePreview({ card }: { card: PatientRequestCard }) {
  const previewOutcome: FrontDeskOutcome | null =
    card.status === "booked"
      ? "appointment_booked"
      : card.status === "no_appointment_booked"
        ? "no_appointment_booked"
        : card.status === "could_not_reach_patient"
          ? "could_not_reach_patient"
          : null;
  const previewNote = card.sampleNote ?? "";

  return (
    <div className="ws-result-form" aria-label="Sample outcome preview">
      <div className="ws-result-head">
        <h3 className="t-h4">Outcome</h3>
        <span className="badge badge-info">Sample preview · not saved</span>
      </div>
      <div className="ws-result-options" aria-hidden="true">
        {FRONT_DESK_OUTCOMES.map((value) => (
          <label className="check" key={value}>
            <input type="radio" name={`sample-outcome-${card.id}`} value={value} checked={previewOutcome === value} disabled readOnly />
            <span>{FRONT_DESK_OUTCOME_LABEL[value]}</span>
          </label>
        ))}
      </div>
      <div className="field">
        <label htmlFor={`sample-note-${card.id}`}>Note</label>
        <textarea
          id={`sample-note-${card.id}`}
          className="textarea"
          value={previewNote}
          disabled
          readOnly
        />
        <span className="helper">Optional short note.</span>
      </div>
    </div>
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
    requestType: "Appointment question",
    preferredTime: "Next available",
    summary: "Office replied and is waiting for confirmation.",
    latestMessage: "Does tomorrow at 10:00 AM work for you?",
    latestMessageDirection: "outbound",
    status: "waiting_for_patient",
    createdAt: "2026-05-24T13:10:00.000Z",
    lastActivityAt: "2026-05-24T13:22:00.000Z",
    timeline: [
      {
        id: "sample-waiting-for-patient-1",
        direction: "inbound",
        body: "I have an appointment question before scheduling.",
        at: "2026-05-24T13:18:00.000Z",
      },
      {
        id: "sample-waiting-for-patient-2",
        direction: "outbound",
        body: "Does tomorrow at 10:00 AM work for you?",
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
    requestType: "Reschedule request",
    preferredTime: "Tuesday morning",
    summary: "Appointment confirmed.",
    latestMessage: "Great, Tuesday morning works for me.",
    latestMessageDirection: "inbound",
    status: "booked",
    createdAt: "2026-05-23T15:00:00.000Z",
    lastActivityAt: "2026-05-23T15:16:00.000Z",
    timeline: [
      {
        id: "sample-booked-1",
        direction: "outbound",
        body: "We can move your visit to Tuesday at 9:00 AM.",
        at: "2026-05-23T15:11:00.000Z",
      },
      {
        id: "sample-booked-2",
        direction: "inbound",
        body: "Great, Tuesday morning works for me.",
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
    requestType: "Callback request",
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
        body: "Would you like us to call back to help schedule?",
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
    requestType: "Appointment question",
    preferredTime: "Afternoon",
    summary: "Could not reach the patient.",
    latestMessage: "Thanks for following up.",
    latestMessageDirection: "inbound",
    status: "could_not_reach_patient",
    createdAt: "2026-05-22T16:20:00.000Z",
    lastActivityAt: "2026-05-22T16:44:00.000Z",
    timeline: [
      {
        id: "sample-could-not-reach-1",
        direction: "outbound",
        body: "Checking in if you still want help booking.",
        at: "2026-05-22T16:35:00.000Z",
      },
      {
        id: "sample-could-not-reach-2",
        direction: "inbound",
        body: "Thanks for following up.",
        at: "2026-05-22T16:44:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Could not reach patient, left voicemail.",
  },
];
