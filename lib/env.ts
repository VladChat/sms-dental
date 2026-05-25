import { z } from "zod";

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

export function getPublicWebhookBaseUrl(): string | undefined {
  const raw = process.env.PUBLIC_WEBHOOK_BASE_URL;
  if (!raw) return undefined;
  const parsed = PublicWebhookBaseSchema.safeParse({
    PUBLIC_WEBHOOK_BASE_URL: raw,
  });
  return parsed.success ? parsed.data.PUBLIC_WEBHOOK_BASE_URL : undefined;
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
  };
}
