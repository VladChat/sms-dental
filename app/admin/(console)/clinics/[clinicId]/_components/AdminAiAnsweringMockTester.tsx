"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "../../../_components/AdminUI";
import {
  AI_VOICE_SESSION_STATUSES,
  aiVoiceSourceLabel,
  aiVoiceStatusLabel,
  type AiVoiceSessionStatus,
} from "../../../../../../config/ai-answering.config";

// Platform-admin-only AI Answering mock tester. Creates and inspects MOCK AI
// answered call sessions for ONE clinic so an admin can verify how an AI answered
// call appears in Workspace. NON-LIVE: it does not place a call, run AI, send
// SMS, or contact Twilio/OpenAI. There is no enable/activation control here.

type LoadState = "loading" | "error" | "ready";

type SessionView = {
  id: string;
  patientPhoneMasked: string;
  status: AiVoiceSessionStatus;
  source: string;
  capturedPatientName: string | null;
  capturedReason: string | null;
  capturedPreferredTime: string | null;
  summaryHeadline: string | null;
  handoffNote: string | null;
  safetySignal: boolean;
  smsFollowupRecommended: boolean;
  createdAt: string;
  completedAt: string | null;
};

type OverviewPayload = {
  ok?: boolean;
  foundationApplied?: boolean;
  settings?: { selectedVoiceId?: string; voiceLabel?: string };
  totalCount?: number;
  sessions?: SessionView[];
  error?: { message?: string };
};

