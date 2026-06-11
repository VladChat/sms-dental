import { getDb } from "./client";
import {
  DEFAULT_HOURS_TIMEZONE,
  DEFAULT_INSURANCE_PLANS,
  DEFAULT_LANGUAGES,
  DEFAULT_PREFERRED_TIME_QUESTION,
  DEFAULT_SERVICES,
  LOCKED_LANGUAGE,
  MAX_FINANCING_OPTIONS_PER_CLINIC,
  MAX_INSURANCE_PLANS_PER_CLINIC,
  MAX_SERVICES_PER_CLINIC,
  findDefaultInsurancePlan,
  findDefaultService,
} from "../../config/ai-front-desk-facts.config";
import {
  customKeyFromLabel,
  customLimitReached,
  isCustomKey,
  looksLikeFormLink,
  reviewedSectionsView,
  type AiReviewSectionKey,
  type AppointmentSettingsValue,
  type CatalogSectionUpdate,
  type FinancingDefaultsValue,
  type FinancingSectionUpdate,
  type HoursValue,
  type OfficePoliciesValue,
  type PaymentMethodsValue,
  type ReviewedSectionsView,
} from "../ai-knowledge/facts";
import type { AggregatedFacts } from "../ai-knowledge/website-extract";

// Clinic-scoped structured AI Front Desk facts (hours, services, insurance,
// appointments, payment, office policies) plus the website scan run log.
// Foundation-only: no AI runtime reads these tables. All writes are
// owner-reviewed ("approved") except website-scan drafts, which stay
// 'needs_review' until the owner saves the section.

// --------------------------------------------------------------- row types

type HoursRow = {
  weekday: number;
  interval_index: number;
  is_closed: boolean;
  opens_at: string | null; // "HH:MM:SS" from time columns
  closes_at: string | null;
  timezone: string;
  status: string;
};

type CatalogEntryRow = {
  service_key?: string;
  plan_key?: string;
  label: string;
  selected: boolean;
  is_custom: boolean;
  status: string;
  sort_order: number;
};

type AppointmentSettingsRow = {
  accepting_new_patients: boolean | null;
  cleaning_appointments: boolean | null;
  same_day_appointments: boolean | null;
  emergency_appointments: boolean | null;
  reschedule_cancel_requests: boolean | null;
  preferred_time_question: string;
  status: string;
};

type PaymentSettingsRow = {
  cash: boolean | null;
  credit_debit_cards: boolean | null;
  personal_checks: boolean | null;
  hsa_fsa_cards: boolean | null;
  in_office_payment_plans: boolean | null;
  carecredit: boolean | null;
  alphaeon_credit: boolean | null;
  membership_plan: boolean | null;
  status: string;
};

type FinancingOptionRow = {
  option_key: string;
  label: string;
  selected: boolean;
  is_custom: boolean;
  status: string;
  sort_order: number;
};

type OfficePoliciesRow = {
  new_patient_forms: string | null;
  what_to_bring: string | null;
  cancellation_policy: string | null;
  languages: string[];
  parking_notes: string | null;
  accessibility_notes: string | null;
  status: string;
};

type ScanRunRow = {
  id: string;
  status: string;
  pages_scanned: number;
  facts_found: number;
  review_notes: string | null;
  error_message: string | null;
  completed_at: Date | null;
};

// -------------------------------------------------------------- view types

export type AiFactsCatalogEntryView = {
  key: string;
  label: string;
  selected: boolean;
  isCustom: boolean;
  // True when the value came from a website scan and was not saved yet.
  suggested: boolean;
  // True for an always-on, non-removable entry (e.g. English in Languages).
  locked?: boolean;
};

export type AiFactsHoursDayView = {
  weekday: number;
  closed: boolean;
  opensAt: string | null; // "HH:MM"
  closesAt: string | null;
};

export type AiFactsView = {
  hours: {
    timezone: string;
    persisted: boolean;
    suggested: boolean;
    days: AiFactsHoursDayView[];
  };
  services: AiFactsCatalogEntryView[];
  insurancePlans: AiFactsCatalogEntryView[];
  appointments: {
    acceptingNewPatients: boolean | null;
    cleaningAppointments: boolean | null;
    sameDayAppointments: boolean | null;
    emergencyAppointments: boolean | null;
    rescheduleCancelRequests: boolean | null;
    preferredTimeQuestion: string;
    persisted: boolean;
    suggested: boolean;
  };
  payment: {
    methods: {
      cash: boolean | null;
      creditDebitCards: boolean | null;
      personalChecks: boolean | null;
      hsaFsaCards: boolean | null;
    };
    financing: {
      inOfficePaymentPlans: boolean | null;
      carecredit: boolean | null;
      alphaeonCredit: boolean | null;
      membershipPlan: boolean | null;
      customOptions: AiFactsCatalogEntryView[];
    };
    persisted: boolean;
    suggested: boolean;
  };
  policies: {
    newPatientForms: string | null; // a form link
    whatToBring: string | null;
    cancellationPolicy: string | null;
    parkingNotes: string | null;
    accessibilityNotes: string | null;
    persisted: boolean;
    suggested: boolean;
  };
  languages: {
    items: AiFactsCatalogEntryView[];
    persisted: boolean;
  };
  // Per-section Needs review → Complete state (clinic_ai_knowledge_section_reviews).
  reviewedSections: ReviewedSectionsView;
  lastScan: {
    status: string;
    pagesScanned: number;
    factsFound: number;
    reviewNotes: string | null;
    completedAt: string | null;
  } | null;
};

