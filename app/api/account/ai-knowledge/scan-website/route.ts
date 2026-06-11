import type { NextResponse } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../lib/http/responses";
import { requireOwnerAdminAccess } from "../../../../../lib/auth/owner-admin";
import { getClinicAiFacts } from "../../../../../lib/db/ai-knowledge";
import { runWebsiteScan } from "../../../../../lib/ai-knowledge/website-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fetching up to 8 pages with an 8s timeout each can exceed the default.
export const maxDuration = 90;

// POST /api/account/ai-knowledge/scan-website
//
// Loads basic information from the clinic's OWN website (clinics.website —
// never a client-provided URL) and stores draft facts the owner must review.
// Same-site homepage variants + same-origin follow-up fetches only, hard
// page/byte limits, no AI provider calls, no raw HTML stored.
//
// Owner-facing failures are NEUTRAL: an unreachable or invalid website returns
// `loaded: false` (the UI shows "No website information was loaded"), never a
// technical error. The technical reason stays in the scan run log + server log.
export async function POST(): Promise<NextResponse> {
  const result = await requireOwnerAdminAccess("Front desk users cannot manage AI knowledge.");
  if (!result.allowed) return result.response;
  const { access } = result;

  try {
    const outcome = await runWebsiteScan({
      clinicId: access.clinic.id,
      website: access.clinic.website,
      businessProfile: {
        mainPhone: access.clinic.main_phone,
        postalCode: access.clinic.postal_code,
      },
    });
    if (!outcome.ok && outcome.reason === "no_website") {
      // The UI hides the button without a website; this is a stale-state guard.
      return jsonBadRequest("Add a website in Business profile first.");
    }
    if (!outcome.ok) {
      // invalid_website / fetch_failed → neutral no-info state for the owner.
      console.warn(
        `ai-knowledge scan returned no info (clinic ${access.clinic.id}): ${outcome.reason}`,
      );
      const facts = await getClinicAiFacts(access.clinic.id);
      return jsonOk({
        ok: true,
        scan: { loaded: false, factsFound: 0, reviewNotes: null },
        facts,
      });
    }
    const facts = await getClinicAiFacts(access.clinic.id);
    return jsonOk({
      ok: true,
      scan: {
        loaded: outcome.factsFound > 0,
        factsFound: outcome.factsFound,
        reviewNotes: outcome.reviewNotes,
      },
      facts,
    });
  } catch {
    return jsonError(500, "scan_failed", "Something went wrong. Please try again.");
  }
}
