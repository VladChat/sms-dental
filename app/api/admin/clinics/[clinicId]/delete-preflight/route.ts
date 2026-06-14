import { NextResponse, type NextRequest } from "next/server";

import {
  jsonForbidden,
  jsonUnauthorized,
} from "../../../../../../lib/http/responses";
import { resolvePlatformAdmin } from "../../../../../../lib/auth/platform-admin";
import { getClinicDeletePreflight } from "../../../../../../lib/db/admin/clinic-delete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
} as const;

type DeletePreflightBody = {
  ok: boolean;
  canDelete: boolean;
  blockers: unknown[];
  summary: unknown | null;
  deletedCounts: null;
  error?: { message: string };
};

// GET /api/admin/clinics/[clinicId]/delete-preflight
// Platform-admin-only. The clinic id comes only from the URL. Response is a
// safe preflight summary: counts, booleans, labels, and blocker copy only.
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
  if (!UUID_RE.test(clinicId)) {
    return deleteJson(
      {
        ok: false,
        canDelete: false,
        blockers: [
          {
            code: "clinic_not_found",
            message: "Clinic not found.",
            resolution: "Open an existing clinic record before deleting.",
          },
        ],
        summary: null,
        deletedCounts: null,
      },
      404,
    );
  }

  try {
    const preflight = await getClinicDeletePreflight(clinicId);
    return deleteJson(
      {
        ok: preflight.summary !== null,
        canDelete: preflight.canDelete,
        blockers: preflight.blockers,
        summary: preflight.summary,
        deletedCounts: null,
      },
      preflight.summary ? 200 : 404,
    );
  } catch {
    return deleteJson(
      {
        ok: false,
        canDelete: false,
        blockers: [],
        summary: null,
        deletedCounts: null,
        error: { message: "Could not load delete preflight. Please try again." },
      },
      500,
    );
  }
}

function deleteJson(body: DeletePreflightBody, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: NO_CACHE_HEADERS });
}
