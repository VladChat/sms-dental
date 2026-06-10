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
import { phoneAreaCode } from "../../../../../../../lib/twilio/numbers";
import { recordAdminAuditEvent } from "../../../../../../../lib/db/admin/audit";
import {
  provisionClinicPhoneNumber,
  type ProvisionErrorCode,
} from "../../../../../../../lib/phone-numbers/provisioning";
import { textingStatusSyncConfig } from "../../../../../../../config/texting-status-sync.config";
import { syncPhoneNumberTextingStatusesBestEffort } from "../../../../../../../lib/texting-status/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const PurchaseSchema = z.object({
  phone_number: z.string().trim().regex(/^\+[1-9]\d{7,14}$/u, "phone_number must be E.164"),
  // Defaults to toll-free (the included first-number path) when unspecified.
  type: z.enum(["local", "toll_free"]).optional(),
  additional_billing_authorized: z.boolean().optional(),
  local_billing_authorized: z.boolean().optional(),
});

// Stable error code -> HTTP status (messages come from the provisioning service).
const ERROR_STATUS: Record<ProvisionErrorCode, number> = {
  payment_method_required: 400,
  number_purchases_revoked: 403,
  number_limit_reached: 409,
  purchase_in_progress: 409,
  paid_plan_required: 409,
  subscription_not_active: 409,
  billing_configuration_missing: 503,
  local_billing_not_configured: 503,
  local_billing_authorization_required: 400,
  additional_billing_authorization_required: 400,
  number_already_assigned: 409,
  number_no_longer_available: 409,
  purchase_disabled: 503,
  missing_fields: 400,
  billing_sync_failed: 502,
  payment_failed: 402,
  reconciliation_required: 500,
  purchase_failed: 502,
};

// POST /api/admin/clinics/[clinicId]/phone-numbers/purchase
//
// Platform-admin manual purchase. Uses the SAME shared, race-safe provisioning
// service as the owner self-service path (no duplicated Twilio logic). The
// clinic limit, purchase-permission, and paid-plan requirements for additional
// numbers are enforced by the shared entitlement gate — the admin must raise the
// limit / restore permission explicitly before purchase. SMS recovery is never
// enabled here.
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

  const clinic = await findClinicById(clinicId).catch(() => null);
  if (!clinic) return jsonError(404, "not_found", "Clinic not found.");

  const result = await provisionClinicPhoneNumber({
    clinicId,
    phoneNumber: parsed.data.phone_number,
    numberType: parsed.data.type ?? "toll_free",
    actorProfileId: admin.userId,
    actorEmail: admin.email,
    source: "admin",
    additionalBillingAuthorized: parsed.data.additional_billing_authorized === true,
    localBillingAuthorized: parsed.data.local_billing_authorized === true,
  });

  if (!result.ok) {
    return jsonError(
      ERROR_STATUS[result.error],
      result.error,
      result.message,
      result.missingFields ? { missing_fields: result.missingFields } : undefined,
    );
  }

  await syncPhoneNumberTextingStatusesBestEffort({
    phoneNumberId: result.assigned.id,
    force: true,
    limit: textingStatusSyncConfig.eventBatchSize,
    event: "admin_number_purchase",
  });

  // Audit: phone number + SID + area code only. Never any Twilio secret.
  try {
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "clinic.phone_number.purchase_assign",
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      afterState: {
        phone_number: result.assigned.phoneNumber,
        twilio_sid: result.twilioSid,
        billing_class: result.assigned.billingClass,
        area_code: phoneAreaCode(result.assigned.phoneNumber),
      },
      metadata: { authSource: admin.source },
    });
  } catch {
    // Purchase + assignment already succeeded; never fail on an audit hiccup.
  }

  return jsonOk({
    ok: true,
    phone_number: result.assigned.phoneNumber,
    twilio_phone_number_sid: result.twilioSid,
    billing_class: result.assigned.billingClass,
  });
}
