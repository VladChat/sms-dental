import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  jsonForbidden,
  jsonUnauthorized,
} from "../../../../../../lib/http/responses";
import { resolvePlatformAdmin } from "../../../../../../lib/auth/platform-admin";
import {
  CLINIC_DELETE_CONFIRM,
  ClinicDeleteBlockedError,
  ClinicDeleteConfirmationError,
  deleteClinicData,
} from "../../../../../../lib/db/admin/clinic-delete";
import { recordAdminAuditEvent } from "../../../../../../lib/db/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const BodySchema = z.object({
  confirm: z.literal(CLINIC_DELETE_CONFIRM),
}).strict();

const NO_CACHE_HEADERS = {
  "cache-control": "no-store",
} as const;

type DeleteBody = {
  ok: boolean;
  canDelete: boolean;
  blockers: unknown[];
  summary: unknown | null;
  deletedCounts: unknown[] | null;
  error?: { message: string };
};

// POST /api/admin/clinics/[clinicId]/delete
// Platform-admin-only. Requires {"confirm":"DELETE"} and refuses blocked
// preflight inside the same DB transaction as the ordered delete.
export async function POST(
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return confirmationRequired();
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return confirmationRequired();
  }

  try {
    const result = await deleteClinicData(clinicId, parsed.data.confirm);
    await recordDeleteAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      authSource: admin.source,
      clinicId,
      clinicName: result.summary.clinicName,
      deletedRowCount: result.deletedCounts.reduce((sum, row) => sum + row.count, 0),
    });

    return deleteJson(
      {
        ok: true,
        canDelete: true,
        blockers: [],
        summary: result.summary,
        deletedCounts: result.deletedCounts,
      },
      200,
    );
  } catch (err) {
    if (err instanceof ClinicDeleteConfirmationError) {
      return confirmationRequired();
    }
    if (err instanceof ClinicDeleteBlockedError) {
      return deleteJson(
        {
          ok: false,
          canDelete: false,
          blockers: err.preflight.blockers,
          summary: err.preflight.summary,
          deletedCounts: null,
        },
        err.preflight.summary ? 409 : 404,
      );
    }
    return deleteJson(
      {
        ok: false,
        canDelete: false,
        blockers: [],
        summary: null,
        deletedCounts: null,
        error: { message: "Could not delete this clinic. Please try again." },
      },
      500,
    );
  }
}

function confirmationRequired(): NextResponse {
  return deleteJson(
    {
      ok: false,
      canDelete: false,
      blockers: [
        {
          code: "confirmation_required",
          message: "Type DELETE to confirm.",
          resolution: "Enter DELETE exactly before deleting.",
        },
      ],
      summary: null,
      deletedCounts: null,
    },
    400,
  );
}

async function recordDeleteAudit(input: {
  adminUserId: string | null;
  adminEmail: string;
  authSource: string;
  clinicId: string;
  clinicName: string;
  deletedRowCount: number;
}): Promise<void> {
  try {
    await recordAdminAuditEvent({
      adminUserId: input.adminUserId,
      adminEmail: input.adminEmail,
      action: "clinic.delete",
      targetType: "clinic",
      targetId: input.clinicId,
      clinicId: null,
      beforeState: { clinic_name_present: input.clinicName.trim().length > 0 },
      afterState: { deleted: true, deleted_row_count: input.deletedRowCount },
      metadata: { authSource: input.authSource },
    });
  } catch {
    // The delete already succeeded. Keep the response successful if audit write
    // is unavailable; no provider/customer state is changed by this audit call.
  }
}

function deleteJson(body: DeleteBody, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: NO_CACHE_HEADERS });
}
