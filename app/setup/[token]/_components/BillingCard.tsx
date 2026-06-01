"use client";

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
              Free trial ends in {dayLabel}
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

      {/* Stripe is not wired yet. Show an honest, disabled state instead of a
          button that opens a fake payment modal. No Stripe call is made. */}
      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <button type="button" className="btn btn-primary" disabled aria-disabled="true">
          Payment setup not connected yet
        </button>
        <p className="t-small" style={{ color: "var(--text-muted)" }}>
          Secure payment setup will be connected next. You will not be charged until
          SMS recovery is active and your trial period ends.
        </p>
      </div>
    </div>
  );
}
