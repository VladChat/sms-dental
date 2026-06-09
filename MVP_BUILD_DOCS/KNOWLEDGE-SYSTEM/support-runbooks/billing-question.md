---
title: Billing question
slug: billing-question
status: internal
visibility: internal_ops
audience: Support / platform operator
surface: support
category: runbook
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - config/billing.config.ts
last_verified: 2026-06-09
related:
  - number-removal-restore-detach
  - ../platform-admin/billing-operations
---

## Symptom

A clinic asks about a charge, the plan price, what's included, an add-on cost, or
why this cycle differs from next cycle.

## Customer-safe explanation

The plan is a base monthly subscription that includes a set amount of calling and
texting, with paid add-ons for extra numbers and for usage above the included
limits. Changes to numbers show on the next cycle.

## Likely causes / scenarios

1. Wants to understand the base plan and what's included.
2. Asks about an additional-number charge (toll-free add-on) or local-number fees.
3. Sees a difference between current and next cycle after removing/adding a number.
4. Asks for a refund/credit for a mid-cycle change.
5. Asks when the trial ends / converts.

## Triage questions (customer-safe)

- Which charge or line are you asking about?
- Did you recently add or remove a number?

## Safe checks (internal)

- Confirm amounts against `config/billing.config.ts` (the single source of truth)
  and `BILLING-AND-USAGE-POLICY.md`. **Never quote a price from memory** — read the
  canonical file.
- In `/admin`, view the clinic's billing **state/presence** (status, customer/
  subscription presence, trial end). Do not expose Stripe IDs or raw invoices. See
  [../platform-admin/billing-operations.md](../platform-admin/billing-operations.md).

## Key rules to communicate

- Base plan includes 1 number + 1,000 call minutes + 1,000 SMS segments (shared
  across all numbers). Additional toll-free is a paid add-on; local numbers carry
  separate regulatory + service fees; overage applies above included limits — all
  amounts sourced from the canonical billing files.
- Never call a number "free" — the first toll-free is "included in plan."
- Number changes: current cycle still counts held/scheduled-removal numbers; next
  cycle reflects the change. No immediate refund/credit/charge from a lifecycle
  change.
- Trial starts after the first number is assigned; paid plan starts only by
  explicit owner action / confirmed subscription.

## Do not

- Do not quote prices from memory or hard-code them — read `config/billing.config.ts`.
- Do not promise refunds/credits for mid-cycle changes.
- Do not expose Stripe price/customer/subscription IDs, raw invoices, or proration
  mechanics.

## Escalation

Escalate apparent double-billing, a `reconciliation_required` number, or any
request that would need a real Stripe change (live billing is gated) to
engineering.

## Customer-safe response summary

> Your plan is a base monthly subscription that includes a set amount of calling
> and texting, with paid add-ons for extra numbers and for usage above the
> included limits. If you recently changed a number, the difference you're seeing
> is because this cycle still counts it and the next cycle reflects the change —
> changes apply next cycle rather than as an immediate refund or credit. I can
> confirm the exact figures from your plan details.

## Source of truth

- `config/billing.config.ts` (canonical amounts)
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` (policy, next-cycle billing, trial)
