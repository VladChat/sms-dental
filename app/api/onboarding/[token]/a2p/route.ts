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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/onboarding/[token]/a2p
//
// Saves the A2P Approval Information card: the authorized representative
// details required for future carrier submission. This ONLY stores data
// locally for later submission. It does NOT submit anything to Twilio,
// does NOT enable live SMS (sms_recovery_enabled stays false), and does
// NOT send any patient SMS. Saving advances the displayed SMS status to
// "waiting_for_approval".

const A2pSchema = z.object({
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
    return jsonBadRequest("Please complete all required representative fields.");
  }
  if (!parsed.data.authorized) {
    return jsonBadRequest(
      "Please confirm you are authorized to approve SMS setup for this business.",
    );
  }

  const repPhone = normalizePhone(parsed.data.rep_phone);
  if (!isValidE164(repPhone)) {
    return jsonBadRequest("Please enter a valid U.S. phone number for the representative.");
  }

  const clinic = await updateA2pInformation(setupRequest.clinic_id, {
    repFirstName: parsed.data.rep_first_name,
    repLastName: parsed.data.rep_last_name,
    repEmail: parsed.data.rep_email,
    repPhone,
    authorized: parsed.data.authorized,
  });

  return jsonOk({ ok: true, clinic_id: clinic.id, sms_status: clinic.sms_status });
}
