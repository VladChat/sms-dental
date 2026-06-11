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
  LOCKED_LANGUAGE,
  MAX_CUSTOM_LABEL_LENGTH,
  MAX_HOURS_INTERVALS_PER_DAY,
  MAX_LANGUAGES,
  MAX_LANGUAGE_LENGTH,
  MAX_POLICY_TEXT_LENGTH,
  MAX_PREFERRED_TIME_QUESTION_LENGTH,
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

export type CatalogCustomAdd = { label: string; selected: boolean };

// One section save persists everything at once: checkbox selections, newly
// added custom entries, and removed custom entries.
export type CatalogSectionUpdate = {
  selections: FactSelection[];
  customToAdd: CatalogCustomAdd[];
  customToRemove: string[];
};

const LIST_SHAPE_MESSAGE = "Could not save this list. Please refresh and try again.";

// Validate a full services/insurance section save. `allowedKeys` is the
// server-known vocabulary (default catalog keys + this clinic's existing
// custom keys); `existingCustom` carries the clinic's custom rows so removals
// and duplicate labels are checked server-side. Custom keys are never taken
// from the client — they are minted from validated labels.
export function validateCatalogSectionUpdate(
  raw: unknown,
  ctx: {
    allowedKeys: ReadonlySet<string>;
    existingCustom: readonly { key: string; label: string }[];
    defaultLabels: readonly string[];
    catalogSize: number;
    maxEntries: number;
  },
): FactValidationResult<CatalogSectionUpdate> {
  const input = (raw ?? {}) as Record<string, unknown>;

  // -- removals (custom entries only; defaults can never be removed)
  const customToRemove: string[] = [];
  if (input.customToRemove !== undefined && input.customToRemove !== null) {
    if (!Array.isArray(input.customToRemove)) return { ok: false, message: LIST_SHAPE_MESSAGE };
    const existingCustomKeys = new Set(ctx.existingCustom.map((c) => c.key));
    for (const key of input.customToRemove) {
      if (typeof key !== "string" || !isCustomKey(key) || !existingCustomKeys.has(key)) {
        return { ok: false, message: LIST_SHAPE_MESSAGE };
      }
      if (!customToRemove.includes(key)) customToRemove.push(key);
    }
  }
  const removedKeys = new Set(customToRemove);

  // -- selections (drop entries for keys being removed)
  const selections: FactSelection[] = [];
  if (input.selections !== undefined && input.selections !== null) {
    if (!Array.isArray(input.selections) || input.selections.length > ctx.allowedKeys.size) {
      return { ok: false, message: LIST_SHAPE_MESSAGE };
    }
    const seen = new Set<string>();
    for (const item of input.selections) {
      const key = (item as { key?: unknown })?.key;
      const selected = (item as { selected?: unknown })?.selected;
      if (typeof key !== "string" || typeof selected !== "boolean" || !ctx.allowedKeys.has(key)) {
        return { ok: false, message: LIST_SHAPE_MESSAGE };
      }
      if (seen.has(key) || removedKeys.has(key)) continue;
      seen.add(key);
      selections.push({ key, selected });
    }
  }

  // -- additions (validated labels; duplicates rejected case-insensitively)
  const customToAdd: CatalogCustomAdd[] = [];
  if (input.customToAdd !== undefined && input.customToAdd !== null) {
    if (!Array.isArray(input.customToAdd)) return { ok: false, message: LIST_SHAPE_MESSAGE };
    const takenLabels = new Set<string>(ctx.defaultLabels.map((label) => label.toLowerCase()));
    const takenKeys = new Set<string>();
    for (const custom of ctx.existingCustom) {
      if (removedKeys.has(custom.key)) continue;
      takenLabels.add(custom.label.toLowerCase());
      takenKeys.add(custom.key);
    }
    for (const item of input.customToAdd) {
      const rawLabel = (item as { label?: unknown })?.label;
      const rawSelected = (item as { selected?: unknown })?.selected;
      if (rawSelected !== undefined && typeof rawSelected !== "boolean") {
        return { ok: false, message: LIST_SHAPE_MESSAGE };
      }
      const label = validateCustomLabel(rawLabel);
      if (!label.ok) return label;
      const key = customKeyFromLabel(label.value);
      if (takenLabels.has(label.value.toLowerCase()) || takenKeys.has(key)) {
        return { ok: false, message: `“${label.value}” is already in the list.` };
      }
      takenLabels.add(label.value.toLowerCase());
      takenKeys.add(key);
      customToAdd.push({ label: label.value, selected: rawSelected ?? true });
    }
  }

  // -- total entry cap (defaults + remaining customs + additions)
  const remainingCustomCount = ctx.existingCustom.length - customToRemove.length;
  if (ctx.catalogSize + remainingCustomCount + customToAdd.length > ctx.maxEntries) {
    return { ok: false, message: `You can list up to ${ctx.maxEntries} items here.` };
  }

  if (selections.length === 0 && customToAdd.length === 0 && customToRemove.length === 0) {
    return { ok: false, message: "Nothing to save yet." };
  }

  return { ok: true, value: { selections, customToAdd, customToRemove } };
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

// ----------------------------------------------------------- payment methods

// Which payment methods the office accepts. Each maps 1:1 to a boolean column.
// No custom additions — the list is fixed.
export type PaymentMethodsValue = {
  cash: boolean | null;
  creditDebitCards: boolean | null;
  personalChecks: boolean | null;
  hsaFsaCards: boolean | null;
};

export function validatePaymentMethods(
  raw: unknown,
): FactValidationResult<PaymentMethodsValue> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const fields = {
    cash: optionalBoolean(input.cash),
    creditDebitCards: optionalBoolean(input.creditDebitCards),
    personalChecks: optionalBoolean(input.personalChecks),
    hsaFsaCards: optionalBoolean(input.hsaFsaCards),
  };
  for (const value of Object.values(fields)) {
    if (value === undefined) {
      return { ok: false, message: "Could not save. Please refresh and try again." };
    }
  }
  return {
    ok: true,
    value: {
      cash: fields.cash as boolean | null,
      creditDebitCards: fields.creditDebitCards as boolean | null,
      personalChecks: fields.personalChecks as boolean | null,
      hsaFsaCards: fields.hsaFsaCards as boolean | null,
    },
  };
}

