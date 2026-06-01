"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  clinicId: string;
  isActive: boolean;
  smsRecoveryEnabled: boolean;
  adminInternalNote: string | null;
  adminProvisioningStatus: string | null;
  adminProvisioningNote: string | null;
  enableSmsBlockedReason: string | null;
};

const PROVISIONING_OPTIONS = [
  { v: "none", t: "None" },
  { v: "review_needed", t: "Review needed" },
  { v: "in_review", t: "In review" },
  { v: "cleared", t: "Cleared" },
  { v: "blocked", t: "Blocked" },
];

const NOTE_MAX = 1000;

export function AdminClinicActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState(props.adminInternalNote ?? "");
  const [provStatus, setProvStatus] = useState(props.adminProvisioningStatus ?? "none");
  const [provNote, setProvNote] = useState(props.adminProvisioningNote ?? "");

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
  const provNoteTooLong = provNote.length > NOTE_MAX;

  return (
    <div className="adm-actions-panel" style={{ display: "grid", gap: "var(--space-5)" }}>
      {(msg || err) && (
        <div className={`alert ${err ? "alert-error" : "alert-success"}`} role="status" aria-live="polite">
          <span>{err ?? msg}</span>
        </div>
      )}

      {/* Lifecycle */}
      <div className="adm-action-group">
        <h4 className="t-h4">Clinic status</h4>
        {props.isActive ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy !== null}
            onClick={() =>
              run("deactivate", {}, "Deactivate this clinic? Call lookups and recovery SMS stop immediately. Data is kept.")
            }
          >
            {busy === "deactivate" ? "Working…" : "Deactivate clinic"}
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

      {/* SMS recovery */}
      <div className="adm-action-group">
        <h4 className="t-h4">SMS recovery</h4>
        {props.smsRecoveryEnabled ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy !== null}
            onClick={() =>
              run("disable_sms", {}, "Disable SMS recovery for this clinic? Future recovery texts will not be sent.")
            }
          >
            {busy === "disable_sms" ? "Working…" : "Disable SMS recovery"}
          </button>
        ) : props.enableSmsBlockedReason ? (
          <div>
            <button type="button" className="btn btn-primary" disabled aria-disabled="true">
              Enable SMS recovery
            </button>
            <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
              Blocked: {props.enableSmsBlockedReason}
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
                  "Enable SMS recovery for this clinic? Live sending also requires the platform SMS mode to be live; opt-outs are always respected.",
                )
              }
            >
              {busy === "enable_sms" ? "Working…" : "Enable SMS recovery"}
            </button>
            <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
              Enabling the per-clinic gate does not send SMS by itself — live sending also requires the
              platform SMS mode and respects opt-outs.
            </p>
          </div>
        )}
      </div>

      {/* Internal note */}
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

      {/* Provisioning / compliance review (internal) */}
      <div className="adm-action-group">
        <h4 className="t-h4">Provisioning review</h4>
        <div className="field">
          <label htmlFor="prov-status">Status</label>
          <select id="prov-status" className="input" value={provStatus} onChange={(e) => setProvStatus(e.target.value)}>
            {PROVISIONING_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>{o.t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="prov-note">Review note</label>
          <textarea
            id="prov-note"
            className="textarea"
            value={provNote}
            onChange={(e) => setProvNote(e.target.value)}
            aria-invalid={provNoteTooLong ? "true" : undefined}
          />
          <span className={`helper${provNoteTooLong ? " adm-over" : ""}`}>{provNote.length}/{NOTE_MAX}</span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy !== null || provNoteTooLong}
          onClick={() => run("set_provisioning", { provisioningStatus: provStatus, note: provNote })}
        >
          {busy === "set_provisioning" ? "Saving…" : "Save provisioning"}
        </button>
      </div>
    </div>
  );
}