function timeToHHMM(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{2}:\d{2})/.exec(value);
  return match ? match[1] : null;
}

// Starting hours shown before a clinic ever saves: weekdays 8–5, weekend
// closed. UI-only defaults; nothing is persisted until the owner saves.
function defaultHoursDays(): AiFactsHoursDayView[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    closed: weekday === 0 || weekday === 6,
    opensAt: weekday === 0 || weekday === 6 ? null : "08:00",
    closesAt: weekday === 0 || weekday === 6 ? null : "17:00",
  }));
}

function catalogView(
  catalog: readonly { key: string; label: string }[],
  rows: CatalogEntryRow[],
  keyField: "service_key" | "plan_key",
): AiFactsCatalogEntryView[] {
  const rowByKey = new Map(rows.map((row) => [row[keyField] as string, row]));
  const view: AiFactsCatalogEntryView[] = catalog.map((item) => {
    const row = rowByKey.get(item.key);
    return {
      key: item.key,
      label: item.label,
      selected: row?.selected ?? false,
      isCustom: false,
      suggested: row?.status === "needs_review",
    };
  });
  const customRows = rows
    .filter((row) => row.is_custom)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  for (const row of customRows) {
    view.push({
      key: row[keyField] as string,
      label: row.label,
      selected: row.selected,
      isCustom: true,
      suggested: row.status === "needs_review",
    });
  }
  return view;
}

// Build the Languages checkbox view from the stored text[]. The default
// languages always appear; English is locked on. Stored languages that are not
// defaults appear as removable custom items (in stored order).
function languagesView(stored: string[]): AiFactsCatalogEntryView[] {
  const storedByLower = new Map<string, string>();
  for (const language of stored) {
    const lower = language.trim().toLowerCase();
    if (lower.length > 0 && !storedByLower.has(lower)) storedByLower.set(lower, language.trim());
  }
  const defaultLower = new Set(DEFAULT_LANGUAGES.map((name) => name.toLowerCase()));

  const items: AiFactsCatalogEntryView[] = DEFAULT_LANGUAGES.map((name) => ({
    key: `lang_${name.toLowerCase()}`,
    label: name,
    selected: name === LOCKED_LANGUAGE ? true : storedByLower.has(name.toLowerCase()),
    isCustom: false,
    suggested: false,
    locked: name === LOCKED_LANGUAGE,
  }));
  for (const [lower, original] of storedByLower) {
    if (defaultLower.has(lower)) continue;
    items.push({
      key: `lang_custom_${lower}`,
      label: original,
      selected: true,
      isCustom: true,
      suggested: false,
      locked: false,
    });
  }
  return items;
}

// Custom financing options view. Default financing options are booleans on the
// payment row; this table holds only the owner-added custom rows.
function financingOptionsView(rows: FinancingOptionRow[]): AiFactsCatalogEntryView[] {
  return rows
    .filter((row) => row.is_custom)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    .map((row) => ({
      key: row.option_key,
      label: row.label,
      selected: row.selected,
      isCustom: true,
      suggested: row.status === "needs_review",
    }));
}

// ----------------------------------------------------------------- queries

