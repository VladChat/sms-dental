---
title: Billing question
slug: billing-question
status: internal
visibility: internal_ops
audience: Internal support / operator
surface: support
category: runbook
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - config/billing.config.ts
  - AGENTS.md
last_verified: 2026-06-09
related:
  - number-removal-restore-detach
  - ../platform-admin/billing-operations
---

# Billing question

## Purpose

Answer a clinic's billing question accurately using config-sourced amounts and the
current-vs-next-cycle rules, without exposing billing-provider internals or
promising refunds.

## Audience / visibility

Internal support / operator. `visibility: internal_ops`. Internal-only.

## Symptom

A clinic asks about a charge, the plan price, what's included, an add-on cost, or
why this cycle differs from next cycle.

## Customer-safe explanation

The plan is a base monthly subscription that includes a set amount of calling and
texting, with paid add-ons for extra numbers and for usage above the included
limits. Changes to numbers show on the next cycle.

## Internal triage checklist

- Identify which charge/line the clinic is asking about and whether they recently
  added/removed a number.
- **Confirm amounts against `config/billing.config.ts`** (single source of truth)
  and `BILLING-AND-USAGE-POLICY.md`. **Never quote a price from memory.**
- In `/admin`, view the clinic's billing **state/presence** (status,
  customer/subscription presence, trial end). See
  [../platform-admin/billing-operations.md](../platform-admin/billing-operations.md).
- Recall the model: base plan + included usage (1 number, 1,000 call minutes, 1,000
  SMS segments shared); additional toll-free is a paid add-on; local carries
  separate regulatory + service fees; overage rates exist but usage billing is not
  fully live; trial starts after first number assignment.

### What info to ask the customer for
- Clinic name and account email; which charge/line; whether they recently changed a
  number.

### What NOT to ask for
- Full payment card details, passwords, or any sensitive data not needed to
  describe the issue.

## What not to expose to the customer

- Billing-provider price/customer/subscription IDs, raw invoice objects, or
  proration mechanics. Never call a number "free" — first toll-free is "included in
  plan."

## Safe resolution paths

- Explain the plan shape and what's included (config-sourced).
- Explain current vs next cycle for a recent number change; changes apply next cycle.
- **Never** promise refunds/credits for mid-cycle changes; **never** hard-code or
  improvise amounts.

## Escalation criteria

Escalate (engineering) for apparent double-billing, a quantity mismatch, a
`reconciliation_required` number, or anything needing a real billing-provider change
(live billing is gated).

## Related platform-admin docs

- [../platform-admin/billing-operations.md](../platform-admin/billing-operations.md)
- [../platform-admin/phone-number-lifecycle.md](../platform-admin/phone-number-lifecycle.md)

## Customer-safe response summary

> Your plan is a base monthly subscription that includes a set amount of calling and
> texting, with paid add-ons for extra numbers and for usage above the included
> limits. If you recently changed a number, this cycle still counts it and the next
> cycle reflects the change — changes apply next cycle rather than as an immediate
> refund or credit. I can confirm the exact figures from your plan details.

## Source of truth

- `config/billing.config.ts` (canonical amounts)
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` (policy, next-cycle billing, trial)
- `AGENTS.md` (number model; client never decides price/quantity)
