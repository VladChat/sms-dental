"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Row } from "../../../_components/AdminUI";
import type { AdminClinicDetail } from "../../../../../../lib/db/admin/types";
import { formatUsdFromCents } from "../../../../../../config/billing.config";

// Platform-admin number operations: purchase permission, limit, per-number
// suspend/reactivate, purchase attempts, and legacy requests. All writes go to
// the admin action routes (audited server-side). No secrets are shown.
export function AdminNumberControls({ d }: { d: AdminClinicDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitInput, setLimitInput] = useState(String(d.phoneNumberLimit));

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? "Action failed. Please try again.");
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
    } catch {
      setError("Action failed. Please try again.");
      setBusy(false);
    }
  }

  const actionUrl = `/admin/clinics/${d.id}/action`;
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

  return (
    <div style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-4)" }}>
      <div className="adm-section-head">
        <h3 className="adm-subhead">Number operations</h3>
        <Badge tone={d.phoneNumberPurchasesEnabled ? "success" : "warning"}>
          {d.phoneNumberPurchasesEnabled ? "Purchasing allowed" : "Purchasing revoked"}
        </Badge>
      </div>

      <dl className="adm-rows">
        <Row label="Numbers used">{d.heldNumberCount} of {d.phoneNumberLimit} held · {d.activeNumberCount} active</Row>
        <Row label="Additional billed quantity">{d.additionalBilledQuantity}</Row>
        <Row label="Billing status">{d.billingStatus}</Row>
        <Row label="Trial">{d.trialStartedAt ? `${fmtDate(d.trialStartedAt)} → ${fmtDate(d.trialEndsAt)}` : "—"}</Row>
        <Row label="Paid plan started">{fmtDate(d.paidPlanStartedAt)}</Row>
        <Row label="Subscription">{d.stripeSubscriptionPresent ? "Present" : "None"}</Row>
        {d.phoneNumberPurchaseSuspendedReason && (
          <Row label="Revoke reason">{d.phoneNumberPurchaseSuspendedReason}</Row>
        )}
      </dl>

      {error && <div className="alert alert-error" role="alert"><span>{error}</span></div>}

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
        {d.phoneNumberPurchasesEnabled ? (
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => post(actionUrl, { action: "revoke_number_purchases" })}>
            Revoke new purchases
          </button>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
            onClick={() => post(actionUrl, { action: "allow_number_purchases" })}>
            Allow new purchases
          </button>
        )}
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="adm-limit">Limit (1–100)</label>
          <input id="adm-limit" className="input t-mono" style={{ width: "5rem" }} value={limitInput}
            inputMode="numeric" onChange={(e) => setLimitInput(e.target.value.replace(/\D/g, "").slice(0, 3))} />
        </div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
          onClick={() => post(actionUrl, { action: "set_phone_number_limit", limit: Number(limitInput) })}>
          Set limit
        </button>
      </div>

      {/* Assigned numbers with per-number suspend/reactivate. */}
      {d.phoneNumbers.length > 0 && (
        <div className="adm-phone-list">
          {d.phoneNumbers.map((p) => (
            <div className="adm-phone-card" key={p.id}>
              <div className="adm-phone-card-head">
                <span className="t-mono" style={{ fontWeight: 700 }}>{p.phoneE164 ?? "—"}</span>
                <span style={{ display: "inline-flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <Badge tone="neutral">{p.billingClass}</Badge>
                  <Badge tone="neutral">{p.source}</Badge>
                  <Badge tone={p.isActive ? "success" : "warning"}>{p.isActive ? "Active" : "Suspended"}</Badge>
                </span>
              </div>
              <dl className="adm-rows">
                <Row label="Monthly">{formatUsdFromCents(p.monthlyUnitAmountCents)}</Row>
                <Row label="Provider reference">{p.sidTail ?? "—"}</Row>
                <Row label="Activated">{fmtDate(p.activatedAt)}</Row>
                {!p.isActive && <Row label="Suspended">{fmtDate(p.suspendedAt)}{p.suspensionReason ? ` · ${p.suspensionReason}` : ""}</Row>}
              </dl>
              <div style={{ marginTop: "var(--space-2)" }}>
                {p.isActive ? (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
                    onClick={() => post(`/admin/clinics/${d.id}/phone-numbers/${p.id}/action`, { action: "suspend" })}>
                    Suspend number
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
                    onClick={() => post(`/admin/clinics/${d.id}/phone-numbers/${p.id}/action`, { action: "reactivate" })}>
                    Reactivate number
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="t-helper" style={{ color: "var(--text-muted)", margin: 0 }}>
        Suspend keeps the number assigned (no Twilio release) and still counts toward the limit and additional-number billing quantity.
      </p>

      {/* Recent purchase attempts (reconciliation visibility). */}
      {d.recentPurchaseAttempts.length > 0 && (
        <details className="adm-fold">
          <summary>Recent purchase attempts</summary>
          <div className="adm-activity" style={{ marginTop: "var(--space-2)" }}>
            {d.recentPurchaseAttempts.map((a) => (
              <div className="adm-activity-item" key={a.id}>
                <span className="t-small">
                  <Badge tone={a.status === "assigned" ? "success" : a.status === "reconciliation_required" ? "warning" : "neutral"}>{a.status}</Badge>{" "}
                  {a.slotClass} · {a.source} · <span className="t-mono">{a.requestedPhoneNumber}</span>
                  {a.twilioSid ? <> · SID <span className="t-mono">{a.twilioSid}</span></> : null}
                  {a.errorCode ? ` · ${a.errorCode}` : ""}
                </span>
                <span className="t-helper" style={{ color: "var(--text-muted)" }}>{fmtDate(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Legacy owner number requests (retired workflow). */}
      {d.requestedNumbers.length > 0 && (
        <details className="adm-fold">
          <summary>Legacy number requests ({d.requestedNumbers.length})</summary>
          <p className="t-helper" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0" }}>
            This request workflow is no longer used for new purchases. Dismissing a request has no Stripe or Twilio side effect.
          </p>
          {d.requestedNumbers.map((r) => (
            <div className="adm-phone-card" key={r.id}>
              <div className="adm-phone-card-head">
                <span className="t-mono">{r.phoneNumber}</span>
                <Badge tone="neutral">{r.status}</Badge>
              </div>
              <dl className="adm-rows">
                <Row label="Billing class">{r.billingClass}</Row>
                {r.billingClass === "additional" && (
                  <Row label="Consent">
                    {r.billingConsentAuthorizedAt
                      ? `Owner authorized ${formatUsdFromCents(r.monthlyUnitAmountCents)}/month — ${fmtDate(r.billingConsentAuthorizedAt)}`
                      : "Not authorized"}
                  </Row>
                )}
                <Row label="Requested by">{r.requestedByEmail ?? "—"}</Row>
              </dl>
              <div style={{ marginTop: "var(--space-2)" }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
                  onClick={() => post(actionUrl, { action: "dismiss_legacy_request", request_id: r.id })}>
                  Dismiss request
                </button>
              </div>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
