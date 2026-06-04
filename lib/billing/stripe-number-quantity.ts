import { getStripeServerClient } from "../stripe/server";
import { getStripeBillingEnv } from "../env";
import { saveClinicAdditionalSubscriptionItemId } from "../db/clinics";
import { logger } from "../logging/logger";

// Server-only Stripe additional-number subscription-item quantity sync.
//
// The desired quantity is computed by the caller from live DB state (held
// additional numbers — active OR suspended — plus the number being activated);
// the client never supplies a quantity. This NEVER releases a number and NEVER
// reduces quantity here (suspension keeps the number billed). It fails closed:
// the caller must not activate the number unless this returns ok.
//
// Quantity changes use proration_behavior:"create_prorations" — the prorated
// amount lands on the NEXT invoice, so no immediate charge / PaymentIntent is
// created at activation time (conservative payment behavior). Idempotency keys
// are derived from the durable purchase-attempt id so retries are safe.

export type QuantitySyncResult =
  | { ok: true; subscriptionItemId: string; quantity: number }
  | {
      ok: false;
      error: "billing_sync_failed" | "billing_configuration_missing";
      message: string;
    };

export async function syncAdditionalNumberQuantity(args: {
  clinicId: string;
  stripeSubscriptionId: string;
  existingAdditionalItemId: string | null;
  desiredQuantity: number;
  attemptId: string;
}): Promise<QuantitySyncResult> {
  let additionalNumberPriceId: string;
  try {
    ({ additionalNumberPriceId } = getStripeBillingEnv());
  } catch {
    logger.error("billing.quantity_sync.price_ids_missing", { clinicId: args.clinicId });
    return {
      ok: false,
      error: "billing_configuration_missing",
      message: "Number billing is not configured yet. The number was not activated.",
    };
  }

  const stripe = getStripeServerClient();
  try {
    let itemId = args.existingAdditionalItemId;
    if (itemId) {
      const item = await stripe.subscriptionItems.update(
        itemId,
        { quantity: args.desiredQuantity, proration_behavior: "create_prorations" },
        { idempotencyKey: `addnum-qty-${args.attemptId}-${args.desiredQuantity}` },
      );
      itemId = item.id;
    } else {
      const item = await stripe.subscriptionItems.create(
        {
          subscription: args.stripeSubscriptionId,
          price: additionalNumberPriceId,
          quantity: args.desiredQuantity,
          proration_behavior: "create_prorations",
        },
        { idempotencyKey: `addnum-create-${args.attemptId}` },
      );
      itemId = item.id;
    }

    // Persist the item id (coalesce-safe single-column write).
    await saveClinicAdditionalSubscriptionItemId(args.clinicId, itemId);

    logger.info("billing.quantity_sync.ok", {
      clinicId: args.clinicId,
      attemptId: args.attemptId,
      quantity: args.desiredQuantity,
    });
    return { ok: true, subscriptionItemId: itemId, quantity: args.desiredQuantity };
  } catch (err) {
    logger.error("billing.quantity_sync.failed", {
      clinicId: args.clinicId,
      attemptId: args.attemptId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return {
      ok: false,
      error: "billing_sync_failed",
      message:
        "We could not update billing for the additional number, so it was not activated. Our team will verify it.",
    };
  }
}
