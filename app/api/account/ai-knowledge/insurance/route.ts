import { NextResponse, type NextRequest } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../lib/http/responses";
import { requireOwnerAdminAccess } from "../../../../../lib/auth/owner-admin";
import {
  getClinicAiFacts,
  listCustomInsuranceEntries,
  saveInsuranceSection,
} from "../../../../../lib/db/ai-knowledge";
import { validateCatalogSectionUpdate } from "../../../../../lib/ai-knowledge/facts";
import {
  DEFAULT_INSURANCE_PLANS,
  MAX_INSURANCE_PLANS_PER_CLINIC,
} from "../../../../../config/ai-front-desk-facts.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/ai-knowledge/insurance
//
// One save persists the whole section: checkbox selections, newly added
// custom plans (labels validated, keys minted server-side), and removed
// custom plans. Default catalog entries can only be (un)checked, never
// removed. Max 50 entries per clinic.
//
// { selections: [{ key, selected }], customToAdd: [{ label, selected }],
//   customToRemove: ["custom_…"] }
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

  try {
    const existingCustom = await listCustomInsuranceEntries(access.clinic.id);
    const validated = validateCatalogSectionUpdate(body, {
      allowedKeys: new Set([
        ...DEFAULT_INSURANCE_PLANS.map((p) => p.key),
        ...existingCustom.map((c) => c.key),
      ]),
      existingCustom,
      defaultLabels: DEFAULT_INSURANCE_PLANS.map((p) => p.label),
      catalogSize: DEFAULT_INSURANCE_PLANS.length,
      maxEntries: MAX_INSURANCE_PLANS_PER_CLINIC,
    });
    if (!validated.ok) return jsonBadRequest(validated.message);

    const saved = await saveInsuranceSection(access.clinic.id, validated.value, access.userId);
    if (!saved.ok) {
      return jsonBadRequest(`You can list up to ${MAX_INSURANCE_PLANS_PER_CLINIC} insurance plans.`);
    }
    const facts = await getClinicAiFacts(access.clinic.id);
    return jsonOk({ ok: true, facts });
  } catch {
    return jsonError(500, "save_failed", "We couldn't save your insurance plans. Please try again.");
  }
}
