import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_INSURANCE_PLANS,
  DEFAULT_LANGUAGES,
  DEFAULT_PREFERRED_TIME_QUESTION,
  DEFAULT_SERVICES,
  FINANCING_DEFAULTS,
  MAX_CUSTOM_LABEL_LENGTH,
  MAX_FINANCING_OPTIONS_PER_CLINIC,
  MAX_INSURANCE_PLANS_PER_CLINIC,
  MAX_LANGUAGES,
  MAX_POLICY_TEXT_LENGTH,
  MAX_PREFERRED_TIME_QUESTION_LENGTH,
  MAX_SERVICES_PER_CLINIC,
} from "../config/ai-front-desk-facts.config";
import {
  customKeyFromLabel,
  customLimitReached,
  looksLikeFormLink,
  validateAppointmentSettings,
  validateCatalogSectionUpdate,
  validateCustomLabel,
  validateFinancingUpdate,
  validateHoursInput,
  validateLanguagesList,
  validateOfficePolicies,
  validatePaymentMethods,
} from "../lib/ai-knowledge/facts";

// ------------------------------------------------------------------ catalogs

test("default services have unique keys and owner-friendly labels", () => {
  const keys = DEFAULT_SERVICES.map((item) => item.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const item of DEFAULT_SERVICES) {
    assert.match(item.key, /^[a-z][a-z0-9_]*$/);
    assert.ok(item.label.trim().length > 0);
    assert.ok(item.label.length <= 40, `${item.key} label too long for a checkbox`);
  }
  for (const expected of ["cleanings", "root_canals", "implants", "emergency_dentistry"]) {
    assert.ok(keys.includes(expected), `missing service: ${expected}`);
  }
});

test("default insurance plans have unique keys and owner-friendly labels", () => {
  const keys = DEFAULT_INSURANCE_PLANS.map((item) => item.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const item of DEFAULT_INSURANCE_PLANS) {
    assert.match(item.key, /^[a-z][a-z0-9_]*$/);
    assert.ok(item.label.trim().length > 0);
    assert.ok(item.label.length <= 40, `${item.key} label too long for a checkbox`);
  }
  for (const expected of ["delta_dental", "medicaid", "blue_cross_blue_shield"]) {
    assert.ok(keys.includes(expected), `missing plan: ${expected}`);
  }
});

test("no Other option exists in either catalog", () => {
  for (const item of [...DEFAULT_SERVICES, ...DEFAULT_INSURANCE_PLANS]) {
    assert.ok(!/^others?$/i.test(item.label.trim()), `${item.key} is an Other option`);
    assert.ok(!/^other_/.test(item.key));
  }
});

test("entry limits are exported as constants of 50", () => {
  assert.equal(MAX_SERVICES_PER_CLINIC, 50);
  assert.equal(MAX_INSURANCE_PLANS_PER_CLINIC, 50);
  assert.ok(DEFAULT_SERVICES.length < MAX_SERVICES_PER_CLINIC);
  assert.ok(DEFAULT_INSURANCE_PLANS.length < MAX_INSURANCE_PLANS_PER_CLINIC);
});

// -------------------------------------------------------------- custom labels

test("custom label accepts a valid name and mints a server-side key", () => {
  const result = validateCustomLabel("  Sleep apnea  appliances ");
  assert.ok(result.ok);
  assert.equal(result.value, "Sleep apnea appliances");
  assert.equal(customKeyFromLabel(result.value), "custom_sleep_apnea_appliances");
});

test("custom label rejects empty, overlong, sample, and Other labels", () => {
  for (const bad of [
    "",
    "   ",
    "x".repeat(MAX_CUSTOM_LABEL_LENGTH + 1),
    "See example.com for details",
    "Lorem ipsum dolor",
    "Other",
    "others",
  ]) {
    const result = validateCustomLabel(bad);
    assert.equal(result.ok, false, `should reject: "${bad}"`);
  }
});

test("custom key generation never trusts odd characters", () => {
  assert.equal(customKeyFromLabel("Botox® / Fillers!"), "custom_botox_fillers");
  assert.equal(customKeyFromLabel("***"), "custom_entry");
});

test("custom entry count cannot exceed the 50-entry cap", () => {
  assert.equal(customLimitReached(DEFAULT_SERVICES.length, 0, MAX_SERVICES_PER_CLINIC), false);
  const remaining = MAX_SERVICES_PER_CLINIC - DEFAULT_SERVICES.length;
  assert.equal(customLimitReached(DEFAULT_SERVICES.length, remaining - 1, MAX_SERVICES_PER_CLINIC), false);
  assert.equal(customLimitReached(DEFAULT_SERVICES.length, remaining, MAX_SERVICES_PER_CLINIC), true);
  assert.equal(customLimitReached(DEFAULT_SERVICES.length, remaining + 5, MAX_SERVICES_PER_CLINIC), true);
});

