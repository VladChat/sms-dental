---
title: How front desk should handle patient replies
slug: how-front-desk-should-handle-patient-replies
status: ready
visibility: clinic_staff
audience: Front desk staff
surface: /workspace
category: workspace
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
last_verified: 2026-06-09
related:
  - ../workspace/front-desk-workspace-overview
  - patient-opt-out-stop-start
---

# How front desk should handle patient replies

## Summary

When a patient replies to a missed-call follow-up text, the front desk reviews the
reply in the **workspace** and follows up to help the patient schedule. Replies are
about helping the patient get an appointment — not about giving medical advice over
text.

## Applies to

Front-desk staff who review and act on patient replies.

## What this means

After a missed-call follow-up text goes out, a patient may reply asking for help.
Those replies show up in the **workspace** as patient request cards so your team can
see who needs follow-up.

Your job at the front desk is to:

- read the patient's reply,
- follow up to help them schedule or answer a scheduling question, and
- record the outcome of your follow-up.

The workspace is for reviewing replies and tracking follow-up. It is **not** a tool
for giving clinical guidance.

### Keep it to scheduling, not medical advice

- Do **not** provide diagnosis, treatment instructions, or medical advice through
  text. The follow-up is about helping the patient book or get a call back.
- If a reply sounds urgent or describes a medical or emergency situation, follow
  your clinic's normal phone and emergency process — do not try to handle it over
  text.
- Do not promise a specific appointment time over text until the office has
  actually confirmed it.

### Some details may be missing

Patient request cards show what is known. Fields the system does not have yet
appear as **"not provided yet"** rather than a guess. Do not assume or invent
details that are not shown — confirm anything you need directly with the patient.

### Respect opt-outs

If a patient has opted out (replied STOP), do not text them through the service.
See [Patient opt-out — STOP and START](patient-opt-out-stop-start.md).

## What you can do

- Open the **workspace** to see patient replies and request cards.
- Review each reply and follow up using your clinic's normal process (for example,
  calling the patient back to schedule).
- Record the outcome of a follow-up — for example, appointment booked, no
  appointment booked, or could not reach the patient — plus a short note if helpful.

> Sending text replies directly from the workspace is not available today. Use the
> workspace to review replies and track outcomes, and follow up with the patient
> through your normal phone process.

## What to expect

- New replies appear as request cards for the front desk to handle.
- Recording an outcome helps your team keep track of which patients still need
  follow-up.
- Cards clearly labeled **"Sample"** are examples only — they are not real patients
  and should not be acted on.

## When to contact support

Contact your clinic owner first for account or access questions. For product
issues — for example, replies not appearing as expected — contact support.

Email: **support@missedcallsdental.com**

## Related articles

- [Front-desk workspace overview](../workspace/front-desk-workspace-overview.md)
- [Patient opt-out — STOP and START](patient-opt-out-stop-start.md)

## Source of truth

- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` — workspace scope, outcomes, sample
  cards, minimum-necessary display, "not provided yet"
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — reply handling and opt-out behavior
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — no medical advice; scheduling focus
