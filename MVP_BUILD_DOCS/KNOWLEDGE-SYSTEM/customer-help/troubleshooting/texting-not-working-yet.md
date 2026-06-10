---
title: My texting isn't working yet
slug: texting-not-working-yet
status: ready
visibility: clinic_owner
audience: Clinic owner
surface: /account
category: troubleshooting
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - config/runtime.config.ts
last_verified: 2026-06-10
related:
  - ../sms-approval/why-sms-is-not-active-immediately
  - ../sms-approval/what-sms-approval-means
  - ../sms-approval/what-information-is-needed-for-sms-approval
---

# My texting isn't working yet

## Summary

If patient texting is not sending yet, the most common reason is that **SMS
approval and texting activation are separate steps** from setting up your number,
adding a payment method, or starting your plan. Each assigned business number has
its own **Texting** status. Texting turns on only after approval and
configuration are complete — it is never switched on automatically. This article
helps you check the likely causes.

## Applies to

Clinic owners whose business number is set up but who are not seeing patient
texting go out yet.

## What this means

Getting your account ready has several independent steps:

- assigning a **business number**,
- adding a payment method / starting your plan,
- completing **SMS approval**, and
- texting being **activated** for your clinic.

These are deliberately separate. Having a number assigned — or having billing set
up — does **not** mean texting is on. Texting to patients stays off until SMS
approval and the required configuration are complete. This protects message
delivery and keeps your texting compliant.

If your account has more than one business number, the numbers can show different
Texting statuses. For example, one number may still be waiting for its local SMS
approval while another number is waiting on toll-free verification. The **SMS
approval** section shows the broader approval workflow; the **Phone number**
section shows each assigned number's own Texting status.

> "SMS approval" is the carrier approval process your texting service needs before
> it can be activated. See
> [What SMS approval means](../sms-approval/what-sms-approval-means.md).

So it is normal to have a working number while texting still shows as pending or
not active.

## What you can do

Check these in your account, in order:

1. **Number status.** Confirm the specific business number is assigned and active.
   A number can be assigned for calls while texting is still pending.
2. **SMS approval status.** Open the **SMS approval** section and confirm you have
   completed the required information. After you submit, texting typically shows
   **Waiting for approval** while the review is in progress.
3. **Required business / SMS approval information.** Make sure the business profile
   and SMS approval details are complete and accurate — missing or inaccurate
   details can hold up approval. See
   [What information is needed for SMS approval](../sms-approval/what-information-is-needed-for-sms-approval.md).
4. **Texting status.** In **Phone number**, look at the **Texting** status for each
   assigned number specifically (Not active → Waiting for approval / verification
   pending → Active). Note that finishing the SMS approval section may show that
   section as "Complete," but the separate Texting status is what tells you
   whether texting is actually live for that number.
5. **Activation confirmed.** Texting is active only after approval and
   configuration finish. If everything looks complete but texting is still not
   active, that is a good time to contact support.

## What to expect

- After you submit your SMS approval information, expect a **Waiting for approval**
  (pending) status. Approval can take time, and we cannot promise an exact
  timeframe.
- Texting becomes active only after approval and configuration are complete.
- Support can help review your account, number, and SMS approval status, but
  cannot instantly activate texting — approval still has to be in place.
- Always-on rules still apply: the service sends a professional follow-up after a
  missed call and respects patient opt-outs. There is no way to skip approval or
  opt-out handling.

## When to contact support

Contact support if:

- you have completed SMS approval and the required information, but texting has
  stayed **Waiting for approval** for an unusually long time, or
- everything looks complete in your account but texting is still not active.

Include your clinic name, account email, and the business number involved. Support
may need to review your account, number, and SMS approval status.

Email: **support@missedcallsdental.com**

## Related articles

- [Why SMS is not active immediately](../sms-approval/why-sms-is-not-active-immediately.md)
- [What SMS approval means](../sms-approval/what-sms-approval-means.md)
- [What information is needed for SMS approval](../sms-approval/what-information-is-needed-for-sms-approval.md)

## Source of truth

- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` — approval is required before
  live patient texting
- `MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md` — required SMS approval information
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — texting is separate from number
  assignment and billing
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — SMS enablement is gated, not automatic
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — per-number texting status model
- `config/runtime.config.ts` — texting enablement is gated
