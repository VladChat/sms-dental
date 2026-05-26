import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../../../lib/http/responses";
import { lookupSetupRequestByRawToken } from "../../../../../../lib/onboarding/verify";
import {
  getAppDomains,
  isTwilioNumberPurchaseEnabled,
} from "../../../../../../lib/env";
import {
  findActiveOfficeTextingNumber,
  upsertOfficeTextingNumber,
} from "../../../../../../lib/db/clinic-phone-numbers";
import {
  setClinicSetupStatus,
} from "../../../../../../lib/db/clinics";
import { setSetupRequestStatus } from "../../../../../../lib/db/setup-requests";
import {
  isNumberNoLongerAvailableError,
  purchaseNumberAndConfigure,
} from "../../../../../../lib/twilio/numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/onboarding/[token]/numbers/purchase
//
// Purchases the user-selected Twilio number after validating:
//   1. Setup token validity.
//   2. Clinic exists and has no active office texting number (idempotent).
//   3. TWILIO_NUMBER_PURCHASE_ENABLED is explicitly "true".
//
// On success, configures Voice + SMS webhooks pointing at APP_BASE_URL and
// stores the mapping. SMS recovery remains DISABLED — onboarding never
// enables live SMS.

const PurchaseInputSchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/u, "phone_number must be E.164"),
});

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

  if (!isTwilioNumberPurchaseEnabled()) {
    return jsonError(
      503,
      "purchase_disabled",
      "Number purchase is currently disabled by the operator. Please try again later.",
    );
  }

  let appBaseUrl: string;
  try {
    ({ appBaseUrl } = getAppDomains());
  } catch {
    return jsonError(
      500,
      "config_missing",
      "App is not fully configured for number purchase.",
    );
  }

  try {
    const purchased = await purchaseNumberAndConfigure({
      phoneNumber: parsed.data.phone_number,
      appBaseUrl,
      attachMessagingService: true,
    });

    const mapping = await upsertOfficeTextingNumber({
      clinicId: setupRequest.clinic_id,
      phoneNumber: purchased.phoneNumber,
      twilioPhoneNumberSid: purchased.sid,
    });
    await setClinicSetupStatus(setupRequest.clinic_id, "number_assigned");
    await setSetupRequestStatus(setupRequest.id, "number_assigned");

    return jsonOk({
      ok: true,
      phone_number: mapping.phone_number,
      twilio_phone_number_sid: mapping.twilio_phone_number_sid,
    });
  } catch (err) {
    if (isNumberNoLongerAvailableError(err)) {
      return jsonError(
        409,
        "number_no_longer_available",
        "That number is no longer available. Please choose another number.",
      );
    }
    return jsonError(
      502,
      "purchase_failed",
      "Number purchase failed. Please choose another number or try again.",
    );
  }
}
