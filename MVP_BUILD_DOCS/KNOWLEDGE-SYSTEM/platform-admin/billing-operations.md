---
title: Billing operations and quantity sync
slug: billing-operations
status: internal
visibility: platform_admin
audience: Platform admin / operator
surface: /admin
category: billing
owner: ops
source_of_truth:
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - config/billing.config.ts
  - AGENTS.md
last_verified: 2026-06-10
related:
  - clinic-console
  - phone-number-lifecycle
  - support-boundaries
---

# Billing operations and quantity sync

## Summary

How billing state and quantity sync work at a concept level for the operator.
**No secrets, no price IDs, no raw billing-provider objects in this doc or in the
console.** Pricing is config-driven; the operator never hard-codes or improvises
amounts.

## Applies to

Platform operators viewing `/admin/clinics/[clinicId]` → Billing, and operators
backing the [billing-question runbook](../support-runbooks/billing-question.md).

## Current reality (gated)

- Billing is **test-mode only**; no live charge can occur until an approved live
  rollout replaces the test-mode configuration.
- The admin Billing panel shows **state/presence only** (billing status, whether a
  customer/subscription exists, trial end). Active billing management
  (collect/start/pause) is **blocked-with-reason** — **Status: not implemented
  yet**; never simulate it.

## Pricing source of truth

Plan pricing, included usage, and add-on amounts are defined **once** in
`config/billing.config.ts` and described in `BILLING-AND-USAGE-POLICY.md`. Treat
those as truth; never hard-code or restate amounts outside config-driven docs/UI.

Current model (verify against config before quoting):

- **Base plan $99/month** — includes **1** business number, **1,000** regular call
  minutes, **100** minutes of AI answered calls, and **1,000** SMS segments
  (shared across all of the clinic's numbers).
- **Additional business number $20/month**.
- **Toll-free:** first toll-free included in plan; additional toll-free $20/month;
  toll-free verification included.
- **Local (always a paid add-on):** local number $20/month; monthly SMS compliance
  $15/month; carrier brand registration $9 one-time; campaign registration/vetting
  $30 one-time; setup fee $20 one-time.
- **Overage:** regular call time, AI answered call time, and SMS segment rates
  exist in config, but usage metering / live overage billing is **not fully
  live** — do not show metered usage charges as if billed today.

Never call any number "free" — the first toll-free is "included in plan."

## Quantity sync (concept)

- Additional **toll-free** numbers map to a recurring billing **quantity** = count
  of active/held additional toll-free numbers.
- **Local** numbers map to their own recurring quantity, plus a monthly SMS
  compliance item (quantity 1 when at least one local number remains), plus one-time
  local fees on assignment.
- Remove/Restore **syncs the recurring quantity before** the lifecycle DB update. If
  the sync fails, the number is **not** changed.
- Lifecycle billing uses no proration — **no immediate credit/refund/charge** from a
  remove/restore. Changes show next cycle.
- Current-cycle display counts scheduled removals as still billed/held; next-cycle
  display excludes them.
- A purchase that buys a number but fails the quantity sync becomes
  `reconciliation_required`: the number is **not activated and not released**, and
  the SID is preserved.

Quantity sync is **server-side and provider-sensitive**. Treat it as something to
read and explain, not to fake or hand-edit.

## Trial

The 21-day trial starts after the **first successful number assignment**. Paid plan
starts only via an explicit owner action / confirmed subscription. Do not describe
"trial starts after payment" as current behavior.

## What support / admin can explain

- The plan shape: base plan + included usage + paid add-ons (extra numbers, local
  fees), with amounts sourced from the plan details.
- Current vs next cycle: a recently changed number can still show this cycle and be
  excluded next cycle; changes apply next cycle, not as an instant refund/credit.
- That local numbers cost more because of compliance/registration.

## What requires deeper operator/engineering review

- Apparent double-billing, a quantity mismatch, or a `reconciliation_required`
  number.
- Anything that would need a real billing-provider change (live billing is gated).
- Any request to refund/credit — escalate; do not promise it.

## Do not

- Do not expose price/customer/subscription IDs or raw invoice objects.
- Do not promise or create refunds/credits from lifecycle actions.
- Do not enable live billing — it requires a separate approved rollout.
- Do not hand-edit billing-provider state from the console.

## Source of truth

- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`
- `config/billing.config.ts` (amounts, breakdown builders, default limit)
- `AGENTS.md` (number model; client never decides type/slot/price/quantity)
