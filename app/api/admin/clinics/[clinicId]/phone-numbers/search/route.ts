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
  searchAvailableTollFreeNumbers,
  type SupportedCountry,
} from "../../../../../../../lib/twilio/numbers";
import {
  buildLocalNumberSearchPlan,
  runLocalNumberSearchPlan,
} from "../../../../../../../lib/twilio/local-number-search-plan";

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
// Platform-admin-only, READ-ONLY Twilio available-number lookup. Local searches
// use the same smart fallback plan as onboarding by default. Never purchases.
// Clinic data is used only as defaults supplied by the caller — never as a
// hidden restriction.
//
// Query params (all optional except defaults below):
//   type=local|toll_free (default local)
//   country=US|CA (default clinic country, else US; local smart search is US-only)
//   area_code=NNN | locality metadata | region (2-letter) | postal_code
//   contains=digits/* pattern
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

  // Capabilities (default Voice + SMS)
  const required = {
    voice: parseBool(q.get("voice"), true),
    sms: parseBool(q.get("sms"), true),
    mms: parseBool(q.get("mms"), false),
  };

  // Limit
  let limit = Number(q.get("limit") ?? "10");
  if (!ALLOWED_LIMITS.includes(limit)) limit = 10;

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

    if (country !== "US") {
      return jsonError(400, "country_not_supported", "Smart local number search is currently available for U.S. numbers only.");
    }

    const attempts = buildLocalNumberSearchPlan({
      country: "US",
      mainPhone: clinic.main_phone,
      areaCode: areaCode || undefined,
      postalCode: postalCode || undefined,
      stateRegion: region || undefined,
      contains: contains || undefined,
      required,
      limit,
    });
    const result = await runLocalNumberSearchPlan(attempts);
    const exactAttempt = attempts[0]?.label ?? null;
    const fallbackUsed = Boolean(result.attemptLabel && exactAttempt && result.attemptLabel !== exactAttempt);

    return jsonOk({
      ok: true,
      type,
      country: "US",
      search_mode: "smart_fallback",
      attempt_label: result.attemptLabel,
      attempted_labels: attempts.map((a) => a.label),
      fallback_used: fallbackUsed,
      fallback_message: fallbackMessage(result.attemptLabel, exactAttempt),
      params: {
        type,
        country: "US",
        area_code: areaCode || null,
        locality: locality || null,
        locality_filter_used: false,
        region: region || null,
        postal_code: postalCode || null,
        contains: contains || null,
        distance: radiusDistance(result.attemptLabel),
        required,
        limit,
      },
      count: result.numbers.length,
      numbers: result.numbers,
      empty_reason: result.numbers.length === 0 ? "no_results_after_fallback" : null,
    });
  } catch {
    return jsonError(502, "search_failed", "Could not search available numbers. Please adjust filters and try again.");
  }
}

function radiusDistance(attemptLabel: string | null): number | null {
  const match = /^zip_radius_(\d+)_miles$/.exec(attemptLabel ?? "");
  return match ? Number(match[1]) : null;
}

function fallbackMessage(attemptLabel: string | null, exactAttempt: string | null): string | null {
  if (!attemptLabel || !exactAttempt || attemptLabel === exactAttempt) return null;
  if (exactAttempt === "area_code_and_zip") {
    if (attemptLabel === "zip_only") {
      return "No exact ZIP + area-code match found. Showing ZIP matches.";
    }
    if (attemptLabel === "area_code_only") {
      return "No exact ZIP + area-code match found. Showing area-code matches.";
    }
    if (attemptLabel.startsWith("zip_radius_")) {
      return "No exact ZIP + area-code match found. Showing nearby ZIP-radius matches.";
    }
    if (attemptLabel === "state_region") {
      return "No exact ZIP + area-code match found. Showing state matches.";
    }
  }
  if (exactAttempt === "zip_only" && attemptLabel === "state_region") {
    return "No ZIP-only match found. Showing state matches.";
  }
  return "No exact match found. Showing the best fallback matches.";
}
