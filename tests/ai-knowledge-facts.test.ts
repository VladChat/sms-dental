import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_INSURANCE_PLANS,
  DEFAULT_PREFERRED_TIME_QUESTION,
  DEFAULT_SERVICES,
  MAX_CUSTOM_LABEL_LENGTH,
  MAX_INSURANCE_PLANS_PER_CLINIC,
  MAX_LANGUAGES,
  MAX_POLICY_TEXT_LENGTH,
  MAX_PREFERRED_TIME_QUESTION_LENGTH,
  MAX_PRICING_POLICY_LENGTH,
  MAX_SERVICES_PER_CLINIC,
} from "../config/ai-front-desk-facts.config";
import {
  customKeyFromLabel,
  customLimitReached,
  validateAppointmentSettings,
  validateCustomLabel,
  validateHoursInput,
  validateOfficePolicies,
  validatePaymentSettings,
  validateSelections,
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

// ---------------------------------------------------------------- selections

test("selection save accepts known keys and rejects unknown keys", () => {
  const allowed = new Set(["cleanings", "implants", "custom_laser_dentistry"]);
  const good = validateSelections(
    [
      { key: "cleanings", selected: true },
      { key: "custom_laser_dentistry", selected: false },
    ],
    allowed,
  );
  assert.ok(good.ok);
  assert.equal(good.value.length, 2);

  const unknown = validateSelections([{ key: "made_up", selected: true }], allowed);
  assert.equal(unknown.ok, false);

  const badShape = validateSelections([{ key: "cleanings", selected: "yes" }], allowed);
  assert.equal(badShape.ok, false);
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

// ------------------------------------------------------------------- payment

test("payment settings cap the pricing policy and keep it optional", () => {
  const ok = validatePaymentSettings({ paymentPlans: true, carecredit: true, pricingPolicy: " " });
  assert.ok(ok.ok);
  assert.equal(ok.value.pricingPolicy, null);
  assert.equal(ok.value.paymentPlans, true);
  assert.equal(ok.value.financing, null);

  const long = validatePaymentSettings({ pricingPolicy: "x".repeat(MAX_PRICING_POLICY_LENGTH + 1) });
  assert.equal(long.ok, false);
});

// ------------------------------------------------------------------ policies

test("office policies cap text lengths and language counts", () => {
  const ok = validateOfficePolicies({
    newPatientForms: "Please arrive 15 minutes early to complete forms.",
    languages: ["English", "Spanish", "  ", "spanish"],
  });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value.languages, ["English", "Spanish"]);
  assert.equal(ok.value.whatToBring, null);

  const longText = validateOfficePolicies({
    cancellationPolicy: "x".repeat(MAX_POLICY_TEXT_LENGTH + 1),
  });
  assert.equal(longText.ok, false);

  const tooManyLanguages = validateOfficePolicies({
    languages: Array.from({ length: MAX_LANGUAGES + 1 }, (_, i) => `Language ${i}`),
  });
  assert.equal(tooManyLanguages.ok, false);

  const longLanguage = validateOfficePolicies({ languages: ["x".repeat(41)] });
  assert.equal(longLanguage.ok, false);

  const sample = validateOfficePolicies({ parkingNotes: "lorem ipsum parking" });
  assert.equal(sample.ok, false);
});
