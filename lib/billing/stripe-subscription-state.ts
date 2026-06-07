import type Stripe from "stripe";

import {
  saveClinicSubscriptionState,
  type BillingStatus,
} from "../db/clinics";
import {
  getLocalNumberBillingEnv,
  getStripeBillingEnv,
  hasLocalNumberBillingConfigured,
  hasStripeBillingPriceIds,
} from "../env";

// Shared subscription-state helpers for the direct paid-plan API and the
// Stripe webhook. Only "active" unlocks paid entitlement.

export function idOfStripeRef(
  ref: string | { id: string } | null | undefined,
): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): BillingStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "paused":
    default:
      return "past_due";
  }
}

export function extractStripeSubscriptionItemIds(
  sub: Stripe.Subscription,
  basePriceId: string,
  additionalPriceId: string,
  localNumberPriceId?: string | null,
  localSmsCompliancePriceId?: string | null,
): {
  baseItemId: string | null;
  additionalItemId: string | null;
  localNumberItemId: string | null;
  localSmsComplianceItemId: string | null;
} {
  let baseItemId: string | null = null;
  let additionalItemId: string | null = null;
  let localNumberItemId: string | null = null;
  let localSmsComplianceItemId: string | null = null;
  for (const item of sub.items?.data ?? []) {
    const priceId = item.price?.id ?? null;
    if (priceId && priceId === basePriceId) baseItemId = item.id;
    else if (priceId && priceId === additionalPriceId) additionalItemId = item.id;
    else if (priceId && priceId === localNumberPriceId) localNumberItemId = item.id;
    else if (priceId && priceId === localSmsCompliancePriceId) localSmsComplianceItemId = item.id;
  }
  return { baseItemId, additionalItemId, localNumberItemId, localSmsComplianceItemId };
}

export function getConfiguredSubscriptionItemIds(sub: Stripe.Subscription): {
  baseItemId: string | null;
  additionalItemId: string | null;
  localNumberItemId: string | null;
  localSmsComplianceItemId: string | null;
} {
  if (!hasStripeBillingPriceIds()) {
    return {
      baseItemId: null,
      additionalItemId: null,
      localNumberItemId: null,
      localSmsComplianceItemId: null,
    };
  }
  try {
    const priceIds = getStripeBillingEnv();
    const localPriceIds = hasLocalNumberBillingConfigured()
      ? getLocalNumberBillingEnv()
      : null;
    return extractStripeSubscriptionItemIds(
      sub,
      priceIds.basePlanPriceId,
      priceIds.additionalNumberPriceId,
      localPriceIds?.localNumberPriceId ?? null,
      localPriceIds?.localSmsCompliancePriceId ?? null,
    );
  } catch {
    return {
      baseItemId: null,
      additionalItemId: null,
      localNumberItemId: null,
      localSmsComplianceItemId: null,
    };
  }
}

export async function persistStripeSubscriptionForClinic(args: {
  clinicId: string;
  subscription: Stripe.Subscription;
}): Promise<{ billingStatus: BillingStatus; isActive: boolean }> {
  const billingStatus = mapStripeSubscriptionStatus(args.subscription.status);
  const items = getConfiguredSubscriptionItemIds(args.subscription);
  await saveClinicSubscriptionState(args.clinicId, {
    stripeSubscriptionId: args.subscription.id,
    baseSubscriptionItemId: items.baseItemId,
    additionalSubscriptionItemId: items.additionalItemId,
    localNumberSubscriptionItemId: items.localNumberItemId,
    localSmsComplianceSubscriptionItemId: items.localSmsComplianceItemId,
    billingStatus,
    markPaidPlanStarted: billingStatus === "active",
  });
  return { billingStatus, isActive: billingStatus === "active" };
}

export function subscriptionMatchesPaidPlan(args: {
  subscription: Stripe.Subscription;
  clinicId: string;
  basePlanPriceId: string;
}): boolean {
  if (args.subscription.status !== "active") return false;
  if (args.subscription.metadata?.clinic_id !== args.clinicId) return false;
  if (args.subscription.metadata?.purpose !== "paid_plan_start") return false;
  return (args.subscription.items?.data ?? []).some(
    (item) => item.price?.id === args.basePlanPriceId,
  );
}

export async function findReusablePaidPlanSubscription(args: {
  stripe: Stripe;
  customerId: string;
  clinicId: string;
  basePlanPriceId: string;
}): Promise<Stripe.Subscription | null> {
  const subscriptions = await args.stripe.subscriptions.list({
    customer: args.customerId,
    status: "all",
    limit: 10,
  });
  return subscriptions.data.find((subscription) =>
    subscriptionMatchesPaidPlan({
      subscription,
      clinicId: args.clinicId,
      basePlanPriceId: args.basePlanPriceId,
    }),
  ) ?? null;
}
