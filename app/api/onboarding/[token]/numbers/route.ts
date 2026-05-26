import { NextResponse, type NextRequest } from "next/server";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../../lib/http/responses";
import { lookupSetupRequestByRawToken } from "../../../../../lib/onboarding/verify";
import { findClinicById } from "../../../../../lib/db/clinics";
import {
  searchAvailableLocalNumbers,
  phoneAreaCode,
} from "../../../../../lib/twilio/numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/onboarding/[token]/numbers?area_code=224
//
// Returns 5–10 Twilio local US numbers with Voice + SMS capability. Search
// is read-only; the route never purchases anything.

export async function GET(
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
      "Please complete the clinic setup form before searching for numbers.",
    );
  }
  const clinic = await findClinicById(setupRequest.clinic_id);
  if (!clinic) {
    return jsonError(404, "clinic_not_found", "Clinic not found.");
  }

  const url = new URL(req.url);
  const requestedAreaCode = url.searchParams.get("area_code")?.trim() ?? "";
  const areaCode =
    requestedAreaCode && /^\d{3}$/.test(requestedAreaCode)
      ? requestedAreaCode
      : clinic.main_phone
        ? phoneAreaCode(clinic.main_phone) ?? undefined
        : undefined;
  if (requestedAreaCode && !/^\d{3}$/.test(requestedAreaCode)) {
    return jsonBadRequest("Area code must be a 3-digit US area code.");
  }

  const numbers = await searchAvailableLocalNumbers({
    areaCode,
    limit: 10,
  });

  return jsonOk({ ok: true, area_code: areaCode ?? null, numbers });
}
