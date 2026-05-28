import { z } from "zod";
import { runtimeConfig } from "../config/runtime.config";

// Per-feature env schemas. Each schema is validated lazily, at the moment a
// specific helper is used. Nothing here runs at module import time, so
// `next build` never requires real secret values to succeed.
//
// Never log the parsed values. Never expose them to the client.

const requiredString = z.string().min(1);

const TwilioServerSchema = z.object({
  TWILIO_ACCOUNT_SID: requiredString,
  TWILIO_AUTH_TOKEN: requiredString,
});

const TwilioMessagingSchema = z.object({
  TWILIO_MESSAGING_SERVICE_SID: requiredString,
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_PHONE_NUMBER_SID: z.string().optional(),
});

const StripeWebhookSchema = z.object({
  STRIPE_WEBHOOK_SECRET: requiredString,
});

const StripeServerSchema = z.object({
  STRIPE_SECRET_KEY: requiredString,
  STRIPE_ACCOUNT_ID: z.string().optional(),
});

const SupabaseDbSchema = z.object({
  SUPABASE_DB_URL: requiredString,
});

const SupabaseServiceRoleSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: requiredString,
});

const InternalAdminSchema = z.object({
  INTERNAL_ADMIN_SECRET: requiredString,
});

const JobRunnerSchema = z.object({
  JOB_RUNNER_SECRET: requiredString,
});

const PublicWebhookBaseSchema = z.object({
  PUBLIC_WEBHOOK_BASE_URL: z.string().url(),
});

const AppDomainsSchema = z.object({
  APP_BASE_URL: z.string().url(),
  PUBLIC_SITE_URL: z.string().url(),
});

// RESEND_API_KEY is the only required secret for setup email sending.
// SETUP_EMAIL_FROM is an optional, non-secret override; when unset we use the
// central default sender from runtimeConfig.email.defaultSetupFrom.
const SetupEmailSchema = z.object({
  RESEND_API_KEY: requiredString,
  SETUP_EMAIL_FROM: z.string().trim().min(1).optional(),
});

export function getTwilioServerEnv() {
  return TwilioServerSchema.parse(process.env);
}

export function getTwilioMessagingEnv() {
  return TwilioMessagingSchema.parse(process.env);
}

export function getStripeWebhookEnv() {
  return StripeWebhookSchema.parse(process.env);
}

export function getStripeServerEnv() {
  return StripeServerSchema.parse(process.env);
}

export function getSupabaseDbEnv() {
  return SupabaseDbSchema.parse(process.env);
}

export function getSupabaseServiceRoleEnv() {
  return SupabaseServiceRoleSchema.parse(process.env);
}

export function getInternalAdminEnv() {
  return InternalAdminSchema.parse(process.env);
}

export function getJobRunnerEnv() {
  return JobRunnerSchema.parse(process.env);
}

// SMS recovery mode. Never throws — defaults to "disabled" if unset or unknown.
export type SmsRecoveryMode = "disabled" | "owner_test" | "live";

export function getSmsRecoveryConfig(): {
  mode: SmsRecoveryMode;
  allowedNumbers: string[];
} {
  const raw = process.env.SMS_RECOVERY_MODE ?? "";
  const mode: SmsRecoveryMode =
    raw === "owner_test" ? "owner_test"
    : raw === "live" ? "live"
    : "disabled";
  const allowedRaw = process.env.SMS_TEST_ALLOWED_TO ?? "";
  const allowedNumbers = allowedRaw
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  return { mode, allowedNumbers };
}

export function getPublicWebhookBaseUrl(): string | undefined {
  const raw = process.env.PUBLIC_WEBHOOK_BASE_URL;
  if (!raw) return undefined;
  const parsed = PublicWebhookBaseSchema.safeParse({
    PUBLIC_WEBHOOK_BASE_URL: raw,
  });
  return parsed.success ? parsed.data.PUBLIC_WEBHOOK_BASE_URL : undefined;
}

// Trusted app and public-site base URLs used by the onboarding workflow.
// The app base URL is the only origin used to compose setup links; we do
// NOT trust the request `Host` header. The public site URL is the apex
// marketing site and is used as the allowed Origin for cross-origin POSTs.
export function getAppDomains(): { appBaseUrl: string; publicSiteUrl: string } {
  const parsed = AppDomainsSchema.parse(process.env);
  return {
    appBaseUrl: parsed.APP_BASE_URL.replace(/\/+$/, ""),
    publicSiteUrl: parsed.PUBLIC_SITE_URL.replace(/\/+$/, ""),
  };
}

