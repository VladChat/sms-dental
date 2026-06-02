import Stripe from "stripe";
import { getStripeServerEnv } from "../env";

// Server-only Stripe API client for the payment-method setup flow. NEVER import
// this from client code. NEVER log, return, echo, or display STRIPE_SECRET_KEY.
//
// Sandbox safety gate: this milestone is test/sandbox only. The client refuses
// to initialize unless STRIPE_SECRET_KEY is a Stripe test/sandbox key, so this
// code path can never run against a live key by accident.
//
// Webhook signature verification stays in lib/stripe/webhook.ts (separate
// concern, no API calls). This helper is for outbound Stripe API calls.

let cachedStripe: Stripe | undefined;

// Stripe test/sandbox keys are sk_test_… (secret) or rk_test_… (restricted).
export function isStripeTestModeKey(key: string): boolean {
  return key.startsWith("sk_test_") || key.startsWith("rk_test_");
}

// Thrown when STRIPE_SECRET_KEY is present but not a test/sandbox key. Callers
// map this to a safe, generic server error — the key value is never included.
export class StripeNotTestModeError extends Error {
  constructor() {
    super("Stripe is not configured in test/sandbox mode.");
    this.name = "StripeNotTestModeError";
  }
}

/**
 * Lazily build and cache the Stripe client from STRIPE_SECRET_KEY.
 * Throws if the env var is missing (ZodError from getStripeServerEnv) or if the
 * key is not a test/sandbox key (StripeNotTestModeError). Both are caught by
 * callers and reported as safe server errors without exposing the key.
 */
export function getStripeServerClient(): Stripe {
  if (cachedStripe) return cachedStripe;
  const { STRIPE_SECRET_KEY } = getStripeServerEnv();
  if (!isStripeTestModeKey(STRIPE_SECRET_KEY)) {
    throw new StripeNotTestModeError();
  }
  // Pin SDK typings only; do not pin an apiVersion string so the installed SDK
  // default is used (kept consistent with lib/stripe/webhook.ts).
  cachedStripe = new Stripe(STRIPE_SECRET_KEY, { typescript: true });
  return cachedStripe;
}
