import { NextResponse, type NextRequest } from "next/server";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolvePlatformAdmin } from "@/lib/auth/platform-admin";
import { auditSmsSendReadiness } from "@/lib/db/sms-readiness";
import { getSmsRecoveryConfig } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// GET /api/admin/sms-readiness/audit[?clinic_id=<uuid>]
//
// Platform-admin-only, read-only operator audit: one row per assigned number
// across all clinics (or one clinic when filtered) with texting status,
// Messaging Service coverage, A2P coverage, can_send_sms, and the first
// blocking reason — computed with the same logic as the live-send guard.
// Reads local DB tables only; never calls Twilio, never sends SMS.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const admin = await resolvePlatformAdmin(req);
  if (!admin.ok) {
    if (admin.reason === "no_session") return jsonUnauthorized("Please sign in to continue.");
    return jsonForbidden("You are not authorized for platform admin access.");
  }

  const clinicId = req.nextUrl.searchParams.get("clinic_id");
  if (clinicId && !UUID_RE.test(clinicId)) {
    return jsonError(400, "invalid_clinic_id", "clinic_id must be a UUID.");
  }

  const config = getSmsRecoveryConfig();
  try {
    const numbers = await auditSmsSendReadiness({
      clinicId: clinicId ?? null,
      smsRecoveryMode: config.mode,
    });
    return jsonOk({
      ok: true,
      smsRecoveryMode: config.mode,
      generatedAt: new Date().toISOString(),
      count: numbers.length,
      numbers,
    });
  } catch {
    return jsonError(
      500,
      "audit_failed",
      "Could not run the SMS readiness audit. Check that the readiness migration is applied.",
    );
  }
}
