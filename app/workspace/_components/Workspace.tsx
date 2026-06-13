"use client";

import { useMemo, useState } from "react";
import {
  applyFlagsToStatus,
  deriveWorkspaceStatus,
  formatDateTime,
  sortWorkspaceSectionCards,
  workspaceSectionForCard,
  type PatientRequestCard,
  type WorkspaceCardChip,
  type WorkspaceSectionId,
} from "./workspace-types";
import { FRONT_DESK_NOTE_MAX } from "../../../lib/workspace/outcome";

// Front-desk operational queue. Answers: who is this patient, what do they
// want, what did they say, and what should staff do next. Deterministic only —
// no AI. Missing name/time/summary values render as "Not provided".
//
// Layout: four visible sections — Needs follow-up, Handled, Archived, Blocked.
// The section header is the status, so cards and the selected header do not
// repeat primary status badges. "Block number" affects ONLY the caller's phone
// number for automation — messages stay saved.

const NOT_PROVIDED = "Not provided";

// Exact action tooltips (also the accessible descriptions).
const TOOLTIP_CALL = "Call this phone number.";
const TOOLTIP_HANDLED = "Close this request and record whether an appointment was booked.";
const TOOLTIP_ARCHIVE =
  "Move this request out of Active. Messages stay saved and it can be reopened later.";
const TOOLTIP_BLOCK =
  "Block this phone number. Automated texts to this number will stop, but messages stay saved.";
const TOOLTIP_REOPEN = "Move this request back to Active.";
const TOOLTIP_UNBLOCK =
  "Unblock this phone number. Automated texts may resume if normal sending rules allow.";

const BLOCK_CONFIRM_TEXT =
  "Block this phone number? Automated texts to this number will stop, but messages stay saved.";

const SECTION_PAGE_SIZE = 6;

type WorkspaceAction =
  | "save_note"
  | "save_name"
  | "archive"
  | "reopen"
  | "mark_handled"
  | "block_number"
  | "unblock_number";

type SectionDef = {
  id: WorkspaceSectionId;
  label: string;
  tone: "warning" | "success" | "info" | "danger";
};

const SECTIONS: SectionDef[] = [
  { id: "needs_follow_up", label: "Needs follow-up", tone: "warning" },
  { id: "handled", label: "Handled", tone: "success" },
  { id: "archived", label: "Archived", tone: "info" },
  { id: "blocked", label: "Blocked", tone: "danger" },
];