// -------------------------------------------------------- section save payload

// A section save persists selections + custom additions + custom removals in
// one request. Shared context for the tests below: 2 defaults, 1 existing
// custom row ("Farma"), cap of 50.
function sectionCtx(overrides?: Partial<Parameters<typeof validateCatalogSectionUpdate>[1]>) {
  return {
    allowedKeys: new Set(["cleanings", "implants", "custom_farma"]),
    existingCustom: [{ key: "custom_farma", label: "Farma" }],
    defaultLabels: ["Cleanings", "Implants"],
    catalogSize: 2,
    maxEntries: 50,
    ...overrides,
  };
}

test("section save accepts selections, additions, and removals together", () => {
  const result = validateCatalogSectionUpdate(
    {
      selections: [
        { key: "cleanings", selected: true },
        { key: "implants", selected: false },
      ],
      customToAdd: [{ label: "Laser dentistry", selected: true }],
      customToRemove: ["custom_farma"],
    },
    sectionCtx(),
  );
  assert.ok(result.ok);
  assert.equal(result.value.selections.length, 2);
  assert.deepEqual(result.value.customToAdd, [{ label: "Laser dentistry", selected: true }]);
  assert.deepEqual(result.value.customToRemove, ["custom_farma"]);
});

test("custom additions can be saved and custom removals drop their selections", () => {
  const result = validateCatalogSectionUpdate(
    {
      selections: [
        { key: "cleanings", selected: true },
        { key: "custom_farma", selected: true }, // being removed below
      ],
      customToRemove: ["custom_farma"],
    },
    sectionCtx(),
  );
  assert.ok(result.ok);
  assert.deepEqual(result.value.selections, [{ key: "cleanings", selected: true }]);
});

test("default catalog entries cannot be removed through the remove payload", () => {
  const defaultKey = validateCatalogSectionUpdate(
    { customToRemove: ["cleanings"] },
    sectionCtx(),
  );
  assert.equal(defaultKey.ok, false);

  const unknownKey = validateCatalogSectionUpdate(
    { customToRemove: ["custom_never_existed"] },
    sectionCtx(),
  );
  assert.equal(unknownKey.ok, false);
});

test("section save rejects unknown selection keys and bad shapes", () => {
  const unknown = validateCatalogSectionUpdate(
    { selections: [{ key: "made_up", selected: true }] },
    sectionCtx(),
  );
  assert.equal(unknown.ok, false);

  const badShape = validateCatalogSectionUpdate(
    { selections: [{ key: "cleanings", selected: "yes" }] },
    sectionCtx(),
  );
  assert.equal(badShape.ok, false);
});

test("duplicate custom labels are rejected case-insensitively", () => {
  const vsDefault = validateCatalogSectionUpdate(
    { customToAdd: [{ label: "cleanings", selected: true }] },
    sectionCtx(),
  );
  assert.equal(vsDefault.ok, false);

  const vsExisting = validateCatalogSectionUpdate(
    { customToAdd: [{ label: "FARMA", selected: true }] },
    sectionCtx(),
  );
  assert.equal(vsExisting.ok, false);

  const withinBatch = validateCatalogSectionUpdate(
    {
      customToAdd: [
        { label: "Laser dentistry", selected: true },
        { label: "laser DENTISTRY", selected: true },
      ],
    },
    sectionCtx(),
  );
  assert.equal(withinBatch.ok, false);

  // Removing the existing custom frees its label for re-adding in the same save.
  const reAddAfterRemove = validateCatalogSectionUpdate(
    {
      customToAdd: [{ label: "Farma", selected: true }],
      customToRemove: ["custom_farma"],
    },
    sectionCtx(),
  );
  assert.ok(reAddAfterRemove.ok);
});

test("section save enforces the 50-entry cap including removals and additions", () => {
  const full = sectionCtx({
    existingCustom: Array.from({ length: 48 }, (_, i) => ({
      key: `custom_extra_${i}`,
      label: `Extra ${i}`,
    })),
    allowedKeys: new Set(["cleanings", "implants"]),
  });
  // 2 defaults + 48 customs = 50 → one more is rejected…
  const over = validateCatalogSectionUpdate(
    { customToAdd: [{ label: "One more", selected: true }] },
    full,
  );
  assert.equal(over.ok, false);
  // …unless a removal frees a slot in the same save.
  const swap = validateCatalogSectionUpdate(
    {
      customToAdd: [{ label: "One more", selected: true }],
      customToRemove: ["custom_extra_0"],
    },
    full,
  );
  assert.ok(swap.ok);
});

