"use client";

import { useState } from "react";
import { Row } from "../../../_components/AdminUI";

// Serializable copy of lib/phone-numbers/twilio-number-inventory UnassignedNumberItem.
// Declared locally so server-only modules are never pulled into the browser bundle.
type InventoryItem = {
  sid: string;
  phoneNumber: string;
  friendlyName: string | null;
  numberType: "toll_free" | "local";
  twilioPurchasedAt: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  voiceConfig: "ok" | "needs_setup";
  smsConfig: "ok" | "needs_setup";
  assignableHere: boolean;
  notAssignableReason: string | null;
};

type InventoryResponse = {
  ok?: boolean;
  numbers?: InventoryItem[];
  error?: { message?: string };
};

function maskSid(sid: string): string {
  return sid.length > 8 ? `${sid.slice(0, 4)}…${sid.slice(-4)}` : sid;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

// Platform-admin-only: assign an EXISTING owned Twilio number to this clinic.
// Lives inside the admin clinic console (already platform-admin gated). First
// version assigns unassigned toll-free numbers as the clinic's included number.
export function AdminAssignExistingNumber({
  clinicId,
  clinicName,
  onAssigned,
}: {
  clinicId: string;
  clinicName: string;
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [selectedSid, setSelectedSid] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const selected = items.find((i) => i.sid === selectedSid) ?? null;

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/phone-numbers/existing`, {
        method: "GET",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as InventoryResponse | null;
      if (!res.ok || !json?.ok) {
        setLoadError(json?.error?.message ?? "Could not load Twilio numbers.");
        setItems([]);
      } else {
        setItems(json.numbers ?? []);
      }
      setLoaded(true);
    } catch {
      setLoadError("Could not load Twilio numbers. Please try again.");
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  function openSection() {
    setOpen(true);
    setSelectedSid(null);
    setAck(false);
    setAssignError(null);
    if (!loaded) void load();
  }

  function closeSection() {
    setOpen(false);
    setSelectedSid(null);
    setAck(false);
    setAssignError(null);
  }

  async function confirmAssign() {
    if (!selected) return;
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/phone-numbers/existing`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ twilio_phone_number_sid: selected.sid }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setAssignError(json?.error?.message ?? "Could not assign this number.");
        return;
      }
      closeSection();
      onAssigned();
    } catch {
      setAssignError("Could not assign this number. Please try again.");
    } finally {
      setAssigning(false);
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: "var(--space-3)" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={openSection}>
          Assign existing Twilio number
        </button>
        <p className="t-helper" style={{ color: "var(--text-muted)", margin: "var(--space-1) 0 0" }}>
          Assign a toll-free number already owned in our Twilio account — no new purchase.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "var(--space-3)",
        padding: "var(--space-4)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        background: "var(--surface-sunken)",
      }}
    >
      <div className="adm-section-head">
        <h3 className="adm-subhead">Assign existing Twilio number</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={closeSection} disabled={assigning}>
          Close
        </button>
      </div>
      <p className="t-helper" style={{ margin: "var(--space-1) 0 var(--space-3)", color: "var(--text-muted)" }}>
        Owned numbers not assigned to any clinic. Toll-free can be assigned as this clinic’s included number.
      </p>

      {loading && (
        <p className="t-small" style={{ color: "var(--text-muted)" }}>Loading owned numbers…</p>
      )}
      {loadError && (
        <div className="alert alert-error" role="alert"><span>{loadError}</span></div>
      )}
      {loaded && !loading && !loadError && items.length === 0 && (
        <p className="t-small" style={{ color: "var(--text-muted)" }}>
          No unassigned Twilio numbers were found in the account.
        </p>
      )}

      {items.length > 0 && (
        <fieldset className="adm-cand-list">
          <legend className="t-helper">Unassigned numbers</legend>
          {items.map((n) => (
            <label
              key={n.sid}
              className={`adm-cand${selectedSid === n.sid ? " is-selected" : ""}${n.assignableHere ? "" : " is-disabled"}`}
            >
              <input
                type="radio"
                name="adm-existing-num"
                value={n.sid}
                checked={selectedSid === n.sid}
                disabled={!n.assignableHere || assigning}
                onChange={() => { setSelectedSid(n.sid); setAck(false); setAssignError(null); }}
              />
              <span className="adm-cand-body">
                <span className="adm-cand-top">
                  <span className="adm-cand-num t-mono">{n.phoneNumber}</span>
                  <span className={`badge ${n.numberType === "toll_free" ? "badge-info" : "badge-neutral"}`}>
                    {n.numberType === "toll_free" ? "Toll-free" : "Local"}
                  </span>
                </span>
                <span className="adm-cand-meta">
                  <span>SID {maskSid(n.sid)}</span>
                  <span> · Created {fmtDate(n.twilioPurchasedAt)}</span>
                </span>
                <span className="adm-cand-caps">
                  {n.capabilities.voice && <span className="badge badge-success">Voice</span>}
                  {n.capabilities.sms && <span className="badge badge-success">SMS</span>}
                  <span className={`badge ${n.voiceConfig === "ok" ? "badge-success" : "badge-warning"}`}>
                    {n.voiceConfig === "ok" ? "Voice webhook OK" : "Voice needs setup"}
                  </span>
                  <span className={`badge ${n.smsConfig === "ok" ? "badge-success" : "badge-warning"}`}>
                    {n.smsConfig === "ok" ? "SMS webhook OK" : "SMS needs setup"}
                  </span>
                  {!n.assignableHere && n.notAssignableReason && (
                    <span className="badge badge-warning">{n.notAssignableReason}</span>
                  )}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {selected && selected.assignableHere && (
        <div
          style={{
            marginTop: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
            display: "grid",
            gap: "var(--space-3)",
          }}
        >
          <div>
            <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>Confirm assignment</p>
            <dl className="adm-rows" style={{ marginTop: "var(--space-2)" }}>
              <Row label="Number"><span className="t-mono">{selected.phoneNumber}</span></Row>
              <Row label="Type">Toll-free</Row>
              <Row label="Clinic">{clinicName}</Row>
              <Row label="Twilio SID"><span className="t-mono">{maskSid(selected.sid)}</span></Row>
              <Row label="Billing">Included with plan — no monthly charge</Row>
              <Row label="Webhooks">
                {selected.voiceConfig === "ok" && selected.smsConfig === "ok"
                  ? "Already configured"
                  : "Will be set to the standard app endpoints on assign"}
              </Row>
            </dl>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              disabled={assigning}
            />
            <span>I understand this existing Twilio number will be assigned to this clinic.</span>
          </label>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={confirmAssign}
              disabled={!ack || assigning}
              aria-busy={assigning}
            >
              {assigning ? "Assigning…" : "Assign number"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setSelectedSid(null); setAck(false); setAssignError(null); }}
              disabled={assigning}
            >
              Cancel
            </button>
          </div>
          {assignError && (
            <div className="alert alert-error" role="alert" aria-live="polite"><span>{assignError}</span></div>
          )}
        </div>
      )}
    </div>
  );
}
