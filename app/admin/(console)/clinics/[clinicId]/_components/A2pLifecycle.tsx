"use client";

import React, { useState } from "react";
import buildA2pLifecycleSteps from "../../../../../../lib/a2p/lifecycle";
import type { A2pReviewPackage, A2pStoredSubmissionMode } from "../../../../../../lib/a2p/types";

export function A2pLifecycle({ pkg, clinicId, selectedMode }: { pkg: A2pReviewPackage; clinicId: string; selectedMode: A2pStoredSubmissionMode; }) {
  const [running, setRunning] = useState<string | null>(null);
  const [confirmMap, setConfirmMap] = useState<Record<string, boolean>>({});
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const steps = buildA2pLifecycleSteps(pkg, selectedMode);

  async function runAction(stepId: string, actionLabel?: string) {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    if (step.disabledReason) return setLastMsg(step.disabledReason);
    // require confirmation for create actions
    const needsConfirm = step.actionLabel?.toLowerCase().includes("create") || false;
    if (needsConfirm && !confirmMap[stepId]) return setLastMsg("Please confirm the action before proceeding.");
    setRunning(stepId);
    setLastMsg(null);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/a2p/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: stepId, confirm: false }),
      });
      const json = await res.json();
      setLastMsg(json?.message ?? (json?.ok ? "OK" : "Unexpected response"));
    } catch (err: any) {
      setLastMsg(String(err?.message ?? err));
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="a2p-lifecycle">
      {steps.map((s) => (
        <div key={s.id} className="a2p-lifecycle-step" style={{ border: "1px solid var(--divider)", padding: "12px", marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{s.title}</strong>
              <div className="t-small" style={{ color: "var(--text-muted)" }}>{s.description}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="t-small">Status: <strong>{s.status}</strong></div>
              {s.providerSid && <div className="t-small" style={{ color: "var(--text-muted)" }}>SID: {s.providerSid}</div>}
            </div>
          </div>
          <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
            <button className="btn btn-sm btn-primary" disabled={Boolean(s.disabledReason) || running === s.id} onClick={() => runAction(s.id, s.actionLabel)}>
              {running === s.id ? "Running…" : s.actionLabel ?? "Run"}
            </button>
            {s.actionLabel && s.actionLabel.toLowerCase().includes("create") && (
              <label className="check" style={{ marginLeft: "8px" }}>
                <input type="checkbox" checked={!!confirmMap[s.id]} onChange={(e) => setConfirmMap({ ...confirmMap, [s.id]: e.target.checked })} />
                <span className="t-small">I confirm</span>
              </label>
            )}
            {s.disabledReason && <div className="t-small" style={{ color: "var(--text-muted)" }}>{s.disabledReason}</div>}
          </div>
        </div>
      ))}
      {lastMsg && <div className="t-small" style={{ marginTop: "8px" }}>{lastMsg}</div>}
    </div>
  );
}

export default A2pLifecycle;
