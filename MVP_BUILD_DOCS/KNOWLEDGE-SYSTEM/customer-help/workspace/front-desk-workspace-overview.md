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
last_verified: 2026-06-13
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
- The request queue grouped into **Needs follow-up**, **Handled**,
  **Archived**, and **Blocked** sections.
- Minimal left-side request cards with the patient name when available, phone
  number, and last activity.
- The selected request's summary and conversation history (patient and office
  messages with timestamps) in the detail panel.
- The selected request's patient name or **Not provided**, plus the phone number
  once in the patient header.
- Staff-only notes and follow-up actions.

### What you cannot see (and why)

The workspace shows only what the front desk needs. It does **not** show billing or
payment details, legal/business registration details, SMS approval controls, owner
setup settings, technical/provider details, or internal record identifiers. Those
belong to the owner account, not the front desk.

### Reading a request card

- **Section** — where the request stands: **Needs follow-up**, **Handled**,
  **Archived**, or **Blocked**. The section header is the status, so cards do
  not repeat the same status label.
- **Patient name / phone** — if a safe name is available, it is the title and the
  phone is secondary; otherwise the phone is the title.
- **Last activity** — the most recent saved activity time.
- **Not provided** — means the system does not have a safe patient name. It is
  not an error; confirm directly with the patient if you need it.

Open a card to see the request summary, conversation preview, name edit, actions,
and internal note on the right. The summary is deterministic and not
AI-generated.

### Recording outcomes

You can mark a real request **Handled** and answer **Was appointment booked?**
with **Yes** or **No**. You can also save an optional internal note. This helps
your team track which patients still need attention.

### Samples are examples only

Cards labeled **"Sample"** are training examples, not real patients. Do not act on
them.

## What you can do

- Open the workspace to review patient replies and request cards.
- Expand or collapse the four queue sections. **Needs follow-up** starts open;
  the other sections start collapsed. Use **Load more** when a section has more
  than six cards. **Needs follow-up** is oldest first by last activity; Handled,
  Archived, and Blocked show newest first.
- Use **Call patient** to open your device's normal phone dialer for the patient
  number. This does not place an automated call from Missed Calls Dental.
- Follow up with patients through your clinic's normal process. See
  [How front desk should handle patient replies](../missed-calls-and-messages/how-front-desk-should-handle-patient-replies.md).
- Mark a request **Handled**, **Archive** it, **Reopen** it, or **Block number**
  when appropriate.

## What to expect

- The workspace currently helps you **review** replies and **record outcomes**.
- Sending text replies from the workspace, automated calling, and task assignment
  are not available today — follow up using your normal phone process.
- The workspace is for missed-call recovery replies, not a public texting inbox.
  If a phone number texts the clinic's Missed Calls Dental number without ever
  receiving a recovery text from that clinic, the inbound message is saved and the
  number is blocked for automation. It appears under **Blocked**.
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
