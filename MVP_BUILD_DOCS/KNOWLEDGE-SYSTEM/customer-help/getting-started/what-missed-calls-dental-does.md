---
title: What Missed Calls Dental does
slug: what-missed-calls-dental-does
status: ready
visibility: customer_authenticated
audience: Clinic owner
surface: /account
category: getting-started
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
  - MVP_BUILD_DOCS/START-HERE.md
  - AGENTS.md
last_verified: 2026-06-09
related:
  - how-missed-call-recovery-works
  - ../sms-approval/why-sms-is-not-active-immediately
---

# What Missed Calls Dental does

## Summary

Missed Calls Dental helps your dental office recover missed patient calls. When a
patient calls and no one can answer, a missed call can quietly become a missed
patient. After a supported missed-call event reaches the system, Missed Calls
Dental sends a professional text follow-up so your office can respond and help the
patient schedule.

## Applies to

Clinic owners getting started, and anyone who wants to understand what the product
is — and is not.

## What this means

The idea is simple: **a missed call should not mean a lost patient.** When a
supported missed-call event reaches the system, the service sends one short,
professional text to the caller offering to help schedule an appointment. That
gives your front desk a chance to follow up instead of losing the patient to the
next office that picks up.

A typical follow-up text reads:

> Hi, this is [your clinic]. We missed your call. Would you like us to help
> schedule an appointment?

It is intentionally calm and professional — no pressure, no sales pitch, and no
medical claims.

### What it is not

To set expectations clearly, Missed Calls Dental is a focused **missed-call
recovery layer**. It is **not**:

- a replacement for your phone system,
- a dental CRM,
- a practice-management (PMS) integration,
- a call-recording or transcription tool, or
- an automated "AI receptionist."

It does one job well: helping you recover missed calls with a safe text follow-up.

### It needs a supported connection

The service cannot magically detect calls to an unrelated office phone number. A
call has to reach the system through a supported setup first — for example, by
forwarding your unanswered calls to a business number on your account, or by using
an assigned business number directly. See
[How missed-call recovery works](how-missed-call-recovery-works.md) for the
supported paths.

## What you can do

- Set up a supported call path so missed calls can reach the system.
- Complete **SMS approval** so your texting service can be activated. Texting is a
  separate step and is not on automatically — see
  [Why SMS is not active immediately](../sms-approval/why-sms-is-not-active-immediately.md).
- Decide who at the office will follow up with patients who reply.

## What to expect

- Once everything is set up and texting is approved, callers who miss a connection
  receive one professional follow-up text per missed-call event.
- Replies come back to your office so the front desk can follow up.
- The service focuses on recovery and follow-up — it does not diagnose, give
  medical advice, promise appointment times, or guarantee outcomes.

## When to contact support

Contact support if you are not sure whether your office's phone setup can work with
the service, or if you want help getting started.

Email: **support@missedcallsdental.com**

## Related articles

- [How missed-call recovery works](how-missed-call-recovery-works.md)
- [Why SMS is not active immediately](../sms-approval/why-sms-is-not-active-immediately.md)

## Source of truth

- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — product identity, core problem/solution,
  and what is out of scope
- `MVP_BUILD_DOCS/START-HERE.md` — product scope and supported paths
- `AGENTS.md` — product boundaries and messaging rules
