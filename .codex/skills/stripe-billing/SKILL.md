---
name: stripe-billing
description: Use for Stripe billing, subscriptions, Checkout, saved payment methods, webhooks, pricing config, trials, invoices, add-on consent, and billing safety in Missed Calls Dental.
---

# Stripe Billing

Use this skill for billing, subscriptions, Checkout, saved payment methods,
Stripe webhooks, pricing configuration, trial policy, customer billing state,
invoices, and add-on consent.

## Safety Rules

- Keep secret keys out of client code and committed config.
- Prefer restricted keys where applicable.
- Verify Stripe webhook signatures.
- Make webhook handlers idempotent and safe on retries.
- Do not create live-mode products, prices, subscriptions, charges, refunds, or
  billing changes without explicit owner approval.
- Do not charge before SMS activation unless the current product and billing
  policy explicitly says otherwise.
- Do not grant paid entitlement from client-supplied values or success query
  params; use server-side state and webhook-confirmed truth.

## Pricing Rules

- Customer-facing prices must come from `config/billing.config.ts` and approved
  builders, never hard-coded in UI components or routes.
- Billing policy source of truth is
  `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`.
- Number type, slot class, price, Stripe quantity, and fees are decided
  server-side only.
- Additional numbers and local-number fees require explicit server-validated
  consent where the policy requires it.

## Implementation Rules

- Inspect existing billing helpers, routes, migrations, and tests first.
- Keep test/sandbox mode separate from live mode.
- Use minimum necessary metadata.
- Store safe billing snapshots for audit; never store raw card data.
- Fail closed when Stripe IDs, saved payment methods, subscription state, or
  required billing config are missing.

## Validation

Run type checks and relevant billing or webhook tests. For production-like Stripe
work, verify target mode and update operations docs when durable billing
knowledge changes.
