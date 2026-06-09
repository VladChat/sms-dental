---
title: Number removal / restore / detach question
slug: number-removal-restore-detach
status: internal
visibility: internal_ops
audience: Support / platform operator
surface: support
category: runbook
owner: support
source_of_truth:
  - AGENTS.md
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
last_verified: 2026-06-09
related:
  - ../platform-admin/phone-number-lifecycle
  - billing-question
---

## Symptom

A clinic asks to remove a number, restore a number they removed, or asks why a
number disappeared / is still being billed.

## Customer-safe explanation

Removing a number stops its calls and texting right away. The number stays
restorable for a short period before it is permanently removed. Billing changes
take effect on the next cycle.

## Likely causes / scenarios

1. Wants to **remove** a number (stop using it).
2. Removed a number and wants to **restore** it.
3. Removed a number and asks about a **refund** for the current cycle.
4. A number was **detached** by an operator (assignment removed, returned to
   inventory) — usually an internal action, not a customer one.
5. Confusion between suspend (admin pause) and remove (customer lifecycle).

## Triage questions (customer-safe)

- Which number, and what do you want — stop using it, or bring a removed one back?
- For restore: when did you remove it? (Restore is only possible before permanent
  removal.)

## Safe checks (internal)

- In `/admin`, check the number's lifecycle state: active, suspended, scheduled
  removal (and `permanent_removal_at`), permanently removed, or detached. See
  [../platform-admin/phone-number-lifecycle.md](../platform-admin/phone-number-lifecycle.md).
- Restore is allowed **only** while scheduled, before `permanent_removal_at`, and
  before Twilio release completed.
- Billing: current cycle still counts scheduled removals as held; next cycle
  excludes them.

## Key rules to communicate

- Action is **"Remove number"**, never "Release". Removal stops routing
  immediately.
- **No fixed restore window** — do not promise "30 days." It is an estimated
  pre-renewal deadline.
- **No immediate refund/credit/charge** from remove/restore; billing changes apply
  next cycle (`proration_behavior:"none"`).
- After permanent removal, the number cannot be restored — a new number must be
  added.

## Do not

- Do not promise a specific restore window or a refund.
- Do not manually clear reconciliation/release state.
- Do not expose SIDs, Stripe internals, or the release-job mechanics.

## Escalation

Escalate if a number is stuck in `reconciliation_required`, a Twilio release
failed, or a customer needs a restore after permanent removal. Engineering only;
redacted detail.

## Customer-safe response summary

> Removing a number stops its calls and texting right away, and it stays
> restorable until it's permanently removed (this is an estimated window, not a
> fixed number of days). Billing changes show on your next cycle — removing a
> number doesn't create an immediate refund or credit. If you'd like, I can check
> the current status of your number.

## Source of truth

- `AGENTS.md` — "Phone Number Removal Lifecycle"
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — removal + next-cycle billing
