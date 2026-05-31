"use client";

import { Badge, StatusRow } from "./AccountUI";

export function BillingCard({
  trialDays,
  hasPaymentMethod,
}: {
  trialDays: number;
  hasPaymentMethod: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <div>
        <StatusRow label="Payment method">
          {hasPaymentMethod ? (
            <Badge tone="success">Added</Badge>
          ) : (
            <Badge tone="warning">Payment method needed</Badge>
          )}
        </StatusRow>
        <StatusRow label="Plan">
          <span className="t-small" style={{ color: "var(--text)", fontWeight: 600 }}>
            Missed-call text follow-up · $99/mo
          </span>
        </StatusRow>
        <StatusRow label="Free trial">
          <span className="t-small" style={{ color: "var(--text)", fontWeight: 600 }}>
            {trialDays} days
          </span>
        </StatusRow>
      </div>

      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <button type="button" className="btn btn-primary" disabled aria-disabled="true">
          Add payment method
        </button>
        <p className="t-small" style={{ color: "var(--text-muted)" }}>
          Secure payment setup opens here shortly. You will not be charged until SMS recovery is
          active and your trial period ends.
        </p>
      </div>
    </div>
  );
}