// Signal chips only — rendered exclusively when something useful exists.
function SummaryChips({ chips }: { chips: WorkspaceCardChip[] }) {
  if (chips.length === 0) return null;
  return (
    <span className="ws-chips">
      {chips.map((chip) => (
        <span key={chip.id} className={`ws-chip is-${chip.id}`}>{chip.label}</span>
      ))}
    </span>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sectionLimits, setSectionLimits] = useState<Record<WorkspaceSectionId, number>>({
    needs_follow_up: SECTION_PAGE_SIZE,
    handled: SECTION_PAGE_SIZE,
    archived: SECTION_PAGE_SIZE,
    blocked: SECTION_PAGE_SIZE,
  });
  const [expandedSections, setExpandedSections] = useState<Record<WorkspaceSectionId, boolean>>({
    needs_follow_up: true,
    handled: false,
    archived: false,
    blocked: false,
  });

  const grouped = useMemo(() => {
    const g: Record<WorkspaceSectionId, PatientRequestCard[]> = {
      needs_follow_up: [],
      handled: [],
      archived: [],
      blocked: [],
    };
    for (const item of items) g[workspaceSectionForCard(item.flags)].push(item);
    for (const section of SECTIONS) {
      g[section.id] = sortWorkspaceSectionCards(section.id, g[section.id]);
    }
    return g;
  }, [items]);

  const selected =
    items.find((c) => c.id === selectedId) ??
    SECTIONS.map((section) => grouped[section.id][0]).find(Boolean) ??
    null;

  // Apply a successful queue action to local state. `status` is recomputed
  // from the card's flag-free base status. If the action moves the card, open
  // the destination section so the selected request remains easy to track.
  function patchCard(id: string, patch: Partial<PatientRequestCard>) {
    const current = items.find((c) => c.id === id);
    if (current) {
      const nextFlags = patch.flags ?? current.flags;
      const destination = workspaceSectionForCard(nextFlags);
      setExpandedSections((prev) => ({ ...prev, [destination]: true }));
    }
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
    <div className="ws-layout">
      <div className="ws-queue-col">
        {SECTIONS.map((section) => {
          const sectionCards = grouped[section.id];
          const limit = sectionLimits[section.id] ?? SECTION_PAGE_SIZE;
          return (
            <details
              key={section.id}
              className={`ws-section tone-${section.tone}`}
              open={expandedSections[section.id]}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setExpandedSections((prev) => ({ ...prev, [section.id]: isOpen }));
              }}
            >
              <summary className="ws-section-summary">
                <span>{section.label} ({sectionCards.length})</span>
              </summary>
              <div className="ws-section-body">
                {sectionCards.length === 0 ? (
                  <p className="t-small ws-empty-note">Nothing here yet.</p>
                ) : (
                  <>
                    {sectionCards.slice(0, limit).map((c) => (
                      <QueueCard
                        key={c.id}
                        card={c}
                        selected={selected?.id === c.id}
                        onSelect={() => setSelectedId(c.id)}
                      />
                    ))}
                    {sectionCards.length > limit && (
                      <button
                        type="button"
                        className="btn btn-secondary ws-load-more"
                        onClick={() =>
                          setSectionLimits((prev) => ({
                            ...prev,
                            [section.id]: limit + SECTION_PAGE_SIZE,
                          }))
                        }
                        aria-label={`Load more ${section.label.toLowerCase()} requests`}
                      >
                        Load more
                      </button>
                    )}
                  </>
                )}
              </div>
            </details>
          );
        })}
      </div>

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
  );
}

function QueueCard({
  card,
  selected,
  onSelect,
}: {
  card: PatientRequestCard;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="ws-list-item"
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
    >
      <span className="ws-list-top">
        <span className="ws-list-name">{card.patientName ?? card.callerPhone}</span>
      </span>
      {card.patientName && <span className="t-small ws-meta t-mono">{card.callerPhone}</span>}
      <span className="t-helper ws-meta">Last activity · {formatDateTime(card.lastActivityAt)}</span>
    </button>
  );
}