// --------------------------------------------------------- financing & plans

// The default financing options (fixed booleans) plus a custom-options update
// (the same add/remove/select pattern used for services/insurance). Default
// financing options are not removable — only the custom ones are.
export type FinancingDefaultsValue = {
  inOfficePaymentPlans: boolean | null;
  carecredit: boolean | null;
  alphaeonCredit: boolean | null;
  membershipPlan: boolean | null;
};

export type FinancingSectionUpdate = {
  defaults: FinancingDefaultsValue;
  custom: CatalogSectionUpdate;
};

// Validate a full Financing & plans save: the four default booleans plus a
// custom-options update. `existingCustom` is the clinic's saved custom rows;
// custom keys are minted server-side and never trusted from the client. The
// default financing labels are reserved so a custom option can't shadow one.
export function validateFinancingUpdate(
  raw: unknown,
  ctx: {
    existingCustom: readonly { key: string; label: string }[];
    defaultLabels: readonly string[];
    maxEntries: number;
  },
): FactValidationResult<FinancingSectionUpdate> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const defaults = {
    inOfficePaymentPlans: optionalBoolean(input.inOfficePaymentPlans),
    carecredit: optionalBoolean(input.carecredit),
    alphaeonCredit: optionalBoolean(input.alphaeonCredit),
    membershipPlan: optionalBoolean(input.membershipPlan),
  };
  for (const value of Object.values(defaults)) {
    if (value === undefined) {
      return { ok: false, message: "Could not save. Please refresh and try again." };
    }
  }

  // -- removals (existing custom rows only)
  const existingCustomKeys = new Set(ctx.existingCustom.map((c) => c.key));
  const customToRemove: string[] = [];
  if (input.customToRemove !== undefined && input.customToRemove !== null) {
    if (!Array.isArray(input.customToRemove)) return { ok: false, message: LIST_SHAPE_MESSAGE };
    for (const key of input.customToRemove) {
      if (typeof key !== "string" || !isCustomKey(key) || !existingCustomKeys.has(key)) {
        return { ok: false, message: LIST_SHAPE_MESSAGE };
      }
      if (!customToRemove.includes(key)) customToRemove.push(key);
    }
  }
  const removedKeys = new Set(customToRemove);

  // -- selections (existing custom rows only; drop ones being removed)
  const selections: FactSelection[] = [];
  if (input.selections !== undefined && input.selections !== null) {
    if (!Array.isArray(input.selections) || input.selections.length > existingCustomKeys.size) {
      return { ok: false, message: LIST_SHAPE_MESSAGE };
    }
    const seen = new Set<string>();
    for (const item of input.selections) {
      const key = (item as { key?: unknown })?.key;
      const selected = (item as { selected?: unknown })?.selected;
      if (typeof key !== "string" || typeof selected !== "boolean" || !existingCustomKeys.has(key)) {
        return { ok: false, message: LIST_SHAPE_MESSAGE };
      }
      if (seen.has(key) || removedKeys.has(key)) continue;
      seen.add(key);
      selections.push({ key, selected });
    }
  }

  // -- additions (validated labels; duplicates rejected case-insensitively)
  const customToAdd: CatalogCustomAdd[] = [];
  if (input.customToAdd !== undefined && input.customToAdd !== null) {
    if (!Array.isArray(input.customToAdd)) return { ok: false, message: LIST_SHAPE_MESSAGE };
    const takenLabels = new Set<string>(ctx.defaultLabels.map((label) => label.toLowerCase()));
    const takenKeys = new Set<string>();
    for (const custom of ctx.existingCustom) {
      if (removedKeys.has(custom.key)) continue;
      takenLabels.add(custom.label.toLowerCase());
      takenKeys.add(custom.key);
    }
    for (const item of input.customToAdd) {
      const rawLabel = (item as { label?: unknown })?.label;
      const rawSelected = (item as { selected?: unknown })?.selected;
      if (rawSelected !== undefined && typeof rawSelected !== "boolean") {
        return { ok: false, message: LIST_SHAPE_MESSAGE };
      }
      const label = validateCustomLabel(rawLabel);
      if (!label.ok) return label;
      const key = customKeyFromLabel(label.value);
      if (takenLabels.has(label.value.toLowerCase()) || takenKeys.has(key)) {
        return { ok: false, message: `“${label.value}” is already in the list.` };
      }
      takenLabels.add(label.value.toLowerCase());
      takenKeys.add(key);
      customToAdd.push({ label: label.value, selected: rawSelected ?? true });
    }
  }

  // -- custom-options cap (existing customs minus removals plus additions)
  const remainingCustomCount = ctx.existingCustom.length - customToRemove.length;
  if (remainingCustomCount + customToAdd.length > ctx.maxEntries) {
    return { ok: false, message: `You can list up to ${ctx.maxEntries} financing options.` };
  }

  return {
    ok: true,
    value: {
      defaults: {
        inOfficePaymentPlans: defaults.inOfficePaymentPlans as boolean | null,
        carecredit: defaults.carecredit as boolean | null,
        alphaeonCredit: defaults.alphaeonCredit as boolean | null,
        membershipPlan: defaults.membershipPlan as boolean | null,
      },
      custom: { selections, customToAdd, customToRemove },
    },
  };
}

