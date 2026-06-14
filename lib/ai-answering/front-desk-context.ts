// AI Front Desk runtime context — SERVER-ONLY, provider-free.
//
// Builds a safe, structured, non-provider-specific context object that a FUTURE
// voice AI could be grounded on. It does NOT call OpenAI, does NOT store a
// prompt, includes NO patient data, and includes NO transcript/audio.
//
// Only facts the clinic actually SELECTED and SAVED (approved) are included.
// Website-scan suggestions still marked `needs_review` (surfaced as `suggested`
// in AiFactsView) are excluded. Unknown values are OMITTED rather than invented;
// the fixed fallback policy says everything unknown goes "send to office".
//
// The safety policy is a fixed system rule (mirrors config/ai-front-desk-facts
// .config.ts): no diagnosis, no treatment advice, no medication instructions, no
// clinical triage; unknown/unapproved questions go to the office; urgent dental
// concerns are flagged to the front desk; the 911 line is reserved for a
// possible medical emergency only.

import { getClinicAiFacts, type AiFactsView } from "../db/ai-knowledge";
import { FINANCING_DEFAULTS, PAYMENT_METHODS } from "../../config/ai-front-desk-facts.config";

// Fixed safety policy. Never clinic-editable; never derived from facts.
export const AI_FRONT_DESK_SAFETY_POLICY = {
  rules: [
    "Never provide a diagnosis.",
    "Never give treatment advice.",
    "Never give medication instructions.",
    "Never perform clinical triage.",
    "Send any unknown or unapproved question to the office.",
    "Flag urgent dental concerns (pain, swelling, bleeding) to the front desk as urgent; do not diagnose or route automatically to 911.",
  ],
  // Reserved wording, used only when a possible medical emergency must be
  // acknowledged.
  emergencyPhrase: "If this is a medical emergency, call 911.",
} as const;

// Fixed fallback policy for anything not present in the approved facts.
export const AI_FRONT_DESK_FALLBACK_POLICY = {
  unknownAnswer: "send to office",
  note: "If a fact was not approved and saved by the clinic, do not invent it — take a message and route the caller to the office.",
} as const;

export type AiFrontDeskHours = {
  weekday: number; // 0 = Sunday … 6 = Saturday
  closed: boolean;
  opensAt: string | null; // "HH:MM"
  closesAt: string | null;
};

export type AiFrontDeskAppointmentSettings = {
  acceptingNewPatients: boolean | null;
  cleaningAppointments: boolean | null;
  sameDayAppointments: boolean | null;
  emergencyAppointments: boolean | null;
  rescheduleCancelRequests: boolean | null;
  preferredTimeQuestion: string;
};

export type AiFrontDeskOfficePolicies = {
  newPatientForms: string | null;
  whatToBring: string | null;
  cancellationPolicy: string | null;
  parkingNotes: string | null;
  accessibilityNotes: string | null;
};

export type AiFrontDeskRuntimeContext = {
  clinicName: string | null;
  // Hours timezone + days, only when persisted & not a pending suggestion.
  hours: { timezone: string; days: AiFrontDeskHours[] } | null;
  services: string[];
  insurancePlans: string[];
  appointmentSettings: AiFrontDeskAppointmentSettings | null;
  paymentMethods: string[];
  financingOptions: string[];
  officePolicies: AiFrontDeskOfficePolicies | null;
  languages: string[];
  safetyPolicy: typeof AI_FRONT_DESK_SAFETY_POLICY;
  fallbackPolicy: typeof AI_FRONT_DESK_FALLBACK_POLICY;
};

// Include only entries the clinic selected AND that are not an unsaved
// website-scan suggestion (needs_review).
function selectedApprovedLabels(
  entries: { label: string; selected: boolean; suggested: boolean }[],
): string[] {
  return entries.filter((e) => e.selected && !e.suggested).map((e) => e.label);
}

const PAYMENT_METHOD_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((item) => [item.key, item.label]),
);
const FINANCING_DEFAULT_LABEL: Record<string, string> = Object.fromEntries(
  FINANCING_DEFAULTS.map((item) => [item.key, item.label]),
);

