import { NextResponse, type NextRequest } from "next/server";

import {
  jsonBadRequest,
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../../lib/http/responses";
import { resolveAuthClinicAccess } from "../../../../../lib/auth/access";
import { findClinicById } from "../../../../../lib/db/clinics";
import { readAccountSessionToken } from "../../../../../lib/onboarding/account-session";
import { lookupSetupRequestByRawToken } from "../../../../../lib/onboarding/verify";
import {
  buildLocalNumberSearchPlan,
  runLocalNumberSearchPlan,
} from "../../../../../lib/twilio/local-number-search-plan";
import { searchAvailableTollFreeNumbers } from "../../../../../lib/twilio/numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/account/phone-numbers/search?type=local|toll_free
//
// Owner/admin account route. Read-only: never purchases, reserves, assigns,
// releases, or stores a phone number. `type` is REQUIRED and selects the search:
//   - toll_free: simple toll-free search (Voice + SMS). No area code / ZIP.
//   - local:     smart local search by area code / ZIP with broad fallback.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess(req);

  if (access.ok) {
    if (access.membership.role === "front_desk") {
      return jsonForbidden("Front desk users cannot search account phone number options.");
    }
  } else {
    const fallback = await resolveLegacyClinic();
    if (!fallback.ok) {
      if (access.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
      return jsonForbidden("You do not have access to this account.");
    }
  }

  const country = "US";
  const numberType = req.nextUrl.searchParams.get("type");
  if (numberType !== "local" && numberType !== "toll_free") {
    return jsonBadRequest("A valid number type (local or toll_free) is required.");
  }

  // Toll-free: no area code / ZIP. Voice + SMS capable only.
  if (numberType === "toll_free") {
    try {
      const numbers = await searchAvailableTollFreeNumbers({
        country,
        required: { voice: true, sms: true, mms: false },
        limit: 5,
      });
      return jsonOk({
        ok: true,
        type: "toll_free",
        search_mode: "toll_free",
        count: numbers.length,
        numbers,
        fallback_message:
          numbers.length === 0
            ? "No toll-free numbers are available right now. Please try again shortly."
            : "Showing available toll-free numbers.",
        empty_reason: numbers.length === 0 ? "no_toll_free_results" : null,
      });
    } catch {
      return jsonError(
        502,
        "search_failed",
        "Could not search toll-free numbers. Please try again.",
      );
    }
  }

  const requestedAreaCode = parseOptionalDigitsParam(
    req.nextUrl.searchParams.get("area_code"),
    3,
    "Area code",
  );
  if (!requestedAreaCode.ok) return jsonBadRequest(requestedAreaCode.message);
  const requestedPostalCode = parseOptionalDigitsParam(
    req.nextUrl.searchParams.get("postal_code"),
    5,
    "ZIP code",
  );
  if (!requestedPostalCode.ok) return jsonBadRequest(requestedPostalCode.message);

  const areaCode = requestedAreaCode.value;
  const postalCode = requestedPostalCode.value;
  const required = { voice: true, sms: true, mms: false };
  const limit = 5;

  try {
    const attempts = buildLocalNumberSearchPlan({
      country,
      mainPhone: null,
      areaCode,
      postalCode,
      stateRegion: null,
      required,
      limit,
      includeBroadFallback: true,
    });
    const result = await runLocalNumberSearchPlan(attempts);

    return jsonOk({
      ok: true,
      type: "local",
      search_mode: "smart_fallback",
      attempt_label: result.attemptLabel,
      attempted_labels: attempts.map((a) => a.label),
      fallback_message: searchStatusMessage({
        areaCode,
        postalCode,
        attemptLabel: result.attemptLabel,
        count: result.numbers.length,
      }),
      params: {
        area_code: areaCode,
        postal_code: postalCode,
      },
      count: result.numbers.length,
      numbers: result.numbers,
      empty_reason: result.numbers.length === 0 ? "no_results_after_fallback" : null,
    });
  } catch {
    return jsonError(
      502,
      "search_failed",
      "Could not search local numbers. Please try again.",
    );
  }
}

async function resolveLegacyClinic(): Promise<
  | { ok: true }
  | { ok: false }
> {
  const token = await readAccountSessionToken();
  if (!token) return { ok: false };

  const lookup = await lookupSetupRequestByRawToken(token);
  if (!lookup.ok || !lookup.setupRequest.clinic_id) return { ok: false };

  const clinic = await findClinicById(lookup.setupRequest.clinic_id).catch(() => null);
  if (!clinic) return { ok: false };

  return { ok: true };
}

function searchStatusMessage({
  areaCode,
  postalCode,
  attemptLabel,
  count,
}: {
  areaCode: string | null;
  postalCode: string | null;
  attemptLabel: string | null;
  count: number;
}): string {
  if (count === 0) {
    return "No available local numbers found. Try a different area code or ZIP.";
  }

  const hasAreaCode = Boolean(areaCode);
  const hasPostalCode = Boolean(postalCode);

  if (hasAreaCode && hasPostalCode) {
    if (attemptLabel === "area_code_and_zip") return "Exact match for ZIP and area code.";
    if (attemptLabel === "zip_only") {
      return "No exact ZIP + area-code match found. Showing ZIP matches.";
    }
    if (attemptLabel === "area_code_only") {
      return "No exact ZIP + area-code match found. Showing area-code matches.";
    }
    if (attemptLabel === "local_default") {
      return "No ZIP or area-code matches found. Showing available U.S. local numbers. Enter a different area code or ZIP to narrow results.";
    }
  }

  if (hasPostalCode && !hasAreaCode) {
    if (attemptLabel === "zip_only") return "Showing ZIP matches.";
    if (attemptLabel === "local_default") {
      return "No ZIP match found. Showing available U.S. local numbers. Enter a different ZIP or area code to narrow results.";
    }
  }

  if (hasAreaCode && !hasPostalCode) {
    if (attemptLabel === "area_code_only") return "Showing area-code matches.";
    if (attemptLabel === "local_default") {
      return "No area-code match found. Showing available U.S. local numbers. Enter a different area code or ZIP to narrow results.";
    }
  }

  if (!hasAreaCode && !hasPostalCode && attemptLabel === "local_default") {
    return "Showing available U.S. local numbers. Enter an area code or ZIP to narrow results.";
  }

  return "Showing available local numbers.";
}

function parseOptionalDigitsParam(
  value: string | null,
  length: number,
  label: string,
):
  | { ok: true; value: string | null }
  | { ok: false; message: string } {
  if (value === null || value.trim() === "") return { ok: true, value: null };
  const trimmed = value.trim();
  if (!new RegExp(`^\\d{${length}}$`).test(trimmed)) {
    return { ok: false, message: `${label} must be exactly ${length} digits.` };
  }
  return { ok: true, value: trimmed };
}
