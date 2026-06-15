---
title: How AI answered calls will work
slug: how-ai-answered-calls-will-work
status: draft
visibility: clinic_owner
audience: Clinic owner
surface: /account
category: ai-call-assistant
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - MVP_BUILD_DOCS/KNOWLEDGE-SYSTEM/platform-admin/ai-answering-foundation.md
  - config/billing.config.ts
last_verified: 2026-06-27
related:
  - ../workspace/front-desk-workspace-overview
  - ../notifications/notification-settings
  - ../billing/understand-your-bill
---

# How AI answered calls will work

## Summary

**AI answered calls** are a planned way for your office to capture a caller's
request when no one can pick up — for example after hours or when the line is
busy. When available, the assistant would collect the caller's name, callback
number, and reason for calling, and turn that into a **call summary** and a
**patient request** in your **Workspace**. This feature is being prepared and is
**not active yet** for general clinic use.

## Applies to

Clinic owners and admins planning ahead for AI answered calls. There is nothing
to turn on today.

## Current status

- AI answered calls are **planned / not active yet**. They are **not enabled for
  all clinics** and there is no launch date to promise.
- Your account may show a read-only "AI Answering — Not active yet" area so you
  know it is coming; it does not answer calls.
- Your existing missed-call **texting service** (SMS recovery) is unchanged.

## What this will do

When available, AI answered calls are intended to:

- greet a caller in your office's voice when a call reaches the assistant,
- collect the caller's **name**, **callback number**, and **reason for calling**,
- create a short **call summary**, and
- add a **patient request** to your Workspace so your team can follow up.

It is a narrow **call-capture** helper, not a full AI receptionist.

## How calls will reach the assistant

AI answered calls only happen when your clinic's phone setup **forwards** calls to
the assistant (for example, an unanswered or after-hours call). The assistant
does not intercept calls on its own, and it does not replace your phone system.

## What appears in the Workspace

A captured call would appear as a **patient request** with **Source: AI answered
call** and a short **call summary**. Your front desk handles it the same way as
any other patient request, through your clinic's normal scheduling and follow-up
process. (See [Front-desk workspace overview](../workspace/front-desk-workspace-overview.md).)

## How this relates to SMS recovery

- AI answered calls and missed-call **SMS recovery** work together, not as
  replacements. SMS recovery continues as it does today.
- If the assistant captures a complete request on a call, your office should not
  re-run the same conversation by text — follow up directly. If a call capture is
  incomplete, you can continue follow-up through your normal process (and, where
  available, SMS recovery).
- **SMS approval is separate.** AI answered calls do not remove the SMS approval
  requirement for texting patients.

## Billing and minute alerts

- AI answered calls are expected to use **AI answered call time**, which may count
  toward the minutes included in your plan in the future. Today, AI answered call
  time is **not being metered or billed**.
- For what your plan includes, see
  [Understand your bill](../billing/understand-your-bill.md); exact figures come
  from your plan details (`config/billing.config.ts`) — this article does not
  restate them.
- You can choose **AI answered call minute alerts** ahead of time in
  [Notification settings](../notifications/notification-settings.md).

## What it will not do

AI answered calls will **not**:

- give medical advice, a diagnosis, or treatment instructions,
- promise or confirm a specific appointment time,
- collect payment,
- replace your front-desk staff, or
- replace your phone system.

Anything urgent or medical should follow your clinic's normal phone and emergency
process.

## When to contact support

Contact support if you want to know more about AI answered calls or be told when
they become available for your clinic. We cannot promise a date.

Email: **support@missedcallsdental.com**

## Related articles

- [Front-desk workspace overview](../workspace/front-desk-workspace-overview.md)
- [Notification settings](../notifications/notification-settings.md)
- [Understand your bill](../billing/understand-your-bill.md)

## Source of truth

- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — "Next MVP Direction — AI Answering"
  (planned, not live; narrow capture)
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`, `config/billing.config.ts` —
  included AI answered call minutes and alerts (cited, not restated)
- `MVP_BUILD_DOCS/KNOWLEDGE-SYSTEM/platform-admin/ai-answering-foundation.md` —
  internal state (not customer-facing)
