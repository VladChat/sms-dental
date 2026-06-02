import { NextResponse, type NextRequest } from "next/server";

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
  isSupportedCountry,
  phoneAreaCode,
  searchAvailableLocalNumbers,
  searchAvailableTollFreeNumbers,
  type SupportedCountry,
} from "../../../../../../../lib/twilio/numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// GET /api/admin/clinics/[clinicId]/phone-numbers/search
//   ?type=local|toll_free   (default local)
//   ?country=US|CA          (default clinic country)
//   ?area_code=3-digit      (local only — overrides clinic-derived hint)
//
// Platform-admin-only, READ-ONLY Twilio available-number lookup. Never purchases.
// Returns only Voice + SMS capable numbers (the helper filters those). Search uses
// clinic-derived hints (area code from clinic preferred/main phone, then region /
// postal) — never any hardcoded area code.
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
  if (!UUID_RE.test(clinicId)) {
    return jsonError(404, "not_found", "Clinic not found.");
  }
  const clinic = await findClinicById(clinicId).catch(() => null);
  if (!clinic) return jsonError(404, "not_found", "Clinic not found.");

  const url = new URL(req.url);
  const requestedType = (url.searchParams.get("type") ?? "local").trim();
  if (requestedType !== "local" && requestedType !== "toll_free") {
    return jsonBadRequest("type must be 'local' or 'toll_free'.");
  }

  const requestedCountry = url.searchParams.get("country")?.trim().toUpperCase() ?? "";
  let country: SupportedCountry;
  if (requestedCountry) {
    if (!isSupportedCountry(requestedCountry)) {
      return jsonError(400, "country_not_supported", "Only US and CA are supported right now.");
    }
    country = requestedCountry;
  } else if (isSupportedCountry(clinic.country)) {
    country = clinic.country;
  } else {
    country = "US";
  }

  try {
    if (requestedType === "toll_free") {
      const numbers = await searchAvailableTollFreeNumbers({ country, limit: 10 });
      return jsonOk({ ok: true, type: "toll_free", country, area_code: null, numbers });
    }

    const requestedAreaCode = url.searchParams.get("area_code")?.trim() ?? "";
    if (requestedAreaCode && !/^\d{3}$/.test(requestedAreaCode)) {
      return jsonBadRequest("Area code must be a 3-digit area code.");
    }
    const storedPreferred = clinic.preferred_area_code ?? "";
    const phoneDerived = clinic.main_phone ? phoneAreaCode(clinic.main_phone) : null;
    const areaCode = (requestedAreaCode || storedPreferred || phoneDerived || "").trim() || undefined;

    const numbers = await searchAvailableLocalNumbers({
      country,
      areaCode,
      inRegion: clinic.state_region ?? undefined,
      inPostalCode: clinic.postal_code ?? undefined,
      limit: 10,
    });

    return jsonOk({ ok: true, type: "local", country, area_code: areaCode ?? null, numbers });
  } catch {
    // Twilio lookup failure (e.g. credentials/config) — never leak details.
    return jsonError(502, "search_failed", "Could not search available numbers. Please try again.");
  }
}
