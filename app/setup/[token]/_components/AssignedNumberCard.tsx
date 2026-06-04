"use client";

import { StatusBadge, type StatusKind } from "./AccountUI";
import { OwnerLocalNumberSearch } from "./OwnerLocalNumberSearch";
import type {
  AssignedBusinessNumberSummary,
  RequestedNumberSummary,
} from "./account-types";
import { billingConfig, formatUsdFromCents } from "../../../../config/billing.config";

const ADDITIONAL_MONTHLY = formatUsdFromCents(
  billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);
const INCLUDED_COUNT = billingConfig.basePlan.includedBusinessNumbers;

const TAG_ROW: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--space-2)",
  marginTop: "var(--space-2)",
};

export function AssignedNumberCard({
  assignedNumbers,
  areaCode,
  postalCode,
  hasPaymentMethod,
  onGoToBilling,
  requestedNumbers,
  onRequestedNumberSaved,
}: {
  assignedNumbers: AssignedBusinessNumberSummary[];
  areaCode: string | null;
  postalCode: string | null;
  hasPaymentMethod: boolean;
  onGoToBilling: () => void;
  requestedNumbers: RequestedNumberSummary[];
  onRequestedNumberSaved: (requestedNumber: RequestedNumberSummary) => void;
}) {
  const activeAssignedCount = assignedNumbers.filter((n) => n.isActive).length;
  // Presentation hint only — the server is the final authority on classification.
  const nextNumberIsAdditional =
    activeAssignedCount + requestedNumbers.length >= INCLUDED_COUNT;
  const showEmpty = assignedNumbers.length === 0 && requestedNumbers.length === 0;

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      {showEmpty && (
        <div className="acct-number">
          <p className="t-body" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
            Not assigned yet
          </p>
        </div>
      )}

      {assignedNumbers.map((n, i) => (
        <div className="acct-number" key={n.id}>
          <span className="t-eyebrow">Business number</span>
          <p className="t-h3 t-mono" style={{ margin: "var(--space-1) 0 0" }}>
            {formatUsPhone(n.phoneNumber)}
          </p>
          <div style={TAG_ROW}>
            {n.isActive && <StatusBadge kind="active" />}
            <span className="t-small" style={{ color: "var(--text-muted)" }}>
              {i < INCLUDED_COUNT
                ? "Included with plan"
                : `Additional business number · ${ADDITIONAL_MONTHLY}/month`}
            </span>
          </div>
        </div>
      ))}

      {requestedNumbers.map((r) => (
        <div className="acct-number" key={r.id}>
          <span className="t-eyebrow">Requested number</span>
          <p className="t-h4 t-mono" style={{ margin: "var(--space-1) 0 0" }}>
            {formatUsPhone(r.phoneNumber)}
          </p>
          {r.locality && (
            <p className="t-small" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
              {[r.locality, r.region].filter(Boolean).join(", ")}
            </p>
          )}
          <div style={TAG_ROW}>
            <StatusBadge kind={requestedStatusKind(r.status)} label={requestedStatusLabel(r.status)} />
            <span className="t-small" style={{ color: "var(--text-muted)" }}>
              {r.billingClass === "additional"
                ? `Additional business number · ${ADDITIONAL_MONTHLY}/month after activation`
                : "Included with plan"}
            </span>
          </div>
        </div>
      ))}

      <OwnerLocalNumberSearch
        hasPaymentMethod={hasPaymentMethod}
        onGoToBilling={onGoToBilling}
        initialAreaCode={areaCode}
        initialPostalCode={postalCode}
        nextNumberIsAdditional={nextNumberIsAdditional}
        existingRequestedNumbers={requestedNumbers.map((r) => r.phoneNumber)}
        onRequestedNumberSaved={onRequestedNumberSaved}
      />
    </div>
  );
}

// Format a +1NXXNXXXXXX number as (NXX) NXX-XXXX for display; pass through otherwise.
function formatUsPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

function requestedStatusLabel(status: string): string {
  switch (status) {
    case "pending": return "Pending review";
    case "reviewed": return "In review";
    case "fulfilled": return "Completed";
    case "rejected": return "Not available";
    case "cancelled": return "Superseded";
    default: return status;
  }
}

function requestedStatusKind(status: string): StatusKind {
  switch (status) {
    case "fulfilled": return "complete";
    case "rejected":
    case "cancelled": return "not_active";
    default: return "waiting";
  }
}
