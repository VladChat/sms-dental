// Pure validation/normalization helpers for the structured AI Front Desk
// facts model (hours, services, insurance, appointments, payment, policies).
//
// No DB or framework imports so these can be unit-tested directly. The DB
// helper (lib/db/ai-knowledge.ts) and the account API routes build on these.
// Foundation-only: nothing here sends SMS, calls an AI provider, or changes
// patient-facing behavior.

import {
  DEFAULT_PREFERRED_TIME_QUESTION,
  HOURS_TIMEZONES,
  MAX_CUSTOM_LABEL_LENGTH,
  MAX_HOURS_INTERVALS_PER_DAY,
  MAX_LANGUAGES,
  MAX_LANGUAGE_LENGTH,
  MAX_POLICY_TEXT_LENGTH,
  MAX_PREFERRED_TIME_QUESTION_LENGTH,
  MAX_PRICING_POLICY_LENGTH,
} from "../../config/ai-front-desk-facts.config";

export type FactValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

// Obvious placeholder/demo content that must never be saved as a clinic fact.
const SAMPLE_DATA_PATTERNS = [/example\.com/i, /lorem ipsum/i, /\{\{\s*\w+\s*\}\}/];

export function containsSampleData(text: string): boolean {
  return SAMPLE_DATA_PATTERNS.some((re) => re.test(text));
}

// ------------------------------------------------------------- custom labels

// Validate an owner-entered custom service/insurance label.
export function validateCustomLabel(raw: unknown): FactValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, message: "Enter a name first." };
  const label = raw.trim().replace(/\s+/g, " ");
  if (label.length === 0) return { ok: false, message: "Enter a name first." };
  if (label.length > MAX_CUSTOM_LABEL_LENGTH) {
    return { ok: false, message: `Keep the name under ${MAX_CUSTOM_LABEL_LENGTH} characters.` };
  }
  if (containsSampleData(label)) {
    return { ok: false, message: "Please enter your office’s real name for this item." };
  }
  if (/^others?$/i.test(label)) {
    return { ok: false, message: "Please enter the specific name instead of “Other”." };
  }
  return { ok: true, value: label };
}

// Server-side key for a custom entry. Never trusts a client-provided key.
export function customKeyFromLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `custom_${slug.length > 0 ? slug : "entry"}`;
}

export function isCustomKey(key: string): boolean {
  return key.startsWith("custom_");
}

// The per-clinic entry cap counts default catalog entries plus custom rows.
export function customLimitReached(
  catalogSize: number,
  customCount: number,
  maxEntries: number,
): boolean {
  return catalogSize + customCount >= maxEntries;
}

// ------------------------------------------------------------ selection sets

export type FactSelection = { key: string; selected: boolean };

// Validate a checkbox-selection payload. `allowedKeys` is the server-known
// vocabulary: default catalog keys plus the clinic's existing custom keys.
export function validateSelections(
  raw: unknown,
  allowedKeys: ReadonlySet<string>,
): FactValidationResult<FactSelection[]> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, message: "Nothing to save yet." };
  }
  if (raw.length > allowedKeys.size) {
    return { ok: false, message: "Too many items." };
  }
  const seen = new Set<string>();
  const selections: FactSelection[] = [];
  for (const item of raw) {
    const key = (item as { key?: unknown })?.key;
    const selected = (item as { selected?: unknown })?.selected;
    if (typeof key !== "string" || typeof selected !== "boolean" || !allowedKeys.has(key)) {
      return { ok: false, message: "Could not save this list. Please refresh and try again." };
    }
    if (seen.has(key)) continue;
    seen.add(key);
    selections.push({ key, selected });
  }
  return { ok: true, value: selections };
}

// ------------------------------------------------------------------- hours

export type HoursDayValue = {
  weekday: number; // 0 = Sunday … 6 = Saturday
  closed: boolean;
  // Ordered, non-overlapping intervals; empty when closed.
  intervals: { opensAt: string; closesAt: string }[];
};

