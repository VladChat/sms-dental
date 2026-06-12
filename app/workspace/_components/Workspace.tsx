"use client";

import { useMemo, useState } from "react";
import {
  WORKSPACE_FLAG_META,
  WORKSPACE_STATUS_META,
  applyFlagsToStatus,
  formatDateTime,
  workspaceFilterForCard,
  type PatientRequestCard,
  type WorkspaceCardFlags,
  type WorkspaceFilter,
} from "./workspace-types";
import { FRONT_DESK_NOTE_MAX } from "../../../lib/workspace/outcome";

// Front-desk operational queue. Answers: who is this patient, what do they
// want, what did they say, and what should staff do next. All structured
// fields are deterministic (no AI); missing values show Unknown/None detected.
//
// Terminology used across this file:
//   "Block number"  = block the PATIENT/CALLER phone number for this clinic
//                     only. Never the clinic's own business number, never a
//                     Twilio mutation, never deletes history.
//   "Archive"       = hide from the active queue. Reversible via Reopen.

const UNKNOWN = "Unknown";
const NONE_DETECTED = "None detected";

const FILTERS: { id: WorkspaceFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "archived", label: "Archived" },
  { id: "blocked", label: "Blocked" },
];

type WorkspaceAction =
  | "save_note"
  | "archive"
  | "reopen"
  | "mark_handled"
  | "block_number"
  | "unblock_number";

function StatusBadge({ status }: { status: PatientRequestCard["status"] }) {
  const m = WORKSPACE_STATUS_META[status];
  return <span className={`badge ${m.badge}`}><span className="dot" aria-hidden="true" />{m.label}</span>;
}

// Secondary flag chips (safety / automation paused / high volume). Block/
// archive/handled surface through the primary status badge instead.
function FlagChips({ flags }: { flags: WorkspaceCardFlags }) {
  const chips: { key: keyof typeof WORKSPACE_FLAG_META; show: boolean }[] = [
    { key: "safetyConcern", show: flags.safetyConcern },
    { key: "automationPaused", show: flags.automationPaused },
    { key: "highVolume", show: flags.highVolume },
  ];
  const visible = chips.filter((c) => c.show);
  if (visible.length === 0) return null;
  return (
    <>
      {visible.map(({ key }) => (
        <span key={key} className={`badge ${WORKSPACE_FLAG_META[key].badge}`}>
          {WORKSPACE_FLAG_META[key].label}
        </span>
      ))}
    </>
  );
}

export function Workspace({ cards }: { cards: PatientRequestCard[] }) {
  const hasReal = cards.length > 0;
  // Samples never dominate: collapsed by default whenever real conversations
  // exist; fully shown only on an empty workspace.
  const [samplesHidden, setSamplesHidden] = useState(hasReal);

  return (
    <main className="ws-page">
      <header className="ws-header">
        <h1 className="t-h2">Front desk workspace</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Review missed-call replies and patient requests.
        </p>
      </header>

      {hasReal ? (
        <RequestQueue cards={cards} kind="real" />
      ) : (
        <p className="ws-empty-real t-body">
          No patient replies yet. Replies to recovery texts will appear here.
        </p>
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
          <RequestQueue cards={SAMPLE_REQUESTS} kind="sample" />
        </section>
      )}
    </main>
  );
}

