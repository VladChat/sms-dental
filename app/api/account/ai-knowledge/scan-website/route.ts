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
// Scans the clinic's OWN website (clinics.website — never a client-provided
// URL) and stores draft facts the owner must review. Same-origin fetch only,
// hard page/byte limits, no AI provider calls, no raw HTML stored.
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
    if (!outcome.ok) {
      if (outcome.reason === "no_website") {
        return jsonBadRequest("Add a website in Business profile first.");
      }
      if (outcome.reason === "invalid_website") {
        return jsonBadRequest(
          "Your Business profile website doesn't look like a public website address. Please check it.",
        );
      }
      return jsonError(502, "scan_failed", "We couldn't load your website. Please try again later.");
    }
    const facts = await getClinicAiFacts(access.clinic.id);
    return jsonOk({
      ok: true,
      scan: {
        pagesScanned: outcome.pagesScanned,
        factsFound: outcome.factsFound,
        reviewNotes: outcome.reviewNotes,
      },
      facts,
    });
  } catch {
    return jsonError(500, "scan_failed", "We couldn't scan your website. Please try again.");
  }
}
