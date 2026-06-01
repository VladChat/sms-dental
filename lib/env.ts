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

const StripeWebhookSchema = z.object({
  STRIPE_WEBHOOK_SECRET: requiredString,
});

const StripeServerSchema = z.object({
  STRIPE_SECRET_KEY: requiredString,
});

const SupabaseDbSchema = z.object({
  SUPABASE_DB_URL: requiredString,
});

const SupabaseServiceRoleSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: requiredString,
});

const PublicWebhookBaseSchema = z.object({
  PUBLIC_WEBHOOK_BASE_URL: z.string().url(),
});

// RESEND_API_KEY is required for setup email sending.
// Sender config is non-secret and lives in committed runtime config.
const SetupEmailSchema = z.object({
  RESEND_API_KEY: requiredString,
});

export function getTwilioServerEnv() {
  return TwilioServerSchema.parse(process.env);
}

// Twilio resource identifiers are non-secret configuration.
// Keep them in committed runtime config, not in .env.local.
export function getTwilioMessagingEnv() {
  const sid = runtimeConfig.twilio.messagingServiceSid?.trim() ?? "";
  if (!sid) {
    throw new Error("Twilio messaging service SID is not configured in runtime config");
  }

  return {
    TWILIO_MESSAGING_SERVICE_SID: sid,
    TWILIO_PHONE_NUMBER: runtimeConfig.twilio.phoneNumber,
    TWILIO_PHONE_NUMBER_SID: runtimeConfig.twilio.phoneNumberSid,
  };
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
// These are non-secret runtime settings and live in committed runtime config.
export function getAppDomains(): { appBaseUrl: string; publicSiteUrl: string } {
  const appBaseUrl = runtimeConfig.app.appBaseUrl.replace(/\/+$/, "");
  const publicSiteUrl = runtimeConfig.app.publicSiteUrl.replace(/\/+$/, "");

  if (!appBaseUrl || !publicSiteUrl) {
    throw new Error("App/public domains are not configured in runtime config");
  }

  return { appBaseUrl, publicSiteUrl };
}

// Returns the configured app/public origins or undefined if unset.
// Use this in places where we render a graceful fallback rather than throw.
export function getAppDomainsSafe():
  | { appBaseUrl: string; publicSiteUrl: string }
  | undefined {
  const appBaseUrl = runtimeConfig.app.appBaseUrl.replace(/\/+$/, "");
  const publicSiteUrl = runtimeConfig.app.publicSiteUrl.replace(/\/+$/, "");
  if (!appBaseUrl || !publicSiteUrl) return undefined;
  return { appBaseUrl, publicSiteUrl };
}

// Platform-admin allowlist (non-secret operator emails) from the environment.
// Comma-separated; trimmed + lowercased; empty array when unset (=> `/admin`
// denies all access). Never log the parsed values.
export function getPlatformAdminEmails(): string[] {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

// Returns the validated Resend API key plus the resolved sender from config.
export function getSetupEmailEnv(): {
  resendApiKey: string;
  setupEmailFrom: string;
} {
  const parsed = SetupEmailSchema.parse(process.env);
  return {
    resendApiKey: parsed.RESEND_API_KEY,
    setupEmailFrom: runtimeConfig.email.defaultSetupFrom,
  };
}

// Twilio number purchase safety gate. Search is always allowed when the
// Twilio client is configured. Purchase proceeds only when the committed
// runtime config explicitly enables it.
export function isTwilioNumberPurchaseEnabled(): boolean {
  return runtimeConfig.onboarding.twilioNumberPurchaseEnabled;
}

// Owner-test setup link fallback gate from committed runtime config.
// Default false — production must use real email delivery.
export function isOwnerTestSetupLinkFallbackEnabled(): boolean {
  return runtimeConfig.onboarding.ownerTestSetupLinkFallback;
}

// Safe presence check for health and runtime wiring. Returns booleans only,
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
    twilioPhoneNumber: runtimeConfig.twilio.phoneNumber.trim().length > 0,
    twilioPhoneNumberSid: runtimeConfig.twilio.phoneNumberSid.trim().length > 0,
    twilioMessagingServiceSid:
      runtimeConfig.twilio.messagingServiceSid.trim().length > 0,
    stripeSecretKey: present("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: present("STRIPE_WEBHOOK_SECRET"),
    stripeAccountId: runtimeConfig.stripe.accountId.trim().length > 0,
    publicWebhookBaseUrl: present("PUBLIC_WEBHOOK_BASE_URL"),
    smsRecoveryMode: present("SMS_RECOVERY_MODE"),
    smsTestAllowedTo: present("SMS_TEST_ALLOWED_TO"),
    appBaseUrl: runtimeConfig.app.appBaseUrl.trim().length > 0,
    publicSiteUrl: runtimeConfig.app.publicSiteUrl.trim().length > 0,
    resendApiKey: present("RESEND_API_KEY"),
    setupEmailFrom: runtimeConfig.email.defaultSetupFrom.trim().length > 0,
    twilioNumberPurchaseEnabled: runtimeConfig.onboarding.twilioNumberPurchaseEnabled,
  };
}