// Returns the configured app/public origins or `undefined` if unset.
// Use this in places where we render a graceful fallback rather than throw.
export function getAppDomainsSafe():
  | { appBaseUrl: string; publicSiteUrl: string }
  | undefined {
  const parsed = AppDomainsSchema.safeParse(process.env);
  if (!parsed.success) return undefined;
  return {
    appBaseUrl: parsed.data.APP_BASE_URL.replace(/\/+$/, ""),
    publicSiteUrl: parsed.data.PUBLIC_SITE_URL.replace(/\/+$/, ""),
  };
}

// Returns the validated Resend API key plus the resolved sender. The sender
// is the optional SETUP_EMAIL_FROM override, otherwise the central default.
export function getSetupEmailEnv(): {
  resendApiKey: string;
  setupEmailFrom: string;
} {
  const parsed = SetupEmailSchema.parse(process.env);
  return {
    resendApiKey: parsed.RESEND_API_KEY,
    setupEmailFrom: parsed.SETUP_EMAIL_FROM ?? runtimeConfig.email.defaultSetupFrom,
  };
}

// Twilio number purchase safety gate. Search is always allowed when the
// Twilio client is configured. Purchase only proceeds when the env flag is
// explicitly set to the string "true".
export function isTwilioNumberPurchaseEnabled(): boolean {
  return process.env.TWILIO_NUMBER_PURCHASE_ENABLED === "true";
}

// Owner-test setup link fallback. When this flag is explicitly enabled,
// /api/setup-requests returns the setup link in the JSON response so the
// owner can complete onboarding without configured email delivery.
// Default false — production must use real email delivery.
export function isOwnerTestSetupLinkFallbackEnabled(): boolean {
  return process.env.OWNER_TEST_SETUP_LINK_FALLBACK === "true";
}

// Safe presence check for the internal health route. Returns booleans only,
// never values. Used to report which feature areas are configured.
export type EnvPresenceReport = {
  supabaseDbUrl: boolean;
  supabaseServiceRoleKey: boolean;
  twilioAccountSid: boolean;
  twilioAuthToken: boolean;
  twilioPhoneNumber: boolean;
  twilioPhoneNumberSid: boolean;
  twilioMessagingServiceSid: boolean;
  stripeSecretKey: boolean;
  stripeWebhookSecret: boolean;
  stripeAccountId: boolean;
  jobRunnerSecret: boolean;
  internalAdminSecret: boolean;
  publicWebhookBaseUrl: boolean;
  smsRecoveryMode: boolean;
  smsTestAllowedTo: boolean;
  appBaseUrl: boolean;
  publicSiteUrl: boolean;
  resendApiKey: boolean;
  setupEmailFrom: boolean;
  twilioNumberPurchaseEnabled: boolean;
};

function present(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

export function getEnvPresenceReport(): EnvPresenceReport {
  return {
    supabaseDbUrl: present("SUPABASE_DB_URL"),
    supabaseServiceRoleKey: present("SUPABASE_SERVICE_ROLE_KEY"),
    twilioAccountSid: present("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: present("TWILIO_AUTH_TOKEN"),
    twilioPhoneNumber: present("TWILIO_PHONE_NUMBER"),
    twilioPhoneNumberSid: present("TWILIO_PHONE_NUMBER_SID"),
    twilioMessagingServiceSid: present("TWILIO_MESSAGING_SERVICE_SID"),
    stripeSecretKey: present("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: present("STRIPE_WEBHOOK_SECRET"),
    stripeAccountId: present("STRIPE_ACCOUNT_ID"),
    jobRunnerSecret: present("JOB_RUNNER_SECRET"),
    internalAdminSecret: present("INTERNAL_ADMIN_SECRET"),
    publicWebhookBaseUrl: present("PUBLIC_WEBHOOK_BASE_URL"),
    smsRecoveryMode: present("SMS_RECOVERY_MODE"),
    smsTestAllowedTo: present("SMS_TEST_ALLOWED_TO"),
    appBaseUrl: present("APP_BASE_URL"),
    publicSiteUrl: present("PUBLIC_SITE_URL"),
    resendApiKey: present("RESEND_API_KEY"),
    setupEmailFrom: present("SETUP_EMAIL_FROM"),
    twilioNumberPurchaseEnabled:
      process.env.TWILIO_NUMBER_PURCHASE_ENABLED === "true",
  };
}
