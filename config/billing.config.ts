// Single source of truth for plan pricing, included usage, and additional-number
// consent metadata.
//
// Safe to import from BOTH server and client code: no secrets, no environment
// reads, no Stripe secret IDs, no Node-only dependencies. UI copy, API
// validation, consent text, and database snapshots all read from here so the
// numbers are never duplicated across the codebase.
//
// Stripe Price IDs are intentionally NOT stored here — test and live IDs differ
// and are managed in Stripe (and non-secret runtime config / future billing
// wiring), never hard-coded next to these amounts.

export const billingConfig = {
  currency: "usd",

  basePlan: {
    displayName: "Standard Plan",
    monthlyUnitAmountCents: 9900,
    includedBusinessNumbers: 1,
    includedCallMinutes: 1000,
    includedSmsSegments: 1000,
  },

  additionalBusinessNumber: {
    monthlyUnitAmountCents: 2000,
    consentTextVersion: "additional-business-number-v1",
  },

  overage: {
    callMinuteUnitAmountCents: 7,
    smsSegmentUnitAmountCents: 6,
  },

  // Non-secret product policy. The default cap on how many business numbers a
  // clinic may self-service hold (assigned + suspended + in-flight). A platform
  // admin can raise a specific clinic's limit; this is only the default.
  productPolicy: {
    defaultSelfServiceBusinessNumberLimit: 5,
  },
} as const;

// "$99", "$20", "$0.07" — whole-dollar amounts drop the cents; sub-dollar
// amounts keep two decimals. USD only (matches billingConfig.currency).
export function formatUsdFromCents(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

// Thousands-separated integer, e.g. 1000 -> "1,000".
export function formatInteger(value: number): string {
  return value.toLocaleString("en-US");
}

// The exact additional-number consent sentence the owner authorizes. Rendered
// from config so the UI checkbox label, the server validation, and the stored
// consent audit snapshot are always identical.
export function additionalNumberConsentText(): string {
  const amount = formatUsdFromCents(
    billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
  );
  return `I authorize Missed Calls Dental to add ${amount}/month to my monthly bill when this number is activated.`;
}
