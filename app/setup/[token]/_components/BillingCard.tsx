"use client";

import { Badge, StatusRow } from "./AccountUI";

export function BillingCard({ trialDays }: { trialDays: number }) {
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div>
        <StatusRow label="Payment method">
          <Badge tone="neutral">Not added yet</Badge>
        </StatusRow>
        <StatusRow label="Plan">
          <span className="t-small" style={{ color: "var(--text)", fontWeight: 600 }}>
            Missed-call text follow-up · $99/mo
          </span>
        </StatusRow>
        <StatusRow label="Free trial">
          <span className="t-small" style={{ color: "var(--text)", fontWeight: 600 }}>
            {trialDays} days, starts after activation
          </span>
        </StatusRow>
      </div>

      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <button type="button" className="btn btn-secondary" disabled aria-disabled="true">
          Add payment method
        </button>
        <p className="t-small" style={{ color: "var(--text-muted)" }}>
          Billing starts only after SMS recovery is active. No card is charged before activation.
        </p>
      </div>
    </div>
  );
}
