import { NextRequest } from "next/server";
import type Stripe from "stripe";
import {
  jsonBadRequest,
  jsonInternalError,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { verifyStripeWebhook } from "@/lib/stripe/webhook";
import { getStripeServerClient } from "@/lib/stripe/server";
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import {
  findClinicById,
  findClinicIdByStripeCustomerId,
  findClinicIdByStripeSubscriptionId,
  saveClinicSubscriptionState,
  saveStripePaymentMethodForClinic,
  type BillingStatus,
} from "@/lib/db/clinics";
import { isDatabaseConfigured } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import {
  getConfiguredSubscriptionItemIds,
  idOfStripeRef,
  mapStripeSubscriptionStatus,
  persistStripeSubscriptionForClinic,
} from "@/lib/billing/stripe-subscription-state";

// Subscription-lifecycle events that carry paid-plan entitlement. Their DB
// writes are idempotent and fail CLOSED (a persistence failure returns non-2xx
// so Stripe retries — entitlement is never granted from an unsaved event).
const BILLING_EVENT_TYPES = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

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

  // Billing-critical events run on EVERY delivery (idempotent) and FAIL CLOSED:
  // if the entitlement write throws, return 5xx so Stripe retries — we never ack
  // a paid-plan event whose DB write failed. (Running regardless of isDuplicate
  // is required: the event row is recorded before the write, so a retry after a
  // failed write would otherwise be skipped as a duplicate.)
  if (BILLING_EVENT_TYPES.has(event.type)) {
    try {
      await handleStripeBillingEvent(event);
    } catch (err) {
      logger.error("stripe.webhook.billing_handler_failed", {
        eventId: event.id,
        eventType: event.type,
        message: err instanceof Error ? err.message : "unknown",
      });
      return jsonInternalError("Webhook processing failed");
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
      setupIntentId: idOfStripeRef(session.setup_intent),
      customerId: idOfStripeRef(session.customer),
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
      customerId: idOfStripeRef(si.customer),
      paymentMethodId: idOfStripeRef(si.payment_method),
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
    paymentMethodId = paymentMethodId ?? idOfStripeRef(si.payment_method);
    customerId = customerId ?? idOfStripeRef(si.customer);
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

// ── Subscription billing lifecycle (fail-closed) ─────────────────────────────

// Resolve the clinic ONLY from trusted Stripe metadata / stored Stripe ids.
async function resolveClinicForStripe(args: {
  metadataClinicId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<string | null> {
  if (args.metadataClinicId) {
    const c = await findClinicById(args.metadataClinicId).catch(() => null);
    if (c) return c.id;
  }
  if (args.subscriptionId) {
    const id = await findClinicIdByStripeSubscriptionId(args.subscriptionId);
    if (id) return id;
  }
  if (args.customerId) {
    const id = await findClinicIdByStripeCustomerId(args.customerId);
    if (id) return id;
  }
  return null;
}

function readSubscriptionRef(o: { subscription?: unknown }): string | null {
  // Invoice.subscription typing drifts across Stripe API versions; read safely.
  const v = o.subscription as string | { id: string } | null | undefined;
  return idOfStripeRef(v ?? null);
}

// Handle subscription-lifecycle events. Throws on DB failure so the caller can
// fail closed. Idempotent (saveClinicSubscriptionState coalesces + upserts).
async function handleStripeBillingEvent(event: Stripe.Event): Promise<void> {
  if (!isDatabaseConfigured()) {
    // Cannot persist entitlement — fail closed so Stripe retries.
    throw new Error("database not configured for billing webhook");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || session.metadata?.purpose !== "paid_plan_start") return;
    const subscriptionId = idOfStripeRef(session.subscription);
    const customerId = idOfStripeRef(session.customer);
    const clinicId = await resolveClinicForStripe({
      metadataClinicId: session.metadata?.clinic_id ?? session.client_reference_id ?? null,
      customerId,
      subscriptionId,
    });
    if (!clinicId) {
      logger.warn("stripe.webhook.billing_missing_clinic", { type: event.type });
      return;
    }
    if (!subscriptionId) {
      logger.warn("stripe.webhook.billing_no_subscription", { type: event.type, clinicId });
      return;
    }
    const stripe = getStripeServerClient();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const persisted = await persistStripeSubscriptionForClinic({ clinicId, subscription: sub });
    logger.info("stripe.webhook.paid_plan_started", { clinicId, status: persisted.billingStatus });
    return;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const clinicId = await resolveClinicForStripe({
      metadataClinicId: sub.metadata?.clinic_id ?? null,
      customerId: idOfStripeRef(sub.customer),
      subscriptionId: sub.id,
    });
    if (!clinicId) {
      logger.warn("stripe.webhook.billing_missing_clinic", { type: event.type });
      return;
    }
    const status: BillingStatus =
      event.type === "customer.subscription.deleted" ? "canceled" : mapStripeSubscriptionStatus(sub.status);
    if (event.type === "customer.subscription.deleted") {
      const items = getConfiguredSubscriptionItemIds(sub);
      await saveClinicSubscriptionState(clinicId, {
        stripeSubscriptionId: sub.id,
        baseSubscriptionItemId: items.baseItemId,
        additionalSubscriptionItemId: items.additionalItemId,
        billingStatus: status,
        markPaidPlanStarted: false,
      });
    } else {
      await persistStripeSubscriptionForClinic({ clinicId, subscription: sub });
    }
    logger.info("stripe.webhook.subscription_state", { clinicId, type: event.type, status });
    return;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = readSubscriptionRef(invoice as unknown as { subscription?: unknown });
    if (!subscriptionId) return; // non-subscription invoice — not relevant
    const clinicId = await resolveClinicForStripe({
      customerId: idOfStripeRef(invoice.customer),
      subscriptionId,
    });
    if (!clinicId) {
      logger.warn("stripe.webhook.billing_missing_clinic", { type: event.type });
      return;
    }
    const status: BillingStatus = event.type === "invoice.paid" ? "active" : "past_due";
    await saveClinicSubscriptionState(clinicId, {
      stripeSubscriptionId: subscriptionId,
      baseSubscriptionItemId: null,
      additionalSubscriptionItemId: null,
      billingStatus: status,
      markPaidPlanStarted: status === "active",
    });
    logger.info("stripe.webhook.invoice", { clinicId, type: event.type, status });
    return;
  }
}
