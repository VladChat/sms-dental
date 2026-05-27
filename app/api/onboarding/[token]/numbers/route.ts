import { NextResponse, type NextRequest } from "next/server";

import {
  jsonBadRequest,
  jsonError,
  jsonOk,
} from "../../../../../lib/http/responses";
import { lookupSetupRequestByRawToken } from "../../../../../lib/onboarding/verify";
import { findClinicById } from "../../../../../lib/db/clinics";
import {
  phoneAreaCode,
  searchAvailableLocalNumbers,
  searchAvailableTollFreeNumbers,
  isSupportedCountry,
  type SupportedCountry,
} from "../../../../../lib/twilio/numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/onboarding/[token]/numbers
//   ?type=local|toll_free     (default: local)
//   ?country=US|CA            (default: clinic country)
//   ?area_code=3-digit        (local only — overrides clinic default)
//
// Search is read-only. The route never purchases anything.

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
  const requestedType = (url.searchParams.get("type") ?? "local").trim();
  if (requestedType !== "local" && requestedType !== "toll_free") {
    return jsonBadRequest("type must be 'local' or 'toll_free'.");
  }

  // Country resolution: explicit query param wins; otherwise use the clinic's
  // stored country; otherwise fall back to US for legacy rows.
  const requestedCountry = url.searchParams.get("country")?.trim().toUpperCase() ?? "";
  let country: SupportedCountry;
  if (requestedCountry) {
    if (!isSupportedCountry(requestedCountry)) {
      return jsonError(
        400,
        "country_not_supported",
        "Not available yet. Contact us if your clinic is outside the United States or Canada.",
      );
    }
    country = requestedCountry;
  } else if (isSupportedCountry(clinic.country)) {
    country = clinic.country;
  } else {
    country = "US";
  }

  if (requestedType === "toll_free") {
    const numbers = await searchAvailableTollFreeNumbers({
      country,
      limit: 10,
    });
    return jsonOk({
      ok: true,
      type: "toll_free",
      country,
      area_code: null,
      numbers,
    });
  }

  // Local search: prefer the explicit area_code query, then clinic's stored
  // preferred area code, then derive from the clinic main phone.
  const requestedAreaCode = url.searchParams.get("area_code")?.trim() ?? "";
  if (requestedAreaCode && !/^\d{3}$/.test(requestedAreaCode)) {
    return jsonBadRequest("Area code must be a 3-digit area code.");
  }
  const storedPreferred = clinic.preferred_area_code ?? "";
  const phoneDerived = clinic.main_phone ? phoneAreaCode(clinic.main_phone) : null;
  const areaCode =
    (requestedAreaCode || storedPreferred || phoneDerived || "").trim() ||
    undefined;

  const numbers = await searchAvailableLocalNumbers({
    country,
    areaCode,
    inRegion: clinic.state_region ?? undefined,
    inPostalCode: clinic.postal_code ?? undefined,
    limit: 10,
  });

  return jsonOk({
    ok: true,
    type: "local",
    country,
    area_code: areaCode ?? null,
    numbers,
  });
}