export async function getClinicAiFacts(clinicId: string): Promise<AiFactsView> {
  const sql = getDb();
  const [
    hoursRows,
    serviceRows,
    insuranceRows,
    appointmentRows,
    paymentRows,
    financingRows,
    policyRows,
    reviewRows,
    scanRows,
  ] = await Promise.all([
      sql<HoursRow[]>`
        select weekday, interval_index, is_closed, opens_at, closes_at, timezone, status
        from public.clinic_ai_hours
        where clinic_id = ${clinicId}
        order by weekday, interval_index
      `,
      sql<CatalogEntryRow[]>`
        select service_key, label, selected, is_custom, status, sort_order
        from public.clinic_ai_services
        where clinic_id = ${clinicId}
      `,
      sql<CatalogEntryRow[]>`
        select plan_key, label, selected, is_custom, status, sort_order
        from public.clinic_ai_insurance_plans
        where clinic_id = ${clinicId}
      `,
      sql<AppointmentSettingsRow[]>`
        select accepting_new_patients, cleaning_appointments, same_day_appointments,
               emergency_appointments, reschedule_cancel_requests, preferred_time_question, status
        from public.clinic_ai_appointment_settings
        where clinic_id = ${clinicId}
      `,
      sql<PaymentSettingsRow[]>`
        select cash, credit_debit_cards, personal_checks, hsa_fsa_cards,
               in_office_payment_plans, carecredit, alphaeon_credit, membership_plan, status
        from public.clinic_ai_payment_settings
        where clinic_id = ${clinicId}
      `,
      sql<FinancingOptionRow[]>`
        select option_key, label, selected, is_custom, status, sort_order
        from public.clinic_ai_financing_options
        where clinic_id = ${clinicId}
      `,
      sql<OfficePoliciesRow[]>`
        select new_patient_forms, what_to_bring, cancellation_policy, languages,
               parking_notes, accessibility_notes, status
        from public.clinic_ai_office_policies
        where clinic_id = ${clinicId}
      `,
      sql<{ section_key: string }[]>`
        select section_key
        from public.clinic_ai_knowledge_section_reviews
        where clinic_id = ${clinicId}
      `,
      sql<ScanRunRow[]>`
        select id, status, pages_scanned, facts_found, review_notes, error_message, completed_at
        from public.clinic_website_scan_runs
        where clinic_id = ${clinicId}
        order by started_at desc
        limit 1
      `,
    ]);

  let hoursDays: AiFactsHoursDayView[];
  if (hoursRows.length === 0) {
    hoursDays = defaultHoursDays();
  } else {
    // The editor works with one range per day (interval_index 0). Extra
    // intervals are a future capability the schema supports.
    const byWeekday = new Map<number, HoursRow>();
    for (const row of hoursRows) {
      if (!byWeekday.has(row.weekday)) byWeekday.set(row.weekday, row);
    }
    hoursDays = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
      const row = byWeekday.get(weekday);
      if (!row) return { weekday, closed: true, opensAt: null, closesAt: null };
      return {
        weekday,
        closed: row.is_closed,
        opensAt: timeToHHMM(row.opens_at),
        closesAt: timeToHHMM(row.closes_at),
      };
    });
  }

  const appointments = appointmentRows[0] ?? null;
  const payment = paymentRows[0] ?? null;
  const policies = policyRows[0] ?? null;
  const scan = scanRows[0] ?? null;

  return {
    hours: {
      timezone: hoursRows[0]?.timezone ?? DEFAULT_HOURS_TIMEZONE,
      persisted: hoursRows.length > 0,
      suggested: hoursRows.some((row) => row.status === "needs_review"),
      days: hoursDays,
    },
    services: catalogView(DEFAULT_SERVICES, serviceRows, "service_key"),
    insurancePlans: catalogView(DEFAULT_INSURANCE_PLANS, insuranceRows, "plan_key"),
    appointments: {
      acceptingNewPatients: appointments?.accepting_new_patients ?? null,
      cleaningAppointments: appointments?.cleaning_appointments ?? null,
      sameDayAppointments: appointments?.same_day_appointments ?? null,
      emergencyAppointments: appointments?.emergency_appointments ?? null,
      rescheduleCancelRequests: appointments?.reschedule_cancel_requests ?? null,
      preferredTimeQuestion: appointments?.preferred_time_question ?? DEFAULT_PREFERRED_TIME_QUESTION,
      persisted: appointments !== null,
      suggested: appointments?.status === "needs_review",
    },
    payment: {
      methods: {
        cash: payment?.cash ?? null,
        creditDebitCards: payment?.credit_debit_cards ?? null,
        personalChecks: payment?.personal_checks ?? null,
        hsaFsaCards: payment?.hsa_fsa_cards ?? null,
      },
      financing: {
        inOfficePaymentPlans: payment?.in_office_payment_plans ?? null,
        carecredit: payment?.carecredit ?? null,
        alphaeonCredit: payment?.alphaeon_credit ?? null,
        membershipPlan: payment?.membership_plan ?? null,
        customOptions: financingOptionsView(financingRows),
      },
      persisted: payment !== null,
      suggested:
        payment?.status === "needs_review" ||
        financingRows.some((row) => row.status === "needs_review"),
    },
    policies: {
      // Form link only — drop any legacy/noisy non-link value (e.g. a website
      // text excerpt) so it never shows in the field and clears on next save.
      newPatientForms:
        policies?.new_patient_forms && looksLikeFormLink(policies.new_patient_forms)
          ? policies.new_patient_forms
          : null,
      whatToBring: policies?.what_to_bring ?? null,
      cancellationPolicy: policies?.cancellation_policy ?? null,
      parkingNotes: policies?.parking_notes ?? null,
      accessibilityNotes: policies?.accessibility_notes ?? null,
      persisted: policies !== null,
      // Only flag a policy review when there is a draft form link to review.
      suggested:
        policies?.status === "needs_review" &&
        Boolean(policies?.new_patient_forms && looksLikeFormLink(policies.new_patient_forms)),
    },
    languages: {
      items: languagesView(policies?.languages ?? []),
      persisted: (policies?.languages?.length ?? 0) > 0,
    },
    reviewedSections: reviewedSectionsView(reviewRows.map((row) => row.section_key)),
    lastScan: scan
      ? {
          status: scan.status,
          pagesScanned: scan.pages_scanned,
          factsFound: scan.facts_found,
          reviewNotes: scan.review_notes,
          completedAt: scan.completed_at ? scan.completed_at.toISOString() : null,
        }
      : null,
  };
}

// The clinic's existing custom entries (key + label). Routes use these to
// validate removals and duplicate labels; custom keys are only ever minted
// server-side.
export type CustomCatalogEntry = { key: string; label: string };

export async function listCustomServiceEntries(clinicId: string): Promise<CustomCatalogEntry[]> {
  const sql = getDb();
  const rows = await sql<{ service_key: string; label: string }[]>`
    select service_key, label from public.clinic_ai_services
    where clinic_id = ${clinicId} and is_custom = true
  `;
  return rows.map((r) => ({ key: r.service_key, label: r.label }));
}

