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
import { isValidE164 } from "../../../../../../../lib/phone/normalize";
import {
  isSupportedCountry,
  searchAvailableLocalNumbers,
  searchAvailableTollFreeNumbers,
  type SupportedCountry,
} from "../../../../../../../lib/twilio/numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const ALLOWED_LIMITS = [10, 20, 50];

function parseBool(v: string | null, fallback: boolean): boolean {
  if (v === null) return fallback;
  return v === "true" || v === "1";
}

// GET /api/admin/clinics/[clinicId]/phone-numbers/search
//
// Platform-admin-only, READ-ONLY Twilio available-number lookup with manual
// filters (mirrors Twilio Console "Buy a number"). Never purchases. Clinic data
// is used only as defaults supplied by the caller — never as a hidden restriction.
//
// Query params (all optional except defaults below):
//   type=local|toll_free (default local)
//   country=US|CA (default clinic country, else US)
//   area_code=NNN | locality | region (2-letter) | postal_code
//   contains=digits/* pattern | distance=miles (geo radius near clinic phone)
//   voice|sms|mms = true|false (capability filters; default voice+sms)
//   limit = 10|20|50 (default 10)
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

  const q = new URL(req.url).searchParams;

  const type = (q.get("type") ?? "local").trim();
  if (type !== "local" && type !== "toll_free") {
    return jsonBadRequest("type must be 'local' or 'toll_free'.");
  }

  // Country
  const requestedCountry = q.get("country")?.trim().toUpperCase() ?? "";
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

  // Area code (3-digit NANP)
  const areaCode = (q.get("area_code") ?? "").trim();
  if (areaCode && !/^\d{3}$/.test(areaCode)) {
    return jsonBadRequest("Area code must be a 3-digit number.");
  }

  // Region (2-letter for US/CA)
  const regionRaw = (q.get("region") ?? "").trim();
  if (regionRaw && !/^[A-Za-z]{2}$/.test(regionRaw)) {
    return jsonBadRequest("State/region must be a 2-letter code (e.g. IL).");
  }
  const region = regionRaw ? regionRaw.toUpperCase() : "";

  const locality = (q.get("locality") ?? "").trim().slice(0, 80);
  const postalCode = (q.get("postal_code") ?? "").trim().slice(0, 16);

  // Contains pattern: digits and `*` only.
  const containsRaw = (q.get("contains") ?? "").trim();
  const contains = containsRaw.replace(/[^\d*]/g, "").slice(0, 12);
  if (containsRaw && !contains) {
    return jsonBadRequest("Pattern must contain digits (and optional * wildcards).");
  }

  // Distance (miles) — only used as a geo radius near the clinic phone.
  const distanceRaw = (q.get("distance") ?? "").trim();
  let distance: number | undefined;
  if (distanceRaw) {
    const n = Number(distanceRaw);
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      return jsonBadRequest("Distance must be between 1 and 500 miles.");
    }
    distance = Math.floor(n);
  }

  // Capabilities (default Voice + SMS)
  const required = {
    voice: parseBool(q.get("voice"), true),
    sms: parseBool(q.get("sms"), true),
    mms: parseBool(q.get("mms"), false),
  };

  // Limit
  let limit = Number(q.get("limit") ?? "10");
  if (!ALLOWED_LIMITS.includes(limit)) limit = 10;

  // Geo radius applies only when no explicit local filters are set and the clinic
  // has a usable phone to anchor on.
  const mainPhone = clinic.main_phone ?? "";
  const canNear =
    type === "local" &&
    Boolean(distance) &&
    !areaCode && !region && !postalCode && !locality &&
    isValidE164(mainPhone);

  try {
    if (type === "toll_free") {
      const numbers = await searchAvailableTollFreeNumbers({ country, contains: contains || undefined, required, limit });
      return jsonOk({
        ok: true,
        type,
        country,
        params: { type, country, contains: contains || null, required, limit },
        count: numbers.length,
        numbers,
        empty_reason: numbers.length === 0 ? "no_results" : null,
      });
    }

    const numbers = await searchAvailableLocalNumbers({
      country,
      areaCode: areaCode || undefined,
      contains: contains || undefined,
      inLocality: locality || undefined,
      inRegion: region || undefined,
      inPostalCode: postalCode || undefined,
      nearNumber: canNear ? mainPhone : undefined,
      distance: canNear ? distance : undefined,
      required,
      limit,
    });

    return jsonOk({
      ok: true,
      type,
      country,
      params: {
        type,
        country,
        area_code: areaCode || null,
        locality: locality || null,
        region: region || null,
        postal_code: postalCode || null,
        contains: contains || null,
        distance: canNear ? distance : null,
        required,
        limit,
      },
      count: numbers.length,
      numbers,
      empty_reason: numbers.length === 0 ? "no_results" : null,
    });
  } catch {
    return jsonError(502, "search_failed", "Could not search available numbers. Please adjust filters and try again.");
  }
}
