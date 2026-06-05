import { NextResponse, type NextRequest } from "next/server";

import {
  jsonError,
  jsonForbidden,
  jsonInternalError,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolveAuthClinicAccess } from "@/lib/auth/access";
import { getStripeBillingEnv } from "@/lib/env";
import { getStripeServerClient, StripeNotTestModeError } from "@/lib/stripe/server";
import { getDb } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import {
  findReusablePaidPlanSubscription,
  persistStripeSubscriptionForClinic,
} from "@/lib/billing/stripe-subscription-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/billing/start-paid-plan
//
// Explicit owner action to convert the trial into the paid $99/month plan using
// the saved Stripe Customer + saved PaymentMethod. The base-plan Price ID is
// resolved server-side only (never from the client). Paid status is NOT granted
// here — it is granted only by the webhook after Stripe confirms the
// subscription is active.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess(req);
  if (!access.ok) {
    return jsonUnauthorized("Please sign in to continue.");
  }
  if (access.membership.role === "front_desk") {
    return jsonForbidden("Front desk users cannot manage billing.");
  }
  const clinic = access.clinic;

  // Require a saved payment method / Stripe customer.
  if (!clinic.stripe_customer_id || !clinic.stripe_payment_method_id) {
    return jsonError(
      400,
      "payment_method_required",
      "Add a payment method before starting the paid plan.",
    );
  }
  // Do not allow duplicate subscriptions.
  if (clinic.stripe_subscription_id) {
    return jsonError(409, "subscription_exists", "Your subscription is already set up.");
  }
  if (clinic.billing_status === "active") {
    return jsonError(409, "already_active", "Your paid plan is already active.");
  }

  // Require a first assigned business number (defensive read).
  const sql = getDb();
  const activeRows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.clinic_phone_numbers
    where clinic_id = ${clinic.id} and is_active = true
  `.catch(() => [{ n: 0 }]);
  if ((activeRows[0]?.n ?? 0) < 1) {
    return jsonError(
      409,
      "first_number_required",
      "Purchase your first number before starting the paid plan.",
    );
  }

  let stripe;
  try {
    stripe = getStripeServerClient();
  } catch (err) {
    if (err instanceof StripeNotTestModeError) {
      logger.error("billing.paid_plan.not_test_mode", { clinicId: clinic.id });
    } else {
      logger.error("billing.paid_plan.stripe_init_failed", { clinicId: clinic.id });
    }
    return jsonInternalError("Billing is not available in this environment.");
  }

  let basePlanPriceId: string;
  try {
    ({ basePlanPriceId } = getStripeBillingEnv());
  } catch {
    logger.error("billing.paid_plan.price_ids_missing", { clinicId: clinic.id });
    return jsonError(
      503,
      "billing_configuration_missing",
      "Billing is not fully configured yet. Please try again later.",
    );
  }

  try {
    const existingSubscription = await findReusablePaidPlanSubscription({
      stripe,
      customerId: clinic.stripe_customer_id,
      clinicId: clinic.id,
      basePlanPriceId,
    });
    if (existingSubscription) {
      const persisted = await persistStripeSubscriptionForClinic({
        clinicId: clinic.id,
        subscription: existingSubscription,
      });
      logger.info("billing.paid_plan.existing_subscription_persisted", {
        clinicId: clinic.id,
        subscriptionId: existingSubscription.id,
        status: existingSubscription.status,
      });
      return jsonOk({ ok: true, status: persisted.isActive ? "active" : "pending" });
    }

    const subscription = await stripe.subscriptions.create(
      {
        collection_method: "charge_automatically",
        customer: clinic.stripe_customer_id,
        default_payment_method: clinic.stripe_payment_method_id,
        items: [{ price: basePlanPriceId, quantity: 1 }],
        metadata: {
          clinic_id: clinic.id,
          purpose: "paid_plan_start",
          environment: "stripe_sandbox",
        },
        payment_behavior: "error_if_incomplete",
      },
      {
        idempotencyKey: `paid-plan-start-${clinic.id}-${clinic.stripe_payment_method_id}`,
      },
    );
    const persisted = await persistStripeSubscriptionForClinic({
      clinicId: clinic.id,
      subscription,
    });

    logger.info("billing.paid_plan.subscription_created", {
      clinicId: clinic.id,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
    return jsonOk({
      ok: true,
      status: persisted.isActive ? "active" : "pending",
    });
  } catch (err) {
    const paymentMessage =
      "We couldn\u2019t start your paid plan with the saved payment method. Please update your payment method in Billing.";
    logger.error("billing.paid_plan.failed", {
      clinicId: clinic.id,
      message: err instanceof Error ? err.message : "unknown",
      stripeType: stripeErrorType(err),
      stripeCode: stripeErrorCode(err),
    });
    if (isStripePaymentFailure(err)) {
      return jsonError(402, "payment_failed", paymentMessage);
    }
    return jsonInternalError("Could not start the paid plan. Please try again.");
  }
}

function stripeErrorType(err: unknown): string | null {
  return typeof err === "object" && err !== null && "type" in err
    ? String((err as { type?: unknown }).type ?? "")
    : null;
}

function stripeErrorCode(err: unknown): string | null {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code?: unknown }).code ?? "")
    : null;
}

function isStripePaymentFailure(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as {
    type?: string;
    code?: string;
    decline_code?: string;
    payment_intent?: { status?: string };
    raw?: { payment_intent?: { status?: string } };
  };
  const status = e.payment_intent?.status ?? e.raw?.payment_intent?.status ?? null;
  return (
    e.type === "StripeCardError" ||
    Boolean(e.decline_code) ||
    e.code === "card_declined" ||
    e.code === "payment_intent_authentication_failure" ||
    e.code === "authentication_required" ||
    status === "requires_action" ||
    status === "requires_payment_method" ||
    Boolean(e.type?.startsWith("Stripe"))
  );
}
