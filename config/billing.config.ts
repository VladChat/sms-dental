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

  // Toll-free vs Local number model — the single source of truth for the
  // customer-facing pricing of each number type. Components must read breakdowns
  // from the builders below; they never hard-code amounts.
  //
  //  - Toll-free: the FIRST toll-free number is included in the plan. An
  //    additional toll-free number is a paid add-on (reuses
  //    additionalBusinessNumber.monthlyUnitAmountCents — the same $20/month item
  //    already wired in Stripe). Toll-free verification is included.
  //  - Local: ALWAYS a paid add-on (even the first number, even during trial)
  //    because of A2P 10DLC registration/compliance. Local carries distinct
  //    regulatory + MCD fees that are NOT yet wired in Stripe, so local purchase
  //    is fail-closed server-side (see lib/env.ts hasLocalNumberBillingConfigured).
  numberModel: {
    local: {
      // Regulatory / carrier fees (passed through; A2P 10DLC compliance).
      regulatoryFees: {
        carrierBrandRegistrationOneTimeCents: 900, // $9 one-time
        campaignRegistrationOneTimeCents: 3000, // $30 one-time
        monthlySmsComplianceCents: 1500, // $15/month
      },
      // Missed Calls Dental fees for a local number.
      mcdFees: {
        monthlyNumberCents: 2000, // $20/month
        setupFeeOneTimeCents: 2000, // $20 one-time
      },
    },
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

// ── Number-type pricing breakdowns (single source of truth for the UI) ─────────
// Every breakdown row's `price` ends in one of: "included in plan", "included",
// "$X/month", "$X one-time", or a per-unit usage rate. Amounts come only from
// billingConfig above so they are never duplicated in components. No "free".

export type NumberType = "toll_free" | "local";
export type NumberPriceRow = { label: string; price: string };
export type NumberPriceGroup = { heading: string | null; rows: NumberPriceRow[] };

function usageRows(): NumberPriceRow[] {
  return [
    {
      label: "SMS usage",
      price: `${formatUsdFromCents(billingConfig.overage.smsSegmentUnitAmountCents)}/additional SMS segment`,
    },
    {
      label: "Call usage",
      price: `${formatUsdFromCents(billingConfig.overage.callMinuteUnitAmountCents)}/additional call minute`,
    },
  ];
}

// Toll-free: first number included, additional $20/month, verification included.
export function tollFreeNumberBreakdown(): NumberPriceGroup[] {
  return [
    {
      heading: null,
      rows: [
        { label: "First toll-free number", price: "included in plan" },
        {
          label: "Additional toll-free number",
          price: `${formatUsdFromCents(billingConfig.additionalBusinessNumber.monthlyUnitAmountCents)}/month`,
        },
        { label: "Toll-free verification", price: "included" },
        ...usageRows(),
      ],
    },
  ];
}

// Local: regulatory fees + MCD fees. Always a paid add-on.
export function localNumberBreakdown(): NumberPriceGroup[] {
  const reg = billingConfig.numberModel.local.regulatoryFees;
  const mcd = billingConfig.numberModel.local.mcdFees;
  return [
    {
      heading: "Regulatory fees",
      rows: [
        {
          label: "Carrier brand registration",
          price: `${formatUsdFromCents(reg.carrierBrandRegistrationOneTimeCents)} one-time`,
        },
        {
          label: "Campaign registration / vetting",
          price: `${formatUsdFromCents(reg.campaignRegistrationOneTimeCents)} one-time`,
        },
        {
          label: "Monthly SMS compliance fee",
          price: `${formatUsdFromCents(reg.monthlySmsComplianceCents)}/month`,
        },
      ],
    },
    {
      heading: "MCD fees",
      rows: [
        { label: "Local number", price: `${formatUsdFromCents(mcd.monthlyNumberCents)}/month` },
        ...usageRows(),
        { label: "Setup fee", price: `${formatUsdFromCents(mcd.setupFeeOneTimeCents)} one-time` },
      ],
    },
  ];
}

// One-line billing label for an assigned number card. Driven by number_type
// (display), not by the Stripe billing_class mechanic. Never uses "free".
export function assignedNumberBillingLabel(
  numberType: NumberType,
  billingClass: string,
): string {
  if (numberType === "local") {
    const amount = formatUsdFromCents(billingConfig.numberModel.local.mcdFees.monthlyNumberCents);
    return `Local number · ${amount}/month`;
  }
  if (billingClass === "additional") {
    const amount = formatUsdFromCents(billingConfig.additionalBusinessNumber.monthlyUnitAmountCents);
    return `Additional toll-free number · ${amount}/month`;
  }
  return "Included in plan";
}
