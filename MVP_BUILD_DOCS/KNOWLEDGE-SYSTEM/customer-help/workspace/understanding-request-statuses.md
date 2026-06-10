---
title: Understanding patient request statuses
slug: understanding-request-statuses
status: ready
visibility: clinic_staff
audience: Front desk staff
surface: /workspace
category: workspace
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
last_verified: 2026-06-10
related:
  - front-desk-workspace-overview
  - ../missed-calls-and-messages/how-front-desk-should-handle-patient-replies
---

# Understanding patient request statuses

## Summary

Each patient request card in the **workspace** shows a status that tells the front
desk where the request stands. This article explains what each status means so you
can quickly see what needs attention — and what "not provided yet" means.

## Applies to

Front-desk staff using the workspace to review patient replies and requests.

## What this means

The workspace gives each request a status to help you triage. The statuses are:

- **New** — there is a new request or conversation to review. No one has worked it
  yet.
- **Needs reply** — the latest activity is from the patient, so the request likely
  needs front-desk attention next.
- **Waiting for patient** — the office has already followed up and is waiting to
  hear back from the patient.
- **Ready to call** — a request that is appropriate to call. This status is part of
  the workspace vocabulary; treat the card's messages as your real guide, since not
  every request is automatically marked this way.
- **Booked** — an appointment has been booked / the patient was recovered, where
  that has been recorded.
- **Closed** — no further follow-up is expected, or the request was not recovered.

Statuses are a helpful guide, not a guarantee. Always read the conversation on the
card to understand the full picture before you act.

### What "not provided yet" means

Some details on a card may show **"not provided yet."** That means the patient has
not given that information, or the system cannot safely determine it. It is **not**
an error and not something to guess at — if you need the detail (for example, the
reason for the visit), confirm it directly with the patient.

### What not to assume

- Do not assume a status means more than it says — for example, **Booked** reflects
  a recorded outcome, not a promise that the appointment will be kept.
- Do not infer medical details from a status or a short message.
- Do not treat **Sample** cards as real patients — they are labeled examples only.

## What you can do

- Scan statuses to prioritize: **New** and **Needs reply** usually need attention
  first; **Waiting for patient** generally does not need action yet.
- Open a card and read the conversation before following up.
- Follow up with the patient using your clinic's normal process, and record the
  outcome (for example, appointment booked, no appointment booked, or could not
  reach the patient). See
  [How front desk should handle patient replies](../missed-calls-and-messages/how-front-desk-should-handle-patient-replies.md).
- If a patient's message sounds urgent or describes a medical or emergency
  situation, follow your clinic's normal phone and emergency process — do not handle
  it over text.

## What to expect

- The workspace helps you **review** requests and **record outcomes**. Sending text
  replies from the workspace, automated calling, and task assignment are not
  available today. The **Call patient** action is a normal phone link for your
  device; it does not place an automated call.
- A status can change as the conversation or the recorded outcome changes.
- Recording an outcome helps your team keep track of which patients still need
  follow-up.

## When to contact support

Contact your clinic owner first for access questions. For product issues — for
example, statuses or cards not appearing as expected — contact support.

Email: **support@missedcallsdental.com**

## Related articles

- [Front-desk workspace overview](front-desk-workspace-overview.md)
- [How front desk should handle patient replies](../missed-calls-and-messages/how-front-desk-should-handle-patient-replies.md)

## Source of truth

- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` — status vocabulary, conservative
  derivation, outcomes, "not provided yet", samples
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — scheduling focus; no medical advice
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — reply handling behavior
