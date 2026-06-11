import { type NextRequest, type NextResponse } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../../../lib/http/responses";
import { requirePlatformAdminClinic } from "../../../../../../../lib/auth/admin-clinic";
import { getClinicAiFacts } from "../../../../../../../lib/db/ai-knowledge";
import { runWebsiteScan } from "../../../../../../../lib/ai-knowledge/website-scan";
import { auditAiKnowledgeScan } from "../../../../../../../lib/ai-knowledge/admin-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

// POST /api/admin/clinics/[clinicId]/ai-knowledge/scan-website
//
// Same safe same-origin website scan as the owner endpoint, but scoped to the
// URL clinic and guarded by platform admin. Reads the clinic's own website from
// the DB row (never a client URL). No AI provider, no raw HTML stored.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const { clinicId } = await ctx.params;
  const guard = await requirePlatformAdminClinic(req, clinicId);
  if (!guard.ok) return guard.response;
  const clinic = guard.clinic;

  try {
    const outcome = await runWebsiteScan({
      clinicId,
      website: clinic.website,
      businessProfile: {
        mainPhone: clinic.main_phone,
        postalCode: clinic.postal_code,
      },
    });
    if (!outcome.ok && outcome.reason === "no_website") {
      return jsonBadRequest("Add a website in Business profile first.");
    }
    if (!outcome.ok) {
      console.warn(`admin ai-knowledge scan returned no info (clinic ${clinicId}): ${outcome.reason}`);
      await auditAiKnowledgeScan(guard.admin, clinicId, 0, false);
      const facts = await getClinicAiFacts(clinicId);
      return jsonOk({ ok: true, scan: { loaded: false, factsFound: 0, reviewNotes: null }, facts });
    }
    const loaded = outcome.factsFound > 0;
    await auditAiKnowledgeScan(guard.admin, clinicId, outcome.factsFound, loaded);
    const facts = await getClinicAiFacts(clinicId);
    return jsonOk({
      ok: true,
      scan: { loaded, factsFound: outcome.factsFound, reviewNotes: outcome.reviewNotes },
      facts,
    });
  } catch {
    return jsonError(500, "scan_failed", "Something went wrong. Please try again.");
  }
}