// Pure: turn the saved AiFactsView into the runtime context. No DB, no provider.
export function buildAiFrontDeskContextFromFacts(
  facts: AiFactsView,
  clinicName: string | null,
): AiFrontDeskRuntimeContext {
  const hours =
    facts.hours.persisted && !facts.hours.suggested
      ? {
          timezone: facts.hours.timezone,
          days: facts.hours.days.map((d) => ({
            weekday: d.weekday,
            closed: d.closed,
            opensAt: d.opensAt,
            closesAt: d.closesAt,
          })),
        }
      : null;

  const appointmentSettings =
    facts.appointments.persisted && !facts.appointments.suggested
      ? {
          acceptingNewPatients: facts.appointments.acceptingNewPatients,
          cleaningAppointments: facts.appointments.cleaningAppointments,
          sameDayAppointments: facts.appointments.sameDayAppointments,
          emergencyAppointments: facts.appointments.emergencyAppointments,
          rescheduleCancelRequests: facts.appointments.rescheduleCancelRequests,
          preferredTimeQuestion: facts.appointments.preferredTimeQuestion,
        }
      : null;

  // Payment methods + default financing booleans are only trustworthy once the
  // payment section is saved and not a pending suggestion.
  const paymentMethods: string[] = [];
  const financingOptions: string[] = [];
  if (facts.payment.persisted && !facts.payment.suggested) {
    const m = facts.payment.methods;
    const methodFlags: [string, boolean | null][] = [
      ["credit_debit_cards", m.creditDebitCards],
      ["hsa_fsa_cards", m.hsaFsaCards],
      ["personal_checks", m.personalChecks],
      ["cash", m.cash],
      ["bank_transfer_ach", m.bankTransferAch],
    ];
    for (const [key, on] of methodFlags) {
      if (on === true && PAYMENT_METHOD_LABEL[key]) paymentMethods.push(PAYMENT_METHOD_LABEL[key]);
    }

    const f = facts.payment.financing;
    const financingFlags: [string, boolean | null][] = [
      ["in_office_payment_plans", f.inOfficePaymentPlans],
      ["carecredit", f.carecredit],
      ["alphaeon_credit", f.alphaeonCredit],
      ["membership_plan", f.membershipPlan],
    ];
    for (const [key, on] of financingFlags) {
      if (on === true && FINANCING_DEFAULT_LABEL[key]) {
        financingOptions.push(FINANCING_DEFAULT_LABEL[key]);
      }
    }
    financingOptions.push(...selectedApprovedLabels(f.customOptions));
  }

  const officePolicies =
    facts.policies.persisted && !facts.policies.suggested
      ? {
          newPatientForms: facts.policies.newPatientForms,
          whatToBring: facts.policies.whatToBring,
          cancellationPolicy: facts.policies.cancellationPolicy,
          parkingNotes: facts.policies.parkingNotes,
          accessibilityNotes: facts.policies.accessibilityNotes,
        }
      : null;

  // Languages are owner checkboxes (English always on); they are never a
  // website suggestion, so any selected language is safe to include.
  const languages = facts.languages.items.filter((i) => i.selected).map((i) => i.label);

  return {
    clinicName: clinicName?.trim() ? clinicName.trim() : null,
    hours,
    services: selectedApprovedLabels(facts.services),
    insurancePlans: selectedApprovedLabels(facts.insurancePlans),
    appointmentSettings,
    paymentMethods,
    financingOptions,
    officePolicies,
    languages,
    safetyPolicy: AI_FRONT_DESK_SAFETY_POLICY,
    fallbackPolicy: AI_FRONT_DESK_FALLBACK_POLICY,
  };
}

// Server entry point: load the clinic's approved facts and build the context.
export async function getAiFrontDeskRuntimeContext(
  clinicId: string,
  clinicName: string | null = null,
): Promise<AiFrontDeskRuntimeContext> {
  const facts = await getClinicAiFacts(clinicId);
  return buildAiFrontDeskContextFromFacts(facts, clinicName);
}

// Optional deterministic text rendering for tests / future grounding. NOT stored
// in the database and NOT sent to any provider here. Includes only approved
// facts plus the fixed safety + fallback policy; never invents an answer.
export function toRuntimeInstructionText(context: AiFrontDeskRuntimeContext): string {
  const lines: string[] = [];
  lines.push(`Clinic: ${context.clinicName ?? "(name on file)"}`);

  if (context.services.length > 0) lines.push(`Services offered: ${context.services.join(", ")}.`);
  if (context.insurancePlans.length > 0) {
    lines.push(`Insurance plans accepted: ${context.insurancePlans.join(", ")}.`);
  }
  if (context.paymentMethods.length > 0) {
    lines.push(`Payment methods: ${context.paymentMethods.join(", ")}.`);
  }
  if (context.financingOptions.length > 0) {
    lines.push(`Financing options: ${context.financingOptions.join(", ")}.`);
  }
  if (context.languages.length > 0) lines.push(`Languages: ${context.languages.join(", ")}.`);
  if (context.appointmentSettings) {
    lines.push(`Ask for: ${context.appointmentSettings.preferredTimeQuestion}`);
  }

  lines.push("Safety rules:");
  for (const rule of context.safetyPolicy.rules) lines.push(`- ${rule}`);
  lines.push(
    `Anything not listed above: ${context.fallbackPolicy.unknownAnswer}. ${context.fallbackPolicy.note}`,
  );

  return lines.join("\n");
}
