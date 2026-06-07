import type Stripe from "stripe";

import {
  getLocalNumberBillingEnv,
  getStripeBillingEnv,
  hasLocalNumberBillingConfigured,
} from "../env";
import { saveClinicNumberSubscriptionItemIds } from "../db/clinics";
import { logger } from "../logging/logger";
import { getStripeServerClient } from "../stripe/server";

export type NumberSubscriptionQuantities = {
  additionalTollFree: number;
  localNumbers: number;
  localSmsCompliance: 0 | 1;
};

export type NumberSubscriptionItemIds = {
  additionalSubscriptionItemId: string | null;
  localNumberSubscriptionItemId: string | null;
  localSmsComplianceSubscriptionItemId: string | null;
};

export type NumberSubscriptionSyncResult =
  | { ok: true; itemIds: NumberSubscriptionItemIds }
  | {
      ok: false;
      error: "billing_configuration_missing" | "billing_sync_failed";
      message: string;
    };

export async function syncNumberSubscriptionQuantities(args: {
  clinicId: string;
  stripeSubscriptionId: string;
  existingItemIds: NumberSubscriptionItemIds;
  desired: NumberSubscriptionQuantities;
  actionId: string;
}): Promise<NumberSubscriptionSyncResult> {
  let basePrices: ReturnType<typeof getStripeBillingEnv>;
  try {
    basePrices = getStripeBillingEnv();
  } catch {
    logger.error("billing.lifecycle.price_ids_missing", { clinicId: args.clinicId });
    return {
      ok: false,
      error: "billing_configuration_missing",
      message: "Billing is not fully configured yet. The number was not changed.",
    };
  }

  const needsLocalPrices =
    args.desired.localNumbers > 0 ||
    args.desired.localSmsCompliance > 0 ||
    Boolean(args.existingItemIds.localNumberSubscriptionItemId) ||
    Boolean(args.existingItemIds.localSmsComplianceSubscriptionItemId);
  const localPrices =
    needsLocalPrices && hasLocalNumberBillingConfigured()
      ? getLocalNumberBillingEnv()
      : null;
  if (needsLocalPrices && !localPrices) {
    logger.error("billing.lifecycle.local_price_ids_missing", { clinicId: args.clinicId });
    return {
      ok: false,
      error: "billing_configuration_missing",
      message: "Local number billing is not fully configured yet. The number was not changed.",
    };
  }

  const stripe = getStripeServerClient();
  try {
    const subscription = await stripe.subscriptions.retrieve(args.stripeSubscriptionId, {
      expand: ["items.data.price"],
    });
    const additionalId = await syncSingleItem({
      stripe,
      subscription,
      priceId: basePrices.additionalNumberPriceId,
      existingItemId: args.existingItemIds.additionalSubscriptionItemId,
      desiredQuantity: args.desired.additionalTollFree,
      idempotencyBase: `phone-lifecycle-additional-${args.actionId}`,
      metadata: { clinic_id: args.clinicId, purpose: "additional_toll_free_monthly" },
    });
    const localNumberId = localPrices
      ? await syncSingleItem({
          stripe,
          subscription,
          priceId: localPrices.localNumberPriceId,
          existingItemId: args.existingItemIds.localNumberSubscriptionItemId,
          desiredQuantity: args.desired.localNumbers,
          idempotencyBase: `phone-lifecycle-local-${args.actionId}`,
          metadata: { clinic_id: args.clinicId, purpose: "local_number_monthly" },
        })
      : null;
    const localComplianceId = localPrices
      ? await syncSingleItem({
          stripe,
          subscription,
          priceId: localPrices.localSmsCompliancePriceId,
          existingItemId: args.existingItemIds.localSmsComplianceSubscriptionItemId,
          desiredQuantity: args.desired.localSmsCompliance,
          idempotencyBase: `phone-lifecycle-compliance-${args.actionId}`,
          metadata: { clinic_id: args.clinicId, purpose: "local_sms_compliance_monthly" },
        })
      : null;

    const itemIds = {
      additionalSubscriptionItemId: additionalId,
      localNumberSubscriptionItemId: localNumberId,
      localSmsComplianceSubscriptionItemId: localComplianceId,
    };
    await saveClinicNumberSubscriptionItemIds(args.clinicId, itemIds);
    logger.info("billing.lifecycle.sync.ok", {
      clinicId: args.clinicId,
      actionId: args.actionId,
      additionalTollFree: args.desired.additionalTollFree,
      localNumbers: args.desired.localNumbers,
      localSmsCompliance: args.desired.localSmsCompliance,
    });
    return { ok: true, itemIds };
  } catch (err) {
    logger.error("billing.lifecycle.sync.failed", {
      clinicId: args.clinicId,
      actionId: args.actionId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return {
      ok: false,
      error: "billing_sync_failed",
      message: "We could not update billing safely, so the number was not changed.",
    };
  }
}

async function syncSingleItem(args: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
  priceId: string;
  existingItemId: string | null;
  desiredQuantity: number;
  idempotencyBase: string;
  metadata: Record<string, string>;
}): Promise<string | null> {
  const matches = (args.subscription.items?.data ?? []).filter(
    (item) => item.price?.id === args.priceId,
  );
  const existing =
    matches.find((item) => item.id === args.existingItemId) ??
    matches[0] ??
    null;
  const extras = existing ? matches.filter((item) => item.id !== existing.id) : matches;

  if (args.desiredQuantity <= 0) {
    for (const item of matches) {
      await args.stripe.subscriptionItems.del(
        item.id,
        { proration_behavior: "none" },
        { idempotencyKey: `${args.idempotencyBase}-delete-${item.id}` },
      );
    }
    return null;
  }

  let itemId: string;
  if (existing) {
    const updated = await args.stripe.subscriptionItems.update(
      existing.id,
      {
        quantity: args.desiredQuantity,
        proration_behavior: "none",
        metadata: args.metadata,
      },
      { idempotencyKey: `${args.idempotencyBase}-update-${args.desiredQuantity}` },
    );
    itemId = updated.id;
  } else {
    const created = await args.stripe.subscriptionItems.create(
      {
        subscription: args.subscription.id,
        price: args.priceId,
        quantity: args.desiredQuantity,
        proration_behavior: "none",
        payment_behavior: "error_if_incomplete",
        metadata: args.metadata,
      },
      { idempotencyKey: `${args.idempotencyBase}-create` },
    );
    itemId = created.id;
  }

  for (const item of extras) {
    await args.stripe.subscriptionItems.del(
      item.id,
      { proration_behavior: "none" },
      { idempotencyKey: `${args.idempotencyBase}-dedupe-${item.id}` },
    );
  }

  return itemId;
}
