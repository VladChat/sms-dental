import type { NextRequest, NextResponse } from "next/server";
import { jsonError, jsonForbidden, jsonUnauthorized } from "../http/responses";
import { resolvePlatformAdmin } from "./platform-admin";
import { findClinicById, type ClinicOnboardingRow } from "../db/clinics";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export type AdminClinicGuard =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      admin: { userId: string; email: string; source: "allowlist" | "profile_flag" };
      clinic: ClinicOnboardingRow;
    };

// Platform-admin guard for a SPECIFIC clinic by URL id. The clinic is always
// taken from the validated URL param — never inferred from any membership.
// Use this for every /api/admin/clinics/[clinicId]/* mutation.
export async function requirePlatformAdminClinic(
  req: NextRequest,
  clinicId: string,
): Promise<AdminClinicGuard> {
  const admin = await resolvePlatformAdmin(req);
  if (!admin.ok) {
    if (admin.reason === "no_session") {
      return { ok: false, response: jsonUnauthorized("Please sign in to continue.") };
    }
    return {
      ok: false,
      response: jsonForbidden("You are not authorized for platform admin access."),
    };
  }
  if (!UUID_RE.test(clinicId)) {
    return { ok: false, response: jsonError(404, "not_found", "Clinic not found.") };
  }
  const clinic = await findClinicById(clinicId).catch(() => null);
  if (!clinic) {
    return { ok: false, response: jsonError(404, "not_found", "Clinic not found.") };
  }
  return {
    ok: true,
    admin: { userId: admin.userId, email: admin.email, source: admin.source },
    clinic,
  };
}
