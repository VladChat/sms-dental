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
last_verified: 2026-06-10
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

Texting goes live only after SMS approval is complete and texting is active for
the specific business number involved. Until then, calls are still recorded but no
patient text is sent. This is by design and protects message delivery.

## Internal triage checklist

Work the gates in order in `/admin` (use the console, not raw SQL):

1. **SMS approval state** — is the clinic's SMS approval complete, and is readiness
   from the **live** submission (not a mock brand)? See
   [../platform-admin/a2p-review-and-submission.md](../platform-admin/a2p-review-and-submission.md).
2. **Assigned active number** — is a business number assigned and active?
3. **Per-number texting status** — for the called / assigned business number, is
   `clinic_phone_numbers.texting_status='active'`, and is the number still
   `is_active=true` with `removal_status='active'`?
4. **Messaging Service coverage (both number types)** — the phone-number card shows
   a **Ready to send SMS** row and a **Messaging Service** row. A toll-free number
   with approved verification still cannot send until it is in the Messaging
   Service sender pool with fresh readiness data; local numbers also need campaign
   coverage. The blocking reason on the card is the same one the live-send guard
   returns.
5. **Fresh status sync** — if provider approval looks complete but the local row
   is pending or stale, run the admin **Run readiness sync** action once. It uses
   the same read-only sync as the cron. Check provider status / error / last
   synced fields on the phone-number card before escalating.
6. **Per-clinic enablement** — is SMS recovery enabled for the clinic
   (`sms_recovery_enabled`)? Safe default is off.
7. **Ops mode** — is `SMS_RECOVERY_MODE=live` (or the clinic in the current
   test-mode allowlist)?
8. **Opt-out** — did the specific patient reply STOP?
9. **Duplicate suppression** — was a recovery SMS already sent to that patient in the
   last 24 hours?
10. **Carrier filtering** — possible for an unverified/unregistered number even when
    gates look correct. Delivery outcomes are now persisted on the outbound message
    row (status + provider error code) by the status callback, so check the message
    record before assuming carrier filtering.

## What not to expose to the customer

- Internal flags, modes, allowlists, provider names, SIDs, raw delivery error codes,
  raw webhooks, or DB internals.
- Whether readiness was "mock-contaminated" — describe it as under review.

## Safe resolution paths

- If SMS approval is incomplete or pending: tell the clinic texting turns on after
  approval; point them to completing SMS Approval Information; do not promise a date.
- If one assigned number is active and another is pending, triage the specific
  business number involved. Do not infer every number's texting status from the
  clinic-level SMS approval state.
- If the provider shows approval but the number card is still pending, run the
  read-only status sync and review the provider diagnostic fields. Do not set a
  status by hand until the provider state is verified for that exact number.
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
pending, readiness looks mock-contaminated, provider diagnostic errors persist
after a read-only sync, a number is in `reconciliation_required`, or all gates
appear correct but delivery still fails.

## Related platform-admin docs

- [../platform-admin/a2p-review-and-submission.md](../platform-admin/a2p-review-and-submission.md)
- [../platform-admin/clinic-console.md](../platform-admin/clinic-console.md)

## Customer-safe response summary

> Calls are being recorded, but patient texting turns on only after your SMS
> approval is complete and texting is active for that business number. Your current
> texting status for the number is "[Waiting for approval / Not active]." Once
> approval is finished we'll follow up with you.

## Source of truth

- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` (gates, go/no-go)
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` §9 (SMS send model/modes), §10 (opt-out)
- `AGENTS.md` (SMS never auto-enabled)
