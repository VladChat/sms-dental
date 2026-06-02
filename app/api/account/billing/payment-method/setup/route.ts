import { NextResponse, type NextRequest } from "next/server";

import {
  jsonForbidden,
  jsonInternalError,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolveAuthClinicAccess } from "@/lib/auth/access";
import { getAppDomains } from "@/lib/env";
import { getStripeServerClient, StripeNotTestModeError } from "@/lib/stripe/server";
import { updateStripeCustomerId } from "@/lib/db/clinics";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/billing/payment-method/setup
//
// Starts Stripe-hosted payment-method collection (sandbox/test mode) for the
// authenticated owner/admin's clinic. Creates a Stripe Customer (once) and a
// Checkout Session in mode:"setup". It NEVER creates a charge, PaymentIntent,
// subscription, or invoice, and never enables SMS recovery or number purchase.
//
// Clinic identity comes only from the authenticated session — no client-supplied
// clinic id is trusted. Secret values are never returned or logged.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess(req);
  if (!access.ok) {
    return jsonUnauthorized("Please sign in to continue.");
  }
  if (access.membership.role === "front_desk") {
    return jsonForbidden("Front desk users cannot manage billing.");
  }

  const clinic = access.clinic;

  // Resolve the sandbox-gated Stripe client. A non-test key (or missing key) is
  // reported as a safe server error — the key value is never echoed.
  let stripe;
  try {
    stripe = getStripeServerClient();
  } catch (err) {
    if (err instanceof StripeNotTestModeError) {
      logger.error("billing.setup.not_test_mode", { clinicId: clinic.id });
    } else {
      logger.error("billing.setup.stripe_init_failed", { clinicId: clinic.id });
    }
    return jsonInternalError("Billing is not available in this environment.");
  }

  try {
    // Ensure a Stripe Customer exists for this clinic (sandbox/test mode).
    let customerId = clinic.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: clinic.owner_contact_email ?? access.userEmail ?? undefined,
        name: clinic.name || undefined,
        metadata: {
          clinic_id: clinic.id,
          environment: "stripe_sandbox",
        },
      });
      customerId = customer.id;
      await updateStripeCustomerId(clinic.id, customerId);
    }

    const { appBaseUrl } = getAppDomains();
    const successUrl = `${appBaseUrl}/account?section=billing&payment_method_setup=success`;
    const cancelUrl = `${appBaseUrl}/account?section=billing&payment_method_setup=cancelled`;

    // mode:"setup" saves a payment method for future billing. No charge, no
    // subscription, no invoice. payment_method_types is intentionally OMITTED so
    // Stripe uses dynamic payment methods configured in the Dashboard. When
    // payment_method_types is omitted, Stripe requires `currency` in setup mode
    // to resolve eligible dynamic payment methods — it does NOT create a charge.
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      currency: "usd",
      customer: customerId,
      client_reference_id: clinic.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        clinic_id: clinic.id,
        purpose: "payment_method_setup",
        environment: "stripe_sandbox",
      },
      setup_intent_data: {
        metadata: {
          clinic_id: clinic.id,
          purpose: "payment_method_setup",
          environment: "stripe_sandbox",
        },
      },
    });

    if (!session.url) {
      logger.error("billing.setup.no_session_url", { clinicId: clinic.id, sessionId: session.id });
      return jsonInternalError("Could not start payment setup. Please try again.");
    }

    logger.info("billing.setup.session_created", {
      clinicId: clinic.id,
      sessionId: session.id,
      mode: session.mode,
    });

    return jsonOk({ ok: true, url: session.url });
  } catch (err) {
    logger.error("billing.setup.failed", {
      clinicId: clinic.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    return jsonInternalError("Could not start payment setup. Please try again.");
  }
}
