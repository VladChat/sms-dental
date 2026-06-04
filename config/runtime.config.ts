// Runtime config: normal settings and public provider IDs only.
// Do not put passwords, auth tokens, service-role keys, database URLs, or secret keys here.

export const runtimeConfig = {
  app: {
    name: "Missed Calls Dental",
    url: "https://missedcallsdental.com/",
    appBaseUrl: "https://app.missedcallsdental.com",
    publicSiteUrl: "https://missedcallsdental.com",
    environment: "local",
    defaultTimezone: "America/Chicago",
    supportEmail: "support@missedcallsdental.com",
    // Internal-only contact. Do not surface this in public website copy.
    adminEmail: "internal-admin@missedcallsdental.local",
  },

  email: {
    // Default From for transactional setup emails sent via Resend.
    defaultSetupFrom: "Missed Calls Dental <no-reply@mail.missedcallsdental.com>",
  },

  supabase: {
    url: "https://qfjpvbvfvhbtebwivcdc.supabase.co",
    anonKey: "sb_publishable_Tl7_-4rLh4IiIT1lgkFGlA_Gf7ShCgC",
  },

  twilio: {
    // Non-secret Twilio resource configuration.
    phoneNumber: "+18447234944",
    phoneNumberSid: "PN3d6d4c7f327b299a4b04e4bd7e05a402",
    messagingServiceSid: "MG83239dc7dfdf8aa6c9b397e8258f7d93",
  },

  stripe: {
    // Non-secret Stripe account identifier used for metadata/ops context.
    accountId: "acct_1TVG3U4ZSHLicmej",
    monthlyPriceId: "TO_FILL_AFTER_STRIPE_PRICE_CREATED",
    annualPriceId: "TO_FILL_AFTER_STRIPE_ANNUAL_PRICE_CREATED_IF_USED",
  },

  onboarding: {
    // Non-secret runtime flags.
    twilioNumberPurchaseEnabled: false,
    // Production must keep this false so /api/setup-requests actually sends the
    // Resend email instead of short-circuiting to a fallback link. Only flip
    // to true for short, controlled owner-only API tests when Resend is
    // intentionally bypassed.
    ownerTestSetupLinkFallback: false,
  },

  billing: {
    // Plan pricing + included usage live in config/billing.config.ts (the single
    // source of truth). Do not duplicate plan/price amounts here.
    trialDaysAfterActivation: 21,
  },

  testClinic: {
    name: "Lakeview Family Dental",
    mainPhone: "+12245329236",
    callbackPhone: "+12245329236",
    timezone: "America/Chicago",
    businessHours: "Monday-Friday 8:00 AM-5:00 PM; Saturday-Sunday closed",
    emergencyInstruction:
      "If you have swelling, trauma, uncontrolled bleeding, or severe pain, please call the office. If this is life-threatening, call 911.",
    averageRecoveredAppointmentValueUsd: 300,
  },
} as const;