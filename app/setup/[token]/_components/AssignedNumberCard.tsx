"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { StatusBadge } from "./AccountUI";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { OwnerLocalNumberSearch } from "./OwnerLocalNumberSearch";
import type {
  AssignedBusinessNumberSummary,
  OwnerNumberEntitlement,
} from "./account-types";
import { billingConfig, formatUsdFromCents } from "../../../../config/billing.config";

const BASE_MONTHLY = formatUsdFromCents(billingConfig.basePlan.monthlyUnitAmountCents);
const ADDITIONAL_MONTHLY = formatUsdFromCents(
  billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);
const ADD_NUMBER_TOTAL_MONTHLY = formatUsdFromCents(
  billingConfig.basePlan.monthlyUnitAmountCents +
    billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);

const TAG_ROW: CSSProperties = {
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
  startingPaidPlan,
  paidPlanPending,
  paidPlanError,
  onPurchased,
}: {
  assignedNumbers: AssignedBusinessNumberSummary[];
  areaCode: string | null;
  postalCode: string | null;
  hasPaymentMethod: boolean;
  entitlement: OwnerNumberEntitlement;
  onGoToBilling: () => void;
  onStartPaidPlan: () => void | Promise<void>;
  startingPaidPlan: boolean;
  paidPlanPending: boolean;
  paidPlanError: string | null;
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

      <NumberAction
        hasPaymentMethod={hasPaymentMethod}
        entitlement={entitlement}
        areaCode={areaCode}
        postalCode={postalCode}
        onGoToBilling={onGoToBilling}
        onStartPaidPlan={onStartPaidPlan}
        startingPaidPlan={startingPaidPlan}
        paidPlanPending={paidPlanPending}
        paidPlanError={paidPlanError}
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
  startingPaidPlan,
  paidPlanPending,
  paidPlanError,
  onPurchased,
}: {
  hasPaymentMethod: boolean;
  entitlement: OwnerNumberEntitlement;
  areaCode: string | null;
  postalCode: string | null;
  onGoToBilling: () => void;
  onStartPaidPlan: () => void | Promise<void>;
  startingPaidPlan: boolean;
  paidPlanPending: boolean;
  paidPlanError: string | null;
  onPurchased: (n: AssignedBusinessNumberSummary) => void;
}) {
  const reason = entitlement.blockReason;
  const [showPaidPlanConfirm, setShowPaidPlanConfirm] = useState(false);

  useEffect(() => {
    if (reason !== "paid_plan_required") {
      setShowPaidPlanConfirm(false);
    }
  }, [reason]);

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
            ? "Additional phone numbers are available after you start the paid plan."
            : "Start the paid plan to add another phone number."}
        </p>
        {paidPlanPending && (
          <div className="alert alert-info" role="status" aria-live="polite" style={{ marginTop: "var(--space-2)" }}>
            <span>Your paid plan is being confirmed. This can take a few seconds.</span>
          </div>
        )}
        {paidPlanError && (
          <div className="alert alert-error" role="alert" aria-live="polite" style={{ marginTop: "var(--space-2)" }}>
            <span>{paidPlanError}</span>
          </div>
        )}
        <div style={{ marginTop: "var(--space-2)" }}>
          <button
            type="button"
            className="btn btn-primary acct-primary-action"
            onClick={() => setShowPaidPlanConfirm(true)}
            disabled={startingPaidPlan || paidPlanPending}
            aria-busy={startingPaidPlan || paidPlanPending}
          >
            Add phone number
          </button>
        </div>
        {showPaidPlanConfirm && (
          <AddPhoneNumberConfirmation
            onClose={() => setShowPaidPlanConfirm(false)}
            onContinue={() => void onStartPaidPlan()}
            starting={startingPaidPlan}
            pending={paidPlanPending}
            error={paidPlanError}
          />
        )}
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
      <OwnerLocalNumberSearch
        mode={entitlement.nextSlotClass}
        initialAreaCode={areaCode}
        initialPostalCode={postalCode}
        onPurchased={onPurchased}
      />
    </>
  );
}

function AddPhoneNumberConfirmation({
  onClose,
  onContinue,
  starting,
  pending,
  error,
}: {
  onClose: () => void;
  onContinue: () => void;
  starting: boolean;
  pending: boolean;
  error: string | null;
}) {
  return (
    <ConfirmationDialog
      title="Add phone number"
      description="Adding another phone number will end your free trial and start your paid plan."
      summaryLabel="Billing summary"
      summaryRows={[
        { label: "Standard Plan", value: `${BASE_MONTHLY}/month` },
        { label: "Additional phone number", value: `${ADDITIONAL_MONTHLY}/month` },
        { label: "Total", value: `${ADD_NUMBER_TOTAL_MONTHLY}/month`, emphasis: true },
      ]}
      checkboxRequired
      checkboxLabel={`I understand my saved payment method will be charged ${ADD_NUMBER_TOTAL_MONTHLY}/month.`}
      primaryLabel="Continue"
      secondaryLabel="Cancel"
      loading={starting}
      pending={pending}
      error={error}
      onConfirm={onContinue}
      onCancel={onClose}
    />
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
