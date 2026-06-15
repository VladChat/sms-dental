import { NextResponse, type NextRequest } from "next/server";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "../../../../lib/http/responses";
import { resolveAuthClinicAccess } from "../../../../lib/auth/access";
import { getWorkspaceFreshnessSnapshot } from "../../../../lib/db/front-desk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSince(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

// GET /api/workspace/freshness
//
// Lightweight workspace polling endpoint. Returns only a clinic-scoped activity
// version + section counts, never full messages, provider IDs, raw payloads, or
// AI transcript text.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess(req);
  if (!access.ok) {
    if (access.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You do not have access to this workspace.");
  }

  try {
    const snapshot = await getWorkspaceFreshnessSnapshot({
      clinicId: access.clinic.id,
      since: parseSince(req.nextUrl.searchParams.get("since")),
    });
    return jsonOk({ ok: true, ...snapshot });
  } catch {
    return jsonError(500, "freshness_failed", "We couldn't check for updates.");
  }
}
