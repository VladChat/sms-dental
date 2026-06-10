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

function textingTone(p: AdminClinicPhoneNumber): "success" | "warning" | "neutral" {
  if (!p.isActive || p.removalStatus !== "active") return "neutral";
  return p.textingStatus === "active" ? "success" : "warning";
}

function textingLabel(p: AdminClinicPhoneNumber): string {
  if (!p.isActive || p.removalStatus !== "active") return "Not active";
  if (p.textingStatus === "active") return "Active";
  if (p.textingStatus === "failed") return "Needs review";
  if (p.textingStatus === "preparing") return "Preparing";
  return p.numberType === "local" ? "Waiting for A2P approval" : "Toll-free verification pending";
}

function textingNextAction(p: AdminClinicPhoneNumber): string {
  if (!p.isActive || p.removalStatus !== "active") return "Reactivate or restore before texting can be live.";
  if (p.textingStatus === "active") return "No action required.";
  if (p.textingProviderErrorCode) return "Review provider error and run texting status sync again.";
  if (p.numberType === "toll_free") return "Confirm toll-free verification in Twilio or wait for the next sync.";
  return "Run readiness sync after A2P and Messaging Service coverage are ready.";
}

// Client-side convenience gate for offering "Detach from clinic". The server
// (detachClinicPhoneNumber) is the authority and re-checks every rule. First
// version: only an unpaid, currently-assigned toll-free number (the clinic's
// included/legacy slot, $0). Suspended numbers keep removal_status='active', so
// they remain detachable.
function detachEligible(p: AdminClinicPhoneNumber): boolean {
  return (
    p.removalStatus === "active" &&
    p.numberType === "toll_free" &&
    p.billingClass !== "additional" &&
    p.monthlyUnitAmountCents === 0
  );
}

type ConfirmState = { id: string; action: "suspend" | "detach" } | null;

