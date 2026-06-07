import { NextResponse, type NextRequest } from "next/server";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolvePlatformAdmin } from "@/lib/auth/platform-admin";
import { recordAdminAuditEvent } from "@/lib/db/admin/audit";
import { readA2pProviderStatus } from "@/lib/twilio/a2p-submission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// POST /api/admin/clinics/[clinicId]/a2p/status
//
// Platform-admin-only READ-ONLY refresh of A2P provider state. Fetches the
// stored Customer Profile / Trust Product / Brand Registration by SID and
// updates only the local status. Creates nothing and mutates no Twilio state.
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
  if (!UUID_RE.test(clinicId)) return jsonError(404, "not_found", "Clinic not found.");

  let statuses: Record<string, string> = {};
  let brandFailureReason: string | null = null;
  let brandFailureCode: string | null = null;
  try {
    const res = await readA2pProviderStatus(clinicId);
    statuses = res.statuses;
    brandFailureReason = res.brandFailureReason;
    brandFailureCode = res.brandFailureCode;
  } catch {
    return jsonError(
      500,
      "status_refresh_failed",
      "Could not refresh A2P provider status. Check provider configuration and try again.",
    );
  }

  await recordAdminAuditEvent({
    adminUserId: admin.userId,
    adminEmail: admin.email,
    action: "clinic.a2p.status_refresh",
    targetType: "clinic",
    targetId: clinicId,
    clinicId,
    afterState: {
      customer_profile: statuses.customerProfile ?? "n/a",
      trust_product: statuses.trustProduct ?? "n/a",
      brand: statuses.brand ?? "n/a",
      brandFailureReason: brandFailureReason ?? null,
      brandFailureCode: brandFailureCode ?? null,
    },
    metadata: { authSource: admin.source, mode: "read_only" },
  }).catch(() => {});

  return jsonOk({ ok: true, statuses, brandFailureReason, brandFailureCode });
}
