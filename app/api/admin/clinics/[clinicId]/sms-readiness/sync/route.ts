import { NextResponse, type NextRequest } from "next/server";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolvePlatformAdmin } from "@/lib/auth/platform-admin";
import { recordAdminAuditEvent } from "@/lib/db/admin/audit";
import { syncClinicSmsReadinessFromTwilio } from "@/lib/twilio/sms-readiness-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// POST /api/admin/clinics/[clinicId]/sms-readiness/sync
//
// Platform-admin-only read-only Twilio verification. Reads Messaging Service,
// A2P Brand/Campaign, and service sender state, then updates only local
// readiness tables. Never mutates Twilio, never submits A2P, and never sends SMS.
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
    summary = await syncClinicSmsReadinessFromTwilio(clinicId);
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
        launch_ready: summary.launchReady,
        blocking_reason: summary.blockingReason,
        number_count: summary.numbers.length,
      },
      metadata: { authSource: admin.source, mode: "read_only" },
    });
  } catch {
    // Sync already completed; never fail the operator on an audit hiccup.
  }

  return jsonOk({ ok: true, summary });
}
