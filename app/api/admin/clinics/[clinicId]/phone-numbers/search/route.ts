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
  searchAvailableTollFreeNumbers,
} from "../../../../../../../lib/twilio/numbers";
import {
  buildLocalNumberSearchPlan,
  runLocalNumberSearchPlan,
} from "../../../../../../../lib/twilio/local-number-search-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// GET /api/admin/clinics/[clinicId]/phone-numbers/search
//
// Platform-admin-only, READ-ONLY Twilio available-number lookup. Local searches
// use the same smart fallback plan as onboarding by default. Never purchases.
// Clinic data is used only as defaults supplied by the caller — never as a
// hidden restriction.
//
// Query params (all optional except defaults below):
//   type=local|toll_free (default local)
//   area_code=NNN | postal_code=5-digit ZIP
//
// MVP defaults: country=US, Voice+SMS required, MMS not required, limit=10.
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

  // Area code (3-digit NANP)
  const areaCode = (q.get("area_code") ?? "").trim();
  if (areaCode && !/^\d{3}$/.test(areaCode)) {
    return jsonBadRequest("Area code must be a 3-digit number.");
  }

  const postalCode = (q.get("postal_code") ?? "").trim().slice(0, 16);

  const required = { voice: true, sms: true, mms: false };
  const limit = 10;
  const country = "US";

  try {
    if (type === "toll_free") {
      const numbers = await searchAvailableTollFreeNumbers({ country, required, limit });
      return jsonOk({
        ok: true,
        type,
        country,
        params: { type, country, required, limit },
        count: numbers.length,
        numbers,
        empty_reason: numbers.length === 0 ? "no_results" : null,
      });
    }

    const attempts = buildLocalNumberSearchPlan({
      country,
      mainPhone: clinic.main_phone,
      areaCode: areaCode || undefined,
      postalCode: postalCode || undefined,
      stateRegion: clinic.state_region,
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
        locality_filter_used: false,
        region: null,
        postal_code: postalCode || null,
        contains: null,
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