function statusTone(status: AiVoiceSessionStatus): "success" | "warning" | "neutral" {
  if (status === "captured") return "success";
  if (status === "failed") return "warning";
  return "neutral";
}

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export function AdminAiAnsweringMockTester({ clinicId }: { clinicId: string }) {
  const [load, setLoad] = useState<LoadState>("loading");
  const [foundationApplied, setFoundationApplied] = useState(true);
  const [voiceLabel, setVoiceLabel] = useState<string>("");
  const [totalCount, setTotalCount] = useState(0);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state.
  const [patientPhone, setPatientPhone] = useState("");
  const [patientName, setPatientName] = useState("");
  const [reason, setReason] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [status, setStatus] = useState<AiVoiceSessionStatus>("captured");
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [handoffNote, setHandoffNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const apiBase = `/api/admin/clinics/${clinicId}/ai-answering`;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiBase, { credentials: "include" });
      const json = (await res.json().catch(() => null)) as OverviewPayload | null;
      if (!res.ok || !json?.ok) {
        setLoadError(json?.error?.message ?? "Could not load AI Answering data.");
        setLoad("error");
        return;
      }
      setFoundationApplied(json.foundationApplied !== false);
      setVoiceLabel(json.settings?.voiceLabel ?? json.settings?.selectedVoiceId ?? "");
      setTotalCount(json.totalCount ?? 0);
      setSessions(Array.isArray(json.sessions) ? json.sessions : []);
      setLoad("ready");
    } catch {
      setLoadError("Could not load AI Answering data.");
      setLoad("error");
    }
  }, [apiBase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createMockSession() {
    if (patientPhone.trim().length === 0) {
      setSubmitError("Enter a test caller phone number in E.164 format (e.g. +12245551234).");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`${apiBase}/mock-session`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientPhone: patientPhone.trim(),
          capturedPatientName: patientName.trim() || undefined,
          capturedReason: reason.trim() || undefined,
          capturedPreferredTime: preferredTime.trim() || undefined,
          status,
          safetySignal: safetyConcern,
          handoffNote: handoffNote.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setSubmitError(json?.error?.message ?? "Could not create the mock session.");
        return;
      }
      setSuccessMessage(json.message ?? "Mock AI answered call request created.");
      // Reset the request-specific fields; keep the phone for repeat testing.
      setReason("");
      setPreferredTime("");
      setHandoffNote("");
      setSafetyConcern(false);
      await refresh();
    } catch {
      setSubmitError("Could not create the mock session.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      {/* Non-live callout + safety copy */}
      <div className="adm-banner tone-info" role="note">
        <div className="adm-banner-main">
          <span className="adm-banner-title">Not live yet — internal test tool</span>
          <span className="adm-banner-body">
            This creates a mock AI answered call request for Workspace testing. It does
            not place a call, run AI, send SMS, or contact Twilio.
          </span>
        </div>
      </div>

      <p className="t-small" style={{ color: "var(--warning)", fontWeight: 600, margin: 0 }}>
        Use only test clinics and documented safe test caller numbers. Never enter real
        patient data.
      </p>

      {load === "loading" && <p className="t-small" style={{ color: "var(--text-muted)" }}>Loading…</p>}
      {load === "error" && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{loadError ?? "Could not load AI Answering data."}</span>
        </div>
      )}

      {load === "ready" && (
        <>
          {!foundationApplied && (
            <div className="alert alert-warning" role="status">
              <span>
                AI Answering tables are not applied to this database yet. In production
                the migration is applied; this state is expected only in local dev.
              </span>
            </div>
          )}

          {/* Future voice preference (display only) */}
          <dl className="adm-rows">
            <div className="adm-row">
              <span className="adm-row-label">Future AI voice preference</span>
              <span className="adm-row-value">{voiceLabel || "—"}</span>
            </div>
            <div className="adm-row">
              <span className="adm-row-label">Mock sessions for this clinic</span>
              <span className="adm-row-value">{totalCount}</span>
            </div>
          </dl>

          {/* Create form */}
          <div
            style={{
              padding: "var(--space-4)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              background: "var(--surface-sunken)",
              display: "grid",
              gap: "var(--space-3)",
            }}
          >
            <h3 className="adm-subhead">Create mock Workspace request</h3>

            <div className="field">
              <label htmlFor="aia-phone">Patient phone (test number, E.164)</label>
              <input
                id="aia-phone"
                className="input"
                inputMode="tel"
                placeholder="+12245551234"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="field">
              <label htmlFor="aia-name">Patient name (optional)</label>
              <input
                id="aia-name"
                className="input"
                placeholder="QA Caller"
                maxLength={80}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label htmlFor="aia-reason">Reason for call (optional)</label>
              <input
                id="aia-reason"
                className="input"
                placeholder="Wants a cleaning appointment"
                maxLength={240}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label htmlFor="aia-time">Preferred time (optional)</label>
              <input
                id="aia-time"
                className="input"
                placeholder="Tuesday morning"
                maxLength={120}
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label htmlFor="aia-status">Status</label>
              <select
                id="aia-status"
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as AiVoiceSessionStatus)}
              >
                {AI_VOICE_SESSION_STATUSES.map((s) => (
                  <option key={s} value={s}>{aiVoiceStatusLabel(s)}</option>
                ))}
              </select>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={safetyConcern}
                onChange={(e) => setSafetyConcern(e.target.checked)}
              />
              <span>Safety concern (flags the request for urgent front-desk attention)</span>
            </label>

            <div className="field">
              <label htmlFor="aia-handoff">Handoff note (optional)</label>
              <textarea
                id="aia-handoff"
                className="textarea"
                placeholder="Mock AI Answering foundation test. No real call was placed."
                maxLength={500}
                value={handoffNote}
                onChange={(e) => setHandoffNote(e.target.value)}
              />
            </div>

            <p className="t-helper" style={{ margin: 0, color: "var(--text-muted)" }}>
              No call is placed. No AI runs. No SMS is sent.
            </p>

            {submitError && (
              <div className="alert alert-error" role="alert" aria-live="polite">
                <span>{submitError}</span>
              </div>
            )}
            {successMessage && !submitError && (
              <div className="alert alert-success" role="status" aria-live="polite">
                <span>{successMessage}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={submitting || !foundationApplied}
                onClick={createMockSession}
              >
                {submitting ? "Creating…" : "Create mock Workspace request"}
              </button>
              <Link className="btn btn-secondary btn-sm" href="/workspace">
                Open Workspace if your account has clinic access
              </Link>
            </div>
          </div>

          {/* Latest mock sessions — lets the admin verify creation even without
              Workspace access. */}
          <div>
            <h3 className="adm-subhead">Latest mock sessions</h3>
            {sessions.length === 0 ? (
              <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
                No mock AI answered call sessions for this clinic yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                {sessions.map((s) => (
                  <div className="adm-phone-card" key={s.id}>
                    <div className="adm-phone-card-head">
                      <span className="t-mono" style={{ fontWeight: 700 }}>{s.patientPhoneMasked}</span>
                      <span style={{ display: "inline-flex", gap: "var(--space-2)" }}>
                        <Badge tone={statusTone(s.status)}>{aiVoiceStatusLabel(s.status)}</Badge>
                        <Badge tone="neutral">{aiVoiceSourceLabel(s.source)}</Badge>
                        {s.safetySignal && <Badge tone="warning">Safety concern</Badge>}
                      </span>
                    </div>
                    <dl className="adm-rows">
                      {s.summaryHeadline && (
                        <div className="adm-row">
                          <span className="adm-row-label">Summary</span>
                          <span className="adm-row-value">{s.summaryHeadline}</span>
                        </div>
                      )}
                      {s.capturedPatientName && (
                        <div className="adm-row">
                          <span className="adm-row-label">Name</span>
                          <span className="adm-row-value">{s.capturedPatientName}</span>
                        </div>
                      )}
                      {s.capturedReason && (
                        <div className="adm-row">
                          <span className="adm-row-label">Reason</span>
                          <span className="adm-row-value">{s.capturedReason}</span>
                        </div>
                      )}
                      {s.capturedPreferredTime && (
                        <div className="adm-row">
                          <span className="adm-row-label">Preferred time</span>
                          <span className="adm-row-value">{s.capturedPreferredTime}</span>
                        </div>
                      )}
                      {s.handoffNote && (
                        <div className="adm-row">
                          <span className="adm-row-label">Handoff note</span>
                          <span className="adm-row-value">{s.handoffNote}</span>
                        </div>
                      )}
                      <div className="adm-row">
                        <span className="adm-row-label">Created</span>
                        <span className="adm-row-value">{fmtDateTime(s.createdAt)}</span>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
