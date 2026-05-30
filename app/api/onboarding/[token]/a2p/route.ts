import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../../lib/http/responses";
import { lookupSetupRequestByRawToken } from "../../../../../lib/onboarding/verify";
import { updateA2pInformation } from "../../../../../lib/db/clinics";
import { isValidE164, normalizePhone } from "../../../../../lib/phone/normalize";
import { BUSINESS_TYPES } from "../../../../../lib/validation/url";

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
  business_type: z.enum(BUSINESS_TYPES),
  rep_first_name: z.string().trim().min(1).max(80),
  rep_last_name: z.string().trim().min(1).max(80),
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

  // Persist. A DB failure must surface as a structured error, never a silent
  // "success" that disappears on reload.
  let clinic;
  try {
    clinic = await updateA2pInformation(setupRequest.clinic_id, {
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
      repEmail: clinic.a2p_rep_email ?? "",
      repPhone: clinic.a2p_rep_phone ?? "",
      authorized: clinic.a2p_authorized,
      completed: clinic.a2p_info_completed,
    },
  });
}
