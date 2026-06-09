---
title: Why SMS is not active immediately
slug: why-sms-is-not-active-immediately
status: ready
visibility: clinic_owner
audience: Clinic owner
surface: /account
category: sms-approval
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - config/runtime.config.ts
  - AGENTS.md
last_verified: 2026-06-09
related:
  - what-sms-approval-means
  - what-information-is-needed-for-sms-approval
  - ../phone-numbers/toll-free-vs-local-numbers
---

# Why SMS is not active immediately

## Summary

Setting up your business number is one step. Turning on patient texting is a
separate step. Texting to patients only becomes active after the required
approval and configuration are complete — it is never switched on automatically
just because you added a number, saved a payment method, or started billing. This
protects your clinic and your patients.

## Applies to

Clinic owners who have set up an account or a number and are wondering why the
texting service is not sending yet.

## What this means

There are two separate readiness steps:

1. **Number and call setup.** Your business number can be assigned and start
   handling calls.
2. **Texting (SMS) activation.** Sending follow-up texts to patients requires
   **SMS approval** and configuration to be complete first.

These are deliberately separate. Adding a number, adding a payment method, or
starting your paid plan does **not** by itself turn on patient texting. Texting
stays off until the approval and configuration gates are met.

This is on purpose. Business texting follows carrier rules, and sending before
approval can cause messages to be blocked or filtered. Keeping texting off until
everything is ready helps make sure your messages actually reach patients and that
your clinic stays compliant.

## What you can do

- Complete the **SMS Approval Information** in your account. See
  [What information is needed for SMS approval](what-information-is-needed-for-sms-approval.md).
- Watch the **Texting** status in your account. It moves through:
  - **Not active** — texting is not on yet.
  - **Waiting for approval** — your information is submitted and under review.
  - **Active** — texting is approved, configured, and on.
- Note that finishing the SMS approval section may show that section as
  **Complete**, but the separate **Texting** status is what tells you whether
  texting is actually live. "Complete" on the section does not mean texting is on.

## What to expect

- After you submit your approval information, you may see a **waiting for
  approval** (pending) status while the review is in progress. Approval can take
  time; we cannot promise an exact turnaround.
- Texting becomes active only after approval and configuration are finished.
- When texting is active, the standard follow-up message is professional and
  simple — for example: *"Hi, this is [your clinic]. We missed your call. Would
  you like us to help schedule an appointment?"* It is not a sales blast and not
  an automated assistant pretending to be a person.

## When to contact support

Contact support if your texting status has been **waiting for approval** for an
unusually long time, if you completed everything but texting still is not active,
or if you are unsure what step is left.

Email: **support@missedcallsdental.com**

## Related articles

- [What SMS approval means](what-sms-approval-means.md)
- [What information is needed for SMS approval](what-information-is-needed-for-sms-approval.md)
- [Toll-free vs local numbers](../phone-numbers/toll-free-vs-local-numbers.md)

## Source of truth

- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` — approval is required before
  live patient SMS
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — SMS enablement is separate from
  number assignment and billing
- `config/runtime.config.ts` — SMS enablement is gated, not automatic
- `AGENTS.md` — SMS recovery is never enabled automatically
