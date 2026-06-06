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
    // Non-secret runtime flags. Keep default disabled.
    //  - "mock": local/staging assignment UX only — no real Twilio call.
    //  - "owner_test_live": REAL Twilio purchase, but ONLY for clinic ids listed
    //     in twilioPurchaseTestClinicIds (controlled owner/test live testing).
    //  - "live": REAL Twilio purchase for all eligible clinics (deliberate go-live).
    twilioNumberPurchaseMode: "owner_test_live" as
      | "disabled"
      | "mock"
      | "owner_test_live"
      | "live",
    // Allowlist of clinic UUIDs permitted to make a REAL Twilio purchase while
    // twilioNumberPurchaseMode === "owner_test_live". Non-secret operational
    // config (clinic ids are not secrets). Empty = no clinic may purchase in
    // owner_test_live. Ignored in "live" (all eligible), "mock", and "disabled".
    //  - f37f24a1-...: "Fairstone Dental Smile" (owner livedealsmart@gmail.com) —
    //    Vlad's controlled owner_test_live test clinic. Only this clinic may make
    //    a REAL Twilio purchase. Broad "live" mode stays OFF.
    twilioPurchaseTestClinicIds: [
      "f37f24a1-070f-436b-b803-956f55466093",
    ] as readonly string[],
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

  a2p: {
    // Review/submission mode for the platform-admin A2P/10DLC approval workflow.
    // This is a NON-secret safety switch. Default is "dry_run".
    //  - "disabled": the submit action is fully off. The admin can still view the
    //     review package; the submit button is hidden and the endpoint refuses.
    //  - "dry_run": the platform admin can record a LOCAL "reviewed / ready for
    //     manual submission" status. NO Twilio mutation occurs and NO real A2P
    //     registration is submitted. A human still submits in the Twilio console.
    //  - "live": RESERVED. Real Twilio A2P submission is NOT implemented in this
    //     build. The submission endpoint refuses "live" so provider state can
    //     never be mutated from here. Enabling real submission is a deliberate
    //     future task that also requires the lib/twilio/a2p-submission.ts helper
    //     to be implemented behind its own explicit gate.
    submissionMode: "dry_run" as "disabled" | "dry_run" | "live",
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