export async function listCustomInsuranceEntries(clinicId: string): Promise<CustomCatalogEntry[]> {
  const sql = getDb();
  const rows = await sql<{ plan_key: string; label: string }[]>`
    select plan_key, label from public.clinic_ai_insurance_plans
    where clinic_id = ${clinicId} and is_custom = true
  `;
  return rows.map((r) => ({ key: r.plan_key, label: r.label }));
}

export async function listCustomFinancingEntries(clinicId: string): Promise<CustomCatalogEntry[]> {
  const sql = getDb();
  const rows = await sql<{ option_key: string; label: string }[]>`
    select option_key, label from public.clinic_ai_financing_options
    where clinic_id = ${clinicId} and is_custom = true
  `;
  return rows.map((r) => ({ key: r.option_key, label: r.label }));
}

// ----------------------------------------------------------- review lifecycle

// Mark exactly ONE section reviewed after its successful owner save. Sections
// are independent rows: saving Payment methods never marks Financing & plans
// complete (and vice versa), and Languages/Office policies stay separate even
// though they share the clinic_ai_office_policies row.
export async function markSectionReviewed(
  clinicId: string,
  sectionKey: AiReviewSectionKey,
  reviewedByProfileId: string | null,
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into public.clinic_ai_knowledge_section_reviews (
      clinic_id, section_key, reviewed_at, reviewed_by_profile_id
    ) values (
      ${clinicId}, ${sectionKey}, now(), ${reviewedByProfileId}
    )
    on conflict (clinic_id, section_key) do update set
      reviewed_at = now(),
      reviewed_by_profile_id = excluded.reviewed_by_profile_id
  `;
}

// ------------------------------------------------------------------- saves

// Full replace of the weekly schedule (the editor submits all 7 days).
// Owner saves are reviewed: status 'approved', source 'manual'.
export async function saveClinicHours(
  clinicId: string,
  value: HoursValue,
  reviewedByProfileId: string | null,
): Promise<void> {
  const sql = getDb();
  await sql.begin(async (tx) => {
    await tx`delete from public.clinic_ai_hours where clinic_id = ${clinicId}`;
    for (const day of value.days) {
      if (day.closed) {
        await tx`
          insert into public.clinic_ai_hours (
            clinic_id, weekday, interval_index, is_closed, opens_at, closes_at,
            timezone, status, source_type, reviewed_at, reviewed_by_profile_id
          ) values (
            ${clinicId}, ${day.weekday}, 0, true, null, null,
            ${value.timezone}, 'approved', 'manual', now(), ${reviewedByProfileId}
          )
        `;
        continue;
      }
      for (let i = 0; i < day.intervals.length; i += 1) {
        const interval = day.intervals[i];
        await tx`
          insert into public.clinic_ai_hours (
            clinic_id, weekday, interval_index, is_closed, opens_at, closes_at,
            timezone, status, source_type, reviewed_at, reviewed_by_profile_id
          ) values (
            ${clinicId}, ${day.weekday}, ${i}, false, ${interval.opensAt}, ${interval.closesAt},
            ${value.timezone}, 'approved', 'manual', now(), ${reviewedByProfileId}
          )
        `;
      }
    }
  });
}

export type SaveCatalogSectionResult = { ok: true } | { ok: false; reason: "limit_reached" };

// Persist one full section save: remove custom rows, insert new custom rows
// (keys minted server-side from validated labels), and upsert checkbox
// selections — all in one transaction. Owner saves are reviewed: status
// 'approved', source 'manual'. The entry cap is re-checked inside the
// transaction (validation already checked it; this guards races).
async function saveCatalogSection(
  table: "clinic_ai_services" | "clinic_ai_insurance_plans",
  keyField: "service_key" | "plan_key",
  catalogSize: number,
  maxEntries: number,
  clinicId: string,
  update: CatalogSectionUpdate,
  reviewedByProfileId: string | null,
): Promise<SaveCatalogSectionResult> {
  const sql = getDb();
  return sql.begin(async (tx) => {
    for (const key of update.customToRemove) {
      await tx`
        delete from ${tx(`public.${table}`)}
        where clinic_id = ${clinicId} and ${tx(keyField)} = ${key} and is_custom = true
      `;
    }

    const [{ count }] = await tx<{ count: string }[]>`
      select count(*)::text as count from ${tx(`public.${table}`)}
      where clinic_id = ${clinicId} and is_custom = true
    `;
    if (
      update.customToAdd.length > 0 &&
      customLimitReached(catalogSize, Number(count) + update.customToAdd.length - 1, maxEntries)
    ) {
      // Throwing rolls back the deletes too; map to a friendly result instead.
      throw new CatalogLimitReachedError();
    }

    for (let i = 0; i < update.customToAdd.length; i += 1) {
      const custom = update.customToAdd[i];
      await tx`
        insert into ${tx(`public.${table}`)} (
          clinic_id, ${tx(keyField)}, label, selected, is_custom,
          status, source_type, reviewed_at, reviewed_by_profile_id, sort_order
        ) values (
          ${clinicId}, ${customKeyFromLabel(custom.label)}, ${custom.label}, ${custom.selected}, true,
          'approved', 'manual', now(), ${reviewedByProfileId}, ${1000 + Number(count) + i}
        )
        on conflict (clinic_id, ${tx(keyField)}) do update set
          label = excluded.label,
          selected = excluded.selected,
          status = 'approved',
          source_type = 'manual',
          reviewed_at = excluded.reviewed_at,
          reviewed_by_profile_id = excluded.reviewed_by_profile_id
      `;
    }

    for (const selection of update.selections) {
      const catalogItem =
        keyField === "service_key"
          ? findDefaultService(selection.key)
          : findDefaultInsurancePlan(selection.key);
      if (catalogItem) {
        await tx`
          insert into ${tx(`public.${table}`)} (
            clinic_id, ${tx(keyField)}, label, selected, is_custom,
            status, source_type, reviewed_at, reviewed_by_profile_id, sort_order
          ) values (
            ${clinicId}, ${selection.key}, ${catalogItem.label}, ${selection.selected}, false,
            'approved', 'manual', now(), ${reviewedByProfileId}, 0
          )
          on conflict (clinic_id, ${tx(keyField)}) do update set
            selected = excluded.selected,
            status = 'approved',
            reviewed_at = excluded.reviewed_at,
            reviewed_by_profile_id = excluded.reviewed_by_profile_id
        `;
      } else if (isCustomKey(selection.key)) {
        // Existing custom rows only; unknown keys were rejected in validation
        // and removed keys were dropped from selections there too.
        await tx`
          update ${tx(`public.${table}`)} set
            selected = ${selection.selected},
            status = 'approved',
            reviewed_at = now(),
            reviewed_by_profile_id = ${reviewedByProfileId}
          where clinic_id = ${clinicId} and ${tx(keyField)} = ${selection.key} and is_custom = true
        `;
      }
    }

    return { ok: true } as const;
  }).catch((error: unknown) => {
    if (error instanceof CatalogLimitReachedError) {
      return { ok: false, reason: "limit_reached" } as const;
    }
    throw error;
  });
}

class CatalogLimitReachedError extends Error {
  constructor() {
    super("catalog entry limit reached");
    this.name = "CatalogLimitReachedError";
  }
}

export async function saveServiceSection(
  clinicId: string,
  update: CatalogSectionUpdate,
  reviewedByProfileId: string | null,
): Promise<SaveCatalogSectionResult> {
  return saveCatalogSection(
    "clinic_ai_services",
    "service_key",
    DEFAULT_SERVICES.length,
    MAX_SERVICES_PER_CLINIC,
    clinicId,
    update,
    reviewedByProfileId,
  );
}

export async function saveInsuranceSection(
  clinicId: string,
  update: CatalogSectionUpdate,
  reviewedByProfileId: string | null,
): Promise<SaveCatalogSectionResult> {
  return saveCatalogSection(
    "clinic_ai_insurance_plans",
    "plan_key",
    DEFAULT_INSURANCE_PLANS.length,
    MAX_INSURANCE_PLANS_PER_CLINIC,
    clinicId,
    update,
    reviewedByProfileId,
  );
}

export async function saveAppointmentSettings(
  clinicId: string,
  value: AppointmentSettingsValue,
  reviewedByProfileId: string | null,
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into public.clinic_ai_appointment_settings (
      clinic_id, accepting_new_patients, cleaning_appointments, same_day_appointments,
      emergency_appointments, reschedule_cancel_requests, preferred_time_question,
      status, source_type, reviewed_at, reviewed_by_profile_id
    ) values (
      ${clinicId}, ${value.acceptingNewPatients}, ${value.cleaningAppointments}, ${value.sameDayAppointments},
      ${value.emergencyAppointments}, ${value.rescheduleCancelRequests}, ${value.preferredTimeQuestion},
      'approved', 'manual', now(), ${reviewedByProfileId}
    )
    on conflict (clinic_id) do update set
      accepting_new_patients = excluded.accepting_new_patients,
      cleaning_appointments = excluded.cleaning_appointments,
      same_day_appointments = excluded.same_day_appointments,
      emergency_appointments = excluded.emergency_appointments,
      reschedule_cancel_requests = excluded.reschedule_cancel_requests,
      preferred_time_question = excluded.preferred_time_question,
      status = 'approved',
      source_type = 'manual',
      reviewed_at = excluded.reviewed_at,
      reviewed_by_profile_id = excluded.reviewed_by_profile_id
  `;
}