async function postConversationAction(
  conversationId: string,
  action: WorkspaceAction,
  extra?: { note?: string; name?: string; appointmentBooked?: boolean },
): Promise<{
  ok: boolean;
  message?: string;
  note?: string;
  name?: string;
  archivedAt?: string;
  handledAt?: string;
  blockedAt?: string;
  outcome?: PatientRequestCard["frontDeskOutcome"];
}> {
  try {
    const res = await fetch("/api/workspace/conversation-action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, action, ...(extra ?? {}) }),
    });
    const data = (await res.json().catch(() => null)) as
      | {
          ok?: boolean;
          note?: string;
          name?: string;
          archivedAt?: string;
          handledAt?: string;
          blockedAt?: string;
          outcome?: PatientRequestCard["frontDeskOutcome"];
          error?: { message?: string };
        }
      | null;
    if (!res.ok || !data?.ok) {
      return { ok: false, message: data?.error?.message ?? "Could not complete this action." };
    }
    return {
      ok: true,
      note: data.note,
      name: data.name,
      archivedAt: data.archivedAt,
      handledAt: data.handledAt,
      blockedAt: data.blockedAt,
      outcome: data.outcome,
    };
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
  const [askingHandled, setAskingHandled] = useState(false);
  const [busyAction, setBusyAction] = useState<WorkspaceAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isSample = kind === "sample";
  const lastTwo = card.timeline.slice(-2);
  const section = workspaceSectionForCard(card.flags);

  async function runAction(action: WorkspaceAction, extra?: { appointmentBooked?: boolean }) {
    if (isSample) return;
    setBusyAction(action);
    setActionError(null);
    const result = await postConversationAction(card.id, action, extra);
    setBusyAction(null);
    if (!result.ok) {
      setActionError(result.message ?? "Could not complete this action.");
      return;
    }
    if (action === "archive") {
      onPatched(card.id, {
        flags: { ...card.flags, archived: true },
        workspaceArchivedAt: result.archivedAt ?? new Date().toISOString(),
      });
    } else if (action === "reopen") {
      onPatched(card.id, {
        flags: { ...card.flags, archived: false, handled: false },
        frontDeskOutcome: null,
        baseStatus: deriveWorkspaceStatus("open", card.timeline),
        workspaceArchivedAt: null,
        workspaceHandledAt: null,
      });
    } else if (action === "mark_handled") {
      setAskingHandled(false);
      onPatched(card.id, {
        flags: { ...card.flags, handled: true },
        frontDeskOutcome:
          result.outcome ?? (extra?.appointmentBooked ? "appointment_booked" : "no_appointment_booked"),
        workspaceHandledAt: result.handledAt ?? new Date().toISOString(),
      });
    } else if (action === "block_number") {
      setConfirmingBlock(false);
      onPatched(card.id, {
        flags: { ...card.flags, blocked: true, archived: true },
        blockedAt: result.blockedAt ?? new Date().toISOString(),
        workspaceArchivedAt: result.blockedAt ?? new Date().toISOString(),
      });
    } else if (action === "unblock_number") {
      onPatched(card.id, { flags: { ...card.flags, blocked: false }, blockedAt: null });
    }
  }

  return (
    <section className="ws-detail" aria-labelledby="ws-detail-title">
      {/* 1. Patient header: who + the actions staff take next. */}
      <div className="card card-pad ws-head-card">
        <header className="acct-section-head">
          <div className="ws-head-id">
            <NameEditor card={card} isSample={isSample} onPatched={onPatched} />
            <p className="t-small t-mono ws-head-phone">{card.callerPhone}</p>
          </div>
          {card.isSample && <span className="badge badge-info">Sample</span>}
        </header>

        <div className="ws-actions">
          <a
            className="btn btn-primary btn-sm ws-call-action"
            href={`tel:${card.callerPhone}`}
            title={TOOLTIP_CALL}
          >
            Call patient
          </a>
          {section === "blocked" ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              title={TOOLTIP_UNBLOCK}
              disabled={isSample || busyAction !== null}
              onClick={() => runAction("unblock_number")}
            >
              {busyAction === "unblock_number" ? "Unblocking…" : "Unblock number"}
            </button>
          ) : section === "archived" || section === "handled" ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                title={TOOLTIP_REOPEN}
                disabled={isSample || busyAction !== null}
                onClick={() => runAction("reopen")}
              >
                {busyAction === "reopen" ? "Reopening…" : "Reopen"}
              </button>
              <span className="ws-actions-divider" aria-hidden="true" />
              <button
                type="button"
                className="btn btn-danger btn-sm ws-action-danger"
                title={TOOLTIP_BLOCK}
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
                title={TOOLTIP_HANDLED}
                disabled={isSample || busyAction !== null}
                onClick={() => setAskingHandled((prev) => !prev)}
              >
                Handled
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                title={TOOLTIP_ARCHIVE}
                disabled={isSample || busyAction !== null}
                onClick={() => runAction("archive")}
              >
                {busyAction === "archive" ? "Archiving…" : "Archive"}
              </button>
              <span className="ws-actions-divider" aria-hidden="true" />
              <button
                type="button"
                className="btn btn-danger btn-sm ws-action-danger"
                title={TOOLTIP_BLOCK}
                disabled={isSample || busyAction !== null}
                onClick={() => setConfirmingBlock(true)}
              >
                Block number
              </button>
            </>
          )}
        </div>

        {askingHandled && section === "needs_follow_up" && (
          <div className="ws-mini-panel" role="group" aria-label="Was appointment booked?">
            <span className="ws-mini-title">Was appointment booked?</span>
            <div className="ws-mini-options">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isSample || busyAction !== null}
                onClick={() => runAction("mark_handled", { appointmentBooked: true })}
              >
                {busyAction === "mark_handled" ? "Saving…" : "Yes"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isSample || busyAction !== null}
                onClick={() => runAction("mark_handled", { appointmentBooked: false })}
              >
                No
              </button>
              <button
                type="button"
                className="link"
                disabled={busyAction !== null}
                onClick={() => setAskingHandled(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {confirmingBlock && section !== "blocked" && (
          <div className="ws-mini-panel is-danger" role="alertdialog" aria-label="Confirm block number">
            <span className="ws-mini-title">{BLOCK_CONFIRM_TEXT}</span>
            <div className="ws-mini-options">
              <button
                type="button"
                className="btn btn-danger btn-sm"
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
          <p className="t-helper ws-empty-note">
            Sample preview — actions are disabled and nothing is saved.
          </p>
        )}
      </div>

      {/* 2. Request summary: one short line + signal chips (never empty rows). */}
      <div className="card card-pad ws-summary-card" aria-labelledby={`ws-summary-${card.id}`}>
        <h3 id={`ws-summary-${card.id}`} className="t-h4">Request summary</h3>
        <p className="ws-summary-headline">{card.summaryHeadline}</p>
        <SummaryChips chips={card.summaryChips} />
        <p className="t-helper ws-meta">
          First seen {formatDateTime(card.createdAt)} · Last activity {formatDateTime(card.lastActivityAt)}
        </p>
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
                  <span className="ws-bubble-author">
                    {t.direction === "inbound" ? "Patient" : "Your office"}
                  </span>
                  <span className="t-helper ws-meta">{formatDateTime(t.at)}</span>
                </div>
                <p className="ws-bubble-body">{t.body || "(empty message)"}</p>
              </div>
            ))}
            {!showFullConversation && card.timeline.length > 2 && (
              <p className="t-helper ws-meta" style={{ margin: 0 }}>
                Showing the last 2 of {card.timeline.length} messages.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 4. Internal note: staff-only, saved on its own. */}
      <InternalNote card={card} isSample={isSample} onPatched={onPatched} />
    </section>
  );
}

