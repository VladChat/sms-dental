import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolveAuthClinicAccess } from "@/lib/auth/access";
import {
  provisionClinicPhoneNumber,
  type ProvisionErrorCode,
} from "@/lib/phone-numbers/provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/phone-numbers/purchase
//
// Owner self-service: purchases and assigns a real business number via the
// shared, race-safe provisioning service. The first number is included with the
// plan and starts the 21-day trial on assignment (no charge). Additional numbers
// require an active paid subscription (gated server-side). The client never
// supplies clinic id, price, billing class, limit, Stripe IDs, Twilio SID, or
// subscription quantity.
const BodySchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone number must be E.164 (starts with +)."),
  friendly_name: z.string().trim().max(160).optional().nullable(),
  locality: z.string().trim().max(160).optional().nullable(),
  region: z.string().trim().max(160).optional().nullable(),
  postal_code: z.string().trim().max(20).optional().nullable(),
  capabilities: z
    .object({ voice: z.boolean(), sms: z.boolean(), mms: z.boolean().optional() })
    .passthrough(),
  type: z.enum(["local", "toll_free"]).optional(),
  additional_billing_authorized: z.boolean().optional(),
});

// Stable error code -> HTTP status. Messages come from the provisioning service.
const ERROR_STATUS: Record<ProvisionErrorCode, number> = {
  payment_method_required: 400,
  number_purchases_revoked: 403,
  number_limit_reached: 409,
  purchase_in_progress: 409,
  paid_plan_required: 409,
  subscription_not_active: 409,
  billing_configuration_missing: 503,
  additional_billing_authorization_required: 400,
  number_already_assigned: 409,
  number_no_longer_available: 409,
  purchase_disabled: 503,
  billing_sync_failed: 502,
  reconciliation_required: 500,
  purchase_failed: 502,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess(req);
  if (!access.ok) {
    return jsonUnauthorized("Please sign in to continue.");
  }
  if (access.membership.role === "front_desk") {
    return jsonForbidden("Front desk users cannot purchase a number.");
  }
  const clinic = access.clinic;

  // Require a saved payment method before any purchase (entitlement also gates,
  // but check here so we never even open an attempt without one).
  if (!clinic.stripe_payment_method_id) {
    return jsonError(
      400,
      "payment_method_required",
      "Add a payment method before purchasing a number.",
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", "Please choose a valid number to purchase.");
  }
  const b = parsed.data;
  if (b.capabilities.voice !== true || b.capabilities.sms !== true) {
    return jsonError(
      400,
      "invalid_capabilities",
      "The selected number must support voice and SMS.",
    );
  }

  const result = await provisionClinicPhoneNumber({
    clinicId: clinic.id,
    phoneNumber: b.phone_number,
    actorProfileId: access.userId,
    actorEmail: access.userEmail ?? clinic.owner_contact_email ?? null,
    source: "owner_self_service",
    additionalBillingAuthorized: b.additional_billing_authorized === true,
  });

  if (!result.ok) {
    return jsonError(ERROR_STATUS[result.error], result.error, result.message);
  }

  return jsonOk({ ok: true, assignedNumber: result.assigned });
}
