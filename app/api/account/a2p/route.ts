import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  firstValidationMessage,
  formatEinForDisplay,
  normalizeBusinessTypeForStorage,
  normalizeRepresentativePhone,
  validateBusinessType,
  validateEin,
  validateLegalBusinessName,
  validateRepresentativeEmail,
  validateRepresentativeName,
  validateRepresentativePhone,
  validateRepresentativeTitle,
} from "../../../../lib/a2p/validation";
import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../lib/http/responses";
import { resolveAuthClinicAccess } from "../../../../lib/auth/access";
import { updateA2pInformation } from "../../../../lib/db/clinics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const A2pSchema = z.object({
  legal_business_name: z.string().trim().min(2).max(200),
  ein_tax_id: z.string().trim().min(2).max(40),
  business_type: z.string().trim().min(1).max(80),
  rep_first_name: z.string().trim().min(1).max(80),
  rep_last_name: z.string().trim().min(1).max(80),
  rep_business_title: z.string().trim().min(1).max(80),
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
    return jsonBadRequest("Please complete all required approval fields.");
  }
  if (!parsed.data.authorized) {
    return jsonBadRequest(
      "Please confirm you have reviewed the information and authorize SMS approval for this business.",
    );
  }

  const validations = [
    validateLegalBusinessName(parsed.data.legal_business_name),
    validateEin(parsed.data.ein_tax_id),
    validateBusinessType(parsed.data.business_type),
    validateRepresentativeName(parsed.data.rep_first_name, "rep_first_name"),
    validateRepresentativeName(parsed.data.rep_last_name, "rep_last_name"),
    validateRepresentativeTitle(parsed.data.rep_business_title),
    validateRepresentativeEmail(parsed.data.rep_email),
    validateRepresentativePhone(parsed.data.rep_phone),
  ].filter((result): result is NonNullable<typeof result> => Boolean(result));
  if (validations.length > 0) {
    return jsonBadRequest(firstValidationMessage(validations) ?? "Please correct the approval fields and try again.");
  }
  const repPhone = normalizeRepresentativePhone(parsed.data.rep_phone);
  const einTaxId = formatEinForDisplay(parsed.data.ein_tax_id);
  const businessType = normalizeBusinessTypeForStorage(parsed.data.business_type);
  if (!businessType) {
    return jsonError(400, "A2P_BUSINESS_TYPE_UNSUPPORTED", "Choose the exact legal business structure before A2P submission.");
  }

  let clinic;
  try {
    clinic = await updateA2pInformation(access.clinic.id, {
      legalBusinessName: parsed.data.legal_business_name,
      einTaxId,
      businessType,
      repFirstName: parsed.data.rep_first_name,
      repLastName: parsed.data.rep_last_name,
      repBusinessTitle: parsed.data.rep_business_title,
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
      repBusinessTitle: clinic.a2p_rep_business_title ?? "",
      repEmail: clinic.a2p_rep_email ?? "",
      repPhone: clinic.a2p_rep_phone ?? "",
      authorized: clinic.a2p_authorized,
      completed: clinic.a2p_info_completed,
    },
  });
}
