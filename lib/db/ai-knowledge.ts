import { getDb } from "./client";
import {
  DEFAULT_HOURS_TIMEZONE,
  DEFAULT_INSURANCE_PLANS,
  DEFAULT_PREFERRED_TIME_QUESTION,
  DEFAULT_SERVICES,
  MAX_INSURANCE_PLANS_PER_CLINIC,
  MAX_SERVICES_PER_CLINIC,
  findDefaultInsurancePlan,
  findDefaultService,
} from "../../config/ai-front-desk-facts.config";
import {
  customKeyFromLabel,
  customLimitReached,
  isCustomKey,
  type AppointmentSettingsValue,
  type FactSelection,
  type HoursValue,
  type OfficePoliciesValue,
  type PaymentSettingsValue,
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
  payment_plans: boolean | null;
  financing: boolean | null;
  carecredit: boolean | null;
  membership_plan: boolean | null;
  pricing_policy: string | null;
  status: string;
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
    paymentPlans: boolean | null;
    financing: boolean | null;
    carecredit: boolean | null;
    membershipPlan: boolean | null;
    pricingPolicy: string | null;
    persisted: boolean;
    suggested: boolean;
  };
  policies: {
    newPatientForms: string | null;
    whatToBring: string | null;
    cancellationPolicy: string | null;
    languages: string[];
    parkingNotes: string | null;
    accessibilityNotes: string | null;
    persisted: boolean;
    suggested: boolean;
  };
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

// ----------------------------------------------------------------- queries

