import type { Sql } from "postgres";
import { getDb } from "../db/client";
import { billingConfig } from "../../config/billing.config";
import { hasStripeBillingPriceIds } from "../env";

// Single server-side source of truth for phone-number purchase eligibility.
// Computed ONLY from live DB state — the client never decides entitlement, slot
// class, price, limit, or subscription state. Used by owner UI data loading, the
// owner purchase API, the shared provisioning service, and the admin console.

export type NumberPurchaseBlockReason =
  | "payment_method_required"
  | "number_purchases_revoked"
  | "number_limit_reached"
  | "purchase_in_progress"
  | "paid_plan_required"
  | "subscription_not_active"
  | "billing_configuration_missing";

export type NextSlotClass = "included" | "additional";

export type NumberEntitlement = {
  // Counts toward the limit: every clinic_phone_numbers row (active OR suspended)
  // plus in-flight attempts that already hold a purchased Twilio number.
  heldNumberCount: number;
  activeNumberCount: number;
  // Active rows classed included/legacy (the "first/included" numbers).
  includedNumberCount: number;
  // Additional-class rows (active OR suspended) — the Stripe billed quantity.
  additionalBilledQuantity: number;
  numberLimit: number;
  purchasesEnabled: boolean;
  nextSlotClass: NextSlotClass;
  isTrialing: boolean;
  trialEnded: boolean;
  hasActivePaidSubscription: boolean;
  hasPaymentMethod: boolean;
  inProgressAttempt: boolean;
  canPurchaseNext: boolean;
  blockReason: NumberPurchaseBlockReason | null;
  // Raw bits the UI/admin surfaces need.
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  paidPlanStartedAt: string | null;
  billingStatus: string;
  stripeSubscriptionPresent: boolean;
};

type ClinicBillingRow = {
  phone_number_purchases_enabled: boolean;
  phone_number_limit: number;
  billing_status: string;
  trial_started_at: Date | null;
  trial_ends_at: Date | null;
  paid_plan_started_at: Date | null;
  stripe_subscription_id: string | null;
  stripe_payment_method_id: string | null;
};

// In-flight attempt statuses that hold a purchased Twilio number not yet in
// clinic_phone_numbers (so they still count toward the held limit).
const HELD_ATTEMPT_STATUSES = ["twilio_purchased", "billing_pending", "reconciliation_required"] as const;
// Statuses that mean a purchase is actively running for the clinic.
const IN_PROGRESS_ATTEMPT_STATUSES = ["started", "twilio_purchased", "billing_pending"] as const;

/**
 * Compute the clinic's number-purchase entitlement from live DB state. Accepts a
 * postgres executor (`getDb()` or a transaction `tx`) so the provisioning
 * service can recompute race-safely while holding the clinic row lock.
 */