// --------------------------------------------------------------------- hours

function weekOf(days: Partial<Record<number, { closed?: boolean; intervals?: { opensAt: string; closesAt: string }[] }>>) {
  return {
    timezone: "America/Chicago",
    days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      closed: days[weekday]?.closed ?? true,
      intervals: days[weekday]?.intervals ?? [],
    })),
  };
}

test("hours accept a valid week and sort days", () => {
  const result = validateHoursInput(
    weekOf({
      1: { closed: false, intervals: [{ opensAt: "08:00", closesAt: "17:00" }] },
      6: { closed: false, intervals: [{ opensAt: "09:00", closesAt: "13:00" }] },
    }),
  );
  assert.ok(result.ok);
  assert.equal(result.value.days.length, 7);
  assert.equal(result.value.days[1].intervals[0].opensAt, "08:00");
  assert.equal(result.value.days[0].closed, true);
});

test("hours require open before close", () => {
  const result = validateHoursInput(
    weekOf({ 1: { closed: false, intervals: [{ opensAt: "17:00", closesAt: "08:00" }] } }),
  );
  assert.equal(result.ok, false);
  const equal = validateHoursInput(
    weekOf({ 1: { closed: false, intervals: [{ opensAt: "08:00", closesAt: "08:00" }] } }),
  );
  assert.equal(equal.ok, false);
});

test("a closed day cannot carry open/close times", () => {
  const result = validateHoursInput(
    weekOf({ 1: { closed: true, intervals: [{ opensAt: "08:00", closesAt: "17:00" }] } }),
  );
  assert.equal(result.ok, false);
});

test("an open day needs at least one time range and at most three", () => {
  const none = validateHoursInput(weekOf({ 1: { closed: false, intervals: [] } }));
  assert.equal(none.ok, false);
  const four = validateHoursInput(
    weekOf({
      1: {
        closed: false,
        intervals: [
          { opensAt: "08:00", closesAt: "09:00" },
          { opensAt: "10:00", closesAt: "11:00" },
          { opensAt: "12:00", closesAt: "13:00" },
          { opensAt: "14:00", closesAt: "15:00" },
        ],
      },
    }),
  );
  assert.equal(four.ok, false);
});

test("overlapping ranges on the same day are rejected", () => {
  const result = validateHoursInput(
    weekOf({
      1: {
        closed: false,
        intervals: [
          { opensAt: "08:00", closesAt: "12:00" },
          { opensAt: "11:00", closesAt: "17:00" },
        ],
      },
    }),
  );
  assert.equal(result.ok, false);
});

test("hours require a known time zone", () => {
  const result = validateHoursInput({ ...weekOf({}), timezone: "Mars/OlympusMons" });
  assert.equal(result.ok, false);
});

// -------------------------------------------------------------- appointments

test("appointment settings default and cap the preferred time question", () => {
  const empty = validateAppointmentSettings({ acceptingNewPatients: true, preferredTimeQuestion: "  " });
  assert.ok(empty.ok);
  assert.equal(empty.value.preferredTimeQuestion, DEFAULT_PREFERRED_TIME_QUESTION);
  assert.equal(empty.value.acceptingNewPatients, true);

  const long = validateAppointmentSettings({
    preferredTimeQuestion: "x".repeat(MAX_PREFERRED_TIME_QUESTION_LENGTH + 1),
  });
  assert.equal(long.ok, false);

  const sample = validateAppointmentSettings({ preferredTimeQuestion: "Visit example.com" });
  assert.equal(sample.ok, false);
});

// ----------------------------------------------------------- payment methods

test("payment methods accept booleans and default omitted fields to null", () => {
  const ok = validatePaymentMethods({ cash: true, hsaFsaCards: true });
  assert.ok(ok.ok);
  assert.equal(ok.value.cash, true);
  assert.equal(ok.value.hsaFsaCards, true);
  assert.equal(ok.value.creditDebitCards, null);
  assert.equal(ok.value.personalChecks, null);
  // No pricing field is part of the payment-methods helper anymore.
  assert.ok(!("pricingPolicy" in ok.value));
});

test("payment methods reject non-boolean values", () => {
  const bad = validatePaymentMethods({ cash: "yes" });
  assert.equal(bad.ok, false);
});

// --------------------------------------------------------- financing & plans

