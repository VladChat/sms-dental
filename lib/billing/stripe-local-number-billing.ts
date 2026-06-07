import type Stripe from "stripe";

import { getLocalNumberBillingEnv } from "../env";
import { saveClinicNumberSubscriptionItemIds } from "../db/clinics";
import { logger } from "../logging/logger";
import { getStripeServerClient } from "../stripe/server";

export type LocalNumberBillingResult =
  | {
      ok: true;
      localNumberSubscriptionItemId: string;
      smsComplianceSubscriptionItemId: string;
      oneTimeInvoiceId: string;
      oneTimeInvoiceStatus: string | null;
    }
  | {
      ok: false;
      error:
        | "billing_configuration_missing"
        | "payment_method_required"
        | "paid_plan_required"
        | "subscription_not_active"
        | "payment_failed"
        | "billing_sync_failed";
      message: string;
    };

type LocalPriceIds = ReturnType<typeof getLocalNumberBillingEnv>;

export async function syncStripeLocalNumberBilling(args: {
  clinicId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePaymentMethodId: string | null;
  billingStatus: string;
  attemptId: string;
}): Promise<LocalNumberBillingResult> {
  let prices: LocalPriceIds;
  try {
    prices = getLocalNumberBillingEnv();
  } catch {
    logger.error("billing.local.price_ids_missing", { clinicId: args.clinicId });
    return {
      ok: false,
      error: "billing_configuration_missing",
      message: "Local number billing is not configured yet. No charge was made.",
    };
  }

  if (!args.stripeCustomerId || !args.stripePaymentMethodId) {
    return {
      ok: false,
      error: "payment_method_required",
      message: "Add a payment method before assigning a local number.",
    };
  }
  if (!args.stripeSubscriptionId) {
    return {
      ok: false,
      error: "paid_plan_required",
      message: "Start the paid plan before assigning a local number.",
    };
  }
  if (args.billingStatus !== "active") {
    return {
      ok: false,
      error: "subscription_not_active",
      message: "Your subscription is not active. Update billing before assigning a local number.",
    };
  }

  const stripe = getStripeServerClient();
  try {
    const subscription = await stripe.subscriptions.retrieve(args.stripeSubscriptionId, {
      expand: ["items.data.price"],
    });
    if (subscription.status !== "active") {
      return {
        ok: false,
        error: "subscription_not_active",
        message: "Your subscription is not active. Update billing before assigning a local number.",
      };
    }

    const localNumberItem = await ensureAttemptSubscriptionItem({
      stripe,
      subscription,
      priceId: prices.localNumberPriceId,
      clinicId: args.clinicId,
      attemptId: args.attemptId,
      purpose: "local_number_monthly",
    });
    const smsComplianceItem = await ensureAttemptSubscriptionItem({
      stripe,
      subscription,
      priceId: prices.localSmsCompliancePriceId,
      clinicId: args.clinicId,
      attemptId: args.attemptId,
      purpose: "local_sms_compliance_monthly",
    });

    const invoice = await ensureOneTimeInvoicePaid({
      stripe,
      customerId: args.stripeCustomerId,
      subscriptionId: args.stripeSubscriptionId,
      paymentMethodId: args.stripePaymentMethodId,
      clinicId: args.clinicId,
      attemptId: args.attemptId,
      prices,
    });

    logger.info("billing.local.sync.ok", {
      clinicId: args.clinicId,
      attemptId: args.attemptId,
      invoiceStatus: invoice.status,
    });
    await saveClinicNumberSubscriptionItemIds(args.clinicId, {
      localNumberSubscriptionItemId: localNumberItem.id,
      localSmsComplianceSubscriptionItemId: smsComplianceItem.id,
    });
    return {
      ok: true,
      localNumberSubscriptionItemId: localNumberItem.id,
      smsComplianceSubscriptionItemId: smsComplianceItem.id,
      oneTimeInvoiceId: invoice.id,
      oneTimeInvoiceStatus: invoice.status,
    };
  } catch (err) {
    logger.error("billing.local.sync.failed", {
      clinicId: args.clinicId,
      attemptId: args.attemptId,
      message: err instanceof Error ? err.message : "unknown",
      stripeType: stripeErrorType(err),
      stripeCode: stripeErrorCode(err),
    });
    if (isStripePaymentFailure(err)) {
      return {
        ok: false,
        error: "payment_failed",
        message: "Payment could not be completed. No number was assigned.",
      };
    }
    return {
      ok: false,
      error: "billing_sync_failed",
      message: "Payment could not be completed. No number was assigned.",
    };
  }
}

async function ensureAttemptSubscriptionItem(args: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
  priceId: string;
  clinicId: string;
  attemptId: string;
  purpose: "local_number_monthly" | "local_sms_compliance_monthly";
}): Promise<Stripe.SubscriptionItem> {
  const existing = (args.subscription.items?.data ?? []).find((item) => {
    return (
      item.price?.id === args.priceId &&
      item.metadata?.local_number_purchase_attempt_id === args.attemptId &&
      item.metadata?.purpose === args.purpose
    );
  });
  if (existing) return existing;

  return args.stripe.subscriptionItems.create(
    {
      subscription: args.subscription.id,
      price: args.priceId,
      quantity: 1,
      proration_behavior: "none",
      payment_behavior: "error_if_incomplete",
      metadata: {
        clinic_id: args.clinicId,
        local_number_purchase_attempt_id: args.attemptId,
        purpose: args.purpose,
      },
    },
    { idempotencyKey: `local-sub-item-${args.purpose}-${args.attemptId}` },
  );
}

