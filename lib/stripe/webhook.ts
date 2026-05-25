import Stripe from "stripe";
import { getStripeWebhookEnv } from "../env";

// Lazy Stripe client. Used only for webhook signature verification in this
// milestone — no billing operations.
let cachedStripe: Stripe | undefined;

function getStripeClient(): Stripe {
  if (cachedStripe) return cachedStripe;
  // For webhook verification, the SDK does not actually call the network, so
  // we pass an empty key. Live API calls will use STRIPE_SECRET_KEY via a
  // separate helper added in a future milestone.
  cachedStripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_placeholder", {
    typescript: true,
  });
  return cachedStripe;
}

export type VerifyStripeSignatureResult =
  | { ok: true; event: Stripe.Event }
  | { ok: false; code: "missing_signature" | "invalid_signature" | "missing_secret" };

export function verifyStripeWebhook(args: {
  rawBody: string;
  signatureHeader: string | null;
}): VerifyStripeSignatureResult {
  const { rawBody, signatureHeader } = args;
  if (!signatureHeader) return { ok: false, code: "missing_signature" };
  let secret: string;
  try {
    secret = getStripeWebhookEnv().STRIPE_WEBHOOK_SECRET;
  } catch {
    return { ok: false, code: "missing_secret" };
  }
  try {
    const event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signatureHeader,
      secret,
    );
    return { ok: true, event };
  } catch {
    return { ok: false, code: "invalid_signature" };
  }
}