// Save the Payment methods section (which methods the office accepts). Touches
// only the method columns on the shared payment row, so a financing save never
// clobbers it and vice versa. The legacy pricing_policy column is cleared.
export async function savePaymentMethods(
  clinicId: string,
  value: PaymentMethodsValue,
  reviewedByProfileId: string | null,
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into public.clinic_ai_payment_settings (
      clinic_id, cash, credit_debit_cards, personal_checks, hsa_fsa_cards, pricing_policy,
      status, source_type, reviewed_at, reviewed_by_profile_id
    ) values (
      ${clinicId}, ${value.cash}, ${value.creditDebitCards}, ${value.personalChecks},
      ${value.hsaFsaCards}, null,
      'approved', 'manual', now(), ${reviewedByProfileId}
    )
    on conflict (clinic_id) do update set
      cash = excluded.cash,
      credit_debit_cards = excluded.credit_debit_cards,
      personal_checks = excluded.personal_checks,
      hsa_fsa_cards = excluded.hsa_fsa_cards,
      pricing_policy = null,
      status = 'approved',
      source_type = 'manual',
      reviewed_at = excluded.reviewed_at,
      reviewed_by_profile_id = excluded.reviewed_by_profile_id
  `;
}

export type SaveFinancingResult = { ok: true } | { ok: false; reason: "limit_reached" };

// Save the whole Financing & plans section in one transaction: the default
// financing booleans on the payment row, plus the custom-options add/remove/
// select on clinic_ai_financing_options. Custom keys are minted server-side.
// The 50-option cap is re-checked inside the transaction (guards races).
export async function saveFinancingSection(
  clinicId: string,
  defaults: FinancingDefaultsValue,
  custom: FinancingSectionUpdate["custom"],
  reviewedByProfileId: string | null,
): Promise<SaveFinancingResult> {
  const sql = getDb();
  return sql
    .begin(async (tx) => {
      // Default financing booleans live on the shared payment row. Touch only
      // those columns so a Payment methods save is never clobbered; clear the
      // legacy pricing_policy column.
      await tx`
        insert into public.clinic_ai_payment_settings (
          clinic_id, in_office_payment_plans, carecredit, alphaeon_credit, membership_plan,
          pricing_policy, status, source_type, reviewed_at, reviewed_by_profile_id
        ) values (
          ${clinicId}, ${defaults.inOfficePaymentPlans}, ${defaults.carecredit},
          ${defaults.alphaeonCredit}, ${defaults.membershipPlan},
          null, 'approved', 'manual', now(), ${reviewedByProfileId}
        )
        on conflict (clinic_id) do update set
          in_office_payment_plans = excluded.in_office_payment_plans,
          carecredit = excluded.carecredit,
          alphaeon_credit = excluded.alphaeon_credit,
          membership_plan = excluded.membership_plan,
          pricing_policy = null,
          status = 'approved',
          source_type = 'manual',
          reviewed_at = excluded.reviewed_at,
          reviewed_by_profile_id = excluded.reviewed_by_profile_id
      `;

      for (const key of custom.customToRemove) {
        await tx`
          delete from public.clinic_ai_financing_options
          where clinic_id = ${clinicId} and option_key = ${key} and is_custom = true
        `;
      }

      const [{ count }] = await tx<{ count: string }[]>`
        select count(*)::text as count from public.clinic_ai_financing_options
        where clinic_id = ${clinicId} and is_custom = true
      `;
      if (Number(count) + custom.customToAdd.length > MAX_FINANCING_OPTIONS_PER_CLINIC) {
        throw new CatalogLimitReachedError();
      }

      for (let i = 0; i < custom.customToAdd.length; i += 1) {
        const option = custom.customToAdd[i];
        await tx`
          insert into public.clinic_ai_financing_options (
            clinic_id, option_key, label, selected, is_custom,
            status, source_type, sort_order
          ) values (
            ${clinicId}, ${customKeyFromLabel(option.label)}, ${option.label}, ${option.selected}, true,
            'approved', 'manual', ${1000 + Number(count) + i}
          )
          on conflict (clinic_id, option_key) do update set
            label = excluded.label,
            selected = excluded.selected,
            status = 'approved',
            source_type = 'manual'
        `;
      }

      for (const selection of custom.selections) {
        // Existing custom rows only; unknown/removed keys were dropped in
        // validation.
        if (!isCustomKey(selection.key)) continue;
        await tx`
          update public.clinic_ai_financing_options set
            selected = ${selection.selected},
            status = 'approved'
          where clinic_id = ${clinicId} and option_key = ${selection.key} and is_custom = true
        `;
      }

      return { ok: true } as const;
    })
    .catch((error: unknown) => {
      if (error instanceof CatalogLimitReachedError) {
        return { ok: false, reason: "limit_reached" } as const;
      }
      throw error;
    });
}

// Save office policy text fields. Languages live in their own column managed by
// saveOfficeLanguages, so this never touches `languages` (the two saves share
// the row but not each other's columns).
export async function saveOfficePolicies(
  clinicId: string,
  value: OfficePoliciesValue,
  reviewedByProfileId: string | null,
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into public.clinic_ai_office_policies (
      clinic_id, new_patient_forms, what_to_bring, cancellation_policy,
      parking_notes, accessibility_notes,
      status, source_type, reviewed_at, reviewed_by_profile_id
    ) values (
      ${clinicId}, ${value.newPatientForms}, ${value.whatToBring}, ${value.cancellationPolicy},
      ${value.parkingNotes}, ${value.accessibilityNotes},
      'approved', 'manual', now(), ${reviewedByProfileId}
    )
    on conflict (clinic_id) do update set
      new_patient_forms = excluded.new_patient_forms,
      what_to_bring = excluded.what_to_bring,
      cancellation_policy = excluded.cancellation_policy,
      parking_notes = excluded.parking_notes,
      accessibility_notes = excluded.accessibility_notes,
      status = 'approved',
      source_type = 'manual',
      reviewed_at = excluded.reviewed_at,
      reviewed_by_profile_id = excluded.reviewed_by_profile_id
  `;
}

