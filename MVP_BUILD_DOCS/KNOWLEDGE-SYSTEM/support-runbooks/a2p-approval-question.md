---
title: A2P approval question
slug: a2p-approval-question
status: internal
visibility: internal_ops
audience: Support / platform operator
surface: support
category: runbook
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md
last_verified: 2026-06-09
related:
  - sms-not-sending
  - ../platform-admin/a2p-review-and-submission
---

## Symptom

A clinic asks about the SMS approval step: what it is, what they need to provide,
how long it takes, or why it's still pending.

## Terminology

Use **"SMS approval"** with the customer. "A2P / 10DLC" is internal/registration
terminology — keep it out of customer-facing replies.

## Customer-safe explanation

Before a clinic can text patients, the texting service must be approved. The
clinic provides a few business and contact details; the rest is handled for them.
Approval can take a few business days.

## Likely causes / scenarios

1. Doesn't know what SMS approval is or why it's required.
2. Unsure what information to enter.
3. Approval pending and asking about timing.
4. Saved the section, sees "Complete", but texting still isn't live.

## Triage questions (customer-safe)

- Have you filled in the SMS approval section (business and authorized-contact
  details)?
- What does the **Texting** status show?

## Safe checks (internal)

- In `/admin`, check the SMS approval / A2P state and whether the submission path
  is reviewed/submitted. See
  [../platform-admin/a2p-review-and-submission.md](../platform-admin/a2p-review-and-submission.md).
- Confirm local vs toll-free path (local = A2P 10DLC; toll-free = toll-free
  verification).
- Confirm readiness comes from the **live** submission, not a mock brand.

## Key rules to communicate

- Customer-entered fields only (per `SMS-APPROVAL-FIELD-MAPPING.md`): legal
  business name, business type, EIN, authorized representative name/email/phone,
  and the authorization checkbox. Everything else is system-generated.
- Saving the section shows "Complete", but the separate **Texting** status
  (Not active → Waiting for approval → Active) is the real state. "Complete" ≠
  "texting is live."
- Approval is required and protects delivery; it is not instant.

## Do not

- Do not use "A2P/10DLC/brand/campaign/TCR" jargon with the customer.
- Do not promise an exact approval date.
- Do not enable live SMS to bypass a pending/failed approval.
- Do not expose internal submission fields, SIDs, or modes.

## Escalation

Escalate if approval is stuck pending beyond the normal window, readiness looks
mock-contaminated, or live submission failed. Engineering/platform admin; redacted
detail.

## Customer-safe response summary

> Before texting patients, your texting service needs SMS approval. You provide a
> few business and authorized-contact details and we handle the rest. After you
> submit, it can take a few business days. Saving the section shows "Complete," but
> your **Texting** status is what tells you when texting is actually live — it will
> move to "Active" once approval is finished.

## Source of truth

- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md`
- `MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md`
