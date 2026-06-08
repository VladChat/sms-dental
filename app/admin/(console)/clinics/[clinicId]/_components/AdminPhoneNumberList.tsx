"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Row, humanizeToken } from "../../../_components/AdminUI";
import type { AdminClinicPhoneNumber } from "../../../../../../lib/db/admin/types";
import { formatUsdFromCents } from "../../../../../../config/billing.config";

const PHONE_ROLE_LABELS: Record<string, string> = { office_texting: "Office texting" };

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

// Canonical assigned-number list for the platform admin Phone number tab. This is
// the SINGLE place d.phoneNumbers is rendered with per-number suspend/reactivate;
// AdminNumberControls (Admin tools) no longer renders number cards. Suspend keeps
// the number assigned (no Twilio release) and still counts toward the limit and
// additional-number billing quantity. No secrets are shown — SIDs are object
// references the operator uses to find the number in the Twilio console.
export function AdminPhoneNumberList({
  clinicId,
  phoneNumbers,
}: {
  clinicId: string;
  phoneNumbers: AdminClinicPhoneNumber[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(phoneNumberId: string, action: "suspend" | "reactivate") {
    setBusyId(phoneNumberId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/phone-numbers/${phoneNumberId}/action`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? "Action failed. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Action failed. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (phoneNumbers.length === 0) {
    return (
      <p className="t-body" style={{ marginTop: "var(--space-3)" }}>
        No tracking number is assigned to this clinic yet.
      </p>
    );
  }

  return (
    <>
      {error && (
        <div className="alert alert-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
          <span>{error}</span>
        </div>
      )}
      <div className="adm-phone-list">
        {phoneNumbers.map((p) => (
          <div className="adm-phone-card" key={p.id}>
            <div className="adm-phone-card-head">
              <span className="t-mono" style={{ fontWeight: 700 }}>{p.phoneE164 ?? "—"}</span>
              <span style={{ display: "inline-flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <Badge tone="neutral">{PHONE_ROLE_LABELS[p.role] ?? humanizeToken(p.role)}</Badge>
                <Badge tone="neutral">{humanizeToken(p.billingClass)}</Badge>
                <Badge tone="neutral">{humanizeToken(p.source)}</Badge>
                <Badge tone={p.isActive ? "success" : "warning"}>{p.isActive ? "Active" : "Suspended"}</Badge>
              </span>
            </div>
            <dl className="adm-rows">
              <Row label="Monthly cost">{formatUsdFromCents(p.monthlyUnitAmountCents)}</Row>
              <Row label="Provider reference">
                {p.sidTail ? <span className="t-mono">{p.sidTail}</span> : <span style={{ color: "var(--text-muted)" }}>Not available</span>}
              </Row>
              <Row label="Assigned">{fmtDateTime(p.createdAt)}</Row>
              <Row label="Activated">{fmtDateTime(p.activatedAt)}</Row>
              {!p.isActive && (
                <Row label="Suspended">
                  {fmtDateTime(p.suspendedAt)}{p.suspensionReason ? ` · ${p.suspensionReason}` : ""}
                </Row>
              )}
            </dl>
            <div style={{ marginTop: "var(--space-2)" }}>
              {p.isActive ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busyId === p.id}
                  onClick={() => runAction(p.id, "suspend")}
                >
                  {busyId === p.id ? "Working…" : "Suspend number"}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busyId === p.id}
                  onClick={() => runAction(p.id, "reactivate")}
                >
                  {busyId === p.id ? "Working…" : "Reactivate number"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="t-helper" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
        Suspend keeps the number assigned (no Twilio release) and still counts toward the limit and additional-number billing quantity.
      </p>
    </>
  );
}