export async function getClinicAiFacts(clinicId: string): Promise<AiFactsView> {
  const sql = getDb();
  const [hoursRows, serviceRows, insuranceRows, appointmentRows, paymentRows, policyRows, scanRows] =
    await Promise.all([
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
        select payment_plans, financing, carecredit, membership_plan, pricing_policy, status
        from public.clinic_ai_payment_settings
        where clinic_id = ${clinicId}
      `,
      sql<OfficePoliciesRow[]>`
        select new_patient_forms, what_to_bring, cancellation_policy, languages,
               parking_notes, accessibility_notes, status
        from public.clinic_ai_office_policies
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
      paymentPlans: payment?.payment_plans ?? null,
      financing: payment?.financing ?? null,
      carecredit: payment?.carecredit ?? null,
      membershipPlan: payment?.membership_plan ?? null,
      pricingPolicy: payment?.pricing_policy ?? null,
      persisted: payment !== null,
      suggested: payment?.status === "needs_review",
    },
    policies: {
      newPatientForms: policies?.new_patient_forms ?? null,
      whatToBring: policies?.what_to_bring ?? null,
      cancellationPolicy: policies?.cancellation_policy ?? null,
      languages: policies?.languages ?? [],
      parkingNotes: policies?.parking_notes ?? null,
      accessibilityNotes: policies?.accessibility_notes ?? null,
      persisted: policies !== null,
      suggested: policies?.status === "needs_review",
    },
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

// Keys the selection endpoints accept: default catalog plus this clinic's
// existing custom keys (custom keys are only ever minted server-side).
export async function listAllowedServiceKeys(clinicId: string): Promise<Set<string>> {
  const sql = getDb();
  const rows = await sql<{ service_key: string }[]>`
    select service_key from public.clinic_ai_services
    where clinic_id = ${clinicId} and is_custom = true
  `;
  return new Set([...DEFAULT_SERVICES.map((s) => s.key), ...rows.map((r) => r.service_key)]);
}

export async function listAllowedInsuranceKeys(clinicId: string): Promise<Set<string>> {
  const sql = getDb();
  const rows = await sql<{ plan_key: string }[]>`
    select plan_key from public.clinic_ai_insurance_plans
    where clinic_id = ${clinicId} and is_custom = true
  `;
  return new Set([...DEFAULT_INSURANCE_PLANS.map((p) => p.key), ...rows.map((r) => r.plan_key)]);
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

async function saveSelections(
  table: "clinic_ai_services" | "clinic_ai_insurance_plans",
  keyField: "service_key" | "plan_key",
  clinicId: string,
  selections: FactSelection[],
  reviewedByProfileId: string | null,
): Promise<void> {
  const sql = getDb();
  await sql.begin(async (tx) => {
    for (const selection of selections) {
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
        // Custom rows always exist already (created by the add-custom path);
        // unknown keys were rejected during validation.
        await tx`
          update ${tx(`public.${table}`)} set
            selected = ${selection.selected},
            status = 'approved',
            reviewed_at = now(),
            reviewed_by_profile_id = ${reviewedByProfileId}
          where clinic_id = ${clinicId} and ${tx(keyField)} = ${selection.key}
        `;
      }
    }
  });
}

export async function saveServiceSelections(
  clinicId: string,
  selections: FactSelection[],
  reviewedByProfileId: string | null,
): Promise<void> {
  await saveSelections("clinic_ai_services", "service_key", clinicId, selections, reviewedByProfileId);
}

export async function saveInsuranceSelections(
  clinicId: string,
  selections: FactSelection[],
  reviewedByProfileId: string | null,
): Promise<void> {
  await saveSelections(
    "clinic_ai_insurance_plans",
    "plan_key",
    clinicId,
    selections,
    reviewedByProfileId,
  );
}

export type AddCustomEntryResult =
  | { ok: true }
  | { ok: false; reason: "limit_reached" | "already_exists" };

async function addCustomEntry(
  table: "clinic_ai_services" | "clinic_ai_insurance_plans",
  keyField: "service_key" | "plan_key",
  catalogSize: number,
  maxEntries: number,
  clinicId: string,
  label: string,
  reviewedByProfileId: string | null,
): Promise<AddCustomEntryResult> {
  const sql = getDb();
  const key = customKeyFromLabel(label);
  return sql.begin(async (tx) => {
    const [{ count }] = await tx<{ count: string }[]>`
      select count(*)::text as count from ${tx(`public.${table}`)}
      where clinic_id = ${clinicId} and is_custom = true
    `;
    if (customLimitReached(catalogSize, Number(count), maxEntries)) {
      return { ok: false, reason: "limit_reached" } as const;
    }
    const inserted = await tx<{ id: string }[]>`
      insert into ${tx(`public.${table}`)} (
        clinic_id, ${tx(keyField)}, label, selected, is_custom,
        status, source_type, reviewed_at, reviewed_by_profile_id, sort_order
      ) values (
        ${clinicId}, ${key}, ${label}, true, true,
        'approved', 'manual', now(), ${reviewedByProfileId}, ${1000 + Number(count)}
      )
      on conflict (clinic_id, ${tx(keyField)}) do nothing
      returning id
    `;
    if (inserted.length === 0) {
      return { ok: false, reason: "already_exists" } as const;
    }
    return { ok: true } as const;
  });
}

export async function addCustomService(
  clinicId: string,
  label: string,
  reviewedByProfileId: string | null,
): Promise<AddCustomEntryResult> {
  return addCustomEntry(
    "clinic_ai_services",
    "service_key",
    DEFAULT_SERVICES.length,
    MAX_SERVICES_PER_CLINIC,
    clinicId,
    label,
    reviewedByProfileId,
  );
}

export async function addCustomInsurancePlan(
  clinicId: string,
  label: string,
  reviewedByProfileId: string | null,
): Promise<AddCustomEntryResult> {
  return addCustomEntry(
    "clinic_ai_insurance_plans",
    "plan_key",
    DEFAULT_INSURANCE_PLANS.length,
    MAX_INSURANCE_PLANS_PER_CLINIC,
    clinicId,
    label,
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

export async function savePaymentSettings(
  clinicId: string,
  value: PaymentSettingsValue,
  reviewedByProfileId: string | null,
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into public.clinic_ai_payment_settings (
      clinic_id, payment_plans, financing, carecredit, membership_plan, pricing_policy,
      status, source_type, reviewed_at, reviewed_by_profile_id
    ) values (
      ${clinicId}, ${value.paymentPlans}, ${value.financing}, ${value.carecredit},
      ${value.membershipPlan}, ${value.pricingPolicy},
      'approved', 'manual', now(), ${reviewedByProfileId}
    )
    on conflict (clinic_id) do update set
      payment_plans = excluded.payment_plans,
      financing = excluded.financing,
      carecredit = excluded.carecredit,
      membership_plan = excluded.membership_plan,
      pricing_policy = excluded.pricing_policy,
      status = 'approved',
      source_type = 'manual',
      reviewed_at = excluded.reviewed_at,
      reviewed_by_profile_id = excluded.reviewed_by_profile_id
  `;
}

export async function saveOfficePolicies(
  clinicId: string,
  value: OfficePoliciesValue,
  reviewedByProfileId: string | null,
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into public.clinic_ai_office_policies (
      clinic_id, new_patient_forms, what_to_bring, cancellation_policy, languages,
      parking_notes, accessibility_notes,
      status, source_type, reviewed_at, reviewed_by_profile_id
    ) values (
      ${clinicId}, ${value.newPatientForms}, ${value.whatToBring}, ${value.cancellationPolicy},
      ${value.languages}, ${value.parkingNotes}, ${value.accessibilityNotes},
      'approved', 'manual', now(), ${reviewedByProfileId}
    )
    on conflict (clinic_id) do update set
      new_patient_forms = excluded.new_patient_forms,
      what_to_bring = excluded.what_to_bring,
      cancellation_policy = excluded.cancellation_policy,
      languages = excluded.languages,
      parking_notes = excluded.parking_notes,
      accessibility_notes = excluded.accessibility_notes,
      status = 'approved',
      source_type = 'manual',
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
    for (const match of facts.services) {
      const item = findDefaultService(match.key);
      if (!item) continue;
      await tx`
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
    }

    for (const match of facts.insurancePlans) {
      const item = findDefaultInsurancePlan(match.key);
      if (!item) continue;
      await tx`
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
          await tx`
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
        }
      }
    }

    if (facts.acceptingNewPatients || facts.emergencyAppointments) {
      const [appointments] = await tx<{ status: string }[]>`
        select status from public.clinic_ai_appointment_settings where clinic_id = ${clinicId}
      `;
      if (!appointments) {
        await tx`
          insert into public.clinic_ai_appointment_settings (
            clinic_id, accepting_new_patients, emergency_appointments,
            status, source_type, source_url
          ) values (
            ${clinicId},
            ${facts.acceptingNewPatients ? true : null},
            ${facts.emergencyAppointments ? true : null},
            'needs_review', 'website_draft', ${urlFor("accepting_new_patients")}
          )
        `;
      } else if (appointments.status !== "approved") {
        await tx`
          update public.clinic_ai_appointment_settings set
            accepting_new_patients = coalesce(accepting_new_patients, ${facts.acceptingNewPatients ? true : null}),
            emergency_appointments = coalesce(emergency_appointments, ${facts.emergencyAppointments ? true : null}),
            status = 'needs_review',
            source_type = 'website_draft',
            source_url = ${urlFor("accepting_new_patients")}
          where clinic_id = ${clinicId}
        `;
      }
    }

    const paymentFound =
      facts.payment.paymentPlans ||
      facts.payment.financing ||
      facts.payment.carecredit ||
      facts.payment.membershipPlan;
    if (paymentFound) {
      const [payment] = await tx<{ status: string }[]>`
        select status from public.clinic_ai_payment_settings where clinic_id = ${clinicId}
      `;
      if (!payment) {
        await tx`
          insert into public.clinic_ai_payment_settings (
            clinic_id, payment_plans, financing, carecredit, membership_plan,
            status, source_type, source_url, source_excerpt
          ) values (
            ${clinicId},
            ${facts.payment.paymentPlans ? true : null},
            ${facts.payment.financing ? true : null},
            ${facts.payment.carecredit ? true : null},
            ${facts.payment.membershipPlan ? true : null},
            'needs_review', 'website_draft', ${urlFor("payment")}, ${facts.payment.excerpt}
          )
        `;
      } else if (payment.status !== "approved") {
        await tx`
          update public.clinic_ai_payment_settings set
            payment_plans = coalesce(payment_plans, ${facts.payment.paymentPlans ? true : null}),
            financing = coalesce(financing, ${facts.payment.financing ? true : null}),
            carecredit = coalesce(carecredit, ${facts.payment.carecredit ? true : null}),
            membership_plan = coalesce(membership_plan, ${facts.payment.membershipPlan ? true : null}),
            status = 'needs_review',
            source_type = 'website_draft',
            source_url = ${urlFor("payment")},
            source_excerpt = coalesce(source_excerpt, ${facts.payment.excerpt})
          where clinic_id = ${clinicId}
        `;
      }
    }

    if (facts.languages.length > 0 || facts.newPatientFormsNote) {
      const [policies] = await tx<{ status: string; languages: string[] }[]>`
        select status, languages from public.clinic_ai_office_policies where clinic_id = ${clinicId}
      `;
      if (!policies) {
        await tx`
          insert into public.clinic_ai_office_policies (
            clinic_id, new_patient_forms, languages,
            status, source_type, source_url
          ) values (
            ${clinicId}, ${facts.newPatientFormsNote}, ${facts.languages},
            'needs_review', 'website_draft', ${urlFor("new_patient_forms")}
          )
        `;
      } else if (policies.status !== "approved") {
        await tx`
          update public.clinic_ai_office_policies set
            new_patient_forms = coalesce(new_patient_forms, ${facts.newPatientFormsNote}),
            languages = case when cardinality(languages) = 0 then ${facts.languages} else languages end,
            status = 'needs_review',
            source_type = 'website_draft',
            source_url = ${urlFor("new_patient_forms")}
          where clinic_id = ${clinicId}
        `;
      }
    }
  });

  return notes;
}
