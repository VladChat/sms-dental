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

// Non-secret Stripe TEST-mode recurring Price IDs for the subscription billing
// model. Server-only: returned to server code, never sent to the client. Test
// and live IDs differ, so these live in env (not committed billing.config.ts).
const StripeBillingSchema = z.object({
  STRIPE_BASE_PLAN_PRICE_ID: requiredString,
  STRIPE_ADDITIONAL_NUMBER_PRICE_ID: requiredString,
});

const LocalNumberBillingSchema = z.object({
  STRIPE_LOCAL_NUMBER_PRICE_ID: requiredString,
  STRIPE_LOCAL_SMS_COMPLIANCE_PRICE_ID: requiredString,
  STRIPE_LOCAL_BRAND_REGISTRATION_PRICE_ID: requiredString,
  STRIPE_LOCAL_CAMPAIGN_REGISTRATION_PRICE_ID: requiredString,
  STRIPE_LOCAL_SETUP_FEE_PRICE_ID: requiredString,
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

// Validated lazily, only when the subscription billing flow needs the Price IDs.
// Throws (ZodError) when either is unset; callers map that to a safe
// `billing_configuration_missing` outcome and never expose the values.
export function getStripeBillingEnv(): {
  basePlanPriceId: string;
  additionalNumberPriceId: string;
} {
  const parsed = StripeBillingSchema.parse(process.env);
  return {
    basePlanPriceId: parsed.STRIPE_BASE_PLAN_PRICE_ID,
    additionalNumberPriceId: parsed.STRIPE_ADDITIONAL_NUMBER_PRICE_ID,
  };
}

// Safe presence check (boolean only) without throwing — for entitlement/health.
export function hasStripeBillingPriceIds(): boolean {
  return (
    present("STRIPE_BASE_PLAN_PRICE_ID") &&
    present("STRIPE_ADDITIONAL_NUMBER_PRICE_ID")
  );
}

// Stripe Price IDs required to charge a LOCAL number correctly (recurring +
// one-time). Until ALL are configured, local number purchase/assignment is
// fail-closed: the owner may search local numbers but the server refuses to buy
// or assign one (so a local number is never assigned with incomplete billing).
//   - STRIPE_LOCAL_NUMBER_PRICE_ID            $20/month  (MCD local number)
//   - STRIPE_LOCAL_SMS_COMPLIANCE_PRICE_ID    $15/month  (monthly SMS compliance)
//   - STRIPE_LOCAL_BRAND_REGISTRATION_PRICE_ID  $9 one-time (carrier brand)
//   - STRIPE_LOCAL_CAMPAIGN_REGISTRATION_PRICE_ID $30 one-time (campaign/vetting)
//   - STRIPE_LOCAL_SETUP_FEE_PRICE_ID         $20 one-time (MCD setup fee)
export const LOCAL_NUMBER_BILLING_ENV_VARS = [
  "STRIPE_LOCAL_NUMBER_PRICE_ID",
  "STRIPE_LOCAL_SMS_COMPLIANCE_PRICE_ID",
  "STRIPE_LOCAL_BRAND_REGISTRATION_PRICE_ID",
  "STRIPE_LOCAL_CAMPAIGN_REGISTRATION_PRICE_ID",
  "STRIPE_LOCAL_SETUP_FEE_PRICE_ID",
] as const;

export function hasLocalNumberBillingConfigured(): boolean {
  return LOCAL_NUMBER_BILLING_ENV_VARS.every((name) => present(name));
}

// The local-billing env vars that are still missing (for ops reporting only —
// returns names, never values).
export function missingLocalNumberBillingEnvVars(): string[] {
  return LOCAL_NUMBER_BILLING_ENV_VARS.filter((name) => !present(name));
}

export function getLocalNumberBillingEnv(): {
  localNumberPriceId: string;
  localSmsCompliancePriceId: string;
  localBrandRegistrationPriceId: string;
  localCampaignRegistrationPriceId: string;
  localSetupFeePriceId: string;
} {
  const parsed = LocalNumberBillingSchema.parse(process.env);
  return {
    localNumberPriceId: parsed.STRIPE_LOCAL_NUMBER_PRICE_ID,
    localSmsCompliancePriceId: parsed.STRIPE_LOCAL_SMS_COMPLIANCE_PRICE_ID,
    localBrandRegistrationPriceId: parsed.STRIPE_LOCAL_BRAND_REGISTRATION_PRICE_ID,
    localCampaignRegistrationPriceId: parsed.STRIPE_LOCAL_CAMPAIGN_REGISTRATION_PRICE_ID,
    localSetupFeePriceId: parsed.STRIPE_LOCAL_SETUP_FEE_PRICE_ID,
  };
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
  duplicateSuppressionBypassNumbers: string[];
} {
  const raw = process.env.SMS_RECOVERY_MODE ?? "";
  const mode: SmsRecoveryMode =
    raw === "owner_test" ? "owner_test"
    : raw === "live" ? "live"
    : "disabled";
  const allowedNumbers = parsePhoneNumberList(process.env.SMS_TEST_ALLOWED_TO);
  const duplicateSuppressionBypassNumbers = parsePhoneNumberList(
    process.env.SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO,
  );
  return { mode, allowedNumbers, duplicateSuppressionBypassNumbers };
}

export function parsePhoneNumberList(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

// AI Answering ConversationRelay — SERVER-ONLY. Lazy: validated only when used,
// never at import time, so `next build` succeeds without these set. Never logs
// the values. The WebSocket URL must be wss:// (TLS). When the runtime gate
// passes but this config is missing/invalid, callers fail closed to the existing
// missed-call voice greeting (see lib/ai-answering/incoming-plan.ts).
const AiAnsweringRelaySchema = z.object({
  AI_ANSWERING_RELAY_WS_URL: z.string().url().startsWith("wss://"),
  AI_ANSWERING_RELAY_SIGNING_SECRET: requiredString,
});

export type AiAnsweringRelayConfig = {
  wsUrl: string;
  signingSecret: string;
};

// Throws (ZodError) when unset/invalid. Prefer getAiAnsweringRelayConfigSafe()
// on the request path so a missing config degrades instead of 500-ing.
export function getAiAnsweringRelayConfig(): AiAnsweringRelayConfig {
  const parsed = AiAnsweringRelaySchema.parse(process.env);
  return {
    wsUrl: parsed.AI_ANSWERING_RELAY_WS_URL,
    signingSecret: parsed.AI_ANSWERING_RELAY_SIGNING_SECRET,
  };
}

// Non-throwing variant: returns null when the relay env is unset or invalid.
export function getAiAnsweringRelayConfigSafe(): AiAnsweringRelayConfig | null {
  const parsed = AiAnsweringRelaySchema.safeParse(process.env);
  if (!parsed.success) return null;
  return {
    wsUrl: parsed.data.AI_ANSWERING_RELAY_WS_URL,
    signingSecret: parsed.data.AI_ANSWERING_RELAY_SIGNING_SECRET,
  };
}

// Safe presence check (boolean only) for health/ops reporting.
export function hasAiAnsweringRelayConfigured(): boolean {
  return getAiAnsweringRelayConfigSafe() !== null;
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

export function getPhoneNumberReleaseCronSecret(): string {
  const secret =
    process.env.PHONE_NUMBER_RELEASE_CRON_SECRET ??
    process.env.CRON_SECRET ??
    "";
  if (!secret) {
    throw new Error("Phone-number release cron secret is not configured");
  }
  return secret;
}

export function getProtectedJobCronSecret(): string {
  const secret =
    process.env.CRON_SECRET ??
    process.env.PHONE_NUMBER_RELEASE_CRON_SECRET ??
    "";
  if (!secret) {
    throw new Error("Protected job cron secret is not configured");
  }
  return secret;
}

// Twilio number purchase safety mode. Search is always allowed when the
// Twilio client is configured. Live Twilio purchase proceeds only when the
// committed runtime config explicitly sets mode to "live".
export type TwilioNumberPurchaseMode =
  | "disabled"
  | "mock"
  | "owner_test_live"
  | "live";

export function getTwilioNumberPurchaseMode(): TwilioNumberPurchaseMode {
  const mode = runtimeConfig.onboarding.twilioNumberPurchaseMode;
  return mode === "mock" || mode === "owner_test_live" || mode === "live"
    ? mode
    : "disabled";
}

// Legacy safety helper: true only for the BROAD real-purchase path. Kept
// "live"-only so older direct-purchase routes never call Twilio in "mock" or
// "owner_test_live" mode. owner_test_live is enforced per-clinic via
// isClinicAllowedForLivePurchase() in the shared provisioning service.
export function isTwilioNumberPurchaseEnabled(): boolean {
  return getTwilioNumberPurchaseMode() === "live";
}

// Non-secret allowlist of clinic UUIDs permitted to make a REAL Twilio purchase
// while the mode is "owner_test_live".
export function getTwilioPurchaseTestClinicIds(): readonly string[] {
  return runtimeConfig.onboarding.twilioPurchaseTestClinicIds;
}

// Whether THIS clinic may make a real Twilio purchase under the current mode:
//   - "live": yes (all eligible clinics).
//   - "owner_test_live": only if its id is in the allowlist.
//   - "mock" / "disabled": no (callers handle those modes separately).
export function isClinicAllowedForLivePurchase(clinicId: string): boolean {
  const mode = getTwilioNumberPurchaseMode();
  if (mode === "live") return true;
  if (mode === "owner_test_live") {
    return getTwilioPurchaseTestClinicIds().includes(clinicId);
  }
  return false;
}

// Owner-test setup link fallback gate from committed runtime config.
// Default false — production must use real email delivery.
export function isOwnerTestSetupLinkFallbackEnabled(): boolean {
  return runtimeConfig.onboarding.ownerTestSetupLinkFallback;
}

// Platform-admin A2P/10DLC review/submission mode from committed runtime config.
// Never throws — defaults to "disabled" if the value is unknown. The config
// default is "dry_run" (review-only, no Twilio mutation).
export type A2pSubmissionMode = "disabled" | "dry_run" | "mock" | "live";

export function getA2pSubmissionMode(): A2pSubmissionMode {
  const mode = runtimeConfig.a2p?.submissionMode;
  return mode === "dry_run" || mode === "mock" || mode === "live" ? mode : "disabled";
}

// Whether REAL Twilio A2P submission is enabled at the platform level. Config
// driven: true only when the committed submission mode is "live". The committed
// default is "dry_run", so this is OFF by default. Real execution is further
// gated per-clinic (isClinicAllowedForLiveA2pSubmit) and requires a configured
// primary Customer Profile SID.
export function isRealA2pSubmissionEnabled(): boolean {
  return getA2pSubmissionMode() === "live";
}

// Whether THIS clinic may trigger a REAL A2P submission under the current mode.
// Mirrors isClinicAllowedForLivePurchase: live mode + explicit per-clinic
// allowlist. Empty allowlist = no clinic may submit for real.
export function isClinicAllowedForLiveA2pSubmit(clinicId: string): boolean {
  if (getA2pSubmissionMode() !== "live") return false;
  const allow = runtimeConfig.a2p?.liveSubmitClinicIds ?? [];
  return allow.includes(clinicId);
}

export type A2pTrustHubConfig = {
  customerProfilePolicySid: string;
  a2pTrustProductPolicySid: string;
  primaryCustomerProfileSid: string;
  notificationEmail: string;
};

// Trust Hub policy SIDs + account-specific primary profile + notification email.
export function getA2pTrustHubConfig(): A2pTrustHubConfig {
  const t = runtimeConfig.a2p?.trustHub;
  return {
    customerProfilePolicySid: t?.customerProfilePolicySid ?? "",
    a2pTrustProductPolicySid: t?.a2pTrustProductPolicySid ?? "",
    primaryCustomerProfileSid: (t?.primaryCustomerProfileSid ?? "").trim(),
    notificationEmail: t?.notificationEmail ?? runtimeConfig.app.supportEmail,
  };
}

export function getA2pMockMessagingServiceSid(): string | null {
  const sid = (runtimeConfig.a2p?.mockMessagingServiceSid ?? "").trim();
  return sid.length > 0 ? sid : null;
}

export type A2pBrandConfig = {
  brandType: "STANDARD" | "SOLE_PROPRIETOR";
  businessIndustry: string;
  businessIdentity: string;
  businessRegistrationIdentifier: string;
  companyType: string;
  regionsOfOperation: string;
  businessTypeFallback: string;
};

// Hosts that must never be submitted as a clinic's own A2P business website
// (platform/owner/placeholder domains). Lowercased.
export function getA2pDisallowedClinicWebsiteHosts(): string[] {
  const list = runtimeConfig.a2p?.disallowedClinicWebsiteHosts ?? [];
  return list.map((h) => h.trim().toLowerCase()).filter((h) => h.length > 0);
}

export function getA2pBrandConfig(): A2pBrandConfig {
  const b = runtimeConfig.a2p?.brand;
  return {
    brandType: (b?.brandType ?? "STANDARD") as "STANDARD" | "SOLE_PROPRIETOR",
    businessIndustry: b?.businessIndustry ?? "HEALTHCARE",
    businessIdentity: b?.businessIdentity ?? "direct_customer",
    businessRegistrationIdentifier: b?.businessRegistrationIdentifier ?? "EIN",
    companyType: b?.companyType ?? "private",
    regionsOfOperation: b?.regionsOfOperation ?? "USA_AND_CANADA",
    businessTypeFallback: b?.businessTypeFallback ?? "Private Company",
  };
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
  stripeBasePlanPriceId: boolean;
  stripeAdditionalNumberPriceId: boolean;
  publicWebhookBaseUrl: boolean;
  smsRecoveryMode: boolean;
  smsTestAllowedTo: boolean;
  smsTestBypassDuplicateSuppressionTo: boolean;
  appBaseUrl: boolean;
  publicSiteUrl: boolean;
  resendApiKey: boolean;
  setupEmailFrom: boolean;
  phoneNumberReleaseCronSecret: boolean;
  twilioNumberPurchaseMode: TwilioNumberPurchaseMode;
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
    stripeBasePlanPriceId: present("STRIPE_BASE_PLAN_PRICE_ID"),
    stripeAdditionalNumberPriceId: present("STRIPE_ADDITIONAL_NUMBER_PRICE_ID"),
    publicWebhookBaseUrl: present("PUBLIC_WEBHOOK_BASE_URL"),
    smsRecoveryMode: present("SMS_RECOVERY_MODE"),
    smsTestAllowedTo: present("SMS_TEST_ALLOWED_TO"),
    smsTestBypassDuplicateSuppressionTo: present("SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO"),
    appBaseUrl: runtimeConfig.app.appBaseUrl.trim().length > 0,
    publicSiteUrl: runtimeConfig.app.publicSiteUrl.trim().length > 0,
    resendApiKey: present("RESEND_API_KEY"),
    setupEmailFrom: runtimeConfig.email.defaultSetupFrom.trim().length > 0,
    phoneNumberReleaseCronSecret:
      present("PHONE_NUMBER_RELEASE_CRON_SECRET") || present("CRON_SECRET"),
    twilioNumberPurchaseMode: getTwilioNumberPurchaseMode(),
    twilioNumberPurchaseEnabled: isTwilioNumberPurchaseEnabled(),
  };
}
