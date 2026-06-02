"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmTone?: "primary" | "danger";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

// Reusable in-app confirmation dialog for platform-admin actions. Replaces the
// native window.confirm() so confirmations match the app UI. Accessible:
// role="dialog" + aria-modal, focus is moved into the dialog on open and
// restored to the trigger on close, Escape / Cancel / backdrop close it, and Tab
// is trapped between the two buttons. The dialog never performs an action itself —
// onConfirm calls back into the existing API path (and its audit logging).
export function AdminConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmTone = "primary",
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const bodyId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  // Keep the latest handler/flag in refs so the keydown listener reads current
  // values without re-subscribing (which would steal focus on every render).
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  onCancelRef.current = onCancel;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    confirmRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busyRef.current) onCancelRef.current();
        return;
      }
      if (e.key === "Tab") {
        const focusables = [cancelRef.current, confirmRef.current].filter(
          (el): el is HTMLButtonElement => Boolean(el),
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement as HTMLButtonElement | null;
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
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open]);

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
      >
        <h2 id={titleId} className="t-h4" style={{ margin: 0 }}>{title}</h2>
        <p id={bodyId} className="t-small" style={{ margin: "var(--space-3) 0 0", color: "var(--text-secondary)" }}>
          {body}
        </p>
        {error && (
          <div className="alert alert-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
            <span>{error}</span>
          </div>
        )}
        <div className="adm-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${confirmTone === "danger" ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
