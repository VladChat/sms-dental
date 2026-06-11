// Shared AI Knowledge section-save handlers.
//
// Each handler takes (clinicId, actorProfileId, rawBody), runs the SAME
// validation + DB save + section-review marking as the owner API, and returns
// the refreshed facts plus the section keys that were saved (for admin audit).
// The owner routes keep their own thin inline handlers; the admin routes call
// these so both surfaces share identical validation/persistence. No SMS, no AI
// provider, no secrets.

import {
  DEFAULT_INSURANCE_PLANS,
  DEFAULT_SERVICES,
  FINANCING_DEFAULTS,
  MAX_FINANCING_OPTIONS_PER_CLINIC,
  MAX_INSURANCE_PLANS_PER_CLINIC,
  MAX_SERVICES_PER_CLINIC,
} from "../../config/ai-front-desk-facts.config";
import {
  validateCatalogSectionUpdate,
  validateFinancingUpdate,
  validateHoursInput,
  validateLanguagesList,
  validateOfficePolicies,
  validatePaymentMethods,
} from "./facts";
import {
  getClinicAiFacts,
  listCustomFinancingEntries,
  listCustomInsuranceEntries,
  listCustomServiceEntries,
  markSectionReviewed,
  saveClinicHours,
  saveFinancingSection,
  saveInsuranceSection,
  saveOfficeLanguages,
  saveOfficePolicies,
  savePaymentMethods,
  saveServiceSection,
  type AiFactsView,
} from "../db/ai-knowledge";

export type SectionSaveResult =
  | { ok: true; facts: AiFactsView; sections: string[] }
  | { ok: false; status: number; code: string; message: string };

const badRequest = (message: string): SectionSaveResult => ({
  ok: false,
  status: 400,
  code: "bad_request",
  message,
});
const saveFailed = (message: string): SectionSaveResult => ({
  ok: false,
  status: 500,
  code: "save_failed",
  message,
});

export async function handleHoursSave(
  clinicId: string,
  actorId: string | null,
  body: unknown,
): Promise<SectionSaveResult> {
  const validated = validateHoursInput(body);
  if (!validated.ok) return badRequest(validated.message);
  try {
    await saveClinicHours(clinicId, validated.value, actorId);
    await markSectionReviewed(clinicId, "hours", actorId);
    return { ok: true, facts: await getClinicAiFacts(clinicId), sections: ["hours"] };
  } catch {
    return saveFailed("We couldn't save your hours. Please try again.");
  }
}

export async function handleServicesSave(
  clinicId: string,
  actorId: string | null,
  body: unknown,
): Promise<SectionSaveResult> {
  try {
    const existingCustom = await listCustomServiceEntries(clinicId);
    const validated = validateCatalogSectionUpdate(body, {
      allowedKeys: new Set([
        ...DEFAULT_SERVICES.map((s) => s.key),
        ...existingCustom.map((c) => c.key),
      ]),
      existingCustom,
      defaultLabels: DEFAULT_SERVICES.map((s) => s.label),
      catalogSize: DEFAULT_SERVICES.length,
      maxEntries: MAX_SERVICES_PER_CLINIC,
    });
    if (!validated.ok) return badRequest(validated.message);
    const saved = await saveServiceSection(clinicId, validated.value, actorId);
    if (!saved.ok) return badRequest(`You can list up to ${MAX_SERVICES_PER_CLINIC} services.`);
    await markSectionReviewed(clinicId, "services", actorId);
    return { ok: true, facts: await getClinicAiFacts(clinicId), sections: ["services"] };
  } catch {
    return saveFailed("We couldn't save your services. Please try again.");
  }
}

export async function handleInsuranceSave(
  clinicId: string,
  actorId: string | null,
  body: unknown,
): Promise<SectionSaveResult> {
  try {
    const existingCustom = await listCustomInsuranceEntries(clinicId);
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
    if (!validated.ok) return badRequest(validated.message);
    const saved = await saveInsuranceSection(clinicId, validated.value, actorId);
    if (!saved.ok) {
      return badRequest(`You can list up to ${MAX_INSURANCE_PLANS_PER_CLINIC} insurance plans.`);
    }
    await markSectionReviewed(clinicId, "insurance", actorId);
    return { ok: true, facts: await getClinicAiFacts(clinicId), sections: ["insurance"] };
  } catch {
    return saveFailed("We couldn't save your insurance plans. Please try again.");
  }
}

export async function handleLanguagesSave(
  clinicId: string,
  actorId: string | null,
  body: unknown,
): Promise<SectionSaveResult> {
  const validated = validateLanguagesList(body);
  if (!validated.ok) return badRequest(validated.message);
  try {
    await saveOfficeLanguages(clinicId, validated.value, actorId);
    await markSectionReviewed(clinicId, "languages", actorId);
    return { ok: true, facts: await getClinicAiFacts(clinicId), sections: ["languages"] };
  } catch {
    return saveFailed("We couldn't save languages. Please try again.");
  }
}

export async function handlePaymentSave(
  clinicId: string,
  actorId: string | null,
  body: unknown,
): Promise<SectionSaveResult> {
  const input = (body ?? {}) as Record<string, unknown>;
  const hasMethods = input.paymentMethods !== undefined && input.paymentMethods !== null;
  const hasFinancing = input.financing !== undefined && input.financing !== null;
  if (!hasMethods && !hasFinancing) return badRequest("Nothing to save yet.");

  const sections: string[] = [];
  try {
    if (hasMethods) {
      const methods = validatePaymentMethods(input.paymentMethods);
      if (!methods.ok) return badRequest(methods.message);
      await savePaymentMethods(clinicId, methods.value, actorId);
      await markSectionReviewed(clinicId, "payment_methods", actorId);
      sections.push("payment_methods");
    }
    if (hasFinancing) {
      const existingCustom = await listCustomFinancingEntries(clinicId);
      const financing = validateFinancingUpdate(input.financing, {
        existingCustom,
        defaultLabels: FINANCING_DEFAULTS.map((o) => o.label),
        maxEntries: MAX_FINANCING_OPTIONS_PER_CLINIC,
      });
      if (!financing.ok) return badRequest(financing.message);
      const saved = await saveFinancingSection(
        clinicId,
        financing.value.defaults,
        financing.value.custom,
        actorId,
      );
      if (!saved.ok) {
        return badRequest(`You can list up to ${MAX_FINANCING_OPTIONS_PER_CLINIC} financing options.`);
      }
      await markSectionReviewed(clinicId, "financing", actorId);
      sections.push("financing");
    }
    return { ok: true, facts: await getClinicAiFacts(clinicId), sections };
  } catch {
    return saveFailed("We couldn't save payment options. Please try again.");
  }
}

export async function handlePoliciesSave(
  clinicId: string,
  actorId: string | null,
  body: unknown,
): Promise<SectionSaveResult> {
  const validated = validateOfficePolicies(body);
  if (!validated.ok) return badRequest(validated.message);
  try {
    await saveOfficePolicies(clinicId, validated.value, actorId);
    await markSectionReviewed(clinicId, "office_policies", actorId);
    return { ok: true, facts: await getClinicAiFacts(clinicId), sections: ["office_policies"] };
  } catch {
    return saveFailed("We couldn't save office rules. Please try again.");
  }
}
