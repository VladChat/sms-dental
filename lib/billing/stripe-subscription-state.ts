import type Stripe from "stripe";

import {
  saveClinicSubscriptionState,
  type BillingStatus,
} from "../db/clinics";
import { getStripeBillingEnv, hasStripeBillingPriceIds } from "../env";

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
): { baseItemId: string | null; additionalItemId: string | null } {
  let baseItemId: string | null = null;
  let additionalItemId: string | null = null;
  for (const item of sub.items?.data ?? []) {
    const priceId = item.price?.id ?? null;
    if (priceId && priceId === basePriceId) baseItemId = item.id;
    else if (priceId && priceId === additionalPriceId) additionalItemId = item.id;
  }
  return { baseItemId, additionalItemId };
}

export function getConfiguredSubscriptionItemIds(sub: Stripe.Subscription): {
  baseItemId: string | null;
  additionalItemId: string | null;
} {
  if (!hasStripeBillingPriceIds()) {
    return { baseItemId: null, additionalItemId: null };
  }
  try {
    const priceIds = getStripeBillingEnv();
    return extractStripeSubscriptionItemIds(
      sub,
      priceIds.basePlanPriceId,
      priceIds.additionalNumberPriceId,
    );
  } catch {
    return { baseItemId: null, additionalItemId: null };
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
