"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge, StatusRow, InfoTooltip } from "./AccountUI";
import type { PaymentMethodSummary, PaymentMethodSetupResult } from "./account-types";
import {
  billingConfig,
  formatInteger,
  formatUsdFromCents,
} from "../../../../config/billing.config";

const SMS_SEGMENT_TOOLTIP =
  "An SMS segment is a billing unit. Long messages and some characters can use more than one segment. Your monthly limit is based on segments, not messages.";

export function BillingCard({
  hasPaymentMethod,
  paymentMethod,
  additionalBilledQuantity,
  trialDaysRemaining,
  trialEnded,
  paymentMethodSetup,
  paidPlanActive,
  canStartPaidPlan,
  isTrialing,
  paidPlanResult,
  startingPaidPlan,
  paidPlanPending,
  paidPlanError,
  onStartPaidPlan,
}: {
  hasPaymentMethod: boolean;
  paymentMethod: PaymentMethodSummary | null;
  additionalBilledQuantity: number;
  trialDaysRemaining: number;
  trialEnded: boolean;
  paymentMethodSetup: PaymentMethodSetupResult;
  paidPlanActive: boolean;
  canStartPaidPlan: boolean;
  isTrialing: boolean;
  paidPlanResult: "success" | "cancelled" | null;
  startingPaidPlan: boolean;
  paidPlanPending: boolean;
  paidPlanError: string | null;
  onStartPaidPlan: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayLabel = `${trialDaysRemaining} ${trialDaysRemaining === 1 ? "day" : "days"}`;

  // Start (or replace) the Stripe-hosted payment method via mode:"setup" Checkout.
  // The browser is redirected to Stripe; no card fields are collected in this UI.
  async function startSetup() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/billing/payment-method/setup", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; url?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok || !json.url) {
        setError(json?.error?.message ?? "Could not start payment setup. Please try again.");
        setLoading(false);
        return;
      }
      // Keep the loading state while the full-page redirect happens.
      window.location.href = json.url;
    } catch {
      setError("Could not start payment setup. Please try again.");
      setLoading(false);
    }
  }

  const expLabel =
    paymentMethod?.expMonth && paymentMethod?.expYear
      ? `${String(paymentMethod.expMonth).padStart(2, "0")}/${paymentMethod.expYear}`
      : null;
  const brandLabel = paymentMethod?.brand ? titleCase(paymentMethod.brand) : "Card";
  const paymentMethodLabel =
    hasPaymentMethod && paymentMethod
      ? `${brandLabel} •••• ${paymentMethod.last4 ?? "••••"}`
      : "Not added";
  const baseMonthly = billingConfig.basePlan.monthlyUnitAmountCents;
  const additionalMonthly = billingConfig.additionalBusinessNumber.monthlyUnitAmountCents;
  const additionalTotal = additionalBilledQuantity * additionalMonthly;
  const currentMonthlyTotal = baseMonthly + additionalTotal;
  const baseMonthlyLabel = `${formatUsdFromCents(baseMonthly)}/month`;
  const additionalMonthlyLabel = `${formatUsdFromCents(additionalMonthly)}/month`;
  const currentMonthlyTotalLabel = `${formatUsdFromCents(currentMonthlyTotal)}/month`;
  const additionalPhoneNumberLabel =
    additionalBilledQuantity === 1 ? "additional phone number" : "additional phone numbers";
  const currentPlanBreakdown =
    additionalBilledQuantity > 0
      ? `${baseMonthlyLabel} base plan + ${formatInteger(additionalBilledQuantity)} × ${additionalMonthlyLabel} ${additionalPhoneNumberLabel}`
      : `${baseMonthlyLabel} base plan`;

  if (paidPlanActive) {
    return (
      <div className="acct-billing-stack">
        <section className="acct-current-plan" aria-labelledby="billing-current-plan-title">
          <div className="acct-current-plan-head">
            <p className="t-eyebrow" id="billing-current-plan-title">Current plan</p>
            <StatusBadge kind="complete" label="Active" />
          </div>
          <p className="acct-current-plan-total">{currentMonthlyTotalLabel}</p>
          <p className="t-small acct-current-plan-note">{currentPlanBreakdown}</p>
        </section>

        <section className="acct-billing-block" aria-labelledby="billing-included-title">
          <p className="t-eyebrow" id="billing-included-title">Included each month</p>
          <ul className="acct-plan-list">
            <li>
              {formatInteger(billingConfig.basePlan.includedBusinessNumbers)} business{" "}
              {billingConfig.basePlan.includedBusinessNumbers === 1 ? "number" : "numbers"}
            </li>
            <li>{formatInteger(billingConfig.basePlan.includedCallMinutes)} call minutes</li>
            <li>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                {formatInteger(billingConfig.basePlan.includedSmsSegments)} SMS segments
                <InfoTooltip label="What is an SMS segment?" text={SMS_SEGMENT_TOOLTIP} />
              </span>
            </li>
          </ul>
          <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
            Included usage is shared across all business numbers on your account.
          </p>
        </section>

        <section className="acct-billing-block" aria-labelledby="billing-overage-title">
          <p className="t-eyebrow" id="billing-overage-title">Usage above included limits</p>
          <ul className="acct-plan-list">
            <li>{formatUsdFromCents(billingConfig.overage.callMinuteUnitAmountCents)} per additional call minute</li>
            <li>{formatUsdFromCents(billingConfig.overage.smsSegmentUnitAmountCents)} per additional SMS segment</li>
          </ul>
        </section>

        {paymentMethodSetup === "success" && hasPaymentMethod && (
          <div className="alert alert-success" role="status" aria-live="polite">
            <span>Payment method updated.</span>
          </div>
        )}
        {paymentMethodSetup === "success" && !hasPaymentMethod && (
          <div className="alert alert-info" role="status" aria-live="polite" style={{ alignItems: "center" }}>
            <span style={{ flex: 1 }}>Payment setup is being confirmed. This can take a few seconds.</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => router.refresh()}>
              Refresh
            </button>
          </div>
        )}
        {paymentMethodSetup === "cancelled" && (
          <div className="alert alert-info" role="status" aria-live="polite">
            <span>Payment setup was cancelled. Your saved payment method was not changed.</span>
          </div>
        )}

        <section className="acct-payment-method" aria-labelledby="billing-payment-method-title">
          <div className="acct-payment-method-main">
            <p className="t-eyebrow" id="billing-payment-method-title">Payment method</p>
            {hasPaymentMethod && paymentMethod ? (
              <div style={{ display: "grid", gap: "2px" }}>
                <p className="t-small" style={{ color: "var(--text)", fontWeight: 700, margin: 0 }}>
                  {paymentMethodLabel}
                </p>
                {expLabel && (
                  <p className="t-helper" style={{ color: "var(--text-muted)", margin: 0 }}>Expires {expLabel}</p>
                )}
              </div>
            ) : (
              <p className="t-small" style={{ color: "var(--text-muted)", margin: 0 }}>No payment method on file</p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={startSetup}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Starting secure setup…" : hasPaymentMethod ? "Update payment method" : "Add payment method"}
          </button>
        </section>

        {error && (
          <div className="alert alert-error" role="alert" aria-live="polite">
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <div>
        <StatusRow label="Plan">
          {paidPlanActive ? (
            <span className="t-small" style={{ color: "var(--text)", fontWeight: 600 }}>
              {currentMonthlyTotalLabel}
            </span>
          ) : (
            <span className="t-small" style={{ color: "var(--text)", fontWeight: 600 }}>
              21-day free trial, then {baseMonthlyLabel}
            </span>
          )}
        </StatusRow>
        {!paidPlanActive && (
          <StatusRow label="Free trial">
            {trialEnded ? (
              <StatusBadge kind="needs_action" label="Trial ended" />
            ) : isTrialing ? (
              <span className="t-small" style={{ color: "var(--text)", fontWeight: 600 }}>
                Ends in {dayLabel}
              </span>
            ) : (
              <span className="t-small" style={{ color: "var(--text-muted)" }}>
                Starts after your first phone number is assigned
              </span>
            )}
          </StatusRow>
        )}
      </div>

      {/* Legacy return-state support. Paid status is shown only from confirmed
          subscription data (paidPlanActive), never from a query param. */}
      {paidPlanResult === "success" && !paidPlanActive && (
        <div className="alert alert-info" role="status" aria-live="polite" style={{ alignItems: "center" }}>
          <span style={{ flex: 1 }}>Your paid plan is being confirmed. This can take a few seconds.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => router.refresh()}>Refresh</button>
        </div>
      )}
      {paidPlanResult === "cancelled" && (
        <div className="alert alert-info" role="status" aria-live="polite">
          <span>Paid plan setup was cancelled. You are still on your trial.</span>
        </div>
      )}

      {/* Explicit trial -> paid conversion. The subscription is created using
          the saved Stripe payment method; webhook-confirmed state unlocks paid
          entitlement. */}
      {hasPaymentMethod && !paidPlanActive && canStartPaidPlan && (
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <button type="button" className="btn btn-primary" onClick={onStartPaidPlan}
            disabled={startingPaidPlan || paidPlanPending} aria-busy={startingPaidPlan || paidPlanPending}>
            {startingPaidPlan || paidPlanPending ? "Starting..." : "Start paid plan"}
          </button>
          <p className="t-small" style={{ color: "var(--text-muted)" }}>
            Starts the {baseMonthlyLabel} plan using your saved payment method. Required before adding more numbers.
          </p>
          {paidPlanPending && (
            <div className="alert alert-info" role="status" aria-live="polite" style={{ alignItems: "center" }}>
              <span style={{ flex: 1 }}>Your paid plan is being confirmed. This can take a few seconds.</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => router.refresh()}>Refresh</button>
            </div>
          )}
          {paidPlanError && (
            <div className="alert alert-error" role="alert" aria-live="polite"><span>{paidPlanError}</span></div>
          )}
        </div>
      )}

      {/* Plan details — sourced entirely from config/billing.config.ts. */}
      <div className="acct-plan">
        {paidPlanActive ? (
          <div>
            <p className="t-eyebrow">Monthly billing</p>
            <ul className="acct-plan-list">
              <li>{billingConfig.basePlan.displayName}: {baseMonthlyLabel}</li>
              <li>
                Additional phone numbers: {formatInteger(additionalBilledQuantity)} × {additionalMonthlyLabel}
              </li>
              <li style={{ fontWeight: 700, color: "var(--text)" }}>
                Current monthly total: {currentMonthlyTotalLabel}
              </li>
            </ul>
          </div>
        ) : (
          <div className="acct-plan-head">
            <span className="t-small" style={{ fontWeight: 700, color: "var(--text)" }}>
              {billingConfig.basePlan.displayName}
            </span>
            <span className="t-h4">
              {baseMonthlyLabel}
            </span>
          </div>
        )}

        <div>
          <p className="t-eyebrow">Included each month</p>
          <ul className="acct-plan-list">
            <li>
              {formatInteger(billingConfig.basePlan.includedBusinessNumbers)} business{" "}
              {billingConfig.basePlan.includedBusinessNumbers === 1 ? "number" : "numbers"}
            </li>
            <li>{formatInteger(billingConfig.basePlan.includedCallMinutes)} call minutes</li>
            <li>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                {formatInteger(billingConfig.basePlan.includedSmsSegments)} SMS segments
                <InfoTooltip label="What is an SMS segment?" text={SMS_SEGMENT_TOOLTIP} />
              </span>
            </li>
          </ul>
          <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
            Included usage is shared across all business numbers on your account.
          </p>
        </div>

        <div>
          <p className="t-eyebrow">Usage above the included monthly limits</p>
          <ul className="acct-plan-list">
            <li>{formatUsdFromCents(billingConfig.overage.callMinuteUnitAmountCents)} per additional call minute</li>
            <li>{formatUsdFromCents(billingConfig.overage.smsSegmentUnitAmountCents)} per additional SMS segment</li>
          </ul>
        </div>

        {!paidPlanActive && (
          <div>
            <p className="t-eyebrow">Additional phone numbers</p>
            <p className="t-small" style={{ color: "var(--text)", fontWeight: 600, margin: "var(--space-1) 0 0" }}>
              {additionalMonthlyLabel} each
            </p>
            <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-1) 0 0" }}>
              Each additional phone number adds {additionalMonthlyLabel} to your paid plan.
            </p>
          </div>
        )}
      </div>

      {/* Returning from Stripe-hosted setup. Success is shown only when a real
          payment method is present — never inferred from the query param alone. */}
      {paymentMethodSetup === "success" && hasPaymentMethod && (
        <div className="alert alert-success" role="status" aria-live="polite">
          <span>
            {paidPlanActive ? "Payment method updated." : "Payment method added. You won't be charged today."}
          </span>
        </div>
      )}
      {paymentMethodSetup === "success" && !hasPaymentMethod && (
        <div className="alert alert-info" role="status" aria-live="polite" style={{ alignItems: "center" }}>
          <span style={{ flex: 1 }}>Payment setup is being confirmed. This can take a few seconds.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => router.refresh()}>
            Refresh
          </button>
        </div>
      )}
      {paymentMethodSetup === "cancelled" && (
        <div className="alert alert-info" role="status" aria-live="polite">
          <span>Payment setup was cancelled. No payment method was added.</span>
        </div>
      )}

      {/* Saved-method summary, or the empty-state shell. */}
      <div className="acct-pay-shell">
        <span className="acct-pay-shell-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </span>
        {hasPaymentMethod && paymentMethod ? (
          <span style={{ display: "grid", gap: "2px" }}>
            <span className="t-helper" style={{ color: "var(--text-muted)" }}>Payment method</span>
            <span className="t-small" style={{ color: "var(--text)", fontWeight: 600 }}>
              {paymentMethodLabel}
            </span>
            {expLabel && (
              <span className="t-helper" style={{ color: "var(--text-muted)" }}>Expires {expLabel}</span>
            )}
          </span>
        ) : (
          <span style={{ display: "grid", gap: "2px" }}>
            <span className="t-helper" style={{ color: "var(--text-muted)" }}>Payment method</span>
            <span className="t-small" style={{ color: "var(--text-muted)" }}>No payment method on file</span>
          </span>
        )}
      </div>

      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={startSetup}
          disabled={loading}
          aria-busy={loading}
        >
          {loading
            ? "Starting secure setup…"
            : hasPaymentMethod
              ? "Update payment method"
              : "Add payment method"}
        </button>
        <p className="t-small" style={{ color: "var(--text-muted)" }}>
          Secure payment setup is handled by Stripe. You will not be charged today.
        </p>
        {error && (
          <div className="alert alert-error" role="alert" aria-live="polite">
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Title-case a Stripe card brand token (e.g. "visa" -> "Visa", "amex" -> "Amex").
function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
