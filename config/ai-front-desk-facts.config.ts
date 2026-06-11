// AI Front Desk facts — committed catalogs and limits.
//
// Source of truth for the structured clinic-facts model (hours, services,
// insurance, appointments, payment, policies). This replaces the old
// question-answer catalog: facts are structured data a future AI assistant can
// consume directly, not free-text answers to questions.
//
// Foundation-only: nothing reads these facts at runtime, no AI provider is
// called, and no patient-facing behavior depends on this file.
//
// Internal safety policy (system rule, not a clinic preference — there is no
// owner-editable safety section):
// - AI must never provide diagnosis, treatment advice, medication
//   instructions, or clinical triage.
// - Unknown or unapproved questions go to the office.
// - Dental pain/swelling/bleeding is flagged to the office as an urgent dental
//   concern, never diagnosed, and not blanket-routed to 911.
// - Reserved emergency wording, only where a possible medical emergency must
//   be acknowledged: "If this is a medical emergency, call 911."

export const AI_FACT_STATUSES = [
  "not_found",
  "needs_review",
  "approved",
  "do_not_use",
] as const;

export type AiFactStatus = (typeof AI_FACT_STATUSES)[number];

export const AI_FACT_SOURCE_TYPES = [
  "manual",
  "business_profile",
  "website_draft",
  "system_default",
] as const;

export type AiFactSourceType = (typeof AI_FACT_SOURCE_TYPES)[number];

// Hard limits enforced server-side (and mirrored by DB constraints where
// practical).
export const MAX_SERVICES_PER_CLINIC = 50;
export const MAX_INSURANCE_PLANS_PER_CLINIC = 50;
export const MAX_FINANCING_OPTIONS_PER_CLINIC = 50;
export const MAX_CUSTOM_LABEL_LENGTH = 80;
export const MAX_HOURS_INTERVALS_PER_DAY = 3;
export const MAX_PREFERRED_TIME_QUESTION_LENGTH = 180;
export const MAX_PRICING_POLICY_LENGTH = 300;
export const MAX_POLICY_TEXT_LENGTH = 300;
export const MAX_LANGUAGES = 20;
export const MAX_LANGUAGE_LENGTH = 40;

export const DEFAULT_PREFERRED_TIME_QUESTION =
  "What name should we use, and what day or time works best?";

export const DEFAULT_HOURS_TIMEZONE = "America/Chicago";

// Default language checkboxes. English is always on and cannot be removed or
// unchecked (enforced in the UI and re-applied server-side).
export const DEFAULT_LANGUAGES = ["English", "Spanish", "Russian", "Polish", "Chinese"] as const;
export const LOCKED_LANGUAGE = "English";

// US-first timezone choices for the hours editor.
export const HOURS_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
] as const;

export type AiFactCatalogItem = {
  key: string;
  label: string;
  // Lowercase phrases the website scan matches against page text. The label
  // itself is always matched too.
  scanKeywords?: readonly string[];
};

// Default dental service list. Owners check what they offer and can add
// custom services (max 50 total, no "Other" option).
export const DEFAULT_SERVICES: readonly AiFactCatalogItem[] = [
  { key: "cleanings", label: "Cleanings", scanKeywords: ["cleaning", "prophylaxis", "preventive care"] },
  { key: "exams", label: "Exams", scanKeywords: ["exam", "check-up", "checkup"] },
  { key: "xrays", label: "X-rays", scanKeywords: ["x-ray", "xray", "x rays", "radiograph"] },
  { key: "fillings", label: "Fillings", scanKeywords: ["filling", "composite"] },
  { key: "crowns", label: "Crowns", scanKeywords: ["crown"] },
  { key: "bridges", label: "Bridges", scanKeywords: ["bridge"] },
  { key: "dentures", label: "Dentures", scanKeywords: ["denture"] },
  { key: "root_canals", label: "Root canals", scanKeywords: ["root canal", "endodontic"] },
  { key: "extractions", label: "Extractions", scanKeywords: ["extraction", "tooth removal"] },
  { key: "deep_cleaning_gum_treatment", label: "Deep cleaning / gum treatment", scanKeywords: ["deep cleaning", "scaling and root planing", "periodontal", "gum treatment", "gum disease"] },
  { key: "whitening", label: "Whitening", scanKeywords: ["whitening", "teeth bleaching"] },
  { key: "veneers", label: "Veneers", scanKeywords: ["veneer"] },
  { key: "invisalign_clear_aligners", label: "Invisalign / clear aligners", scanKeywords: ["invisalign", "clear aligner", "aligners"] },
  { key: "implants", label: "Implants", scanKeywords: ["implant"] },
  { key: "pediatric_dentistry", label: "Pediatric dentistry", scanKeywords: ["pediatric", "children's dentistry", "kids dentistry"] },
  { key: "wisdom_teeth", label: "Wisdom teeth", scanKeywords: ["wisdom tooth", "wisdom teeth"] },
  { key: "sedation_dentistry", label: "Sedation dentistry", scanKeywords: ["sedation", "nitrous oxide", "laughing gas"] },
  { key: "emergency_dentistry", label: "Emergency dentistry", scanKeywords: ["emergency dentist", "emergency dental", "dental emergency", "emergency appointment"] },
];

