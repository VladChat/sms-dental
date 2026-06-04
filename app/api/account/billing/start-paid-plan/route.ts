import { NextResponse, type NextRequest } from "next/server";

import {
  jsonError,
  jsonForbidden,
  jsonInternalError,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolveAuthClinicAccess } from "@/lib/auth/access";
import { getAppDomains, getStripeBillingEnv } from "@/lib/env";
import { getStripeServerClient, StripeNotTestModeError } from "@/lib/stripe/server";
import { getDb } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/billing/start-paid-plan
//
// Explicit owner action to convert the trial into the paid $99/month plan via
// Stripe-hosted Checkout in mode:"subscription". The base-plan Price ID is
// resolved server-side only (never from the client). Paid status is NOT granted
// here — it is granted only by the webhook after Stripe confirms the
// subscription is active. No charge is made by this route; Checkout collects it.
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
    const { appBaseUrl } = getAppDomains();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: clinic.stripe_customer_id,
      line_items: [{ price: basePlanPriceId, quantity: 1 }],
      client_reference_id: clinic.id,
      success_url: `${appBaseUrl}/account?section=billing&paid_plan=success`,
      cancel_url: `${appBaseUrl}/account?section=billing&paid_plan=cancelled`,
      metadata: {
        clinic_id: clinic.id,
        purpose: "paid_plan_start",
        environment: "stripe_sandbox",
      },
      subscription_data: {
        metadata: {
          clinic_id: clinic.id,
          purpose: "paid_plan_start",
          environment: "stripe_sandbox",
        },
      },
    });

    if (!session.url) {
      logger.error("billing.paid_plan.no_session_url", { clinicId: clinic.id, sessionId: session.id });
      return jsonInternalError("Could not start the paid plan. Please try again.");
    }

    logger.info("billing.paid_plan.session_created", { clinicId: clinic.id, sessionId: session.id });
    return jsonOk({ ok: true, url: session.url });
  } catch (err) {
    logger.error("billing.paid_plan.failed", {
      clinicId: clinic.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    return jsonInternalError("Could not start the paid plan. Please try again.");
  }
}
