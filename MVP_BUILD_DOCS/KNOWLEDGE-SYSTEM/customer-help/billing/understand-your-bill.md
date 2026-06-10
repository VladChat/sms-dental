---
title: Understand your bill
slug: understand-your-bill
status: ready
visibility: clinic_owner
audience: Clinic owner
surface: /account
category: billing
owner: product
source_of_truth:
  - config/billing.config.ts
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - AGENTS.md
last_verified: 2026-06-10
related:
  - current-vs-next-cycle
  - local-vs-toll-free-charges
  - ../phone-numbers/toll-free-vs-local-numbers
---

# Understand your bill

## Summary

Your account runs on one monthly plan with included regular calling, AI answered
call time, and texting. Extra business numbers and certain number types add their
own charges. This article explains the parts of your bill in plain terms. The
exact amounts always come from your plan details in your account.

## Applies to

Clinic owners who manage billing for their Missed Calls Dental account.

## What this means

Your bill is made up of a few simple parts:

- **Base plan — $99/month.** This is your main subscription. It includes:
  - **1 business number**
  - **1,000 regular call minutes**
  - **100 minutes of AI answered calls**
  - **1,000 SMS segments**

  The included regular call minutes, AI answered call minutes, and SMS segments
  are shared across **all** of the business numbers on your account, not per
  number.

  An **SMS segment** is a billing unit for texting. A long text message can use
  more than one segment, so the included amount is measured in segments rather
  than messages.

- **Additional business numbers.** Your plan includes your first number. If you
  add another toll-free number, it is a paid add-on at **$20/month** each.

- **Local-number charges.** A local number is always a paid add-on (even your
  first one) and comes with extra charges tied to texting registration and
  compliance. See
  [Local vs toll-free charges](local-vs-toll-free-charges.md) for the full
  breakdown.

- **Usage above the included amounts.** Your plan defines per-unit rates for
  regular call time, AI answered call time, and SMS segments above the included
  amounts. Usage-based charges are still being rolled out, so you should not
  expect to see metered usage charges on your bill until that feature is active
  and you are notified.

Because of this structure, **some charges only appear when certain number types
are active.** For example, additional-number charges appear only after you add a
second number, and local-number compliance charges appear only when you have a
local number on the account.

## What you can do

- Open the **Billing** section in your account to see your current plan, payment
  method status, and trial countdown.
- Review the price breakdown shown in your account before adding a number or
  changing your plan. The amounts there are the source of truth for what you
  will be charged.
- Add a payment method before assigning your first business number — it is
  required to assign a number.

## What to expect

- Your **21-day free trial** starts after your first business number is
  assigned, not at sign-up.
- The base plan amount is the same each month. Add-ons (extra numbers, local
  numbers) are added on top.
- We never describe any number as "free." Your first toll-free number is
  **included in plan**.
- If you add or remove a number mid-month, the change is reflected on your
  **next** billing cycle rather than as an instant refund or charge. See
  [Current vs next billing cycle](current-vs-next-cycle.md).

## When to contact support

Contact support if a charge is unclear, if an amount does not match what you
expected to see in your account, or if you have a billing question that is not
answered here. We can review your account details with you.

Email: **support@missedcallsdental.com**

## Related articles

- [Current vs next billing cycle](current-vs-next-cycle.md)
- [Local vs toll-free charges](local-vs-toll-free-charges.md)
- [Toll-free vs local numbers](../phone-numbers/toll-free-vs-local-numbers.md)

## Source of truth

- `config/billing.config.ts` — the single source of truth for plan amounts,
  included usage, and number-type breakdowns
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — plan policy, add-ons, trial
  behavior, and usage-billing status
- `AGENTS.md` — toll-free vs local number model and pricing rules