export async function computeNumberEntitlement(
  q: Sql,
  clinicId: string,
): Promise<NumberEntitlement> {
  const clinicRows = await q<ClinicBillingRow[]>`
    select
      phone_number_purchases_enabled, phone_number_limit, billing_status,
      trial_started_at, trial_ends_at, paid_plan_started_at,
      stripe_subscription_id, stripe_payment_method_id
    from public.clinics
    where id = ${clinicId}
    limit 1
  `;
  const c = clinicRows[0];
  if (!c) throw new Error("clinic not found for entitlement computation");

  const cpnAgg = await q<
    { total: number; active: number; included_active: number; additional_held: number }[]
  >`
    select
      count(*)::int as total,
      count(*) filter (where is_active = true)::int as active,
      count(*) filter (where is_active = true and billing_class in ('included', 'legacy'))::int as included_active,
      count(*) filter (where billing_class = 'additional')::int as additional_held
    from public.clinic_phone_numbers
    where clinic_id = ${clinicId}
  `;
  const agg = cpnAgg[0] ?? { total: 0, active: 0, included_active: 0, additional_held: 0 };

  const attemptAgg = await q<{ held: number; in_progress: number }[]>`
    select
      count(*) filter (where status in ('twilio_purchased', 'billing_pending', 'reconciliation_required'))::int as held,
      count(*) filter (where status in ('started', 'twilio_purchased', 'billing_pending'))::int as in_progress
    from public.clinic_phone_number_purchase_attempts
    where clinic_id = ${clinicId}
  `;
  const att = attemptAgg[0] ?? { held: 0, in_progress: 0 };

  const heldNumberCount = agg.total + att.held;
  const activeNumberCount = agg.active;
  const includedNumberCount = agg.included_active;
  const additionalBilledQuantity = agg.additional_held;
  const numberLimit = c.phone_number_limit;
  const purchasesEnabled = c.phone_number_purchases_enabled;
  const inProgressAttempt = att.in_progress > 0;

  const nextSlotClass: NextSlotClass =
    heldNumberCount < billingConfig.basePlan.includedBusinessNumbers ? "included" : "additional";

  const isTrialing = c.billing_status === "trialing";
  const trialEnded = c.trial_ends_at != null && Date.now() > c.trial_ends_at.getTime();
  const stripeSubscriptionPresent = Boolean(c.stripe_subscription_id);
  // Conservative: only a billing_status of 'active' with a stored subscription id
  // counts as an active paid plan. trialing/past_due/canceled/incomplete/paused
  // never unlock additional-number purchases.
  const hasActivePaidSubscription = c.billing_status === "active" && stripeSubscriptionPresent;
  const hasPaymentMethod = Boolean(c.stripe_payment_method_id);

  const blockReason = computeBlockReason({
    hasPaymentMethod,
    purchasesEnabled,
    inProgressAttempt,
    heldNumberCount,
    numberLimit,
    nextSlotClass,
    hasActivePaidSubscription,
    stripeSubscriptionPresent,
    billingConfigured: hasStripeBillingPriceIds(),
  });

  return {
    heldNumberCount,
    activeNumberCount,
    includedNumberCount,
    additionalBilledQuantity,
    numberLimit,
    purchasesEnabled,
    nextSlotClass,
    isTrialing,
    trialEnded,
    hasActivePaidSubscription,
    hasPaymentMethod,
    inProgressAttempt,
    canPurchaseNext: blockReason === null,
    blockReason,
    trialStartedAt: c.trial_started_at ? c.trial_started_at.toISOString() : null,
    trialEndsAt: c.trial_ends_at ? c.trial_ends_at.toISOString() : null,
    paidPlanStartedAt: c.paid_plan_started_at ? c.paid_plan_started_at.toISOString() : null,
    billingStatus: c.billing_status,
    stripeSubscriptionPresent,
  };
}

function computeBlockReason(s: {
  hasPaymentMethod: boolean;
  purchasesEnabled: boolean;
  inProgressAttempt: boolean;
  heldNumberCount: number;
  numberLimit: number;
  nextSlotClass: NextSlotClass;
  hasActivePaidSubscription: boolean;
  stripeSubscriptionPresent: boolean;
  billingConfigured: boolean;
}): NumberPurchaseBlockReason | null {
  if (!s.hasPaymentMethod) return "payment_method_required";
  if (!s.purchasesEnabled) return "number_purchases_revoked";
  if (s.inProgressAttempt) return "purchase_in_progress";
  if (s.heldNumberCount >= s.numberLimit) return "number_limit_reached";
  // The first/included number can be purchased without a paid subscription.
  if (s.nextSlotClass === "additional") {
    if (!s.billingConfigured) return "billing_configuration_missing";
    if (!s.hasActivePaidSubscription) {
      // No subscription started yet -> the owner must start the paid plan.
      // Subscription exists but isn't active (past_due/canceled/…) -> not active.
      return s.stripeSubscriptionPresent ? "subscription_not_active" : "paid_plan_required";
    }
  }
  return null;
}

// Convenience wrapper using the default DB client (non-transactional reads).
export async function getNumberEntitlement(clinicId: string): Promise<NumberEntitlement> {
  return computeNumberEntitlement(getDb(), clinicId);
}
