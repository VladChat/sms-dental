import type { NextResponse } from "next/server";

import { jsonError, jsonOk } from "../../../../lib/http/responses";
import { requireOwnerAdminAccess } from "../../../../lib/auth/owner-admin";
import { getClinicAiFacts } from "../../../../lib/db/ai-knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AI Front Desk facts — owner/admin account API (foundation only).
//
// Returns the structured clinic facts (hours, services, insurance,
// appointments, payment, policies) plus the latest website scan summary.
// Section saves live under ./hours, ./services, ./insurance, ./appointments,
// ./payment, ./policies, and ./scan-website. Nothing here sends SMS, calls an
// AI provider, or changes patient-facing behavior.
export async function GET(): Promise<NextResponse> {
  const result = await requireOwnerAdminAccess("Front desk users cannot manage AI knowledge.");
  if (!result.allowed) return result.response;
  const { access } = result;

  try {
    const facts = await getClinicAiFacts(access.clinic.id);
    return jsonOk({ ok: true, facts });
  } catch {
    return jsonError(500, "load_failed", "We couldn't load this section. Please try again.");
  }
}
