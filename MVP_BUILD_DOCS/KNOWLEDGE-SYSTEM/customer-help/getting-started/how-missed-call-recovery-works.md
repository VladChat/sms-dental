---
title: How missed-call recovery works
slug: how-missed-call-recovery-works
status: ready
visibility: customer_authenticated
audience: Clinic owner
surface: /account
category: getting-started
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
  - MVP_BUILD_DOCS/START-HERE.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - AGENTS.md
last_verified: 2026-06-09
related:
  - what-missed-calls-dental-does
  - ../sms-approval/why-sms-is-not-active-immediately
  - ../phone-numbers/toll-free-vs-local-numbers
---

# How missed-call recovery works

## Summary

Missed-call recovery follows a simple flow: a patient's call reaches the system
through a supported setup, the missed call is recognized, and — once your texting
is approved and configured — a professional follow-up text is sent so your front
desk can help the patient. This article explains the flow and the supported ways a
call can reach the system.

## Applies to

Clinic owners setting up the service or wanting to understand how a missed call
turns into a text follow-up.

## What this means

At a high level, the flow is:

```text
patient call -> supported call event reaches the system -> safe SMS follow-up
(after approval/configuration) -> patient reply -> front desk follow-up
```

Step by step:

1. **A patient calls** and the call is not answered.
2. **The call event reaches the system** through a supported setup (see below).
3. **A follow-up text is sent** to the caller — but only after your texting
   service is approved and configured. Texting is never turned on automatically.
4. **The patient replies** if they want help scheduling.
5. **Your front desk follows up** using the office's normal process.

### Supported connection paths

A call must reach the system through one of these supported setups. The service
cannot watch an unrelated office phone number on its own.

- **Conditional forwarding** — you keep your existing main office number, and your
  phone provider forwards unanswered, busy, or after-hours calls to a business
  number on your account. This lets you keep your published number while still
  recovering missed calls. (For this to work well, the forwarded call needs to pass
  along the patient's caller ID.)
- **Assigned business number / local-number path** — you use a business number
  assigned to your account directly (for example, on a campaign page or as the
  number you route calls to). See
  [Toll-free vs local numbers](../phone-numbers/toll-free-vs-local-numbers.md).

Some offices use a combination of both.

### Future options

Direct integrations with phone providers may come in the future, but they are
**not** part of the current service. For now, use one of the supported paths above.

## What you can do

- Choose a supported path that fits your office's phone setup.
- If you want to keep your main number, set up conditional forwarding for
  unanswered/busy/after-hours calls.
- Complete **SMS approval** so the texting step can be activated. See
  [Why SMS is not active immediately](../sms-approval/why-sms-is-not-active-immediately.md).
- Decide who will handle patient replies.

## What to expect

- Calls are recognized only when they reach the system through a supported path.
- Texting follow-ups begin only after approval and configuration are complete —
  setting up a number alone does not start texting.
- Each missed-call event leads to one professional follow-up text (the service does
  not repeatedly text the same patient for the same event).
- The service helps you respond faster; it does not promise appointment
  availability or guarantee that every message is delivered.

## When to contact support

Contact support if you are unsure which path fits your phone system, if forwarding
does not seem to reach the system, or if you need help confirming your setup.

Email: **support@missedcallsdental.com**

## Related articles

- [What Missed Calls Dental does](what-missed-calls-dental-does.md)
- [Why SMS is not active immediately](../sms-approval/why-sms-is-not-active-immediately.md)
- [Toll-free vs local numbers](../phone-numbers/toll-free-vs-local-numbers.md)

## Source of truth

- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — phone event strategy and supported paths
- `MVP_BUILD_DOCS/START-HERE.md` — current supported paths (forwarding, local
  number); future integrations out of scope
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — recovery flow (customer-safe level)
- `AGENTS.md` — product boundaries
