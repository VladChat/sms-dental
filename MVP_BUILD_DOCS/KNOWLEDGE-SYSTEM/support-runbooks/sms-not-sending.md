---
title: SMS not sending
slug: sms-not-sending
status: internal
visibility: internal_ops
audience: Internal support / operator
surface: support
category: runbook
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - AGENTS.md
last_verified: 2026-06-09
related:
  - a2p-approval-question
  - ../platform-admin/a2p-review-and-submission
  - ../platform-admin/clinic-console
---

# SMS not sending

## Purpose

Triage a report that patients are not receiving the missed-call follow-up text, and
resolve or escalate it without bypassing any gate.

## Audience / visibility

Internal support / operator. `visibility: internal_ops`. Internal-only; use the
customer-safe wording when replying to the clinic.

## Symptom

A clinic reports patients are not receiving the missed-call follow-up text, or
"texting isn't working."

## Customer-safe explanation

Texting goes live only after SMS approval is complete and texting is enabled for the
clinic. Until then, calls are still recorded but no patient text is sent. This is by
design and protects message delivery.

## Internal triage checklist

Work the gates in order in `/admin` (use the console, not raw SQL):

1. **SMS approval state** — is the clinic's SMS approval complete, and is readiness
   from the **live** submission (not a mock brand)? See
   [../platform-admin/a2p-review-and-submission.md](../platform-admin/a2p-review-and-submission.md).
2. **Assigned active number** — is a business number assigned and active?
3. **Per-clinic enablement** — is SMS recovery enabled for the clinic
   (`sms_recovery_enabled`)? Safe default is off.
4. **Ops mode** — is `SMS_RECOVERY_MODE=live` (or the clinic in the current
   test-mode allowlist)?
5. **Opt-out** — did the specific patient reply STOP?
6. **Duplicate suppression** — was a recovery SMS already sent to that patient in the
   last 24 hours?
7. **Carrier filtering** — possible for an unverified/unregistered number even when
   gates look correct.

## What not to expose to the customer

- Internal flags, modes, allowlists, provider names, SIDs, raw delivery error codes,
  raw webhooks, or DB internals.
- Whether readiness was "mock-contaminated" — describe it as under review.

## Safe resolution paths

- If SMS approval is incomplete or pending: tell the clinic texting turns on after
  approval; point them to completing SMS Approval Information; do not promise a date.
- If a patient opted out: that is correct behavior; do not re-enable texting to that
  patient. See [../platform-admin/support-boundaries.md](../platform-admin/support-boundaries.md).
- If it was a duplicate within 24h: explain one follow-up per missed call; not an
  error.
- If all gates pass but delivery still fails: treat as possible carrier filtering →
  escalate.
- **Never** enable live SMS, bypass opt-out, or bypass duplicate suppression to
  "test" past a failed/pending state.

## Escalation criteria

Escalate to platform admin / engineering (redacted detail only) if: A2P is stuck
pending, readiness looks mock-contaminated, a number is in
`reconciliation_required`, or all gates appear correct but delivery still fails.

## Related platform-admin docs

- [../platform-admin/a2p-review-and-submission.md](../platform-admin/a2p-review-and-submission.md)
- [../platform-admin/clinic-console.md](../platform-admin/clinic-console.md)

## Customer-safe response summary

> Calls are being recorded, but patient texting turns on only after your SMS
> approval is complete and texting is enabled for your clinic. Your current texting
> status is "[Waiting for approval / Not active]." Once approval is finished we'll
> enable texting and follow up with you.

## Source of truth

- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` (gates, go/no-go)
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` §9 (SMS send model/modes), §10 (opt-out)
- `AGENTS.md` (SMS never auto-enabled)
