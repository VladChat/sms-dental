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
last_verified: 2026-06-13
related:
  - front-desk-workspace-overview
  - ../missed-calls-and-messages/how-front-desk-should-handle-patient-replies
---

# Understanding patient request statuses

## Summary

The **workspace** groups patient request cards into sections that tell the front
desk where each request stands. This article explains what each section means so
you can quickly see what needs attention — and what **Not provided** means.

## Applies to

Front-desk staff using the workspace to review patient replies and requests.

## What this means

The workspace uses three visible sections:

- **Needs follow-up** — active work for the front desk. This section starts open.
  It includes active requests whether the latest message is from the patient or
  from the office.
- **Handled** — staff marked the request handled and recorded whether an
  appointment was booked.
- **Blocked** — staff blocked automated texts to that patient/caller phone number
  for this clinic, or the system auto-blocked an inbound-only SMS number that had
  never received a missed-call recovery text from this clinic. Messages stay
  saved, and inbound messages can still be recorded.

The section header is the status. Cards inside a section do not repeat the same
status label. Left-side cards show only the name when available, the phone
number, and last activity. Open the card to read the request summary and
Activity & SMS audit trail in the detail panel before you act.

### What "Not provided" means

The patient name may show **Not provided**. That means the patient has not given a
safe name, or the stored text does not look like a name. It is **not** an error
and not something to guess at. If you need the name, confirm it directly with the
patient or use the inline name edit after you know it.

### What not to assume

- Do not assume a section means more than it says. **Handled** means staff marked
  the request handled; it does not replace your office's scheduling records.
- Do not infer medical details from a status or a short message.
- Do not treat **Sample** cards as real patients — they are labeled examples only.

## What you can do

- Start with **Needs follow-up**. It is expanded by default and is the main work
  area. It is oldest first by last activity.
- Expand **Handled** or **Blocked** when you need older or completed requests.
  These sections are newest first. If a section has many cards, use **Load more**.
- Open a card and read the conversation before following up.
- Follow up with the patient using your clinic's normal process, and mark the
  request **Handled** when done. See
  [How front desk should handle patient replies](../missed-calls-and-messages/how-front-desk-should-handle-patient-replies.md).
- If a patient's message sounds urgent or describes a medical or emergency
  situation, follow your clinic's normal phone and emergency process — do not handle
  it over text.

## What to expect

- The workspace helps you **review** requests and **record outcomes**. Sending text
  replies from the workspace, automated calling, and task assignment are not
  available today. The **Call patient** action is a normal phone link for your
  device; it does not place an automated call.
- A request can move between sections when staff use Handled, Reopen, Block
  number, or Unblock number. Inbound-only SMS numbers with no prior
  recovery-text history from this clinic can also move directly to Blocked after
  the inbound message is saved.
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

- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` — queue sections, conservative
  derivation, outcomes, "Not provided", samples
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — scheduling focus; no medical advice
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — reply handling behavior