// Canonical assigned-number list for the platform admin Phone number tab. This is
// the SINGLE place d.phoneNumbers is rendered with per-number controls. Detached
// rows are already filtered out server-side, so this list only shows numbers still
// assigned to this clinic. Suspend keeps the number assigned (no Twilio release)
// and still counts toward the limit and additional-number billing quantity. Detach
// releases ONLY the clinic assignment (no Twilio release) and frees the number for
// another clinic. No secrets are shown — SIDs are object references.
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
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [ack, setAck] = useState(false);

  function openConfirm(id: string, action: "suspend" | "detach") {
    setConfirm({ id, action });
    setAck(false);
    setError(null);
  }
  function closeConfirm() {
    setConfirm(null);
    setAck(false);
  }

  async function runAction(phoneNumberId: string, action: "suspend" | "reactivate" | "detach") {
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
      closeConfirm();
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
      {error && !confirm && (
        <div className="alert alert-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
          <span>{error}</span>
        </div>
      )}
      <div className="adm-phone-list">
        {phoneNumbers.map((p) => {
          const open = confirm?.id === p.id ? confirm.action : null;
          const busy = busyId === p.id;
          return (
            <div className="adm-phone-card" key={p.id}>
              <div className="adm-phone-card-head">
                <span className="t-mono" style={{ fontWeight: 700 }}>{p.phoneE164 ?? "—"}</span>
                <span style={{ display: "inline-flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <Badge tone="neutral">{PHONE_ROLE_LABELS[p.role] ?? humanizeToken(p.role)}</Badge>
                  <Badge tone="neutral">{humanizeToken(p.billingClass)}</Badge>
                  <Badge tone="neutral">{humanizeToken(p.source)}</Badge>
                  <Badge tone={p.isActive ? "success" : "warning"}>{p.isActive ? "Active" : "Suspended"}</Badge>
                  <Badge tone={textingTone(p)}>{textingLabel(p)}</Badge>
                </span>
              </div>
              <dl className="adm-rows">
                <Row label="Monthly cost">{formatUsdFromCents(p.monthlyUnitAmountCents)}</Row>
                <Row label="Number type">{humanizeToken(p.numberType)}</Row>
                <Row label="Texting status">
                  <Badge tone={textingTone(p)}>{textingLabel(p)}</Badge>
                </Row>
                <Row label="Texting source"><span className="t-mono">{p.textingStatusSource}</span></Row>
                <Row label="Texting updated">{fmtDateTime(p.textingStatusUpdatedAt)}</Row>
                <Row label="Provider status">
                  {p.textingProviderStatus ? <span className="t-mono">{p.textingProviderStatus}</span> : <span style={{ color: "var(--text-muted)" }}>Not synced</span>}
                </Row>
                <Row label="Provider synced">{fmtDateTime(p.textingProviderSyncedAt)}</Row>
                {p.textingProviderErrorCode && (
                  <Row label="Provider error">
                    <span className="t-mono">{p.textingProviderErrorCode}</span>
                  </Row>
                )}
                {p.textingProviderErrorMessage && (
                  <Row label="Provider message">{p.textingProviderErrorMessage}</Row>
                )}
                <Row label="Next action">{textingNextAction(p)}</Row>
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

              {open === null && (
                <div style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {p.isActive ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => openConfirm(p.id, "suspend")}
                    >
                      Suspend number
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => runAction(p.id, "reactivate")}
                    >
                      {busy ? "Working…" : "Reactivate number"}
                    </button>
                  )}
                  {detachEligible(p) && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => openConfirm(p.id, "detach")}
                    >
                      Detach from clinic
                    </button>
                  )}
                </div>
              )}

              {open === "suspend" && (
                <div className="acct-cand-actions" style={{ marginTop: "var(--space-2)", paddingLeft: 0 }}>
                  <div className="acct-consent">
                    <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>Suspend this number?</p>
                    <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>
                      The number stays assigned to this clinic.
                    </p>
                    <p className="t-small" style={{ margin: 0 }}>
                      It will not appear as available for other clinics. The Twilio number is not
                      released. You can reactivate it for this clinic at any time.
                    </p>
                    <label className="check">
                      <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} disabled={busy} />
                      <span>I understand and want to suspend this number.</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary acct-primary-action"
                    disabled={!ack || busy}
                    aria-busy={busy}
                    onClick={() => runAction(p.id, "suspend")}
                  >
                    {busy ? "Suspending…" : "Suspend number"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ justifySelf: "center" }}
                    disabled={busy}
                    onClick={closeConfirm}
                  >
                    Cancel
                  </button>
                  {error && (
                    <div className="alert alert-error" role="alert" aria-live="polite"><span>{error}</span></div>
                  )}
                </div>
              )}

              {open === "detach" && (
                <div className="acct-cand-actions" style={{ marginTop: "var(--space-2)", paddingLeft: 0 }}>
                  <div className="acct-consent">
                    <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>Detach this number from this clinic?</p>
                    <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>
                      This number will be detached from this clinic.
                    </p>
                    <p className="t-small" style={{ margin: 0 }}>
                      Calls and texts will no longer route to this clinic. The Twilio number will stay
                      in our Twilio account and will not be released. It will become available to assign
                      to another clinic.
                    </p>
                    <label className="check">
                      <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} disabled={busy} />
                      <span>I understand and want to detach this number from this clinic.</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary acct-primary-action"
                    disabled={!ack || busy}
                    aria-busy={busy}
                    onClick={() => runAction(p.id, "detach")}
                  >
                    {busy ? "Detaching…" : "Detach from clinic"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ justifySelf: "center" }}
                    disabled={busy}
                    onClick={closeConfirm}
                  >
                    Cancel
                  </button>
                  {error && (
                    <div className="alert alert-error" role="alert" aria-live="polite"><span>{error}</span></div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="t-helper" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
        Suspend keeps the number assigned (no Twilio release) and still counts toward the limit and
        additional-number billing quantity. Detach releases only the clinic assignment (no Twilio
        release) and frees the number to assign to another clinic.
      </p>
    </>
  );
}
