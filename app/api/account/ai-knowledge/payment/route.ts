import { NextResponse, type NextRequest } from "next/server";

import { jsonBadRequest, jsonError, jsonOk } from "../../../../../lib/http/responses";
import { requireOwnerAdminAccess } from "../../../../../lib/auth/owner-admin";
import {
  getClinicAiFacts,
  listCustomFinancingEntries,
  saveFinancingSection,
  savePaymentMethods,
} from "../../../../../lib/db/ai-knowledge";
import {
  validateFinancingUpdate,
  validatePaymentMethods,
} from "../../../../../lib/ai-knowledge/facts";
import {
  FINANCING_DEFAULTS,
  MAX_FINANCING_OPTIONS_PER_CLINIC,
} from "../../../../../config/ai-front-desk-facts.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/account/ai-knowledge/payment
//
// Saves the Payment methods and/or Financing & plans sections. Each owner Save
// posts its own section, so either key may be present independently:
//
// { paymentMethods: { cash, creditDebitCards, personalChecks, hsaFsaCards },
//   financing: { inOfficePaymentPlans, carecredit, alphaeonCredit, membershipPlan,
//                customToAdd: [{ label, selected }], customToRemove: ["custom_…"],
//                selections: [{ key, selected }] } }
//
// Default financing options are fixed booleans; custom financing options are
// owner-keyed rows (max 50 per clinic). clinic_id always comes from the
// authenticated owner/admin session — never the client.
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
  const hasMethods = input.paymentMethods !== undefined && input.paymentMethods !== null;
  const hasFinancing = input.financing !== undefined && input.financing !== null;
  if (!hasMethods && !hasFinancing) {
    return jsonBadRequest("Nothing to save yet.");
  }

  try {
    if (hasMethods) {
      const methods = validatePaymentMethods(input.paymentMethods);
      if (!methods.ok) return jsonBadRequest(methods.message);
      await savePaymentMethods(access.clinic.id, methods.value, access.userId);
    }

    if (hasFinancing) {
      const existingCustom = await listCustomFinancingEntries(access.clinic.id);
      const financing = validateFinancingUpdate(input.financing, {
        existingCustom,
        defaultLabels: FINANCING_DEFAULTS.map((option) => option.label),
        maxEntries: MAX_FINANCING_OPTIONS_PER_CLINIC,
      });
      if (!financing.ok) return jsonBadRequest(financing.message);
      const saved = await saveFinancingSection(
        access.clinic.id,
        financing.value.defaults,
        financing.value.custom,
        access.userId,
      );
      if (!saved.ok) {
        return jsonBadRequest(`You can list up to ${MAX_FINANCING_OPTIONS_PER_CLINIC} financing options.`);
      }
    }

    const facts = await getClinicAiFacts(access.clinic.id);
    return jsonOk({ ok: true, facts });
  } catch {
    return jsonError(500, "save_failed", "We couldn't save payment options. Please try again.");
  }
}
