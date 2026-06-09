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
  assignExistingTwilioNumber,
  listUnassignedTwilioInventory,
  type AssignExistingErrorCode,
} from "../../../../../../../lib/phone-numbers/assign-existing-twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const AssignSchema = z.object({
  twilio_phone_number_sid: z.string().trim().regex(/^PN[A-Za-z0-9]{32}$/u, "invalid Twilio SID"),
});

const ERROR_STATUS: Record<AssignExistingErrorCode, number> = {
  clinic_not_found: 404,
  not_found_in_twilio: 409,
  local_not_supported: 422,
  missing_capability: 422,
  already_assigned: 409,
  previously_removed: 409,
  clinic_has_toll_free: 409,
  twilio_configuration_failed: 502,
  assign_failed: 502,
};

// GET /api/admin/clinics/[clinicId]/phone-numbers/existing
//
// Platform-admin-only, READ-ONLY. Lists Twilio numbers owned by our account that
// are not currently mapped to any clinic row in an active/scheduled state. The
// clinicId only scopes admin context; the inventory itself is account-wide.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const admin = await resolvePlatformAdmin(req);
  if (!admin.ok) {
    if (admin.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You are not authorized for platform admin access.");
  }

  const { clinicId } = await ctx.params;
  if (!UUID_RE.test(clinicId)) return jsonError(404, "not_found", "Clinic not found.");
  const clinic = await findClinicById(clinicId).catch(() => null);
  if (!clinic) return jsonError(404, "not_found", "Clinic not found.");

  try {
    const { items } = await listUnassignedTwilioInventory();
    return jsonOk({ ok: true, count: items.length, numbers: items });
  } catch {
    return jsonError(
      502,
      "inventory_failed",
      "Could not load Twilio numbers from the provider. Please try again.",
    );
  }
}

// POST /api/admin/clinics/[clinicId]/phone-numbers/existing
//
// Platform-admin-only. Assigns an existing, already-owned Twilio number to this
// clinic. The server re-fetches the number by SID, re-checks the DB, decides the
// number type + billing class, and (only if needed) points the number's webhooks
// at the standard app endpoints. It never buys or releases a Twilio number.
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
  if (!UUID_RE.test(clinicId)) return jsonError(404, "not_found", "Clinic not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const parsed = AssignSchema.safeParse(body);
  if (!parsed.success) {
    return jsonBadRequest("Select a number from the list to continue.");
  }

  const result = await assignExistingTwilioNumber({
    clinicId,
    twilioSid: parsed.data.twilio_phone_number_sid,
    actorProfileId: admin.userId,
    actorEmail: admin.email,
  });

  if (!result.ok) {
    return jsonError(ERROR_STATUS[result.error], result.error, result.message);
  }

  // Audit: phone number + SID + billing class + area code only. No secrets.
  try {
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "clinic.phone_number.assign_existing",
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      afterState: {
        phone_number: result.phoneNumber,
        twilio_sid: result.twilioSid,
        number_type: result.numberType,
        billing_class: result.billingClass,
        area_code: phoneAreaCode(result.phoneNumber),
        reconfigured: result.reconfigured,
      },
      metadata: { authSource: admin.source },
    });
  } catch {
    // Assignment already succeeded; never fail on an audit hiccup.
  }

  return jsonOk({
    ok: true,
    phone_number: result.phoneNumber,
    twilio_phone_number_sid: result.twilioSid,
    number_type: result.numberType,
    billing_class: result.billingClass,
    reconfigured: result.reconfigured,
  });
}
