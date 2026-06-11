import { type NextRequest, type NextResponse } from "next/server";

import { jsonError, jsonOk } from "../../../../../../lib/http/responses";
import { requirePlatformAdminClinic } from "../../../../../../lib/auth/admin-clinic";
import { getClinicAiFacts } from "../../../../../../lib/db/ai-knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/clinics/[clinicId]/ai-knowledge
//
// Platform-admin-scoped AI Knowledge facts for ONE clinic (by URL id). Returns
// the same AiFactsView the owner GET returns so AiKnowledgeCard works unchanged
// against this base path. Never infers the clinic from membership.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ clinicId: string }> },
): Promise<NextResponse> {
  const { clinicId } = await ctx.params;
  const guard = await requirePlatformAdminClinic(req, clinicId);
  if (!guard.ok) return guard.response;

  try {
    const facts = await getClinicAiFacts(clinicId);
    return jsonOk({ ok: true, facts });
  } catch {
    return jsonError(500, "load_failed", "We couldn't load this section. Please try again.");
  }
}
