/**
 * Non-secret runtime configuration example.
 *
 * This file is safe to commit after replacing placeholders with non-secret values.
 * Do not put private API secrets, passwords, auth tokens, service-role keys,
 * or webhook secrets here.
 *
 * Real project options:
 * - keep this as TypeScript config,
 * - read non-secret values from environment variables,
 * - store clinic-specific settings in the database,
 * - or combine the above.
 */

export const runtimeConfig = {
  app: {
    env: process.env.NEXT_PUBLIC_APP_ENV ?? "local",
    name: "Missed Call Recovery",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    supportEmail: "support@example.com",
    adminEmailAllowlist: ["founder@example.com"],
  },

  supabase: {
    // Public Supabase values intended for browser/client use.
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },

  twilio: {
    // Provider identifiers, not private secrets.
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    apiKeySid: process.env.TWILIO_API_KEY_SID ?? "",
    defaultMessagingServiceSid:
      process.env.TWILIO_DEFAULT_MESSAGING_SERVICE_SID ?? "",

    webhookBaseUrl:
      process.env.TWILIO_WEBHOOK_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000",
  },

  stripe: {
    // Stripe Price IDs are identifiers, not private secret keys.
    monthlyPriceId: process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
    annualPriceId: process.env.STRIPE_PRICE_ID_ANNUAL ?? "",
    trialDays: 14,
    customerPortalReturnUrl:
      process.env.STRIPE_CUSTOMER_PORTAL_RETURN_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000",
  },

  sms: {
    firstSmsDelaySeconds: 15,
    followupOneDelayMinutes: 15,
    nextBusinessDayFollowupHourLocal: 9,
    maxAutomatedSmsPerMissedCall: 3,
    includeStopTextInFirstMessage: true,
  },

  calls: {
    callbackBridgeTimeoutSeconds: 15,
  },

  jobs: {
    followupBatchSize: 50,
  },

  observability: {
    // Sentry DSN is usually not a private secret, but keep it per environment.
    sentryDsn: process.env.SENTRY_DSN ?? "",
  },

  productScope: {
    aiReceptionistEnabled: false,
    pmsIntegrationEnabled: false,
    callRecordingEnabled: false,
    numberPortingEnabled: false,
    flyIoEnabled: false,
  },
} as const;