export type HoursValue = {
  timezone: string;
  days: HoursDayValue[];
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_TIMEZONES = new Set<string>(HOURS_TIMEZONES.map((tz) => tz.value));

export function validateHoursInput(raw: unknown): FactValidationResult<HoursValue> {
  const input = raw as { timezone?: unknown; days?: unknown };
  if (typeof input?.timezone !== "string" || !VALID_TIMEZONES.has(input.timezone)) {
    return { ok: false, message: "Choose a time zone." };
  }
  if (!Array.isArray(input.days) || input.days.length === 0 || input.days.length > 7) {
    return { ok: false, message: "Could not save hours. Please refresh and try again." };
  }

  const seenWeekdays = new Set<number>();
  const days: HoursDayValue[] = [];
  for (const rawDay of input.days) {
    const day = rawDay as { weekday?: unknown; closed?: unknown; intervals?: unknown };
    if (
      typeof day?.weekday !== "number" ||
      !Number.isInteger(day.weekday) ||
      day.weekday < 0 ||
      day.weekday > 6 ||
      typeof day.closed !== "boolean" ||
      seenWeekdays.has(day.weekday)
    ) {
      return { ok: false, message: "Could not save hours. Please refresh and try again." };
    }
    seenWeekdays.add(day.weekday);

    const rawIntervals = Array.isArray(day.intervals) ? day.intervals : [];
    if (day.closed) {
      if (rawIntervals.length > 0) {
        return { ok: false, message: "A closed day can’t have open hours." };
      }
      days.push({ weekday: day.weekday, closed: true, intervals: [] });
      continue;
    }

    if (rawIntervals.length === 0) {
      return { ok: false, message: "Add open and close times, or mark the day closed." };
    }
    if (rawIntervals.length > MAX_HOURS_INTERVALS_PER_DAY) {
      return { ok: false, message: `Use at most ${MAX_HOURS_INTERVALS_PER_DAY} time ranges per day.` };
    }
    const intervals: { opensAt: string; closesAt: string }[] = [];
    let previousClose = "";
    for (const rawInterval of rawIntervals) {
      const interval = rawInterval as { opensAt?: unknown; closesAt?: unknown };
      if (
        typeof interval?.opensAt !== "string" ||
        typeof interval?.closesAt !== "string" ||
        !TIME_RE.test(interval.opensAt) ||
        !TIME_RE.test(interval.closesAt)
      ) {
        return { ok: false, message: "Enter times as hours and minutes (for example 8:00 AM)." };
      }
      if (interval.opensAt >= interval.closesAt) {
        return { ok: false, message: "Opening time must be before closing time." };
      }
      if (previousClose && interval.opensAt < previousClose) {
        return { ok: false, message: "Time ranges on the same day can’t overlap." };
      }
      previousClose = interval.closesAt;
      intervals.push({ opensAt: interval.opensAt, closesAt: interval.closesAt });
    }
    days.push({ weekday: day.weekday, closed: false, intervals });
  }

  days.sort((a, b) => a.weekday - b.weekday);
  return { ok: true, value: { timezone: input.timezone, days } };
}

// ------------------------------------------------------------- appointments

export type AppointmentSettingsValue = {
  acceptingNewPatients: boolean | null;
  cleaningAppointments: boolean | null;
  sameDayAppointments: boolean | null;
  emergencyAppointments: boolean | null;
  rescheduleCancelRequests: boolean | null;
  preferredTimeQuestion: string;
};

function optionalBoolean(value: unknown): boolean | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  return undefined; // invalid
}

export function validateAppointmentSettings(
  raw: unknown,
): FactValidationResult<AppointmentSettingsValue> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const fields = {
    acceptingNewPatients: optionalBoolean(input.acceptingNewPatients),
    cleaningAppointments: optionalBoolean(input.cleaningAppointments),
    sameDayAppointments: optionalBoolean(input.sameDayAppointments),
    emergencyAppointments: optionalBoolean(input.emergencyAppointments),
    rescheduleCancelRequests: optionalBoolean(input.rescheduleCancelRequests),
  };
  for (const value of Object.values(fields)) {
    if (value === undefined) {
      return { ok: false, message: "Could not save. Please refresh and try again." };
    }
  }
  let question = DEFAULT_PREFERRED_TIME_QUESTION;
  if (typeof input.preferredTimeQuestion === "string") {
    question = input.preferredTimeQuestion.trim().replace(/\s+/g, " ");
    if (question.length === 0) question = DEFAULT_PREFERRED_TIME_QUESTION;
  } else if (input.preferredTimeQuestion !== undefined && input.preferredTimeQuestion !== null) {
    return { ok: false, message: "Could not save. Please refresh and try again." };
  }
  if (question.length > MAX_PREFERRED_TIME_QUESTION_LENGTH) {
    return {
      ok: false,
      message: `Keep the question under ${MAX_PREFERRED_TIME_QUESTION_LENGTH} characters.`,
    };
  }
  if (containsSampleData(question)) {
    return { ok: false, message: "Please replace the sample text with your office’s wording." };
  }
  return {
    ok: true,
    value: {
      acceptingNewPatients: fields.acceptingNewPatients as boolean | null,
      cleaningAppointments: fields.cleaningAppointments as boolean | null,
      sameDayAppointments: fields.sameDayAppointments as boolean | null,
      emergencyAppointments: fields.emergencyAppointments as boolean | null,
      rescheduleCancelRequests: fields.rescheduleCancelRequests as boolean | null,
      preferredTimeQuestion: question,
    },
  };
}

