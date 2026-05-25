import { NextRequest } from "next/server";
import {
  jsonBadRequest,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { verifyStripeWebhook } from "@/lib/stripe/webhook";
import { recordWebhookEvent } from "@/lib/db/webhook-events";
import { isDatabaseConfigured } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe webhook placeholder. Foundation behavior:
//   - read raw body (Stripe signature is computed over the exact bytes)
//   - validate Stripe-Signature using STRIPE_WEBHOOK_SECRET
//   - log/record a webhook_event idempotently keyed by event.id
//   - return 200 for any verified event (no billing logic yet)
//
// Billing handlers (customer.subscription.*, invoice.*, etc.) will be added
// in the billing milestone.
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

  if (isDatabaseConfigured()) {
    try {
      const record = await recordWebhookEvent({
        provider: "stripe",
        eventType: event.type,
        externalId: event.id,
        payload: event,
      });
      if (record.recorded && record.duplicate) {
        logger.info("stripe.webhook.duplicate", {
          eventId: event.id,
          eventType: event.type,
        });
      }
    } catch (err) {
      logger.error("stripe.webhook.persist_failed", {
        eventId: event.id,
        eventType: event.type,
        message: err instanceof Error ? err.message : "unknown",
      });
      // Returning a 5xx would trigger Stripe retries. With signature valid
      // and persistence the only failure, we still want to ack so retries do
      // not pile up. The error is already logged.
    }
  } else {
    logger.info("stripe.webhook.received", {
      eventId: event.id,
      eventType: event.type,
      dbConfigured: false,
    });
  }

  return jsonOk({ ok: true, received: true, type: event.type });
}