function RequestQueue({
  cards,
  kind,
}: {
  cards: PatientRequestCard[];
  kind: "real" | "sample";
}) {
  const [items, setItems] = useState(cards);
  const [filter, setFilter] = useState<WorkspaceFilter>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<WorkspaceFilter, number> = { active: 0, archived: 0, blocked: 0 };
    for (const item of items) c[workspaceFilterForCard(item.flags)] += 1;
    return c;
  }, [items]);

  const visible = items.filter((c) => workspaceFilterForCard(c.flags) === filter);
  const selected = visible.find((c) => c.id === selectedId) ?? visible[0] ?? null;

  // Apply a successful queue action to local state. `status` is recomputed
  // from the card's flag-free base status, so the badge stays correct.
  function patchCard(id: string, patch: Partial<PatientRequestCard>) {
    setItems((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.flags) next.status = applyFlagsToStatus(patch.flags, next.baseStatus);
        return next;
      }),
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <div role="group" aria-label="Queue filter" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`btn btn-sm ${filter === f.id ? "btn-primary" : "btn-secondary"}`}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label} ({counts[f.id]})
          </button>
        ))}
      </div>

      <div className="ws-layout">
        <nav className="ws-list" aria-label={kind === "sample" ? "Sample requests" : "Patient requests"}>
          {visible.length === 0 ? (
            <p className="t-small" style={{ color: "var(--text-muted)", padding: "var(--space-3)" }}>
              {filter === "active"
                ? "No active requests."
                : filter === "archived"
                  ? "No archived requests."
                  : "No blocked numbers."}
            </p>
          ) : (
            visible.map((c) => {
              const m = WORKSPACE_STATUS_META[c.status];
              return (
                <button
                  key={c.id}
                  type="button"
                  className="ws-list-item"
                  aria-current={selected?.id === c.id ? "true" : undefined}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className="ws-list-top">
                    <span className="ws-list-name">{c.patientName ?? c.callerPhone}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {c.isSample && <span className="badge badge-info">Sample</span>}
                      <span className={`badge ${m.badge}`}><span className="dot" aria-hidden="true" />{m.label}</span>
                    </span>
                  </span>
                  {c.patientName && (
                    <span className="t-small ws-meta t-mono">{c.callerPhone}</span>
                  )}
                  <span style={{ display: "inline-flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                    <FlagChips flags={c.flags} />
                  </span>
                  <span className="t-small ws-snippet">
                    {c.latestMessage
                      ? `${c.latestMessageDirection === "outbound" ? "Your office: " : "Patient: "}${c.latestMessage}`
                      : "No messages yet"}
                  </span>
                  <span className="t-helper ws-meta">
                    Last activity · {formatDateTime(c.lastActivityAt)}
                  </span>
                </button>
              );
            })
          )}
        </nav>

        {selected ? (
          <RequestDetail key={selected.id} card={selected} kind={kind} onPatched={patchCard} />
        ) : (
          <section className="card card-pad" aria-live="polite">
            <p className="t-small" style={{ color: "var(--text-muted)" }}>
              Select a request to see details.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

async function postConversationAction(
  conversationId: string,
  action: WorkspaceAction,
  note?: string,
): Promise<{ ok: boolean; message?: string; note?: string }> {
  try {
    const res = await fetch("/api/workspace/conversation-action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, action, ...(note !== undefined ? { note } : {}) }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; note?: string; error?: { message?: string } }
      | null;
    if (!res.ok || !data?.ok) {
      return { ok: false, message: data?.error?.message ?? "Could not complete this action." };
    }
    return { ok: true, note: data.note };
  } catch {
    return { ok: false, message: "Could not complete this action." };
  }
}

function RequestDetail({
  card,
  kind,
  onPatched,
}: {
  card: PatientRequestCard;
  kind: "real" | "sample";
  onPatched: (id: string, patch: Partial<PatientRequestCard>) => void;
}) {
  const [showFullConversation, setShowFullConversation] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [busyAction, setBusyAction] = useState<WorkspaceAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isSample = kind === "sample";
  const lastTwo = card.timeline.slice(-2);

  async function runAction(action: WorkspaceAction) {
    if (isSample) return;
    setBusyAction(action);
    setActionError(null);
    const result = await postConversationAction(card.id, action);
    setBusyAction(null);
    if (!result.ok) {
      setActionError(result.message ?? "Could not complete this action.");
      return;
    }
    if (action === "archive") {
      onPatched(card.id, { flags: { ...card.flags, archived: true } });
    } else if (action === "reopen") {
      onPatched(card.id, { flags: { ...card.flags, archived: false } });
    } else if (action === "mark_handled") {
      onPatched(card.id, { flags: { ...card.flags, handled: true } });
    } else if (action === "block_number") {
      setConfirmingBlock(false);
      onPatched(card.id, { flags: { ...card.flags, blocked: true, archived: true } });
    } else if (action === "unblock_number") {
      onPatched(card.id, { flags: { ...card.flags, blocked: false } });
    }
  }

  return (
    <section className="ws-detail" aria-labelledby="ws-detail-title" style={{ display: "grid", gap: "var(--space-4)", alignContent: "start" }}>
      {/* 1. Patient header: who + status + the actions staff take next. */}
      <div className="card card-pad" style={{ display: "grid", gap: "var(--space-3)" }}>
        <header className="acct-section-head">
          <div>
            <h2 id="ws-detail-title" className="t-h3">
              {card.patientName ?? UNKNOWN}
            </h2>
            <p className="t-small t-mono" style={{ marginTop: "var(--space-1)", color: "var(--text-secondary)" }}>
              {card.callerPhone}
            </p>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {card.isSample && <span className="badge badge-info">Sample</span>}
            <StatusBadge status={card.status} />
            <FlagChips flags={card.flags} />
          </div>
        </header>

        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
          <a className="btn btn-primary btn-sm ws-call-action" href={`tel:${card.callerPhone}`}>
            Call patient
          </a>
          {card.flags.blocked ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={isSample || busyAction !== null}
              onClick={() => runAction("unblock_number")}
            >
              {busyAction === "unblock_number" ? "Unblocking…" : "Unblock number"}
            </button>
          ) : card.flags.archived ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isSample || busyAction !== null}
                onClick={() => runAction("reopen")}
              >
                {busyAction === "reopen" ? "Reopening…" : "Reopen"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isSample || busyAction !== null}
                onClick={() => setConfirmingBlock(true)}
              >
                Block number
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isSample || busyAction !== null || card.flags.handled}
                onClick={() => runAction("mark_handled")}
              >
                {busyAction === "mark_handled" ? "Saving…" : card.flags.handled ? "Handled" : "Mark handled"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isSample || busyAction !== null}
                onClick={() => runAction("archive")}
              >
                {busyAction === "archive" ? "Archiving…" : "Archive"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isSample || busyAction !== null}
                onClick={() => setConfirmingBlock(true)}
              >
                Block number
              </button>
            </>
          )}
        </div>

        {confirmingBlock && !card.flags.blocked && (
          <div className="alert alert-error" role="alertdialog" aria-label="Confirm block number" style={{ display: "grid", gap: "var(--space-2)" }}>
            <span className="t-small" style={{ fontWeight: 700 }}>
              Block this patient number for this clinic? Automated replies will stop for this number. Messages will be kept.
            </span>
            <span className="t-helper">
              This blocks the patient&apos;s phone number for your clinic only. It does not change or
              remove your office&apos;s business number, and it does not delete any messages.
            </span>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isSample || busyAction !== null}
                onClick={() => runAction("block_number")}
              >
                {busyAction === "block_number" ? "Blocking…" : "Block number"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busyAction !== null}
                onClick={() => setConfirmingBlock(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {actionError && (
          <div className="alert alert-error" role="alert" aria-live="polite">
            <span>{actionError}</span>
          </div>
        )}
        {isSample && (
          <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
            Sample preview — actions are disabled and nothing is saved.
          </p>
        )}
      </div>

      {/* 2. Request details: the same fields every time, Unknown when missing. */}
      <div className="card card-pad ws-patient-details" aria-labelledby={`ws-request-details-${card.id}`}>
        <h3 id={`ws-request-details-${card.id}`} className="t-h4">Request details</h3>
        <dl className="ws-detail-rows" style={{ marginTop: "var(--space-3)" }}>
          <Row label="Name" value={card.patientName ?? UNKNOWN} />
          <Row label="Phone" value={card.callerPhone} mono />
          <Row label="Request" value={card.requestType ?? UNKNOWN} />
          <Row label="Preferred appointment time" value={card.preferredTime ?? UNKNOWN} />
          <Row label="Safety concern" value={card.safetyConcern ?? NONE_DETECTED} />
          <Row label="Payment / insurance" value={card.paymentInsurance ?? UNKNOWN} />
          <Row label="First seen" value={formatDateTime(card.createdAt)} />
          <Row label="Last activity" value={formatDateTime(card.lastActivityAt)} />
        </dl>
      </div>

      {/* 3. Conversation preview: last 2 messages immediately, full on demand. */}
      <div className="card card-pad" aria-labelledby={`ws-conversation-${card.id}`}>
        <div className="acct-section-head">
          <h3 id={`ws-conversation-${card.id}`} className="t-h4">Conversation</h3>
          {card.timeline.length > 2 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowFullConversation((prev) => !prev)}
            >
              {showFullConversation ? "Hide full conversation" : "Show full conversation"}
            </button>
          )}
        </div>
        {card.timeline.length === 0 ? (
          <p className="t-small ws-empty-note" style={{ marginTop: "var(--space-3)" }}>
            No messages yet.
          </p>
        ) : (
          <div className="ws-timeline" style={{ marginTop: "var(--space-3)" }}>
            {(showFullConversation ? card.timeline : lastTwo).map((t) => (
              <div key={t.id} className={`ws-bubble${t.direction === "inbound" ? " is-inbound" : ""}`}>
                <div className="ws-bubble-head">
                  <span className="t-helper" style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                    {t.direction === "inbound" ? "Patient" : "Your office"}
                  </span>
                  <span className="t-helper ws-meta">{formatDateTime(t.at)}</span>
                </div>
                <p className="t-small" style={{ margin: 0, color: "var(--text-body)", overflowWrap: "anywhere" }}>
                  {t.body || "(empty message)"}
                </p>
              </div>
            ))}
            {!showFullConversation && card.timeline.length > 2 && (
              <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
                Showing the last 2 of {card.timeline.length} messages.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 4. Internal note: staff-only, saved on its own (no outcome required). */}
      <InternalNote card={card} isSample={isSample} onPatched={onPatched} />
    </section>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const muted = value === UNKNOWN || value === NONE_DETECTED;
  return (
    <div className="ws-row">
      <dt>{label}</dt>
      <dd
        className={mono ? "t-mono" : undefined}
        style={muted ? { color: "var(--text-muted)", fontWeight: 400 } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

// Internal staff note. Saves independently through the conversation-action API
// — no outcome selection required. Not visible to patients.
function InternalNote({
  card,
  isSample,
  onPatched,
}: {
  card: PatientRequestCard;
  isSample: boolean;
  onPatched: (id: string, patch: Partial<PatientRequestCard>) => void;
}) {
  const [note, setNote] = useState(card.frontDeskNote ?? card.sampleNote ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteTooLong = note.length > FRONT_DESK_NOTE_MAX;

  async function saveNote() {
    if (isSample || noteTooLong) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await postConversationAction(card.id, "save_note", note);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "Could not save the note.");
      return;
    }
    setSaved(true);
    onPatched(card.id, { frontDeskNote: (result.note ?? note).trim() || null });
  }

  return (
    <div className="card card-pad" aria-labelledby={`ws-note-${card.id}`}>
      <h3 id={`ws-note-${card.id}`} className="t-h4">Internal note</h3>
      <div className="field" style={{ marginTop: "var(--space-3)" }}>
        <textarea
          id={`note-${card.id}`}
          className="textarea"
          value={note}
          readOnly={isSample}
          aria-label="Internal note"
          onChange={(event) => {
            setNote(event.target.value);
            setSaved(false);
            setError(null);
          }}
          aria-invalid={noteTooLong ? "true" : undefined}
        />
        <div className="ws-note-meta">
          <span className="helper">Staff-only. Patients never see this note.</span>
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
        <p className="t-small" role="status" style={{ color: "var(--success-text)", margin: "0 0 var(--space-2)" }}>
          Note saved.
        </p>
      )}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={isSample || saving || noteTooLong}
        onClick={saveNote}
      >
        {saving ? "Saving…" : "Save note"}
      </button>
    </div>
  );
}

// Sample/demo cards. Same structure and fields as real cards so the demo
// matches the live UI. Never persisted; actions are disabled.
const SAMPLE_FLAGS = {
  safetyConcern: false,
  automationPaused: false,
  highVolume: false,
  blocked: false,
  archived: false,
  handled: false,
} as const;

const SAMPLE_REQUESTS: PatientRequestCard[] = [
  {
    id: "sample-appointment",
    callerPhone: "+1 (555) 010-1001",
    patientName: "Jordan Lee",
    requestType: "Cleaning appointment",
    preferredTime: "Tuesday morning",
    safetyConcern: "None detected",
    paymentInsurance: null,
    summary: null,
    latestMessage: "Hi, can I book a cleaning for Tuesday morning?",
    latestMessageDirection: "inbound",
    status: "needs_follow_up",
    baseStatus: "needs_follow_up",
    flags: { ...SAMPLE_FLAGS },
    createdAt: "2026-05-24T14:30:00.000Z",
    lastActivityAt: "2026-05-24T14:36:00.000Z",
    timeline: [
      {
        id: "sample-appointment-1",
        direction: "outbound",
        body: "Hi, this is Bright Smile Dental. We missed your call. How can we help? Reply STOP to opt out.",
        at: "2026-05-24T14:31:00.000Z",
      },
      {
        id: "sample-appointment-2",
        direction: "inbound",
        body: "Hi, can I book a cleaning for Tuesday morning?",
        at: "2026-05-24T14:36:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Patient asked for a cleaning appointment Tuesday morning.",
  },
  {
    id: "sample-safety",
    callerPhone: "+1 (555) 010-1002",
    patientName: "Avery Chen",
    requestType: "Pain / urgent concern",
    preferredTime: "Today",
    safetyConcern: "Mentioned pain/urgent concern",
    paymentInsurance: null,
    summary: null,
    latestMessage: "I have bad tooth pain, can someone see me today?",
    latestMessageDirection: "inbound",
    status: "needs_follow_up",
    baseStatus: "needs_follow_up",
    flags: { ...SAMPLE_FLAGS, safetyConcern: true },
    createdAt: "2026-05-24T13:10:00.000Z",
    lastActivityAt: "2026-05-24T13:22:00.000Z",
    timeline: [
      {
        id: "sample-safety-1",
        direction: "inbound",
        body: "I have bad tooth pain, can someone see me today?",
        at: "2026-05-24T13:18:00.000Z",
      },
      {
        id: "sample-safety-2",
        direction: "outbound",
        body: "If this is a medical emergency, call 911. Thanks for the info. What name should we use when our office follows up? If you're looking for an appointment, what time works best for you?",
        at: "2026-05-24T13:22:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Patient mentioned tooth pain — call first.",
  },
  {
    id: "sample-insurance",
    callerPhone: "+1 (555) 010-1003",
    patientName: "Taylor Brooks",
    requestType: "Insurance question",
    preferredTime: null,
    safetyConcern: "None detected",
    paymentInsurance: "Insurance mentioned",
    summary: null,
    latestMessage: "Do you take Delta Dental insurance?",
    latestMessageDirection: "inbound",
    status: "needs_follow_up",
    baseStatus: "needs_follow_up",
    flags: { ...SAMPLE_FLAGS },
    createdAt: "2026-05-23T15:00:00.000Z",
    lastActivityAt: "2026-05-23T15:16:00.000Z",
    timeline: [
      {
        id: "sample-insurance-1",
        direction: "outbound",
        body: "Hi, this is Bright Smile Dental. We missed your call. How can we help? Reply STOP to opt out.",
        at: "2026-05-23T15:11:00.000Z",
      },
      {
        id: "sample-insurance-2",
        direction: "inbound",
        body: "Do you take Delta Dental insurance?",
        at: "2026-05-23T15:16:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Check Delta Dental coverage before calling back.",
  },
  {
    id: "sample-handled",
    callerPhone: "+1 (555) 010-1004",
    patientName: "Morgan Patel",
    requestType: "Appointment request",
    preferredTime: "Next week",
    safetyConcern: "None detected",
    paymentInsurance: null,
    summary: null,
    latestMessage: "Great, see you next week.",
    latestMessageDirection: "inbound",
    status: "archived",
    baseStatus: "waiting_for_patient",
    flags: { ...SAMPLE_FLAGS, handled: true, archived: true },
    createdAt: "2026-05-23T11:00:00.000Z",
    lastActivityAt: "2026-05-23T11:18:00.000Z",
    timeline: [
      {
        id: "sample-handled-1",
        direction: "inbound",
        body: "Can I get an appointment next week?",
        at: "2026-05-23T11:12:00.000Z",
      },
      {
        id: "sample-handled-2",
        direction: "inbound",
        body: "Great, see you next week.",
        at: "2026-05-23T11:18:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Booked over the phone; archived after handling.",
  },
];
