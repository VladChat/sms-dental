"use client";

import { StatusBadge } from "./AccountUI";
import { OwnerLocalNumberSearch } from "./OwnerLocalNumberSearch";
import type {
  AssignedBusinessNumberSummary,
  OwnerNumberEntitlement,
} from "./account-types";
import { billingConfig, formatUsdFromCents } from "../../../../config/billing.config";

const ADDITIONAL_MONTHLY = formatUsdFromCents(
  billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);

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
  entitlement,
  onGoToBilling,
  onStartPaidPlan,
  onPurchased,
}: {
  assignedNumbers: AssignedBusinessNumberSummary[];
  areaCode: string | null;
  postalCode: string | null;
  hasPaymentMethod: boolean;
  entitlement: OwnerNumberEntitlement;
  onGoToBilling: () => void;
  onStartPaidPlan: () => void;
  onPurchased: (n: AssignedBusinessNumberSummary) => void;
}) {
  const showEmpty = assignedNumbers.length === 0;

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      {showEmpty && (
        <div className="acct-number">
          <p className="t-body" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
            Not assigned yet
          </p>
        </div>
      )}

      {assignedNumbers.map((n) => {
        const isAdditional = n.billingClass === "additional";
        return (
          <div className="acct-number" key={n.id}>
            <span className="t-eyebrow">Business number</span>
            <p className="t-h3 t-mono" style={{ margin: "var(--space-1) 0 0" }}>{formatUsPhone(n.phoneNumber)}</p>
            <div style={TAG_ROW}>
              {n.isActive ? <StatusBadge kind="active" /> : <StatusBadge kind="not_active" label="Suspended" />}
              <span className="t-small" style={{ color: "var(--text-muted)" }}>
                {isAdditional ? `Additional business number · ${ADDITIONAL_MONTHLY}/month` : "Included with plan"}
              </span>
            </div>
            {!n.isActive && (
              <p className="t-small" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
                This number is still assigned to your clinic and counts toward your account limit.
              </p>
            )}
          </div>
        );
      })}

      <p className="t-small" style={{ color: "var(--text-muted)", margin: 0 }}>
        {entitlement.heldNumberCount} of {entitlement.numberLimit} business numbers used
      </p>

      <NumberAction
        hasPaymentMethod={hasPaymentMethod}
        entitlement={entitlement}
        areaCode={areaCode}
        postalCode={postalCode}
        onGoToBilling={onGoToBilling}
        onStartPaidPlan={onStartPaidPlan}
        onPurchased={onPurchased}
      />
    </div>
  );
}

function NumberAction({
  hasPaymentMethod,
  entitlement,
  areaCode,
  postalCode,
  onGoToBilling,
  onStartPaidPlan,
  onPurchased,
}: {
  hasPaymentMethod: boolean;
  entitlement: OwnerNumberEntitlement;
  areaCode: string | null;
  postalCode: string | null;
  onGoToBilling: () => void;
  onStartPaidPlan: () => void;
  onPurchased: (n: AssignedBusinessNumberSummary) => void;
}) {
  const reason = entitlement.blockReason;

  if (reason === "payment_method_required" || !hasPaymentMethod) {
    return (
      <div className="acct-callout">
        <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>Add a payment method to get your business number</p>
        <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
          A payment method is required before your first number. You won&apos;t be charged today.
        </p>
        <div style={{ marginTop: "var(--space-2)" }}>
          <button type="button" className="btn btn-primary acct-primary-action" onClick={onGoToBilling}>Add payment method</button>
        </div>
      </div>
    );
  }

  if (reason === "number_purchases_revoked") {
    return <Note text="New number purchases are disabled for this account. Contact support." />;
  }
  if (reason === "number_limit_reached") {
    return <Note text="You have reached your current business-number limit. Contact support to request a higher limit." />;
  }
  if (reason === "purchase_in_progress") {
    return <Note text="A number purchase is in progress. This page will update once it finishes." />;
  }
  if (reason === "billing_configuration_missing") {
    return <Note text="Adding numbers is temporarily unavailable. Please try again later." />;
  }
  if (reason === "paid_plan_required") {
    return (
      <div className="acct-callout">
        <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
          {entitlement.isTrialing
            ? "Additional business numbers are available after you start the paid plan."
            : "Start the paid plan to add another business number."}
        </p>
        <div style={{ marginTop: "var(--space-2)" }}>
          <button type="button" className="btn btn-primary acct-primary-action" onClick={onStartPaidPlan}>
            {entitlement.isTrialing ? "End trial and start paid plan" : "Start paid plan"}
          </button>
        </div>
      </div>
    );
  }
  if (reason === "subscription_not_active") {
    return (
      <div className="acct-callout">
        <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
          Your subscription is not active. Update billing to add another number.
        </p>
        <div style={{ marginTop: "var(--space-2)" }}>
          <button type="button" className="btn btn-primary acct-primary-action" onClick={onGoToBilling}>Go to billing</button>
        </div>
      </div>
    );
  }

  // canPurchaseNext — render search for the server-classified next slot.
  return (
    <>
      {entitlement.nextSlotClass === "included" && (
        <p className="t-small" style={{ color: "var(--text-muted)", margin: 0 }}>
          Included with plan. Your 21-day trial starts after this number is assigned. You won&apos;t be charged today.
        </p>
      )}
      <OwnerLocalNumberSearch
        mode={entitlement.nextSlotClass}
        initialAreaCode={areaCode}
        initialPostalCode={postalCode}
        onPurchased={onPurchased}
      />
    </>
  );
}

function Note({ text }: { text: string }) {
  return (
    <div className="acct-callout">
      <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>{text}</p>
    </div>
  );
}

// Format a +1NXXNXXXXXX number as (NXX) NXX-XXXX for display; pass through otherwise.
function formatUsPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
