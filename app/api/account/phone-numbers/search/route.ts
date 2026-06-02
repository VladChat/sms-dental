import { NextResponse, type NextRequest } from "next/server";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../../lib/http/responses";
import { resolveAuthClinicAccess } from "../../../../../lib/auth/access";
import { findClinicById, type ClinicOnboardingRow } from "../../../../../lib/db/clinics";
import { readAccountSessionToken } from "../../../../../lib/onboarding/account-session";
import { lookupSetupRequestByRawToken } from "../../../../../lib/onboarding/verify";
import { phoneAreaCode } from "../../../../../lib/twilio/numbers";
import {
  buildLocalNumberSearchPlan,
  runLocalNumberSearchPlan,
} from "../../../../../lib/twilio/local-number-search-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/account/phone-numbers/search
//
// Owner/admin account route. Searches available local numbers using only saved
// clinic data. This is read-only: never purchases, reserves, assigns, releases,
// or stores a phone number.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess(req);
  let clinic: ClinicOnboardingRow | null = null;

  if (access.ok) {
    if (access.membership.role === "front_desk") {
      return jsonForbidden("Front desk users cannot search account phone number options.");
    }
    clinic = access.clinic;
  } else {
    const fallback = await resolveLegacyClinic();
    if (!fallback.ok) {
      if (access.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
      return jsonForbidden("You do not have access to this account.");
    }
    clinic = fallback.clinic;
  }

  const country = "US";
  const mainPhone = clinic.main_phone;
  const areaCode = mainPhone ? phoneAreaCode(mainPhone) : null;
  const postalCode = clinic.postal_code;
  const required = { voice: true, sms: true, mms: false };
  const limit = 10;

  try {
    const attempts = buildLocalNumberSearchPlan({
      country,
      mainPhone,
      areaCode,
      postalCode,
      stateRegion: clinic.state_region,
      required,
      limit,
    });
    const result = await runLocalNumberSearchPlan(attempts);
    const exactAttempt = attempts[0]?.label ?? null;

    return jsonOk({
      ok: true,
      search_mode: "smart_fallback",
      attempt_label: result.attemptLabel,
      attempted_labels: attempts.map((a) => a.label),
      fallback_message: fallbackMessage(result.attemptLabel, exactAttempt),
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
  | { ok: true; clinic: ClinicOnboardingRow }
  | { ok: false }
> {
  const token = await readAccountSessionToken();
  if (!token) return { ok: false };

  const lookup = await lookupSetupRequestByRawToken(token);
  if (!lookup.ok || !lookup.setupRequest.clinic_id) return { ok: false };

  const clinic = await findClinicById(lookup.setupRequest.clinic_id).catch(() => null);
  if (!clinic) return { ok: false };

  return { ok: true, clinic };
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
      return "No exact ZIP + area-code match found. Showing nearby matches.";
    }
    if (attemptLabel === "state_region") {
      return "No exact ZIP + area-code match found. Showing state matches.";
    }
  }
  if (exactAttempt === "zip_only" && attemptLabel === "state_region") {
    return "No ZIP match found. Showing state matches.";
  }
  return "No exact match found. Showing the best available local numbers.";
}
