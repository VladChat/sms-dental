"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminConfirmDialog } from "./AdminConfirmDialog";

type Props = {
  clinicId: string;
  isActive: boolean;
  smsRecoveryEnabled: boolean;
  adminInternalNote: string | null;
  // Non-null when the clinic cannot be launched yet — the exact operator reason.
  launchBlockedReason: string | null;
};

const NOTE_MAX = 1000;

// A state-changing action awaiting confirmation in the in-app modal.
type PendingAction = {
  action: string;
  extra: Record<string, unknown>;
  title: string;
  body: string;
  confirmLabel: string;
  confirmTone: "primary" | "danger";
};

// The only working platform-admin mutations: clinic status (pause/reactivate),
// the single service-launch control (launch / pause sending), and the internal
// note. Meaningful state changes confirm through AdminConfirmDialog (no native
// window.confirm); the note saves directly (low impact).
export function AdminClinicActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState(props.adminInternalNote ?? "");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  async function run(action: string, extra: Record<string, unknown>): Promise<boolean> {
    setBusy(action);
    setErr(null);
    setMsg(null);
    setModalError(null);
    try {
      const res = await fetch(`/api/admin/clinics/${props.clinicId}/action`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.ok) {
        const message = data?.error?.message ?? "Could not complete this action.";
        setErr(message);
        setModalError(message);
        return false;
      }
      setMsg("Saved.");
      router.refresh();
      return true;
    } catch {
      setErr("Could not complete this action.");
      setModalError("Could not complete this action.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function openConfirm(p: PendingAction) {
    setModalError(null);
    setErr(null);
    setMsg(null);
    setPending(p);
  }

  async function confirmPending() {
    if (!pending) return;
    const ok = await run(pending.action, pending.extra);
    if (ok) setPending(null);
  }

  function cancelPending() {
    if (busy) return;
    setPending(null);
    setModalError(null);
  }

  const noteTooLong = note.length > NOTE_MAX;

  return (
    <div className="adm-actions-panel" style={{ display: "grid", gap: "var(--space-5)" }}>
      {(msg || err) && (
        <div className={`alert ${err ? "alert-error" : "alert-success"}`} role="status" aria-live="polite">
          <span>{err ?? msg}</span>
        </div>
      )}

      {/* Clinic status — the single master on/off control (clinics.is_active) */}
      <div className="adm-action-group">
        <h4 className="t-h4">Clinic status</h4>
        {props.isActive ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy !== null}
            onClick={() =>
              openConfirm({
                action: "deactivate",
                extra: {},
                title: "Pause clinic?",
                body: "This will pause the clinic without deleting its data.",
                confirmLabel: "Pause clinic",
                confirmTone: "danger",
              })
            }
          >
            Pause clinic
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== null}
            onClick={() =>
              openConfirm({
                action: "reactivate",
                extra: {},
                title: "Reactivate clinic?",
                body: "This will make the clinic active again.",
                confirmLabel: "Reactivate clinic",
                confirmTone: "primary",
              })
            }
          >
            Reactivate clinic
          </button>
        )}
      </div>

      {/* Service launch — the single final-readiness control (sms_recovery_enabled).
          Launch status itself is shown in the Launch readiness section above; this
          area only carries the actions, so it does not repeat the status badge. */}
      <div className="adm-action-group">
        <h4 className="t-h4">Service launch</h4>
        {props.smsRecoveryEnabled ? (
          <div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy !== null}
              onClick={() =>
                openConfirm({
                  action: "disable_sms",
                  extra: {},
                  title: "Pause SMS sending?",
                  body: "This will stop missed-call SMS recovery for this clinic. The clinic stays active.",
                  confirmLabel: "Pause SMS sending",
                  confirmTone: "danger",
                })
              }
            >
              Pause SMS sending
            </button>
            <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
              Stops recovery texts; the clinic stays active.
            </p>
          </div>
        ) : props.launchBlockedReason ? (
          <div>
            <button type="button" className="btn btn-primary" disabled aria-disabled="true">
              Launch service
            </button>
            <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
              Resolve launch readiness above to enable.
            </p>
          </div>
        ) : (
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy !== null}
              onClick={() =>
                openConfirm({
                  action: "enable_sms",
                  extra: {},
                  title: "Launch service?",
                  body: "This will enable missed-call SMS recovery for this clinic.",
                  confirmLabel: "Launch service",
                  confirmTone: "primary",
                })
              }
            >
              Launch service
            </button>
            <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
              Launching turns on the per-clinic gate. Live sending also requires the platform SMS mode and
              always respects opt-outs.
            </p>
          </div>
        )}
      </div>

      {/* Internal note — single, plain-text, internal-only. Low impact: no modal. */}
      <div className="adm-action-group">
        <h4 className="t-h4">Internal note</h4>
        <p className="t-helper" style={{ margin: "0 0 var(--space-2)" }}>Internal only — never shown to the clinic.</p>
        <textarea
          className="textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={noteTooLong ? "true" : undefined}
        />
        <div className="adm-note-meta">
          <span className={`helper${noteTooLong ? " adm-over" : ""}`}>{note.length}/{NOTE_MAX}</span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy !== null || noteTooLong}
          onClick={() => run("update_note", { note })}
        >
          {busy === "update_note" ? "Saving…" : "Save note"}
        </button>
      </div>

      <AdminConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        body={pending?.body ?? ""}
        confirmLabel={pending?.confirmLabel ?? "Confirm"}
        confirmTone={pending?.confirmTone ?? "primary"}
        busy={pending !== null && busy === pending.action}
        error={modalError}
        onConfirm={confirmPending}
        onCancel={cancelPending}
      />
    </div>
  );
}
