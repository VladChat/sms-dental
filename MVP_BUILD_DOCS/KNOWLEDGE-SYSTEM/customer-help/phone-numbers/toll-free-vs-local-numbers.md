---
title: Toll-free vs local numbers
slug: toll-free-vs-local-numbers
status: ready
visibility: clinic_owner
audience: Clinic owner
surface: /account
category: phone-numbers
owner: product
source_of_truth:
  - AGENTS.md
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - config/billing.config.ts
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
last_verified: 2026-06-09
related:
  - remove-a-number
  - restore-a-removed-number
  - ../billing/local-vs-toll-free-charges
  - ../sms-approval/what-sms-approval-means
---

# Toll-free vs local numbers

## Summary

Your clinic's business number can be either a toll-free number or a local number.
They work the same way for recovering missed calls, but they differ in how they
look to patients, how texting gets approved, and how they are billed. This
article helps you choose.

## Applies to

Clinic owners choosing or comparing business numbers for their account.

## What this means

### Toll-free number

- A business number with a toll-free area code (for example, an 8xx number).
- The approval step needed before texting is **toll-free verification**, which is
  included in your plan.
- Your **first toll-free number is included in plan**; an additional toll-free
  number is a paid add-on.
- A good default if a local area code is not essential.

### Local number

- A business number with a **local area-code identity**, which can feel more
  familiar to nearby patients.
- Before it can text patients, a local number needs **SMS approval** — the
  carrier registration process for local business texting.
- A local number is **always a paid add-on** (even your first one, even during
  the free trial) and carries extra registration and compliance charges.

### Calls vs texting readiness

For either type, **calls and texting can become ready at different times.** A
number can start handling calls while its texting is still going through approval.
Texting to patients only turns on after the required approval and configuration
are complete — it is never enabled automatically just because a number was added.
See
[Why SMS is not active immediately](../sms-approval/why-sms-is-not-active-immediately.md).

## What you can do

- In the **Phone number** section of your account, search for and select a
  business number.
- Compare the price breakdown for each type before you choose. See
  [Local vs toll-free charges](../billing/local-vs-toll-free-charges.md).
- Choose based on your clinic's needs:
  - Want the simpler, lower-cost path? A **toll-free** number is usually the
    easiest start.
  - Want a local area-code identity and comfortable with the added charges and
    approval? Choose a **local** number.
- Make sure you have a saved payment method, which is required to assign a number.

## What to expect

- Your account decides the number type, whether it is included or a paid add-on,
  and the price — you do not have to work this out yourself.
- A local number will show as **waiting for approval** for texting until SMS
  approval is complete.
- You can hold more than one business number on your account, up to your account's
  limit. If you need more, contact support.

## When to contact support

Contact support if you are unsure which number type fits your clinic, if you need
a higher number limit, or if a number is not behaving the way you expect after
you add it.

Email: **support@missedcallsdental.com**

## Related articles

- [Local vs toll-free charges](../billing/local-vs-toll-free-charges.md)
- [What SMS approval means](../sms-approval/what-sms-approval-means.md)
- [Remove a number](remove-a-number.md)
- [Restore a removed number](restore-a-removed-number.md)

## Source of truth

- `AGENTS.md` — toll-free vs local number model (types, included vs paid, approval
  paths)
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — pricing model for each type
- `config/billing.config.ts` — canonical amounts
- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` — approval paths (local vs
  toll-free)