async function ensureOneTimeInvoicePaid(args: {
  stripe: Stripe;
  customerId: string;
  subscriptionId: string;
  paymentMethodId: string;
  clinicId: string;
  attemptId: string;
  prices: LocalPriceIds;
}): Promise<Stripe.Invoice> {
  const existing = await findExistingOneTimeInvoice(args);
  let invoice =
    existing ??
    (await args.stripe.invoices.create(
      {
        auto_advance: false,
        collection_method: "charge_automatically",
        customer: args.customerId,
        default_payment_method: args.paymentMethodId,
        subscription: args.subscriptionId,
        pending_invoice_items_behavior: "exclude",
        metadata: {
          clinic_id: args.clinicId,
          local_number_purchase_attempt_id: args.attemptId,
          purpose: "local_number_one_time_fees",
        },
      },
      { idempotencyKey: `local-one-time-invoice-${args.attemptId}` },
    ));

  if (invoice.status === "paid") return invoice;
  if (invoice.status === "void" || invoice.status === "uncollectible") {
    throw new Error(`local one-time invoice is ${invoice.status}`);
  }

  if (invoice.status === "draft") {
    await ensureInvoiceHasLine({
      ...args,
      invoiceId: invoice.id,
      priceId: args.prices.localBrandRegistrationPriceId,
      purpose: "local_brand_registration_one_time",
    });
    await ensureInvoiceHasLine({
      ...args,
      invoiceId: invoice.id,
      priceId: args.prices.localCampaignRegistrationPriceId,
      purpose: "local_campaign_registration_one_time",
    });
    await ensureInvoiceHasLine({
      ...args,
      invoiceId: invoice.id,
      priceId: args.prices.localSetupFeePriceId,
      purpose: "local_setup_fee_one_time",
    });

    invoice = await args.stripe.invoices.finalizeInvoice(
      invoice.id,
      { auto_advance: false },
      { idempotencyKey: `local-one-time-finalize-${args.attemptId}` },
    );
  }

  if (invoice.status === "paid") return invoice;
  const paid = await args.stripe.invoices.pay(
    invoice.id,
    {
      off_session: true,
      payment_method: args.paymentMethodId,
    },
    { idempotencyKey: `local-one-time-pay-${args.attemptId}` },
  );
  if (paid.status !== "paid") {
    throw new Error(`local one-time invoice payment status ${paid.status ?? "unknown"}`);
  }
  return paid;
}

async function findExistingOneTimeInvoice(args: {
  stripe: Stripe;
  customerId: string;
  subscriptionId: string;
  attemptId: string;
}): Promise<Stripe.Invoice | null> {
  const invoices = await args.stripe.invoices.list({
    customer: args.customerId,
    subscription: args.subscriptionId,
    limit: 20,
  });
  return invoices.data.find((invoice) =>
    invoice.metadata?.local_number_purchase_attempt_id === args.attemptId &&
    invoice.metadata?.purpose === "local_number_one_time_fees"
  ) ?? null;
}

async function ensureInvoiceHasLine(args: {
  stripe: Stripe;
  invoiceId: string;
  priceId: string;
  clinicId: string;
  attemptId: string;
  customerId: string;
  subscriptionId: string;
  purpose:
    | "local_brand_registration_one_time"
    | "local_campaign_registration_one_time"
    | "local_setup_fee_one_time";
}): Promise<void> {
  const lines = await args.stripe.invoices.listLineItems(args.invoiceId, { limit: 100 });
  const exists = lines.data.some((line) => line.price?.id === args.priceId);
  if (exists) return;
  await args.stripe.invoiceItems.create(
    {
      customer: args.customerId,
      invoice: args.invoiceId,
      price: args.priceId,
      quantity: 1,
      subscription: args.subscriptionId,
      metadata: {
        clinic_id: args.clinicId,
        local_number_purchase_attempt_id: args.attemptId,
        purpose: args.purpose,
      },
    },
    { idempotencyKey: `local-invoice-item-${args.purpose}-${args.attemptId}` },
  );
}

function stripeErrorType(err: unknown): string | null {
  return typeof err === "object" && err !== null && "type" in err
    ? String((err as { type?: unknown }).type ?? "")
    : null;
}

function stripeErrorCode(err: unknown): string | null {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code?: unknown }).code ?? "")
    : null;
}

function isStripePaymentFailure(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as {
    type?: string;
    code?: string;
    decline_code?: string;
    payment_intent?: { status?: string };
    raw?: { payment_intent?: { status?: string } };
  };
  const status = e.payment_intent?.status ?? e.raw?.payment_intent?.status ?? null;
  return (
    e.type === "StripeCardError" ||
    Boolean(e.decline_code) ||
    e.code === "card_declined" ||
    e.code === "payment_intent_authentication_failure" ||
    e.code === "authentication_required" ||
    status === "requires_action" ||
    status === "requires_payment_method"
  );
}
