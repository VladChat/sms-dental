import { NextResponse, type NextRequest } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../lib/http/responses";
import { requireOwnerAdminAccess } from "../../../../../lib/auth/owner-admin";
import { getClinicAiFacts, saveAppointmentSettings } from "../../../../../lib/db/ai-knowledge";
import { validateAppointmentSettings } from "../../../../../lib/ai-knowledge/facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/ai-knowledge/appointments — save appointment intake
// settings (which request types the office handles). Nothing books anything.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await requireOwnerAdminAccess("Front desk users cannot manage AI knowledge.");
  if (!result.allowed) return result.response;
  const { access } = result;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest("Invalid request body");
  }
  const validated = validateAppointmentSettings(body);
  if (!validated.ok) return jsonBadRequest(validated.message);

  try {
    await saveAppointmentSettings(access.clinic.id, validated.value, access.userId);
    const facts = await getClinicAiFacts(access.clinic.id);
    return jsonOk({ ok: true, facts });
  } catch {
    return jsonError(500, "save_failed", "We couldn't save these settings. Please try again.");
  }
}
