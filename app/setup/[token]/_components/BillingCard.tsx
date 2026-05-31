"use client";

import { useEffect, useRef, useState } from "react";
import { StatusBadge, StatusRow } from "./AccountUI";

export function BillingCard({
  hasPaymentMethod,
  trialDaysRemaining,
  trialEnded,
}: {
  hasPaymentMethod: boolean;
  trialDaysRemaining: number;
  trialEnded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const dayLabel = `${trialDaysRemaining} ${trialDaysRemaining === 1 ? "day" : "days"}`;

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <div>
        <StatusRow label="Payment method">
          {hasPaymentMethod ? (
            <StatusBadge kind="complete" label="Added" />
          ) : (
            <StatusBadge kind="needs_setup" />
          )}
        </StatusRow>
        <StatusRow label="Plan">
          <span className="t-small" style={{ color: "var(--text)", fontWeight: 600 }}>
            Missed-call text follow-up · $99/mo
          </span>
        </StatusRow>
        <StatusRow label="Free trial">
          {trialEnded ? (
            <StatusBadge kind="needs_action" label="Trial ended" />
          ) : (
            <span className="t-small" style={{ color: "var(--text)", fontWeight: 600 }}>
              Free Trial ends in {dayLabel}
            </span>
          )}
        </StatusRow>
      </div>

      <div className="acct-pay-shell">
        <span className="acct-pay-shell-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </span>
        <span className="t-small" style={{ color: "var(--text-muted)" }}>
          {hasPaymentMethod ? "Payment method on file" : "No payment method on file"}
        </span>
      </div>

      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          {hasPaymentMethod ? "Update payment method" : "Add payment method"}
        </button>
        <p className="t-small" style={{ color: "var(--text-muted)" }}>
          You will not be charged until SMS recovery is active and your trial period ends.
        </p>
      </div>

      {open && (
        <div
          className="acct-modal-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="acct-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-payment-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="add-payment-title" className="t-h4">
              {hasPaymentMethod ? "Update payment method" : "Add payment method"}
            </h3>
            <div className="acct-modal-placeholder" aria-hidden="true">
              <span className="t-small" style={{ color: "var(--text-muted)" }}>
                Secure payment setup will open here when billing is connected.
              </span>
            </div>
            <p className="t-small" style={{ color: "var(--text-muted)", margin: 0 }}>
              Your card details are entered on a secure payment screen — never stored by us.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                ref={closeRef}
                type="button"
                className="btn btn-secondary"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
