---
title: Current vs next billing cycle
slug: current-vs-next-cycle
status: ready
visibility: clinic_owner
audience: Clinic owner
surface: /account
category: billing
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - config/billing.config.ts
  - AGENTS.md
last_verified: 2026-06-09
related:
  - understand-your-bill
  - ../phone-numbers/remove-a-number
  - ../phone-numbers/restore-a-removed-number
---

# Current vs next billing cycle

## Summary

When you change your numbers mid-month, the difference you see between this
month's charges and next month's is normal. Changes to numbers take effect on
your **next billing cycle**, not as an instant refund or charge. This article
explains why.

## Applies to

Clinic owners who have added, removed, or restored a business number and want to
understand how it affects their bill.

## What this means

Your account has two views of billing:

- **Current billing period** — what you are paying for in the month you are in
  now.
- **Next billing cycle** — what your charges will look like starting next month,
  based on the numbers and add-ons that will still be active then.

When you make a change to a number, these two views can look different for a
short time, and that is expected.

### Removing a number

When you remove a business number:

- It **stops working right away** — calls and texting for that number stop
  immediately.
- For the **current billing period**, that number can still show as held or
  billed, because you have already been billed for the current period.
- For the **next billing cycle**, the removed number is excluded, so your
  estimated next-cycle amount goes down accordingly.

This is why a number you just removed may still appear in your current charges
while no longer counting toward your next cycle.

### Adding or restoring a number

Adding a new number or restoring one you removed updates your next-cycle estimate
to include it. As with removals, the change is reflected going forward rather
than as an instant mid-month adjustment.

## What you can do

- Look at both the current and next-cycle views in your **Billing** section to
  see the effect of a recent change.
- If you removed a number by mistake and it is still restorable, you may be able
  to restore it. See
  [Restore a removed number](../phone-numbers/restore-a-removed-number.md).
- Plan number changes with next-cycle timing in mind, since changes apply going
  forward.

## What to expect

- **No instant refund or credit.** Removing or restoring a number does not create
  an immediate refund, credit, or extra charge for the current period.
- Changes are applied on a **next-cycle** basis.
- A removed number may remain visible and restorable for a limited time before it
  is permanently removed. We do not promise a fixed restore window. See
  [Remove a number](../phone-numbers/remove-a-number.md).

## When to contact support

Contact support if:

- your current or next-cycle amount looks wrong,
- a number you removed still appears active after the next cycle, or
- you expected a change to be reflected and it is not.

Sometimes a recent change needs a quick review on our side to make sure your
account is in sync. We are happy to check.

Email: **support@missedcallsdental.com**

## Related articles

- [Understand your bill](understand-your-bill.md)
- [Remove a number](../phone-numbers/remove-a-number.md)
- [Restore a removed number](../phone-numbers/restore-a-removed-number.md)

## Source of truth

- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — phone-number removal and
  next-cycle billing behavior (no immediate credit/refund/charge)
- `config/billing.config.ts` — plan amounts and number-type breakdowns
- `AGENTS.md` — phone number removal lifecycle (billing applies next cycle only)
