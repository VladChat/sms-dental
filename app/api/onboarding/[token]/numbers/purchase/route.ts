import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../../../lib/http/responses";
import { lookupSetupRequestByRawToken } from "../../../../../../lib/onboarding/verify";
import { findActiveOfficeTextingNumber } from "../../../../../../lib/db/clinic-phone-numbers";
import { setSetupRequestStatus } from "../../../../../../lib/db/setup-requests";
import {
  provisionClinicPhoneNumber,
  type ProvisionErrorCode,
} from "../../../../../../lib/phone-numbers/provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/onboarding/[token]/numbers/purchase
//
// Legacy token-scoped number assignment endpoint. New owner UI uses
// /api/account/phone-numbers/purchase, but this route remains as a safe wrapper:
// it never calls Twilio directly and instead delegates to the shared provisioning
// service so entitlement, readiness, purchase mode, and reconciliation behavior
// stay identical across all purchase surfaces.

const PurchaseInputSchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/u, "phone_number must be E.164"),
});

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
  missing_fields: 400,
  billing_sync_failed: 502,
  reconciliation_required: 500,
  purchase_failed: 502,
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await ctx.params;
  const lookup = await lookupSetupRequestByRawToken(token);
  if (!lookup.ok) {
    return jsonError(404, "invalid_setup_link", "This setup link is invalid or expired.");
  }
  const setupRequest = lookup.setupRequest;
  if (!setupRequest.clinic_id) {
    return jsonError(
      409,
      "clinic_details_required",
      "Please complete the clinic setup form before selecting a number.",
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const parsed = PurchaseInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Please choose an available number to continue.");
  }

  // Idempotency: if the clinic already has an active office texting number,
  // return it immediately without contacting Twilio.
  const existing = await findActiveOfficeTextingNumber(setupRequest.clinic_id);
  if (existing) {
    await setSetupRequestStatus(setupRequest.id, "number_assigned");
    return jsonOk({
      ok: true,
      already_assigned: true,
      phone_number: existing.phone_number,
      twilio_phone_number_sid: existing.twilio_phone_number_sid,
    });
  }

  const result = await provisionClinicPhoneNumber({
    clinicId: setupRequest.clinic_id,
    phoneNumber: parsed.data.phone_number,
    actorProfileId: null,
    actorEmail: setupRequest.owner_email,
    source: "owner_self_service",
    additionalBillingAuthorized: false,
  });

  if (!result.ok) {
    return jsonError(
      ERROR_STATUS[result.error],
      result.error,
      result.message,
      result.missingFields ? { missing_fields: result.missingFields } : undefined,
    );
  }

  try {
    await setSetupRequestStatus(setupRequest.id, "number_assigned");
  } catch {
    // Assignment already succeeded; setup-request status can be reconciled later.
  }

  return jsonOk({
    ok: true,
    phone_number: result.assigned.phoneNumber,
    twilio_phone_number_sid: result.twilioSid,
  });
}
