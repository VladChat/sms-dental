import { NextResponse, type NextRequest } from "next/server";

import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/http/responses";
import { resolveAuthClinicAccess } from "@/lib/auth/access";
import { schedulePhoneNumberRemoval } from "@/lib/phone-numbers/removal-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: Record<Exclude<Awaited<ReturnType<typeof schedulePhoneNumberRemoval>>, { ok: true }>["error"], number> = {
  not_found: 404,
  already_removed: 409,
  not_scheduled: 409,
  restore_window_closed: 409,
  billing_configuration_missing: 503,
  billing_sync_failed: 502,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ phoneNumberId: string }> },
): Promise<NextResponse> {
  const access = await resolveAuthClinicAccess(req);
  if (!access.ok) return jsonUnauthorized("Please sign in to continue.");
  if (access.membership.role === "front_desk") {
    return jsonForbidden("Front desk users cannot remove account phone numbers.");
  }

  const { phoneNumberId } = await params;
  const result = await schedulePhoneNumberRemoval({
    clinicId: access.clinic.id,
    phoneNumberId,
    actorProfileId: access.userId,
    actorEmail: access.userEmail ?? access.clinic.owner_contact_email ?? null,
  });

  if (!result.ok) {
    return jsonError(STATUS[result.error], result.error, result.message);
  }
  return jsonOk({
    ok: true,
    phoneNumber: result.phoneNumber,
    permanentRemovalAt: result.permanentRemovalAt ?? null,
  });
}
