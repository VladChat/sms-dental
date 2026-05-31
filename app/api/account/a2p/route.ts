import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../lib/http/responses";
import { resolveAuthClinicAccess } from "../../../../lib/auth/access";
import { updateA2pInformation } from "../../../../lib/db/clinics";
import { isValidE164, normalizePhone } from "../../../../lib/phone/normalize";
import { BUSINESS_TYPES } from "../../../../lib/validation/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const A2pSchema = z.object({
  legal_business_name: z.string().trim().min(2).max(200),
  ein_tax_id: z.string().trim().min(2).max(40),
  business_type: z.enum(BUSINESS_TYPES),
  rep_first_name: z.string().trim().min(1).max(80),
  rep_last_name: z.string().trim().min(1).max(80),
  rep_email: z.string().trim().email().max(254),
  rep_phone: z.string().trim().min(7).max(40),
  authorized: z.boolean(),
});

// POST /api/account/a2p
//
// Authenticated owner/account save endpoint for SMS approval data.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess();
  if (!access.ok) {
    if (access.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You do not have access to this account.");
  }
  if (access.membership.role === "front_desk") {
    return jsonForbidden("Front desk users cannot edit SMS approval settings.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const parsed = A2pSchema.safeParse(body);
  if (!parsed.success) {
    const typeIssue = parsed.error.issues.find((i) => i.path.includes("business_type"));
    if (typeIssue) return jsonBadRequest("Please choose a business type.");
    return jsonBadRequest("Please complete all required approval fields.");
  }
  if (!parsed.data.authorized) {
    return jsonBadRequest(
      "Please confirm you have reviewed the information and authorize SMS approval for this business.",
    );
  }

  const repPhone = normalizePhone(parsed.data.rep_phone);
  if (!isValidE164(repPhone)) {
    return jsonBadRequest("Please enter a valid U.S. phone number for the representative.");
  }

  let clinic;
  try {
    clinic = await updateA2pInformation(access.clinic.id, {
      legalBusinessName: parsed.data.legal_business_name,
      einTaxId: parsed.data.ein_tax_id,
      businessType: parsed.data.business_type,
      repFirstName: parsed.data.rep_first_name,
      repLastName: parsed.data.rep_last_name,
      repEmail: parsed.data.rep_email,
      repPhone,
      authorized: parsed.data.authorized,
    });
  } catch {
    return jsonError(
      500,
      "save_failed",
      "We couldn't save your approval information. Please try again.",
    );
  }

  return jsonOk({
    ok: true,
    clinic_id: clinic.id,
    sms_status: clinic.sms_status,
    smsApproval: {
      legalBusinessName: clinic.legal_business_name ?? "",
      einTaxId: clinic.ein_tax_id ?? "",
      businessType: clinic.business_type ?? "",
      repFirstName: clinic.a2p_rep_first_name ?? "",
      repLastName: clinic.a2p_rep_last_name ?? "",
      repEmail: clinic.a2p_rep_email ?? "",
      repPhone: clinic.a2p_rep_phone ?? "",
      authorized: clinic.a2p_authorized,
      completed: clinic.a2p_info_completed,
    },
  });
}
