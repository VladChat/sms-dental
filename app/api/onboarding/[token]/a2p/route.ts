import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  firstValidationMessage,
  formatEinForDisplay,
  normalizeRepresentativePhone,
  validateBusinessType,
  validateEin,
  validateLegalBusinessName,
  validateRepresentativeEmail,
  validateRepresentativeName,
  validateRepresentativePhone,
  validateRepresentativeTitle,
} from "../../../../../lib/a2p/validation";
import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../../lib/http/responses";
import { lookupSetupRequestByRawToken } from "../../../../../lib/onboarding/verify";
import { updateA2pInformation } from "../../../../../lib/db/clinics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/onboarding/[token]/a2p
//
// Saves the SMS Approval Information card: the legal/registration fields
// (legal business name, EIN, business type) plus the authorized representative
// details required for future carrier submission. This ONLY stores data
// locally for later submission. It does NOT submit anything to Twilio,
// does NOT enable live SMS (sms_recovery_enabled stays false), and does
// NOT send any patient SMS. Saving advances the displayed SMS status to
// "waiting_for_approval". Returns the persisted values.

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
      "Please create your office profile first.",
    );
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

  // Persist. A DB failure must surface as a structured error, never a silent
  // "success" that disappears on reload.
  let clinic;
  try {
    clinic = await updateA2pInformation(setupRequest.clinic_id, {
      legalBusinessName: parsed.data.legal_business_name,
      einTaxId,
      businessType: parsed.data.business_type,
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

  // Echo persisted values so the client reconciles its state to the DB.
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
