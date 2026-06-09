---
title: Local vs toll-free charges
slug: local-vs-toll-free-charges
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
last_verified: 2026-06-09
related:
  - understand-your-bill
  - ../phone-numbers/toll-free-vs-local-numbers
---

# Local vs toll-free charges

## Summary

Toll-free numbers and local numbers are billed differently because they use
different texting-approval models. Toll-free is the simpler, lower-cost path and
your first toll-free number is included in your plan. Local numbers are always a
paid add-on and carry extra registration and compliance charges. The exact
amounts come from your plan details in your account.

## Applies to

Clinic owners deciding which number type to add, or reviewing why a local number
costs more than a toll-free one.

## What this means

### Toll-free numbers

- **First toll-free number: included in plan.** It is part of your $99/month base
  plan.
- **Additional toll-free number: $20/month** each.
- **Toll-free verification: included.** The approval step a toll-free number needs
  before texting is part of the plan at no extra charge.

### Local numbers

A local number gives your clinic a local area-code identity, but it uses a
stricter texting-approval model, so it has additional charges. A local number is
always a paid add-on — even your first one, and even during your free trial.

Local-number charges include:

**Registration and compliance**

- **Carrier brand registration: $9 one-time**
- **Campaign registration / vetting: $30 one-time**
- **Monthly SMS compliance fee: $15/month**

**Number fees**

- **Local number: $20/month**
- **Setup fee: $20 one-time**

The one-time charges happen when the local number is set up; the monthly charges
continue while the local number is active on your account.

### Why the difference

Local numbers require **SMS approval** (the carrier registration process for
local business texting) before they can text patients. Toll-free numbers use a
separate **toll-free verification** path that is included in your plan. The extra
local charges cover that registration and ongoing compliance — they are not
optional once you choose a local number.

## What you can do

- Review the full price breakdown for each number type **in your account before
  you add a number**. Your account shows the current charges, which are the
  source of truth.
- Choose toll-free if you want the simpler, lower-cost path and a local area code
  is not essential.
- Choose local if a local area-code identity matters for your clinic, and you are
  comfortable with the added registration and compliance charges.
- Make sure your account has an active paid plan and a saved payment method
  before adding a paid number.

## What to expect

- You will be shown and asked to authorize the relevant charges before a paid
  number is added. Review them first.
- One-time local charges appear at setup; monthly local charges continue while
  the number is active.
- These amounts are sourced from your plan details and are never hard-coded in a
  way that could drift from what you actually pay.

## When to contact support

Contact support if a number-type charge is unclear, if you are unsure which type
fits your clinic, or if a local charge appears that you did not expect.

Email: **support@missedcallsdental.com**

## Related articles

- [Understand your bill](understand-your-bill.md)
- [Toll-free vs local numbers](../phone-numbers/toll-free-vs-local-numbers.md)

## Source of truth

- `config/billing.config.ts` — toll-free and local breakdown builders (the
  amounts in this article)
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — toll-free vs local pricing model
- `AGENTS.md` — toll-free vs local number model rules
