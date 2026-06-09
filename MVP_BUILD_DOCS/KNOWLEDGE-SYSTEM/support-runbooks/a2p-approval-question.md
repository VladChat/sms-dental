---
title: A2P approval question
slug: a2p-approval-question
status: internal
visibility: internal_ops
audience: Internal support / operator
surface: support
category: runbook
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md
  - config/runtime.config.ts
last_verified: 2026-06-09
related:
  - sms-not-sending
  - ../platform-admin/a2p-review-and-submission
---

# A2P approval question

## Purpose

Answer "why is my SMS approval pending / what do I need to provide?" using
customer-safe wording, and verify the internal state correctly.

## Audience / visibility

Internal support / operator. `visibility: internal_ops`. Internal-only.

## Symptom

A clinic asks about the SMS approval step: what it is, what they need to provide,
how long it takes, or why it's still pending.

## Customer-safe explanation

Before a clinic can text patients, the texting service must be approved. The clinic
provides a few business and authorized-contact details; the rest is handled for
them. Approval can take time.

## Internal triage checklist

- Confirm the clinic completed **SMS Approval Information** and what the **Texting**
  status shows (Not active / Waiting for approval / Active).
- In `/admin`, check the SMS approval / A2P state and whether the submission path is
  reviewed/submitted. See
  [../platform-admin/a2p-review-and-submission.md](../platform-admin/a2p-review-and-submission.md).
- Confirm the path: local → A2P 10DLC; toll-free → toll-free verification.
- Confirm readiness comes from the **live** submission, not a mock brand.
- Recall the customer-entered fields (per `SMS-APPROVAL-FIELD-MAPPING.md`): legal
  business name, business type, EIN, authorized representative name/email/phone, and
  the authorization checkbox. Everything else is system-generated.

## What not to expose to the customer

- "A2P / 10DLC / brand / campaign / TCR" jargon, submission modes, allowlists,
  SIDs, the review-package internals, or system-generated field details.
- Do not promise an exact approval date.

## Safe resolution paths

- If fields incomplete: ask the clinic to complete SMS Approval Information.
- If pending: explain approval is required, protects delivery, and can take time;
  "Complete" on the section ≠ texting live (the Texting status is the truth).
- **Never** enable live SMS to bypass a pending/failed approval.

## Escalation criteria

Escalate (engineering / platform admin, redacted detail) if approval is stuck
pending beyond the normal window, readiness looks mock-contaminated, or a live
submission failed.

## Related platform-admin docs

- [../platform-admin/a2p-review-and-submission.md](../platform-admin/a2p-review-and-submission.md)
- [../platform-admin/clinic-console.md](../platform-admin/clinic-console.md)

## Customer-safe response summary

> Before texting patients, your texting service needs SMS approval. You provide a few
> business and authorized-contact details and we handle the rest. After you submit,
> it can take some time. Saving the section shows "Complete," but your **Texting**
> status is what tells you when texting is actually live — it moves to "Active" once
> approval is finished.

## Source of truth

- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md`
- `MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md` (customer-entered vs system-generated)
- `config/runtime.config.ts` (`a2p.submissionMode`, live allowlist — internal only)