// Save the languages list (own section). Only touches the `languages` column so
// it never clobbers policy text; status/source on the shared row are left as-is
// so a pending policy-text review is not silently approved here. The caller
// (validateLanguagesList) guarantees English is included.
export async function saveOfficeLanguages(
  clinicId: string,
  languages: string[],
  reviewedByProfileId: string | null,
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into public.clinic_ai_office_policies (
      clinic_id, languages, reviewed_at, reviewed_by_profile_id
    ) values (
      ${clinicId}, ${languages}, now(), ${reviewedByProfileId}
    )
    on conflict (clinic_id) do update set
      languages = excluded.languages,
      reviewed_at = excluded.reviewed_at,
      reviewed_by_profile_id = excluded.reviewed_by_profile_id
  `;
}

// ---------------------------------------------------------- scan run + drafts

export async function createScanRun(clinicId: string, websiteUrl: string): Promise<string> {
  const sql = getDb();
  const [row] = await sql<{ id: string }[]>`
    insert into public.clinic_website_scan_runs (clinic_id, website_url, status)
    values (${clinicId}, ${websiteUrl}, 'running')
    returning id
  `;
  return row.id;
}

export async function completeScanRun(params: {
  runId: string;
  status: "completed" | "failed";
  pagesScanned: number;
  factsFound: number;
  reviewNotes: string | null;
  errorMessage: string | null;
}): Promise<void> {
  const sql = getDb();
  await sql`
    update public.clinic_website_scan_runs set
      status = ${params.status},
      pages_scanned = ${params.pagesScanned},
      facts_found = ${params.factsFound},
      review_notes = ${params.reviewNotes},
      error_message = ${params.errorMessage},
      completed_at = now()
    where id = ${params.runId}
  `;
}

// Write aggregated scan facts as drafts ('needs_review' / 'website_draft').
// Conservative rules: never touch rows the owner already approved or turned
// off, never overwrite owner hours, and only fill blanks in singleton rows.
// Appointment signals are NOT drafted: there is no owner Appointments UI, so
// scan results must never create owner-review work there.
// Sections that actually receive new drafts get their review row removed so
// the owner sees "Needs review" again; untouched sections stay "Complete".
// Returns notes for the run log (e.g. kept owner hours).
export async function applyScanDrafts(
  clinicId: string,
  facts: AggregatedFacts,
  scannedOrigin: string,
): Promise<string[]> {
  const sql = getDb();
  const notes: string[] = [];
  const urlFor = (factKey: string) => facts.sourceUrlByFact.get(factKey) ?? scannedOrigin;

  await sql.begin(async (tx) => {
    const draftedSections = new Set<AiReviewSectionKey>();

    for (const match of facts.services) {
      const item = findDefaultService(match.key);
      if (!item) continue;
      const result = await tx`
        insert into public.clinic_ai_services (
          clinic_id, service_key, label, selected, is_custom,
          status, source_type, source_url, source_excerpt, confidence, sort_order
        ) values (
          ${clinicId}, ${match.key}, ${item.label}, true, false,
          'needs_review', 'website_draft', ${urlFor(`service:${match.key}`)}, ${match.excerpt}, ${match.confidence}, 0
        )
        on conflict (clinic_id, service_key) do update set
          selected = true,
          status = 'needs_review',
          source_type = 'website_draft',
          source_url = excluded.source_url,
          source_excerpt = excluded.source_excerpt,
          confidence = excluded.confidence
        where public.clinic_ai_services.status in ('not_found', 'needs_review')
      `;
      if (result.count > 0) draftedSections.add("services");
    }

    for (const match of facts.insurancePlans) {
      const item = findDefaultInsurancePlan(match.key);
      if (!item) continue;
      const result = await tx`
        insert into public.clinic_ai_insurance_plans (
          clinic_id, plan_key, label, selected, is_custom,
          status, source_type, source_url, source_excerpt, confidence, sort_order
        ) values (
          ${clinicId}, ${match.key}, ${item.label}, true, false,
          'needs_review', 'website_draft', ${urlFor(`insurance:${match.key}`)}, ${match.excerpt}, ${match.confidence}, 0
        )
        on conflict (clinic_id, plan_key) do update set
          selected = true,
          status = 'needs_review',
          source_type = 'website_draft',
          source_url = excluded.source_url,
          source_excerpt = excluded.source_excerpt,
          confidence = excluded.confidence
        where public.clinic_ai_insurance_plans.status in ('not_found', 'needs_review')
      `;
      if (result.count > 0) draftedSections.add("insurance");
    }

    if (facts.hours.length > 0) {
      const [{ count: approvedCount }] = await tx<{ count: string }[]>`
        select count(*)::text as count from public.clinic_ai_hours
        where clinic_id = ${clinicId} and status = 'approved'
      `;
      if (Number(approvedCount) > 0) {
        notes.push("Hours found on your website were not applied because saved hours already exist.");
      } else {
        await tx`
          delete from public.clinic_ai_hours
          where clinic_id = ${clinicId} and status = 'needs_review'
        `;
        const intervalIndexByWeekday = new Map<number, number>();
        for (const draft of facts.hours) {
          const intervalIndex = intervalIndexByWeekday.get(draft.weekday) ?? 0;
          if (intervalIndex > 2) continue;
          intervalIndexByWeekday.set(draft.weekday, intervalIndex + 1);
          const result = await tx`
            insert into public.clinic_ai_hours (
              clinic_id, weekday, interval_index, is_closed, opens_at, closes_at, timezone,
              status, source_type, source_url, source_excerpt, confidence
            ) values (
              ${clinicId}, ${draft.weekday}, ${intervalIndex}, ${draft.closed},
              ${draft.opensAt}, ${draft.closesAt}, ${DEFAULT_HOURS_TIMEZONE},
              'needs_review', 'website_draft', ${urlFor("hours")}, ${draft.excerpt}, ${draft.confidence}
            )
            on conflict (clinic_id, weekday, interval_index) do nothing
          `;
          if (result.count > 0) draftedSections.add("hours");
        }
      }
    }

    // Map detected financing facts to the structured columns. Payment-plan
    // text → in_office_payment_plans, CareCredit → carecredit, Alphaeon →
    // alphaeon_credit, membership → membership_plan. Payment METHODS (cash,
    // cards, checks, HSA/FSA) are never inferred from generic page text.
    const inOfficePaymentPlans = facts.payment.paymentPlans ? true : null;
    const carecredit = facts.payment.carecredit ? true : null;
    const alphaeonCredit = facts.payment.alphaeonCredit ? true : null;
    const membershipPlan = facts.payment.membershipPlan ? true : null;
    const paymentFound =
      inOfficePaymentPlans || carecredit || alphaeonCredit || membershipPlan;
    if (paymentFound) {
      const [payment] = await tx<{ status: string }[]>`
        select status from public.clinic_ai_payment_settings where clinic_id = ${clinicId}
      `;
      if (!payment) {
        await tx`
          insert into public.clinic_ai_payment_settings (
            clinic_id, in_office_payment_plans, carecredit, alphaeon_credit, membership_plan,
            status, source_type, source_url, source_excerpt
          ) values (
            ${clinicId},
            ${inOfficePaymentPlans},
            ${carecredit},
            ${alphaeonCredit},
            ${membershipPlan},
            'needs_review', 'website_draft', ${urlFor("payment")}, ${facts.payment.excerpt}
          )
        `;
        draftedSections.add("financing");
      } else if (payment.status !== "approved") {
        const result = await tx`
          update public.clinic_ai_payment_settings set
            in_office_payment_plans = coalesce(in_office_payment_plans, ${inOfficePaymentPlans}),
            carecredit = coalesce(carecredit, ${carecredit}),
            alphaeon_credit = coalesce(alphaeon_credit, ${alphaeonCredit}),
            membership_plan = coalesce(membership_plan, ${membershipPlan}),
            status = 'needs_review',
            source_type = 'website_draft',
            source_url = ${urlFor("payment")},
            source_excerpt = coalesce(source_excerpt, ${facts.payment.excerpt})
          where clinic_id = ${clinicId}
        `;
        if (result.count > 0) draftedSections.add("financing");
      }
    }

    // Office policies: only a clean form LINK is ever drafted (never page text).
    // Languages drafts go to the same row's languages column. Each draft only
    // re-opens review for its own section: a form-link draft re-opens
    // office_policies, a languages draft re-opens languages.
    if (facts.languages.length > 0 || facts.newPatientFormLink) {
      const [policies] = await tx<{ status: string; languages: string[]; new_patient_forms: string | null }[]>`
        select status, languages, new_patient_forms
        from public.clinic_ai_office_policies where clinic_id = ${clinicId}
      `;
      if (!policies) {
        await tx`
          insert into public.clinic_ai_office_policies (
            clinic_id, new_patient_forms, languages,
            status, source_type, source_url
          ) values (
            ${clinicId}, ${facts.newPatientFormLink}, ${facts.languages},
            'needs_review', 'website_draft', ${urlFor("new_patient_forms")}
          )
        `;
        if (facts.newPatientFormLink) draftedSections.add("office_policies");
        if (facts.languages.length > 0) draftedSections.add("languages");
      } else if (policies.status !== "approved") {
        const result = await tx`
          update public.clinic_ai_office_policies set
            new_patient_forms = coalesce(new_patient_forms, ${facts.newPatientFormLink}),
            languages = case when cardinality(languages) = 0 then ${facts.languages} else languages end,
            status = 'needs_review',
            source_type = 'website_draft',
            source_url = ${urlFor("new_patient_forms")}
          where clinic_id = ${clinicId}
        `;
        if (result.count > 0) {
          if (facts.newPatientFormLink && !policies.new_patient_forms) {
            draftedSections.add("office_policies");
          }
          if (facts.languages.length > 0 && policies.languages.length === 0) {
            draftedSections.add("languages");
          }
        }
      }
    }

    // Re-open review only for sections that actually received new drafts.
    if (draftedSections.size > 0) {
      await tx`
        delete from public.clinic_ai_knowledge_section_reviews
        where clinic_id = ${clinicId} and section_key in ${tx([...draftedSections])}
      `;
    }
  });

  return notes;
}