// Inline patient-name display + edit. Missing/unsafe names render as
// "Not provided"; staff can save a simple safe name or clear it.
function NameEditor({
  card,
  isSample,
  onPatched,
}: {
  card: PatientRequestCard;
  isSample: boolean;
  onPatched: (id: string, patch: Partial<PatientRequestCard>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.patientName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    if (isSample) return;
    setSaving(true);
    setError(null);
    const result = await postConversationAction(card.id, "save_name", { name: value });
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "Could not save the name.");
      return;
    }
    const savedName = (result.name ?? "").trim();
    onPatched(card.id, { patientName: savedName.length > 0 ? savedName : null });
    setValue(savedName);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="ws-name-row">
        <h2 id="ws-detail-title" className={`t-h3${card.patientName ? "" : " ws-name-missing"}`}>
          {card.patientName ?? NOT_PROVIDED}
        </h2>
        <button
          type="button"
          className="link ws-name-edit"
          disabled={isSample}
          title="Edit the patient name shown for this request."
          onClick={() => {
            setValue(card.patientName ?? "");
            setError(null);
            setEditing(true);
          }}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="ws-name-editor">
      <div className="ws-name-editor-row">
        <input
          className="input"
          type="text"
          value={value}
          maxLength={80}
          aria-label="Patient name"
          placeholder="Patient name (leave empty to clear)"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveName}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={saving}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="t-helper" style={{ color: "var(--error-text)", margin: 0 }}>
          {error}
        </p>
      )}
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
    const result = await postConversationAction(card.id, "save_note", { note });
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

