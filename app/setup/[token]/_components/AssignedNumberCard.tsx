"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { StatusBadge } from "./AccountUI";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { NumberTypeChooser } from "./NumberTypeChooser";
import { OwnerNumberSearch } from "./OwnerNumberSearch";
import type {
  AssignedBusinessNumberSummary,
  OwnerNumberEntitlement,
  SmsStatus,
} from "./account-types";
import {
  assignedNumberBillingLabel,
  billingConfig,
  formatUsdFromCents,
} from "../../../../config/billing.config";

const BASE_MONTHLY = formatUsdFromCents(billingConfig.basePlan.monthlyUnitAmountCents);
const ADDITIONAL_MONTHLY = formatUsdFromCents(
  billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);
const ADD_NUMBER_TOTAL_MONTHLY = formatUsdFromCents(
  billingConfig.basePlan.monthlyUnitAmountCents +
    billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);

const LOCAL_NOTICE =
  "Local number billing is not configured yet. No charge was made.";

const TAG_ROW: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--space-2)",
  marginTop: "var(--space-2)",
};

export function AssignedNumberCard({
  assignedNumbers,
  smsStatus,
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
  smsStatus: SmsStatus;
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

      {assignedNumbers.map((n) => (
        <AssignedRow key={n.id} n={n} smsStatus={smsStatus} />
      ))}

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

function AssignedRow({
  n,
  smsStatus,
}: {
  n: AssignedBusinessNumberSummary;
  smsStatus: SmsStatus;
}) {
  const isLocal = n.numberType === "local";
  return (
    <div className="acct-number" key={n.id}>
      <span className="t-eyebrow">Business number</span>
      <p className="t-h3 t-mono" style={{ margin: "var(--space-1) 0 0" }}>{formatUsPhone(n.phoneNumber)}</p>
      <div style={TAG_ROW}>
        <span className={`badge ${isLocal ? "badge-neutral" : "badge-info"}`}>
          {isLocal ? "Local" : "Toll-free"}
        </span>
      </div>

      <dl className="acct-rows" style={{ marginTop: "var(--space-2)" }}>
        <Row label="Calls">
          {n.isActive ? <StatusBadge kind="active" /> : <StatusBadge kind="not_active" />}
        </Row>
        <Row label="Texting">
          {smsStatus === "active" ? <StatusBadge kind="active" /> : <StatusBadge kind="waiting" />}
        </Row>
        <Row label="Billing">
          <span className="t-small" style={{ color: "var(--text-muted)" }}>
            {assignedNumberBillingLabel(n.numberType, n.billingClass)}
          </span>
        </Row>
      </dl>

      {!n.isActive && (
        <p className="t-small" style={{ margin: "var(--space-2) 0 0", color: "var(--text-muted)" }}>
          This number is still assigned to your clinic and counts toward your account limit.
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
      <dt className="t-small" style={{ color: "var(--text-secondary)" }}>{label}</dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </div>
  );
}

type FlowStep =
  | { step: "idle" }
  | { step: "choose" }
  | { step: "search"; type: "toll_free" | "local" };

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
  const [flow, setFlow] = useState<FlowStep>({ step: "idle" });
  const [showPaidPlanConfirm, setShowPaidPlanConfirm] = useState(false);

  useEffect(() => {
    setShowPaidPlanConfirm(false);
  }, [reason]);

  // ── Type-independent hard blocks: no purchase of any kind is possible ────────
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

  // ── Otherwise the add-number flow is available ──────────────────────────────
  // reason may still be paid_plan_required / subscription_not_active, which only
  // blocks paid number assignment (handled inside the type branches).
  const tollFreeNeedsPaidPlan =
    reason === "paid_plan_required" || reason === "subscription_not_active";
  const localNeedsPaidPlan = tollFreeNeedsPaidPlan;

  if (flow.step === "idle") {
    return (
      <button type="button" className="btn btn-primary acct-primary-action" onClick={() => setFlow({ step: "choose" })}>
        Add a number
      </button>
    );
  }

  if (flow.step === "choose") {
    return (
      <NumberTypeChooser
        onChoose={(type) => setFlow({ step: "search", type })}
        onCancel={() => setFlow({ step: "idle" })}
      />
    );
  }

  // flow.step === "search"
  if (flow.type === "toll_free") {
    if (tollFreeNeedsPaidPlan) {
      return (
        <div className="acct-callout">
          <div className="acct-search-head">
            <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>Additional toll-free number</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlow({ step: "choose" })}>Back</button>
          </div>
          {reason === "subscription_not_active" ? (
            <>
              <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
                Your subscription is not active. Update billing to add another number.
              </p>
              <div style={{ marginTop: "var(--space-2)" }}>
                <button type="button" className="btn btn-primary acct-primary-action" onClick={onGoToBilling}>Go to billing</button>
              </div>
            </>
          ) : (
            <>
              <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
                {entitlement.isTrialing
                  ? "An additional toll-free number is available after you start the paid plan."
                  : "Start the paid plan to add another toll-free number."}
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
                  Start paid plan
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
            </>
          )}
        </div>
      );
    }

    return (
      <OwnerNumberSearch
        numberType="toll_free"
        tollFreeSlotClass={entitlement.nextSlotClass}
        purchaseEnabled
        localNotice={null}
        onPurchased={onPurchased}
        onBack={() => setFlow({ step: "choose" })}
      />
    );
  }

  // flow.type === "local"
  if (localNeedsPaidPlan) {
    return (
      <div className="acct-callout">
        <div className="acct-search-head">
          <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>Local number</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlow({ step: "choose" })}>Back</button>
        </div>
        {reason === "subscription_not_active" ? (
          <>
            <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
              Your subscription is not active. Update billing to assign a local number.
            </p>
            <div style={{ marginTop: "var(--space-2)" }}>
              <button type="button" className="btn btn-primary acct-primary-action" onClick={onGoToBilling}>Go to billing</button>
            </div>
          </>
        ) : (
          <>
            <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
              Start the paid plan to assign a local number.
            </p>
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
                Start paid plan
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
          </>
        )}
      </div>
    );
  }

  return (
    <OwnerNumberSearch
      numberType="local"
      tollFreeSlotClass="additional"
      purchaseEnabled={entitlement.localBillingConfigured}
      localNotice={entitlement.localBillingConfigured ? null : LOCAL_NOTICE}
      initialAreaCode={areaCode}
      initialPostalCode={postalCode}
      onPurchased={onPurchased}
      onBack={() => setFlow({ step: "choose" })}
    />
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
      title="Add toll-free number"
      description="Adding another toll-free number will end your free trial and start your paid plan."
      summaryLabel="Billing summary"
      summaryRows={[
        { label: "Standard Plan", value: `${BASE_MONTHLY}/month` },
        { label: "Additional toll-free number", value: `${ADDITIONAL_MONTHLY}/month` },
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
