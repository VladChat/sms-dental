import { NextResponse, type NextRequest } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../lib/http/responses";
import { requireOwnerAdminAccess } from "../../../../../lib/auth/owner-admin";
import {
  addCustomService,
  getClinicAiFacts,
  listAllowedServiceKeys,
  saveServiceSelections,
} from "../../../../../lib/db/ai-knowledge";
import { validateCustomLabel, validateSelections } from "../../../../../lib/ai-knowledge/facts";
import {
  DEFAULT_SERVICES,
  MAX_SERVICES_PER_CLINIC,
} from "../../../../../config/ai-front-desk-facts.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/ai-knowledge/services
// { action: "save", selections: [{ key, selected }] } — save the checkbox list.
// { action: "add", label } — add a custom service (key minted server-side).
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
  const input = (body ?? {}) as Record<string, unknown>;

  try {
    if (input.action === "add") {
      const label = validateCustomLabel(input.label);
      if (!label.ok) return jsonBadRequest(label.message);
      if (DEFAULT_SERVICES.some((s) => s.label.toLowerCase() === label.value.toLowerCase())) {
        return jsonBadRequest("That service is already in the list.");
      }
      const added = await addCustomService(access.clinic.id, label.value, access.userId);
      if (!added.ok) {
        return jsonBadRequest(
          added.reason === "limit_reached"
            ? `You can list up to ${MAX_SERVICES_PER_CLINIC} services.`
            : "That service is already in the list.",
        );
      }
    } else if (input.action === "save") {
      const allowedKeys = await listAllowedServiceKeys(access.clinic.id);
      const selections = validateSelections(input.selections, allowedKeys);
      if (!selections.ok) return jsonBadRequest(selections.message);
      await saveServiceSelections(access.clinic.id, selections.value, access.userId);
    } else {
      return jsonBadRequest("Invalid request body");
    }
    const facts = await getClinicAiFacts(access.clinic.id);
    return jsonOk({ ok: true, facts });
  } catch {
    return jsonError(500, "save_failed", "We couldn't save your services. Please try again.");
  }
}
