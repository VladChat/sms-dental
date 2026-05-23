---
name: stripe-billing
description: Stripe Checkout and subscription billing guidance for Dental SMS, including secure webhook processing, pricing clarity, and production readiness.
---

# Stripe Billing

Use this skill for Stripe integration, pricing, plans, and billing workflows.

Integration rules:
- Prefer Checkout Sessions for standard SaaS flows.
- Keep API keys server-side only.
- Use least-privilege keys when possible.
- Verify webhook signatures and handle retries idempotently.

Subscription rules:
- Keep plan names and billing intervals explicit.
- Surface trial terms, renewal timing, and cancellation policy clearly.
- Map Stripe customer and subscription IDs reliably in the database.

Operational readiness:
- Handle failed payments and dunning paths gracefully.
- Keep billing logs auditable.
- Test full lifecycle: trial, active, past_due, canceled.

Dental SMS context:
- Pricing and billing copy must look trustworthy for clinic decision-makers.
- Avoid ambiguous fee language and unsupported claims.
