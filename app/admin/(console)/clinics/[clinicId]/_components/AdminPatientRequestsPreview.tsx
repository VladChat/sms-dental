"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../../_components/AdminUI";
import type { WorkspaceSourceChannel } from "../../../../../../config/ai-answering.config";

type LoadState = "loading" | "error" | "ready";

type PatientRequestPreview = {
  requestKey: string;
  callerPhoneMasked: string;
  patientName: string | null;
  statusLabel: "Needs follow-up" | "Handled" | "Blocked" | string;
  sourceChannel: WorkspaceSourceChannel;
  sourceLabel: string;
  summaryHeadline: string;
  createdAt: string;
  lastActivityAt: string;
  smsMessageCount: number;
  aiVoice: {
    summaryHeadline: string | null;
    capturedName: string | null;
    reason: string | null;
    preferredTime: string | null;
    safetyConcern: boolean;
    handoffNote: string | null;
    capturedAt: string | null;
  } | null;
};

type Payload = {
  ok?: boolean;
  requests?: PatientRequestPreview[];
  error?: { message?: string };
};

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "-";
}

function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "Handled") return "success";
  if (status === "Blocked") return "warning";
  return "neutral";
}

function sourceTone(source: WorkspaceSourceChannel): "info" | "brand" | "neutral" {
  if (source === "ai_voice") return "brand";
  if (source === "mixed") return "info";
  return "neutral";
}

export function AdminPatientRequestsPreview({ clinicId }: { clinicId: string }) {
  const [load, setLoad] = useState<LoadState>("loading");
  const [requests, setRequests] = useState<PatientRequestPreview[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoad("loading");
    setError(null);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/patient-requests`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as Payload | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? "Could not load patient requests.");
        setLoad("error");
        return;
      }
      setRequests(Array.isArray(json.requests) ? json.requests : []);
      setLoad("ready");
    } catch {
      setError("Could not load patient requests.");
      setLoad("error");
    }
  }, [clinicId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (load === "loading") {
    return <p className="t-small" style={{ color: "var(--text-muted)" }}>Loading...</p>;
  }

  if (load === "error") {
    return (
      <div className="alert alert-error" role="alert" aria-live="polite">
        <span>{error ?? "Could not load patient requests."}</span>
      </div>
    );
  }

  if (requests.length === 0) {
    return <p className="t-small" style={{ color: "var(--text-muted)" }}>No patient requests yet.</p>;
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      {requests.map((request) => (
        <article className="adm-phone-card" key={request.requestKey}>
          <div className="adm-phone-card-head">
            <div>
              <h3 className="adm-subhead" style={{ margin: 0 }}>
                {request.patientName ?? request.callerPhoneMasked}
              </h3>
              {request.patientName && (
                <p className="t-helper t-mono" style={{ margin: "var(--space-1) 0 0" }}>
                  {request.callerPhoneMasked}
                </p>
              )}
            </div>
            <span style={{ display: "inline-flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <Badge tone={sourceTone(request.sourceChannel)}>{request.sourceLabel}</Badge>
              <Badge tone={statusTone(request.statusLabel)}>{request.statusLabel}</Badge>
              {request.aiVoice?.safetyConcern && <Badge tone="warning">Urgent concern</Badge>}
            </span>
          </div>

          <dl className="adm-rows">
            <div className="adm-row">
              <span className="adm-row-label">Summary</span>
              <span className="adm-row-value">{request.summaryHeadline}</span>
            </div>
            {request.aiVoice?.capturedName && (
              <div className="adm-row">
                <span className="adm-row-label">Name</span>
                <span className="adm-row-value">{request.aiVoice.capturedName}</span>
              </div>
            )}
            {request.aiVoice?.summaryHeadline && (
              <div className="adm-row">
                <span className="adm-row-label">AI call summary</span>
                <span className="adm-row-value">{request.aiVoice.summaryHeadline}</span>
              </div>
            )}
            {request.aiVoice?.reason && (
              <div className="adm-row">
                <span className="adm-row-label">Reason</span>
                <span className="adm-row-value">{request.aiVoice.reason}</span>
              </div>
            )}
            {request.aiVoice?.preferredTime && (
              <div className="adm-row">
                <span className="adm-row-label">Preferred time</span>
                <span className="adm-row-value">{request.aiVoice.preferredTime}</span>
              </div>
            )}
            {request.aiVoice?.handoffNote && (
              <div className="adm-row">
                <span className="adm-row-label">Internal note</span>
                <span className="adm-row-value">{request.aiVoice.handoffNote}</span>
              </div>
            )}
            {request.aiVoice?.capturedAt && (
              <div className="adm-row">
                <span className="adm-row-label">Captured</span>
                <span className="adm-row-value">{fmtDateTime(request.aiVoice.capturedAt)}</span>
              </div>
            )}
            <div className="adm-row">
              <span className="adm-row-label">Last activity</span>
              <span className="adm-row-value">{fmtDateTime(request.lastActivityAt)}</span>
            </div>
            <div className="adm-row">
              <span className="adm-row-label">Created</span>
              <span className="adm-row-value">{fmtDateTime(request.createdAt)}</span>
            </div>
            <div className="adm-row">
              <span className="adm-row-label">SMS activity</span>
              <span className="adm-row-value">
                {request.smsMessageCount === 0
                  ? "No SMS messages"
                  : `${request.smsMessageCount} SMS ${request.smsMessageCount === 1 ? "message" : "messages"}`}
              </span>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
