import { NextResponse, type NextRequest } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../lib/http/responses";
import { requireOwnerAdminAccess } from "../../../../../lib/auth/owner-admin";
import {
  getClinicAiFacts,
  markSectionReviewed,
  saveOfficeLanguages,
} from "../../../../../lib/db/ai-knowledge";
import { validateLanguagesList } from "../../../../../lib/ai-knowledge/facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/ai-knowledge/languages — save the languages list.
// English is always included server-side even if the client omits it.
// { languages: ["English", "Spanish", "Ukrainian"] }
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
  const validated = validateLanguagesList(body);
  if (!validated.ok) return jsonBadRequest(validated.message);

  try {
    await saveOfficeLanguages(access.clinic.id, validated.value, access.userId);
    // Languages only — never marks the shared-row office_policies section.
    await markSectionReviewed(access.clinic.id, "languages", access.userId);
    const facts = await getClinicAiFacts(access.clinic.id);
    return jsonOk({ ok: true, facts });
  } catch {
    return jsonError(500, "save_failed", "We couldn't save languages. Please try again.");
  }
}
