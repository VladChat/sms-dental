---
title: Patient opt-out — STOP and START
slug: patient-opt-out-stop-start
status: ready
visibility: customer_authenticated
audience: Clinic owner and front desk
surface: /account, /workspace
category: missed-calls-and-messages
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
last_verified: 2026-06-09
related:
  - how-front-desk-should-handle-patient-replies
  - ../sms-approval/what-sms-approval-means
---

# Patient opt-out — STOP and START

## Summary

Patients are always in control of whether they receive texts. If a patient replies
**STOP**, they are opted out and the service stops texting them. If they reply
**START**, they can opt back in. The service handles this automatically, and your
office should always respect it.

## Applies to

Clinic owners and front-desk staff who want to understand how patient opt-out works
and why it matters.

## What this means

Text messaging includes standard opt-out handling that keeps your office compliant
and respectful of patients:

- **STOP** — when a patient replies STOP (or similar opt-out words), they are
  recorded as opted out and the service stops sending them follow-up texts.
- **START** — a patient who previously opted out can reply START to opt back in,
  where supported.
- **HELP** — if a patient replies HELP, the texting service provides a standard
  help response automatically.

This handling is automatic. You do not need to manually track opt-outs — but
everyone at the office should honor them. Never try to work around a patient's
opt-out.

Opt-out is part of responsible business texting. Keeping it reliable protects your
patients' trust and keeps your messaging in good standing. It works alongside
**SMS approval**, which is the approval your texting service needs before it can be
activated — see
[What SMS approval means](../sms-approval/what-sms-approval-means.md).

## What you can do

- Let opt-out work automatically — no manual step is needed to record a STOP.
- Make sure your team understands that an opted-out patient should not be texted
  through the service.
- If a patient asks to stop receiving texts, you can let them know they can simply
  reply STOP to the message.
- If a patient says they want to receive texts again, they can reply START.

## What to expect

- After a patient replies STOP, the service will not send them further follow-up
  texts.
- Opt-out applies to the texting follow-ups; your office can still contact the
  patient through your normal phone process when appropriate.
- The service sends a limited, professional follow-up after a missed call — it is
  not a marketing list, so most patients will not need to opt out.

## When to contact support

Contact support if:

- a patient says they replied STOP but still received a text,
- a patient says they are not receiving messages they expected, or
- you are unsure whether a patient is opted out.

Support may need to review the account's messaging status to help.

Email: **support@missedcallsdental.com**

## Related articles

- [How front desk should handle patient replies](how-front-desk-should-handle-patient-replies.md)
- [What SMS approval means](../sms-approval/what-sms-approval-means.md)

## Source of truth

- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — STOP/START/HELP handling behavior
- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` — opt-out compliance
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — messaging and compliance rules