// Shared context: 4 default financing labels reserved, 1 existing custom row
// ("Cherry"), cap of 50.
function financingCtx(overrides?: Partial<Parameters<typeof validateFinancingUpdate>[1]>) {
  return {
    existingCustom: [{ key: "custom_cherry", label: "Cherry" }],
    defaultLabels: FINANCING_DEFAULTS.map((option) => option.label),
    maxEntries: MAX_FINANCING_OPTIONS_PER_CLINIC,
    ...overrides,
  };
}

test("financing save accepts default booleans plus custom add/remove/select", () => {
  const result = validateFinancingUpdate(
    {
      inOfficePaymentPlans: true,
      carecredit: true,
      alphaeonCredit: false,
      membershipPlan: false,
      customToAdd: [{ label: "Sunbit", selected: true }],
      customToRemove: ["custom_cherry"],
      selections: [],
    },
    financingCtx(),
  );
  assert.ok(result.ok);
  assert.equal(result.value.defaults.inOfficePaymentPlans, true);
  assert.equal(result.value.defaults.carecredit, true);
  assert.equal(result.value.defaults.alphaeonCredit, false);
  assert.deepEqual(result.value.custom.customToAdd, [{ label: "Sunbit", selected: true }]);
  assert.deepEqual(result.value.custom.customToRemove, ["custom_cherry"]);
  // No pricing field is part of the financing helper.
  assert.ok(!("pricingPolicy" in result.value));
});

test("financing defaults are required and reject non-boolean values", () => {
  const bad = validateFinancingUpdate({ carecredit: "maybe" }, financingCtx());
  assert.equal(bad.ok, false);

  const omittedOk = validateFinancingUpdate({ carecredit: true }, financingCtx());
  assert.ok(omittedOk.ok);
  assert.equal(omittedOk.value.defaults.inOfficePaymentPlans, null);
});

test("financing selections and removals are limited to existing custom rows", () => {
  const removedSelectionDropped = validateFinancingUpdate(
    {
      selections: [{ key: "custom_cherry", selected: true }],
      customToRemove: ["custom_cherry"],
    },
    financingCtx(),
  );
  assert.ok(removedSelectionDropped.ok);
  assert.deepEqual(removedSelectionDropped.value.custom.selections, []);

  // A default financing key is a boolean, never a custom selection key.
  const defaultAsSelection = validateFinancingUpdate(
    { selections: [{ key: "carecredit", selected: true }] },
    financingCtx(),
  );
  assert.equal(defaultAsSelection.ok, false);

  const unknownRemoval = validateFinancingUpdate(
    { customToRemove: ["custom_never_existed"] },
    financingCtx(),
  );
  assert.equal(unknownRemoval.ok, false);
});

test("duplicate custom financing labels are rejected case-insensitively", () => {
  // vs a default financing label
  const vsDefault = validateFinancingUpdate(
    { customToAdd: [{ label: "carecredit", selected: true }] },
    financingCtx(),
  );
  assert.equal(vsDefault.ok, false);

  // vs an existing custom row
  const vsExisting = validateFinancingUpdate(
    { customToAdd: [{ label: "CHERRY", selected: true }] },
    financingCtx(),
  );
  assert.equal(vsExisting.ok, false);

  // within the same batch
  const withinBatch = validateFinancingUpdate(
    { customToAdd: [{ label: "Sunbit", selected: true }, { label: "sunbit", selected: true }] },
    financingCtx(),
  );
  assert.equal(withinBatch.ok, false);

  // removing the existing custom frees its label for re-adding in the same save
  const reAddAfterRemove = validateFinancingUpdate(
    { customToAdd: [{ label: "Cherry", selected: true }], customToRemove: ["custom_cherry"] },
    financingCtx(),
  );
  assert.ok(reAddAfterRemove.ok);
});

test("financing enforces a 50 custom-option cap", () => {
  const full = financingCtx({
    existingCustom: Array.from({ length: MAX_FINANCING_OPTIONS_PER_CLINIC }, (_, i) => ({
      key: `custom_opt_${i}`,
      label: `Option ${i}`,
    })),
  });
  const over = validateFinancingUpdate({ customToAdd: [{ label: "One more", selected: true }] }, full);
  assert.equal(over.ok, false);

  // …unless a removal frees a slot in the same save.
  const swap = validateFinancingUpdate(
    { customToAdd: [{ label: "One more", selected: true }], customToRemove: ["custom_opt_0"] },
    full,
  );
  assert.ok(swap.ok);
});

// ------------------------------------------------------------------ UI guards