// Sample/demo cards demonstrating the same four-section layout as real cards.
// They are never persisted and actions are disabled.
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
    id: "sample-needs-follow-up",
    callerPhone: "+1 (555) 010-1001",
    patientName: null,
    summaryHeadline: "Cleaning appointment · Tomorrow",
    summaryChips: [],
    latestMessage: "Hi, can I book a cleaning tomorrow?",
    latestMessageDirection: "inbound",
    status: "needs_follow_up",
    baseStatus: "needs_follow_up",
    flags: { ...SAMPLE_FLAGS },
    createdAt: "2026-05-24T14:30:00.000Z",
    lastActivityAt: "2026-05-24T14:36:00.000Z",
    timeline: [
      {
        id: "sample-needs-follow-up-1",
        direction: "outbound",
        body: "Hi, this is Bright Smile Dental. We missed your call. How can we help? Reply STOP to opt out.",
        at: "2026-05-24T14:31:00.000Z",
      },
      {
        id: "sample-needs-follow-up-2",
        direction: "inbound",
        body: "Hi, can I book a cleaning tomorrow?",
        at: "2026-05-24T14:36:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Name is not provided; call back about tomorrow.",
  },
  {
    id: "sample-handled",
    callerPhone: "+1 (555) 010-1002",
    patientName: "Taylor Brooks",
    summaryHeadline: "Appointment request · Next week",
    summaryChips: [],
    latestMessage: "Great, see you next week.",
    latestMessageDirection: "inbound",
    status: "handled",
    baseStatus: "booked",
    flags: { ...SAMPLE_FLAGS, handled: true },
    createdAt: "2026-05-23T15:00:00.000Z",
    lastActivityAt: "2026-05-23T15:16:00.000Z",
    timeline: [
      {
        id: "sample-handled-1",
        direction: "inbound",
        body: "Can I get an appointment next week?",
        at: "2026-05-23T15:11:00.000Z",
      },
      {
        id: "sample-handled-2",
        direction: "inbound",
        body: "Great, see you next week.",
        at: "2026-05-23T15:16:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Booked over the phone.",
    frontDeskOutcome: "appointment_booked",
  },
  {
    id: "sample-archived",
    callerPhone: "+1 (555) 010-1003",
    patientName: "Morgan Patel",
    summaryHeadline: "Insurance question",
    summaryChips: [],
    latestMessage: "Do you take Delta Dental insurance?",
    latestMessageDirection: "inbound",
    status: "archived",
    baseStatus: "needs_follow_up",
    flags: { ...SAMPLE_FLAGS, archived: true },
    createdAt: "2026-05-23T11:00:00.000Z",
    lastActivityAt: "2026-05-23T11:18:00.000Z",
    timeline: [
      {
        id: "sample-archived-1",
        direction: "inbound",
        body: "Do you take Delta Dental insurance?",
        at: "2026-05-23T11:18:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Answered by email; archived.",
  },
  {
    id: "sample-blocked",
    callerPhone: "+1 (555) 010-1004",
    patientName: null,
    summaryHeadline: "Review conversation",
    summaryChips: [{ id: "high_volume", label: "High volume" }],
    latestMessage: "(repeated automated-looking messages)",
    latestMessageDirection: "inbound",
    status: "blocked",
    baseStatus: "needs_follow_up",
    flags: { ...SAMPLE_FLAGS, blocked: true, archived: true, highVolume: true },
    createdAt: "2026-05-22T16:20:00.000Z",
    lastActivityAt: "2026-05-22T16:44:00.000Z",
    timeline: [
      {
        id: "sample-blocked-1",
        direction: "inbound",
        body: "(repeated automated-looking messages)",
        at: "2026-05-22T16:44:00.000Z",
      },
    ],
    isSample: true,
    sampleNote: "Number blocked after repeated bot-like messages.",
  },
];
