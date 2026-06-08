"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import buildA2pLifecycleSteps from "../../../../../../lib/a2p/lifecycle";
import type { A2pReviewPackage, A2pStoredSubmissionMode } from "../../../../../../lib/a2p/types";

export function A2pLifecycle({ pkg, clinicId, selectedMode }: { pkg: A2pReviewPackage; clinicId: string; selectedMode: A2pStoredSubmissionMode; }) {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [confirmMap, setConfirmMap] = useState<Record<string, boolean>>({});
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const steps = buildA2pLifecycleSteps(pkg, selectedMode);

  async function runAction(stepId: string, actionLabel?: string) {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    if (step.status === "locked") return setLastMsg("This step is locked until its prerequisites are met.");
    if (step.disabledReason) return setLastMsg(step.disabledReason);
    // require confirmation for create actions
    const needsConfirm = step.actionLabel?.toLowerCase().includes("create") || false;
    if (needsConfirm && !confirmMap[stepId]) return setLastMsg("Please confirm the action before proceeding.");

    // Refresh actions use the /a2p/status endpoint (read-only provider sync).
    const isRefresh = stepId.includes("refresh");
    const endpoint = isRefresh
      ? `/api/admin/clinics/${clinicId}/a2p/status`
      : `/api/admin/clinics/${clinicId}/a2p/action`;

    setRunning(stepId);
    setLastMsg(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: stepId, confirm: isRefresh ? false : confirmMap[stepId] === true }),
      });
      const json = await res.json();
      setLastMsg(json?.message ?? (json?.ok ? "OK" : "Unexpected response"));
      // After a successful non-dry-run mutation, refresh server data so the
      // lifecycle and review panel reflect the new provider state.
      if (!isRefresh && json?.ok && json?.dryRun === false) {
        router.refresh();
      }
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
          <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {s.status === "complete" && (
              <span className="t-small" style={{ color: "var(--color-success, #16a34a)", fontWeight: 600 }}>✓ Complete</span>
            )}
            {s.status === "ready" && s.actionLabel && (
              <button className="btn btn-sm btn-primary" disabled={running === s.id} onClick={() => runAction(s.id, s.actionLabel)}>
                {running === s.id ? "Running…" : s.actionLabel}
              </button>
            )}
            {s.status === "ready" && s.actionLabel && s.actionLabel.toLowerCase().includes("create") && (
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