test("AI knowledge intro uses a CSS class, not an inline gap style", () => {
  const source = readFileSync(
    join(process.cwd(), "app", "setup", "[token]", "_components", "AiKnowledgeCard.tsx"),
    "utf8",
  );
  // The failed inline-spacing attempt must be gone.
  assert.ok(!/style=\{\{\s*gap:\s*"var\(--space-3\)"\s*\}\}/.test(source));
  // The real class-based intro must be present.
  assert.ok(source.includes('className="acct-callout aifacts-intro"'));
  assert.ok(source.includes("aifacts-intro-title"));
  assert.ok(source.includes("aifacts-intro-body"));
  // The removed Pricing policy textarea must not reappear in the owner UI.
  assert.ok(!source.includes("MAX_PRICING_POLICY_LENGTH"));
  assert.ok(!/Pricing policy/.test(source));
});

// ------------------------------------------------------------------ policies

test("office policies accept a clean form link and short policy text", () => {
  const ok = validateOfficePolicies({
    newPatientForms: "https://yourpractice.com/new-patient-forms",
    whatToBring: "Photo ID and insurance card",
    cancellationPolicy: "Please call to cancel or reschedule.",
  });
  assert.ok(ok.ok);
  assert.equal(ok.value.newPatientForms, "https://yourpractice.com/new-patient-forms");
  assert.equal(ok.value.parkingNotes, null);
  // Languages are no longer part of office policies.
  assert.ok(!("languages" in ok.value));
});

test("office policies reject a noisy text excerpt in the form link field", () => {
  const noisy = validateOfficePolicies({
    newPatientForms:
      "Michigan Ave Ste 922 E Chicago, IL 60611 Downloadable Forms: New Patient Form Medical History Making an Appointment",
  });
  assert.equal(noisy.ok, false);

  const sentence = validateOfficePolicies({
    newPatientForms: "Please arrive 15 minutes early to complete forms.",
  });
  assert.equal(sentence.ok, false);
});

test("office policies cap text lengths and reject sample data", () => {
  const longText = validateOfficePolicies({
    cancellationPolicy: "x".repeat(MAX_POLICY_TEXT_LENGTH + 1),
  });
  assert.equal(longText.ok, false);

  const sample = validateOfficePolicies({ parkingNotes: "lorem ipsum parking" });
  assert.equal(sample.ok, false);
});

test("looksLikeFormLink accepts links/paths/domains and rejects free text", () => {
  for (const good of [
    "https://yourpractice.com/new-patient-forms",
    "http://example.org/forms/new-patient.pdf",
    "/patient-paperwork",
    "yourpractice.com/forms",
  ]) {
    assert.equal(looksLikeFormLink(good), true, `should accept: ${good}`);
  }
  for (const bad of [
    "",
    "New Patient Form Medical History",
    "Downloadable Forms: New Patient Form",
    "call the office",
    "x".repeat(MAX_POLICY_TEXT_LENGTH + 1),
  ]) {
    assert.equal(looksLikeFormLink(bad), false, `should reject: ${bad}`);
  }
});

// ----------------------------------------------------------------- languages

test("default languages are English, Spanish, Russian, Polish, Chinese", () => {
  assert.deepEqual([...DEFAULT_LANGUAGES], ["English", "Spanish", "Russian", "Polish", "Chinese"]);
});

test("languages always include English even when omitted by the client", () => {
  const omitted = validateLanguagesList({ languages: ["Spanish", "Polish"] });
  assert.ok(omitted.ok);
  assert.equal(omitted.value[0], "English");
  assert.ok(omitted.value.includes("Spanish"));
  assert.ok(omitted.value.includes("Polish"));

  const empty = validateLanguagesList({ languages: [] });
  assert.ok(empty.ok);
  assert.deepEqual(empty.value, ["English"]);
});

test("languages add a custom value and dedupe case-insensitively", () => {
  const custom = validateLanguagesList({ languages: ["Ukrainian", "english", "ENGLISH", "ukrainian"] });
  assert.ok(custom.ok);
  // English forced once at the front; Ukrainian kept once.
  assert.deepEqual(custom.value, ["English", "Ukrainian"]);
});

test("languages enforce max count and per-item length", () => {
  const tooMany = validateLanguagesList({
    languages: Array.from({ length: MAX_LANGUAGES + 2 }, (_, i) => `Language ${i}`),
  });
  assert.equal(tooMany.ok, false);

  const tooLong = validateLanguagesList({ languages: ["x".repeat(41)] });
  assert.equal(tooLong.ok, false);

  const sample = validateLanguagesList({ languages: ["lorem ipsum"] });
  assert.equal(sample.ok, false);
});
