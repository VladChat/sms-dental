"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import type {
  ClinicDeleteBlocker,
  ClinicDeleteSummary,
  ClinicDeleteTableCount,
} from "../../../../../../lib/db/admin/clinic-delete";

type Props = {
  clinicId: string;
  isActive: boolean;
  smsRecoveryEnabled: boolean;
  adminInternalNote: string | null;
  // Non-null when the clinic cannot be launched yet — the exact operator reason.
  launchBlockedReason: string | null;
};

const NOTE_MAX = 1000;
const DELETE_CONFIRM = "DELETE";

// A state-changing action awaiting confirmation in the in-app modal.
type PendingAction = {
  action: string;
  extra: Record<string, unknown>;
  title: string;
  body: string;
  confirmLabel: string;
  confirmTone: "primary" | "danger";
};

type DeleteApiResponse = {
  ok?: boolean;
  canDelete?: boolean;
  blockers?: ClinicDeleteBlocker[];
  summary?: ClinicDeleteSummary | null;
  deletedCounts?: ClinicDeleteTableCount[] | null;
  error?: { message?: string };
};

type DeletePreflightState = {
  canDelete: boolean;
  blockers: ClinicDeleteBlocker[];
  summary: ClinicDeleteSummary | null;
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
  const [deletePreflight, setDeletePreflight] = useState<DeletePreflightState | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

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

  async function openDeleteClinic() {
    setBusy("delete_preflight");
    setErr(null);
    setMsg(null);
    setDeleteError(null);
    setDeleteSuccess(null);
    setDeleteConfirm("");
    try {
      const res = await fetch(`/api/admin/clinics/${props.clinicId}/delete-preflight`, {
        method: "GET",
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as DeleteApiResponse | null;
      if (!data?.summary && !data?.blockers?.length) {
        setErr(data?.error?.message ?? "Could not load delete preflight.");
        return;
      }
      setDeletePreflight({
        canDelete: Boolean(data.canDelete),
        blockers: data.blockers ?? [],
        summary: data.summary ?? null,
      });
      setDeleteDialogOpen(true);
      if (!res.ok && data?.error?.message) {
        setDeleteError(data.error.message);
      }
    } catch {
      setErr("Could not load delete preflight.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmDeleteClinic() {
    if (!deletePreflight?.canDelete || deleteConfirm !== DELETE_CONFIRM) return;
    setBusy("delete_clinic");
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/clinics/${props.clinicId}/delete`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: deleteConfirm }),
      });
      const data = (await res.json().catch(() => null)) as DeleteApiResponse | null;
      if (!res.ok || !data?.ok) {
        if (data?.summary || data?.blockers?.length) {
          setDeletePreflight({
            canDelete: Boolean(data.canDelete),
            blockers: data.blockers ?? [],
            summary: data.summary ?? null,
          });
        }
        setDeleteError(data?.error?.message ?? "Delete is blocked. Resolve the listed items first.");
        return;
      }
      setDeleteSuccess("Clinic deleted. Returning to Clinics.");
      window.setTimeout(() => {
        router.push("/admin/clinics");
        router.refresh();
      }, 700);
    } catch {
      setDeleteError("Could not delete this clinic. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function cancelDeleteClinic() {
    if (busy) return;
    setDeleteDialogOpen(false);
    setDeleteError(null);
    setDeleteSuccess(null);
    setDeleteConfirm("");
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

      <div className="adm-action-group">
        <h4 className="t-h4">Danger zone</h4>
        <div>
          <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>
            Delete clinic
          </p>
          <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-1) 0 0" }}>
            Permanently removes this clinic and its test data from the app database. This does not touch Twilio or Stripe.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy !== null}
          onClick={openDeleteClinic}
        >
          {busy === "delete_preflight" ? "Checking..." : "Delete clinic"}
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

      <DeleteClinicDialog
        open={deleteDialogOpen}
        preflight={deletePreflight}
        confirmValue={deleteConfirm}
        busy={busy === "delete_clinic"}
        error={deleteError}
        success={deleteSuccess}
        onConfirmValueChange={setDeleteConfirm}
        onConfirm={confirmDeleteClinic}
        onCancel={cancelDeleteClinic}
      />
    </div>
  );
}

function DeleteClinicDialog({
  open,
  preflight,
  confirmValue,
  busy,
  error,
  success,
  onConfirmValueChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  preflight: DeletePreflightState | null;
  confirmValue: string;
  busy: boolean;
  error: string | null;
  success: string | null;
  onConfirmValueChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  onCancelRef.current = onCancel;
  busyRef.current = busy;

  const summary = preflight?.summary ?? null;
  const blockers = preflight?.blockers ?? [];
  const canDelete = Boolean(preflight?.canDelete && summary);
  const confirmReady = canDelete && confirmValue === DELETE_CONFIRM;
  const visibleCounts = (summary?.tableCounts ?? []).filter((row) => row.count > 0);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const firstFocus = canDelete ? inputRef.current : cancelRef.current;
    firstFocus?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busyRef.current) onCancelRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables: HTMLElement[] = [];
      if (inputRef.current && !inputRef.current.disabled) focusables.push(inputRef.current);
      if (cancelRef.current && !cancelRef.current.disabled) focusables.push(cancelRef.current);
      if (confirmRef.current && !confirmRef.current.disabled) focusables.push(confirmRef.current);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      const inside = active ? focusables.includes(active) : false;
      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [canDelete, open]);

  if (!open) return null;

  return (
    <div
      className="adm-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="adm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        style={{ maxWidth: 640 }}
      >
        <h2 id={titleId} className="t-h4" style={{ margin: 0 }}>Delete clinic</h2>
        <p id={bodyId} className="t-small" style={{ margin: "var(--space-3) 0 0", color: "var(--text-secondary)" }}>
          Permanently removes this clinic and its test data from the app database. This does not touch Twilio or Stripe.
        </p>

        {summary ? (
          <>
            <dl className="adm-rows" style={{ marginTop: "var(--space-4)" }}>
              <ModalRow label="Clinic">{summary.clinicName}</ModalRow>
              <ModalRow label="Owner email">{summary.ownerEmail ?? "-"}</ModalRow>
              <ModalRow label="Assigned phones">{summary.assignedPhoneCount}</ModalRow>
              <ModalRow label="SMS recovery">{summary.smsRecoveryEnabled ? "On" : "Off"}</ModalRow>
              <ModalRow label="Billing status">{summary.billingStatus ?? "-"}</ModalRow>
            </dl>

            <section style={{ marginTop: "var(--space-4)" }}>
              <h3 className="adm-subhead">Data that will be deleted</h3>
              {visibleCounts.length === 0 ? (
                <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
                  No related app data was found.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                  {visibleCounts.map((row) => (
                    <div
                      key={`${row.table}:${row.label}`}
                      className="adm-row"
                      style={{ padding: "var(--space-2) 0" }}
                    >
                      <span className="adm-row-label">{row.label}</span>
                      <span className="adm-row-value">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <p className="t-small" style={{ marginTop: "var(--space-4)", color: "var(--text-muted)" }}>
            Could not load this clinic.
          </p>
        )}

        {blockers.length > 0 && (
          <div className="alert alert-error" role="alert" aria-live="polite" style={{ marginTop: "var(--space-4)" }}>
            <div>
              <strong>Resolve these first.</strong>
              <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "var(--space-5)" }}>
                {blockers.map((blocker) => (
                  <li key={blocker.code}>
                    {blocker.message} {blocker.resolution}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {canDelete && !success && (
          <div className="field" style={{ marginTop: "var(--space-4)" }}>
            <label htmlFor={inputId}>Type DELETE to confirm.</label>
            <input
              ref={inputRef}
              id={inputId}
              className="input"
              value={confirmValue}
              onChange={(e) => onConfirmValueChange(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={confirmValue.length > 0 && confirmValue !== DELETE_CONFIRM ? "true" : undefined}
              disabled={busy}
            />
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert" aria-live="polite" style={{ marginTop: "var(--space-4)" }}>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="status" aria-live="polite" style={{ marginTop: "var(--space-4)" }}>
            <span>{success}</span>
          </div>
        )}

        <div className="adm-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={busy || Boolean(success)}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={busy || Boolean(success) || !confirmReady}
          >
            {busy ? "Deleting..." : "Delete clinic"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="adm-row">
      <dt className="adm-row-label">{label}</dt>
      <dd className="adm-row-value">{children}</dd>
    </div>
  );
}
