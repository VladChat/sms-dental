import { NextResponse, type NextRequest } from "next/server";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolvePlatformAdmin } from "@/lib/auth/platform-admin";
import { recordAdminAuditEvent } from "@/lib/db/admin/audit";
import { textingStatusSyncConfig } from "@/config/texting-status-sync.config";
import { syncPhoneNumberTextingStatuses } from "@/lib/texting-status/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// POST /api/admin/clinics/[clinicId]/sms-readiness/sync
//
// Platform-admin-only read-only Twilio verification. Runs the same per-number
// texting-status sync as the cron job, scoped to this clinic. It reads Twilio
// Toll-Free Verification for toll-free numbers and Messaging Service/A2P
// readiness for local numbers. Never mutates Twilio, never submits A2P, and
// never sends SMS.
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
    return jsonError(404, "not_found", "Clinic not found.");
  }

  let summary;
  try {
    summary = await syncPhoneNumberTextingStatuses({
      clinicId,
      force: true,
      limit: textingStatusSyncConfig.singleClinicBatchSize,
    });
  } catch {
    return jsonError(
      500,
      "sync_failed",
      "Could not run the read-only SMS readiness sync. Please check provider configuration and try again.",
    );
  }

  try {
    await recordAdminAuditEvent({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: "clinic.sms_readiness.sync",
      targetType: "clinic",
      targetId: clinicId,
      clinicId,
      afterState: {
        checked: summary.checked,
        updated_to_active: summary.updatedToActive,
        remained_pending: summary.remainedPending,
        failed: summary.failed,
        skipped: summary.skipped,
      },
      metadata: { authSource: admin.source, mode: "read_only" },
    });
  } catch {
    // Sync already completed; never fail the operator on an audit hiccup.
  }

  return jsonOk({ ok: true, summary });
}