// Default insurance plan list. Owners check what they accept and can add
// custom plans (max 50 total, no "Other" option).
export const DEFAULT_INSURANCE_PLANS: readonly AiFactCatalogItem[] = [
  { key: "delta_dental", label: "Delta Dental" },
  { key: "aetna", label: "Aetna" },
  { key: "cigna", label: "Cigna" },
  { key: "metlife", label: "MetLife" },
  { key: "guardian", label: "Guardian" },
  { key: "unitedhealthcare", label: "UnitedHealthcare", scanKeywords: ["united healthcare", "unitedhealthcare"] },
  { key: "blue_cross_blue_shield", label: "Blue Cross Blue Shield", scanKeywords: ["blue cross", "blue shield", "bcbs"] },
  { key: "humana", label: "Humana" },
  { key: "principal", label: "Principal" },
  { key: "ameritas", label: "Ameritas" },
  { key: "united_concordia", label: "United Concordia" },
  { key: "geha", label: "GEHA" },
  { key: "dental_discount_plans", label: "DentalPlans / discount plans", scanKeywords: ["dentalplans", "discount plan", "savings plan"] },
  { key: "medicaid", label: "Medicaid" },
  { key: "medicare_advantage", label: "Medicare Advantage dental plans", scanKeywords: ["medicare advantage", "medicare"] },
];

// Fixed payment methods an office can accept. Keys map 1:1 to boolean columns
// on clinic_ai_payment_settings. No custom additions here.
export const PAYMENT_METHODS: readonly AiFactCatalogItem[] = [
  { key: "cash", label: "Cash" },
  { key: "credit_debit_cards", label: "Credit/debit cards" },
  { key: "personal_checks", label: "Personal checks" },
  { key: "hsa_fsa_cards", label: "HSA/FSA cards" },
];

// Default financing options. Keys map 1:1 to boolean columns on
// clinic_ai_payment_settings; owners may also add custom financing options
// (stored in clinic_ai_financing_options, max 50 per clinic).
export const FINANCING_DEFAULTS: readonly AiFactCatalogItem[] = [
  { key: "in_office_payment_plans", label: "In-office payment plans" },
  { key: "carecredit", label: "CareCredit" },
  { key: "alphaeon_credit", label: "Alphaeon Credit" },
  { key: "membership_plan", label: "Membership plan" },
];

const serviceByKey = new Map(DEFAULT_SERVICES.map((item) => [item.key, item]));
const insurancePlanByKey = new Map(DEFAULT_INSURANCE_PLANS.map((item) => [item.key, item]));

export function findDefaultService(key: string): AiFactCatalogItem | null {
  return serviceByKey.get(key) ?? null;
}

export function findDefaultInsurancePlan(key: string): AiFactCatalogItem | null {
  return insurancePlanByKey.get(key) ?? null;
}

export function isAiFactStatus(value: string): value is AiFactStatus {
  return (AI_FACT_STATUSES as readonly string[]).includes(value);
}

export function isAiFactSourceType(value: string): value is AiFactSourceType {
  return (AI_FACT_SOURCE_TYPES as readonly string[]).includes(value);
}
