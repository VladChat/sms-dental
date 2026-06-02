import { NextRequest } from "next/server";
import type Stripe from "stripe";
import {
  jsonBadRequest,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { verifyStripeWebhook } from "@/lib/stripe/webhook";
import { getStripeServerClient } from "@/lib/stripe/server";
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import { saveStripePaymentMethodForClinic } from "@/lib/db/clinics";
import { isDatabaseConfigured } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe webhook. Behavior:
//   - read raw body (Stripe signature is computed over the exact bytes)
//   - validate Stripe-Signature using STRIPE_WEBHOOK_SECRET
//   - record a webhook_event idempotently keyed by event.id
//   - handle payment-method setup completion (mode:"setup" Checkout Session and
//     setup_intent.succeeded fallback), saving only safe card metadata
//
// This handler NEVER creates a charge, PaymentIntent, subscription, or invoice.
// Subscription/invoice handlers belong to a later billing milestone.
export async function POST(request: NextRequest) {
  const signatureHeader = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!rawBody) {
    return jsonBadRequest("Empty body");
  }

  const result = verifyStripeWebhook({ rawBody, signatureHeader });
  if (!result.ok) {
    logger.warn("stripe.webhook.signature_invalid", { code: result.code });
    if (result.code === "missing_secret") {
      return jsonUnauthorized();
    }
    return jsonUnauthorized("Invalid Stripe signature");
  }

  const { event } = result;

  // Record the event idempotently. duplicate=true means we already saw this exact
  // event id, so we skip side effects to keep processing idempotent.
  let isDuplicate = false;
  if (isDatabaseConfigured()) {
    try {
      const record = await recordWebhookEvent({
        provider: "stripe",
        eventType: event.type,
        externalId: event.id,
        payload: event,
      });
      isDuplicate = record.recorded && record.duplicate;
      if (isDuplicate) {
        logger.info("stripe.webhook.duplicate", { eventId: event.id, eventType: event.type });
      }
    } catch (err) {
      logger.error("stripe.webhook.persist_failed", {
        eventId: event.id,
        eventType: event.type,
        message: err instanceof Error ? err.message : "unknown",
      });
      // Returning a 5xx would trigger Stripe retries. With signature valid and
      // persistence the only failure, we still ack so retries do not pile up.
    }
  } else {
    logger.info("stripe.webhook.received", {
      eventId: event.id,
      eventType: event.type,
      dbConfigured: false,
    });
  }

  // Payment-method setup side effects (skip exact-duplicate replays). Failures
  // are logged but still ack'd: Stripe sends both checkout.session.completed and
  // setup_intent.succeeded for setup sessions, so the other event can recover.
  if (!isDuplicate) {
    try {
      await handleStripeSetupEvent(event);
    } catch (err) {
      logger.error("stripe.webhook.handler_failed", {
        eventId: event.id,
        eventType: event.type,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return jsonOk({ ok: true, received: true, type: event.type });
}

// Route the verified event to the setup handler. Unrelated events are no-ops
// (the caller still returns 200).
async function handleStripeSetupEvent(event: Stripe.Event): Promise<void> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    // Only payment-method setup sessions — never subscription/payment sessions.
    if (session.mode !== "setup") return;
    await savePaymentMethodFromSetup({
      clinicId: session.metadata?.clinic_id ?? session.client_reference_id ?? null,
      setupIntentId: idOf(session.setup_intent),
      customerId: idOf(session.customer),
      source: "checkout.session.completed",
    });
    return;
  }

  if (event.type === "setup_intent.succeeded") {
    const si = event.data.object as Stripe.SetupIntent;
    // Only our payment-method setup intents (tagged in setup_intent_data.metadata).
    if (si.metadata?.purpose !== "payment_method_setup") return;
    await savePaymentMethodFromSetup({
      clinicId: si.metadata?.clinic_id ?? null,
      setupIntentId: si.id,
      customerId: idOf(si.customer),
      paymentMethodId: idOf(si.payment_method),
      source: "setup_intent.succeeded",
    });
    return;
  }
}

// Resolve a saved PaymentMethod from a setup event and persist safe metadata to
// the clinic. Sets the customer's default payment method for future billing
// readiness — this does NOT create an invoice, subscription, or charge.
async function savePaymentMethodFromSetup(args: {
  clinicId: string | null;
  setupIntentId: string | null;
  customerId: string | null;
  paymentMethodId?: string | null;
  source: string;
}): Promise<void> {
  const { clinicId, setupIntentId, source } = args;

  if (!clinicId) {
    logger.warn("stripe.webhook.setup_missing_clinic", { source });
    return;
  }
  if (!isDatabaseConfigured()) {
    logger.warn("stripe.webhook.setup_db_not_configured", { source, clinicId });
    return;
  }

  const stripe = getStripeServerClient();

  // Prefer ids already on the event; otherwise resolve via the SetupIntent.
  let paymentMethodId = args.paymentMethodId ?? null;
  let customerId = args.customerId ?? null;
  if ((!paymentMethodId || !customerId) && setupIntentId) {
    const si = await stripe.setupIntents.retrieve(setupIntentId);
    paymentMethodId = paymentMethodId ?? idOf(si.payment_method);
    customerId = customerId ?? idOf(si.customer);
  }

  if (!paymentMethodId) {
    logger.warn("stripe.webhook.setup_no_payment_method", { source, clinicId });
    return;
  }

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  const card = pm.card ?? null;

  await saveStripePaymentMethodForClinic(clinicId, {
    stripeCustomerId: customerId,
    paymentMethodId,
    brand: card?.brand ?? null,
    last4: card?.last4 ?? null,
    expMonth: card?.exp_month ?? null,
    expYear: card?.exp_year ?? null,
  });

  // Mark this method as the customer default for future billing. Safe: no
  // invoice/subscription/charge is created by updating invoice_settings.
  if (customerId) {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    } catch (err) {
      logger.warn("stripe.webhook.set_default_pm_failed", {
        source,
        clinicId,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  logger.info("stripe.webhook.payment_method_saved", {
    source,
    clinicId,
    brand: card?.brand ?? null,
    last4Present: Boolean(card?.last4),
  });
}

// Stripe fields are often `string | { id } | null`. Return the id string.
function idOf(
  ref: string | { id: string } | null | undefined,
): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}
