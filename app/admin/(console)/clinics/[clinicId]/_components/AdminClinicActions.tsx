"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  clinicId: string;
  isActive: boolean;
  smsRecoveryEnabled: boolean;
  adminInternalNote: string | null;
  // Non-null when the clinic cannot be launched yet — the exact operator reason.
  launchBlockedReason: string | null;
};

const NOTE_MAX = 1000;

// The only working platform-admin mutations: clinic status (pause/reactivate),
// the single service-launch control (launch / pause sending), and the internal
// note. Provisioning review and the duplicate SMS-recovery toggle were removed.
export function AdminClinicActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState(props.adminInternalNote ?? "");

  async function run(
    action: string,
    extra: Record<string, unknown>,
    confirmText?: string,
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setErr(null);
    setMsg(null);
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
        setErr(data?.error?.message ?? "Could not complete this action.");
        return;
      }
      setMsg("Saved.");
      router.refresh();
    } catch {
      setErr("Could not complete this action.");
    } finally {
      setBusy(null);
    }
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
              run("deactivate", {}, "Pause this clinic? Call lookups and any recovery SMS stop immediately. Data is kept.")
            }
          >
            {busy === "deactivate" ? "Working…" : "Pause clinic"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== null}
            onClick={() => run("reactivate", {}, "Reactivate this clinic?")}
          >
            {busy === "reactivate" ? "Working…" : "Reactivate clinic"}
          </button>
        )}
      </div>

      {/* Service launch — the single final-readiness control (sms_recovery_enabled) */}
      <div className="adm-action-group">
        <h4 className="t-h4">Service launch</h4>
        {props.smsRecoveryEnabled ? (
          <div>
            <p className="t-small" style={{ margin: "0 0 var(--space-2)" }}>
              <span className="badge badge-success">Launched</span>
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy !== null}
              onClick={() =>
                run("disable_sms", {}, "Pause SMS sending for this clinic? Recovery texts stop until you launch again. The clinic stays active.")
              }
            >
              {busy === "disable_sms" ? "Working…" : "Pause SMS sending"}
            </button>
          </div>
        ) : props.launchBlockedReason ? (
          <div>
            <button type="button" className="btn btn-primary" disabled aria-disabled="true">
              Launch service
            </button>
            <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
              Blocked: {props.launchBlockedReason}
            </p>
          </div>
        ) : (
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy !== null}
              onClick={() =>
                run(
                  "enable_sms",
                  {},
                  "Launch service for this clinic? Live sending also requires the platform SMS mode to be live; opt-outs are always respected.",
                )
              }
            >
              {busy === "enable_sms" ? "Working…" : "Launch service"}
            </button>
            <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
              Launching turns on the per-clinic gate. Live sending also requires the platform SMS mode and
              always respects opt-outs.
            </p>
          </div>
        )}
      </div>

      {/* Internal note — single, plain-text, internal-only */}
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
    </div>
  );
}