// ----------------------------------------------------------- office policies

// Office policies no longer hold languages (those moved to their own section).
// `newPatientForms` is now a single Form link, validated as a URL/path — never
// free text — so the parser can never push a noisy page excerpt into it.
export type OfficePoliciesValue = {
  newPatientForms: string | null; // a form link (URL or path), or null
  whatToBring: string | null;
  cancellationPolicy: string | null;
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

// A Form link is a single http(s) URL, a root-relative/absolute path, or a bare
// domain. It must have no spaces and look like a link, so page text excerpts
// ("Downloadable Forms: New Patient Form Medical History …") are rejected.
export function looksLikeFormLink(value: string): boolean {
  const v = value.trim();
  if (v.length === 0 || v.length > MAX_POLICY_TEXT_LENGTH) return false;
  if (/\s/.test(v)) return false;
  if (/^https?:\/\/\S+\.\S+/i.test(v)) return true; // absolute URL
  if (/^\/[^\s]*$/.test(v)) return true; // root-relative path
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v)) return true; // bare domain (+path)
  return false;
}

function optionalFormLink(value: unknown): FactValidationResult<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, message: "Could not save. Please refresh and try again." };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (containsSampleData(trimmed)) {
    return { ok: false, message: "Please enter your office’s real form link." };
  }
  if (!looksLikeFormLink(trimmed)) {
    return { ok: false, message: "Enter a form link (for example https://yourpractice.com/new-patient-forms)." };
  }
  return { ok: true, value: trimmed };
}

export function validateOfficePolicies(
  raw: unknown,
): FactValidationResult<OfficePoliciesValue> {
  const input = (raw ?? {}) as Record<string, unknown>;

  const formLink = optionalFormLink(input.newPatientForms);
  if (!formLink.ok) return formLink;

  const textFields = [
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

  return {
    ok: true,
    value: {
      newPatientForms: formLink.value,
      whatToBring: values.whatToBring ?? null,
      cancellationPolicy: values.cancellationPolicy ?? null,
      parkingNotes: values.parkingNotes ?? null,
      accessibilityNotes: values.accessibilityNotes ?? null,
    },
  };
}

// ----------------------------------------------------------------- languages

// Validate the languages list for the dedicated Languages section. English is
// always included (re-added server-side even if the client omits it), the list
// is deduped case-insensitively, and limits are enforced.
export function validateLanguagesList(raw: unknown): FactValidationResult<string[]> {
  const list = (raw as { languages?: unknown })?.languages ?? raw;
  if (list !== undefined && list !== null && !Array.isArray(list)) {
    return { ok: false, message: "Could not save. Please refresh and try again." };
  }
  const seen = new Set<string>();
  const languages: string[] = [LOCKED_LANGUAGE];
  seen.add(LOCKED_LANGUAGE.toLowerCase());

  for (const rawLanguage of Array.isArray(list) ? list : []) {
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
  return { ok: true, value: languages };
}
