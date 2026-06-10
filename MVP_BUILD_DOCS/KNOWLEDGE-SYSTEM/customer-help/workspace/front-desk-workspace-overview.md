---
title: Front-desk workspace overview
slug: front-desk-workspace-overview
status: ready
visibility: clinic_staff
audience: Front desk staff
surface: /workspace
category: workspace
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md
  - MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md
last_verified: 2026-06-10
related:
  - ../missed-calls-and-messages/how-front-desk-should-handle-patient-replies
  - ../missed-calls-and-messages/patient-opt-out-stop-start
---

# Front-desk workspace overview

## Summary

The **workspace** is where front-desk staff review missed-call text conversations
and patient requests, and record the outcome of a follow-up. It is a focused,
front-desk-only area — separate from the owner account — and it intentionally shows
only what you need to help patients.

## Applies to

Front-desk staff who use the workspace to follow up with patients.

## What this means

After a missed-call follow-up text goes out and a patient replies, their request
appears in the workspace as a **patient request card**. The workspace is for
reviewing those replies and tracking your follow-up.

### What you can see

- The patient's phone number.
- The latest patient reply, visible on the selected request without opening the
  full conversation.
- The conversation history (patient and office messages with timestamps).
- A status for each request (see below).
- A short note when patient details have not been collected yet.

### What you cannot see (and why)

The workspace shows only what the front desk needs. It does **not** show billing or
payment details, legal/business registration details, SMS approval controls, owner
setup settings, technical/provider details, or internal record identifiers. Those
belong to the owner account, not the front desk.

### Reading a request card

- **Patient phone** — how to reach the patient.
- **Latest message** — a quick snippet of the most recent activity.
- **Status** — where the request stands. Statuses include: **New**, **Needs
  reply**, **Waiting for patient**, **Ready to call**, **Booked**, and **Closed**.
- **Patient details are not collected yet** — means the system simply does not
  have details such as patient name or request type. It is not an error; confirm
  with the patient if you need it. Do not guess.

### Recording outcomes

You can record the outcome of a follow-up on a real request — for example,
**appointment booked**, **no appointment booked**, or **could not reach the
patient** — plus an optional short note. This helps your team track which patients
still need attention.

### Samples are examples only

Cards labeled **"Sample"** are training examples, not real patients. Do not act on
them.

## What you can do

- Open the workspace to review patient replies and request cards.
- Use **Call patient** to open your device's normal phone dialer for the patient
  number. This does not place an automated call from Missed Calls Dental.
- Follow up with patients through your clinic's normal process. See
  [How front desk should handle patient replies](../missed-calls-and-messages/how-front-desk-should-handle-patient-replies.md).
- Record an outcome and note after you follow up.

## What to expect

- The workspace currently helps you **review** replies and **record outcomes**.
- Sending text replies from the workspace, automated calling, and task assignment
  are not available today — follow up using your normal phone process.
- Always respect patient opt-outs. See
  [Patient opt-out — STOP and START](../missed-calls-and-messages/patient-opt-out-stop-start.md).

## When to contact support

Contact your clinic owner first for access questions. For product issues — for
example, replies or cards not appearing as expected — contact support.

Email: **support@missedcallsdental.com**

## Related articles

- [How front desk should handle patient replies](../missed-calls-and-messages/how-front-desk-should-handle-patient-replies.md)
- [Patient opt-out — STOP and START](../missed-calls-and-messages/patient-opt-out-stop-start.md)

## Source of truth

- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` — workspace scope, request card fields,
  status vocabulary, outcomes, samples, minimum-necessary display
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` — workspace is separate from the owner
  account
