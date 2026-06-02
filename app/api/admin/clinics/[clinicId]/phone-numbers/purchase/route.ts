import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../../../../lib/http/responses";
import { resolvePlatformAdmin } from "../../../../../../../lib/auth/platform-admin";
import { findClinicById } from "../../../../../../../lib/db/clinics";
import {
  findActiveOfficeTextingNumber,
  upsertOfficeTextingNumber,
} from "../../../../../../../lib/db/clinic-phone-numbers";
import { getAppDomains, isTwilioNumberPurchaseEnabled } from "../../../../../../../lib/env";
import {
  isNumberNoLongerAvailableError,
  phoneAreaCode,
  purchaseNumberAndConfigure,
} from "../../../../../../../lib/twilio/numbers";
import { recordAdminAuditEvent } from "../../../../../../../lib/db/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const PurchaseSchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/u, "phone_number must be E.164"),
});

// POST /api/admin/clinics/[clinicId]/phone-numbers/purchase
//
// Platform-admin-only. Purchases the admin-selected number and assigns it to the
// clinic, configuring the same production Voice + SMS webhooks and Messaging
// Service as onboarding (single architecture, not a second one). SMS recovery is
// NOT enabled here. Gated hard by `TWILIO_NUMBER_PURCHASE_ENABLED`.
//
// Precondition order: auth → clinic exists → not already assigned → purchase flag
// on → app base URL present → purchase. No bypass.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const admin = await resolvePlatformAdmin(req);
  if (!admin.ok) {
    if (admin.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You are not authorized for platform admin access.");
  }

  const { clinicId } = await ctx.params;
  if (!UUID_RE.test(clinicId)) {
    return jsonError(404, "not_found", "Clinic not found.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const parsed = PurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Please choose an available number to continue.");
  }
  const phoneNumber = parsed.data.phone_number;

  const clinic = await findClinicById(clinicId).catch(() => null);
  if (!clinic) return jsonError(404, "not_found", "Clinic not found.");

  // Idempotency / one-number rule: never purchase a second number for a clinic
  // that already has an active assigned number.
  const existing = await findActiveOfficeTextingNumber(clinicId).catch(() => null);
  if (existing) {
    return jsonError(
      409,
      "already_assigned",
      "This clinic already has an active assigned number.",
    );
  }

  // Hard purchase gate. When disabled, return a safe non-200 — never simulate.
  if (!isTwilioNumberPurchaseEnabled()) {
    return jsonError(
      503,
      "purchase_disabled",
      "Twilio number purchase is disabled by environment flag.",
    );
  }

  let appBaseUrl: string;
  try {
    ({ appBaseUrl } = getAppDomains());
  } catch {
    return jsonError(500, "config_missing", "App base URL is not configured for webhook setup.");
  }

  let purchased: { sid: string; phoneNumber: string };
  try {
    purchased = await purchaseNumberAndConfigure({
      phoneNumber,
      appBaseUrl,
      attachMessagingService: true,
    });
  } catch (err) {
    if (isNumberNoLongerAvailableError(err)) {
      return jsonError(409, "number_no_longer_available", "That number is no longer available. Please search again.");
    }
    return jsonError(502, "purchase_failed", "Number purchase failed. Please try another number.");
  }

  let mapping;
  try {
    mapping = await upsertOfficeTextingNumber({
      clinicId,
      phoneNumber: purchased.phoneNumber,
      twilioPhoneNumberSid: purchased.sid,
    });
  } catch {
    // The Twilio number was purchased + configured, but the DB write failed. Do
    // not lose the SID — surface it so an operator can reconcile manually.
    return jsonError(
      500,
      "assignment_save_failed",
      `Number ${purchased.phoneNumber} was purchased (SID ${purchased.sid}) but could not be saved. Reconcile manually.`,
    );
  }

  // Audit: phone number + SID + area code only. Never any Twilio secret.
  try {
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "clinic.phone_number.purchase_assign",
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      beforeState: { had_active_number: false },
      afterState: {
        phone_number: mapping.phone_number,
        twilio_sid: mapping.twilio_phone_number_sid,
        area_code: phoneAreaCode(mapping.phone_number),
      },
      metadata: { authSource: admin.source },
    });
  } catch {
    // Purchase + assignment already succeeded; never fail on an audit hiccup.
  }

  return jsonOk({
    ok: true,
    phone_number: mapping.phone_number,
    twilio_phone_number_sid: mapping.twilio_phone_number_sid,
  });
}
