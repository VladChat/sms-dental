---
title: Billing operations and Stripe quantity sync
slug: billing-operations
status: internal
visibility: platform_admin
audience: Platform operator
surface: /admin
category: billing
owner: ops
source_of_truth:
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - config/billing.config.ts
last_verified: 2026-06-09
related:
  - clinic-console
  - phone-number-lifecycle
  - support-boundaries
---

## Summary

How billing state and Stripe quantity sync work at a concept level for the
operator. **No secrets, no price IDs, no raw Stripe objects in this doc or in the
console.**

## Applies to

Platform operators viewing `/admin/clinics/[clinicId]` → Billing, and operators
triaging billing tickets
([billing-question runbook](../../support-runbooks/billing-question.md)).

## Current reality (gated)

- Stripe is **test-mode only**; no live charge can occur until an approved live
  rollout replaces test-mode configuration.
- The admin Billing panel currently shows **state/presence only** (billing status,
  whether a Stripe customer/subscription exists, trial end). Active billing
  management (collect/start/pause) is **blocked-with-reason** until the real
  backend exists — never simulate it.

## Pricing source

Plan pricing, included usage, and add-on amounts are defined **once** in
`config/billing.config.ts` and described in `BILLING-AND-USAGE-POLICY.md`. The
operator (and any doc) must treat those as truth and never hard-code or restate
amounts. Base plan includes 1 number + 1,000 call minutes + 1,000 SMS segments
(shared across all numbers); additional toll-free is a paid add-on; local carries
separate regulatory + service fees; overage applies above included limits.

## Stripe quantity sync (concept)

- Additional **toll-free** numbers map to a recurring Stripe item **quantity** =
  count of active/held additional toll-free numbers (`billing_class='additional'`).
- **Local** numbers map to their own recurring item quantity, plus a monthly SMS
  compliance item (quantity 1 when at least one local number remains), plus
  one-time local fees on assignment.
- Remove/Restore **syncs the recurring Stripe quantity before** the lifecycle DB
  update. If the Stripe sync fails, the number is **not** changed.
- Lifecycle billing uses `proration_behavior:"none"` — no immediate
  credit/refund/charge from a remove/restore. Changes show next cycle.
- Current-cycle display counts scheduled removals as still billed/held; next-cycle
  display excludes them.
- A purchase that buys a Twilio number but fails the quantity sync becomes
  `reconciliation_required`: the number is **not activated and not released**, and
  the SID is preserved.

## Trial

The 21-day trial starts after the **first successful number assignment**
(`clinics.trial_started_at` / `trial_ends_at`). Paid plan starts only via an
explicit owner action / webhook-confirmed active subscription. Do not describe
"trial starts after payment" as current behavior.

## Expected result

The operator can read billing state accurately and explain current vs next-cycle
effects, without exposing Stripe internals or making live changes.

## Escalation

`reconciliation_required` numbers, quantity mismatches, or any apparent
double-billing go to engineering. Do not attempt manual Stripe edits to "fix"
state from the console.

## Do not

- Do not expose Stripe price/customer/subscription IDs or raw invoice objects.
- Do not promise or create refunds/credits from lifecycle actions.
- Do not enable live billing — it requires a separate approved rollout.

## Source of truth

- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`
- `config/billing.config.ts` (amounts, breakdown builders, default limit)
