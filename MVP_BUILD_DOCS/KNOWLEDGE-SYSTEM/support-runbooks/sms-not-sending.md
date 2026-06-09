---
title: SMS not sending
slug: sms-not-sending
status: internal
visibility: internal_ops
audience: Support / platform operator
surface: support
category: runbook
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
last_verified: 2026-06-09
related:
  - a2p-approval-question
  - ../platform-admin/a2p-review-and-submission
---

## Symptom

A clinic reports that patients are not receiving the missed-call follow-up text,
or "texting isn't working."

## Customer-safe explanation

Texting goes live only after SMS approval is complete and texting is enabled for
the clinic. Until then, calls are still recorded but no patient text is sent. This
is by design and protects message delivery.

## Likely causes (most → least common)

1. **SMS approval not complete / still waiting** — the clinic hasn't finished the
   SMS approval step, or approval is pending.
2. **Texting not enabled for the clinic** — `clinics.sms_recovery_enabled` is
   false (the safe default).
3. **Ops mode not live** — `SMS_RECOVERY_MODE` is not `live` (or the clinic isn't
   in the allowlist for the current test mode).
4. **No assigned/active business number** for the clinic.
5. **Patient opted out** — the patient replied STOP.
6. **Duplicate suppression** — one recovery SMS per (clinic, patient) per 24h.
7. **Carrier filtering** for an unverified/unregistered number.
8. **Readiness contaminated by a mock A2P brand** — looks approved but the live
   brand failed.

## Triage questions (customer-safe)

- Have you completed the SMS approval step? What does the **Texting** status show
  (Not active / Waiting for approval / Active)?
- Is a business number assigned and active on the account?
- Did the specific patient possibly reply STOP earlier?
- Is this the first text to that patient in the last 24 hours?

## Safe checks (internal)

- Open the clinic in `/admin` and check launch readiness: business profile, phone
  number, A2P/SMS approval, SMS launch state. Use the console, not raw SQL.
- Confirm gates in order: A2P/approval state → assigned active number →
  `sms_recovery_enabled` → ops `SMS_RECOVERY_MODE=live`.
- Check redacted diagnostics for opt-out state and recent message status/keyword.
- Verify readiness comes from the **live** A2P submission, not a mock brand SID
  (see [../platform-admin/a2p-review-and-submission.md](../platform-admin/a2p-review-and-submission.md)).

## Do not

- Do not enable live SMS to "test" it past a failed/pending A2P state.
- Do not bypass opt-out or duplicate suppression.
- Do not expose SIDs, raw delivery error codes, modes, or allowlists to the
  customer.

## Escalation

Escalate to platform admin/engineering if: A2P is stuck pending, readiness looks
mock-contaminated, a number is in `reconciliation_required`, or all gates appear
correct but delivery still fails (possible carrier filtering). Provide redacted
detail only.

## Customer-safe response summary

> Calls are being recorded, but patient texting turns on only after your SMS
> approval is complete and texting is enabled for your clinic. Your current
> texting status is "[Waiting for approval / Not active]". Once approval is
> finished we'll enable texting; we'll follow up with you on the timeline.

## Source of truth

- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` (gates, go/no-go)
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` §9 (SMS send model, modes), §10 (opt-out)
