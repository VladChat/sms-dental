// Runtime config: normal settings and public provider IDs only.
// Do not put passwords, auth tokens, service-role keys, database URLs, or secret keys here.

export const runtimeConfig = {
  app: {
    name: "Missed Calls Dental",
    url: "https://missedcallsdental.com/",
    environment: "local",
    defaultTimezone: "America/Chicago",
    supportEmail: "support@missedcallsdental.com",
    // Internal-only contact. Do not surface this in public website copy.
    adminEmail: "internal-admin@missedcallsdental.local",
  },

  supabase: {
    url: "https://qfjpvbvfvhbtebwivcdc.supabase.co",
    anonKey: "sb_publishable_Tl7_-4rLh4IiIT1lgkFGlA_Gf7ShCgC",
  },

  twilio: {
    accountSid: "TO_FILL_AFTER_TWILIO_ACCOUNT_CREATED",
    defaultMessagingServiceSid: "TO_FILL_AFTER_TWILIO_MESSAGING_SERVICE_CREATED",
  },

  stripe: {
    monthlyPriceId: "TO_FILL_AFTER_STRIPE_PRICE_CREATED",
    annualPriceId: "TO_FILL_AFTER_STRIPE_ANNUAL_PRICE_CREATED_IF_USED",
  },

  billing: {
    monthlyPriceUsd: 99,
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