// ------------------------------------------------------------------ payment

export type PaymentSettingsValue = {
  paymentPlans: boolean | null;
  financing: boolean | null;
  carecredit: boolean | null;
  membershipPlan: boolean | null;
  pricingPolicy: string | null;
};

export function validatePaymentSettings(
  raw: unknown,
): FactValidationResult<PaymentSettingsValue> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const fields = {
    paymentPlans: optionalBoolean(input.paymentPlans),
    financing: optionalBoolean(input.financing),
    carecredit: optionalBoolean(input.carecredit),
    membershipPlan: optionalBoolean(input.membershipPlan),
  };
  for (const value of Object.values(fields)) {
    if (value === undefined) {
      return { ok: false, message: "Could not save. Please refresh and try again." };
    }
  }
  let pricingPolicy: string | null = null;
  if (typeof input.pricingPolicy === "string") {
    const trimmed = input.pricingPolicy.trim();
    if (trimmed.length > MAX_PRICING_POLICY_LENGTH) {
      return {
        ok: false,
        message: `Keep the pricing note under ${MAX_PRICING_POLICY_LENGTH} characters.`,
      };
    }
    if (containsSampleData(trimmed)) {
      return { ok: false, message: "Please replace the sample text with your office’s wording." };
    }
    pricingPolicy = trimmed.length > 0 ? trimmed : null;
  } else if (input.pricingPolicy !== undefined && input.pricingPolicy !== null) {
    return { ok: false, message: "Could not save. Please refresh and try again." };
  }
  return {
    ok: true,
    value: {
      paymentPlans: fields.paymentPlans as boolean | null,
      financing: fields.financing as boolean | null,
      carecredit: fields.carecredit as boolean | null,
      membershipPlan: fields.membershipPlan as boolean | null,
      pricingPolicy,
    },
  };
}

// ----------------------------------------------------------- office policies

export type OfficePoliciesValue = {
  newPatientForms: string | null;
  whatToBring: string | null;
  cancellationPolicy: string | null;
  languages: string[];
  parkingNotes: string | null;
  accessibilityNotes: string | null;
};

function optionalPolicyText(value: unknown, label: string): FactValidationResult<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, message: "Could not save. Please refresh and try again." };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > MAX_POLICY_TEXT_LENGTH) {
    return { ok: false, message: `Keep ${label} under ${MAX_POLICY_TEXT_LENGTH} characters.` };
  }
  if (containsSampleData(trimmed)) {
    return { ok: false, message: "Please replace the sample text with your office’s wording." };
  }
  return { ok: true, value: trimmed };
}

export function validateOfficePolicies(
  raw: unknown,
): FactValidationResult<OfficePoliciesValue> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const textFields = [
    ["newPatientForms", "the new patient forms note"],
    ["whatToBring", "the what-to-bring note"],
    ["cancellationPolicy", "the cancellation policy"],
    ["parkingNotes", "the parking notes"],
    ["accessibilityNotes", "the accessibility notes"],
  ] as const;
  const values: Record<string, string | null> = {};
  for (const [field, label] of textFields) {
    const result = optionalPolicyText(input[field], label);
    if (!result.ok) return result;
    values[field] = result.value;
  }

  let languages: string[] = [];
  if (Array.isArray(input.languages)) {
    const seen = new Set<string>();
    for (const rawLanguage of input.languages) {
      if (typeof rawLanguage !== "string") {
        return { ok: false, message: "Could not save. Please refresh and try again." };
      }
      const language = rawLanguage.trim().replace(/\s+/g, " ");
      if (language.length === 0) continue;
      if (language.length > MAX_LANGUAGE_LENGTH) {
        return { ok: false, message: `Keep each language under ${MAX_LANGUAGE_LENGTH} characters.` };
      }
      if (containsSampleData(language)) {
        return { ok: false, message: "Please enter real language names." };
      }
      const dedupeKey = language.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      languages.push(language);
    }
    if (languages.length > MAX_LANGUAGES) {
      return { ok: false, message: `List up to ${MAX_LANGUAGES} languages.` };
    }
  } else if (input.languages !== undefined && input.languages !== null) {
    return { ok: false, message: "Could not save. Please refresh and try again." };
  }

  return {
    ok: true,
    value: {
      newPatientForms: values.newPatientForms ?? null,
      whatToBring: values.whatToBring ?? null,
      cancellationPolicy: values.cancellationPolicy ?? null,
      languages,
      parkingNotes: values.parkingNotes ?? null,
      accessibilityNotes: values.accessibilityNotes ?? null,
    },
  };
}
