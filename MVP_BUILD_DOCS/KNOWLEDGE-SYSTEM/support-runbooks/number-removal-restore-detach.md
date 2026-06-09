---
title: Number removal / restore / detach question
slug: number-removal-restore-detach
status: internal
visibility: internal_ops
audience: Internal support / operator
surface: support
category: runbook
owner: support
source_of_truth:
  - AGENTS.md
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
last_verified: 2026-06-09
related:
  - billing-question
  - ../platform-admin/phone-number-lifecycle
---

# Number removal / restore / detach question

## Purpose

Handle questions about removing a number, restoring a removed number, or why a
number changed — using the correct lifecycle terms and next-cycle billing rules.

## Audience / visibility

Internal support / operator. `visibility: internal_ops`. Internal-only.

## Symptom

A clinic asks to remove a number, restore a removed number, or asks why a number
disappeared or is still being billed.

## Customer-safe explanation

Removing a number stops its calls and texting right away. The number stays
restorable for a limited time before it is permanently removed. Billing changes take
effect on the next cycle.

## Internal triage checklist

- Confirm what the clinic wants: stop using a number (Remove), bring a removed one
  back (Restore), or a billing question about a change.
- In `/admin`, check the number's lifecycle state: active, suspended, scheduled
  removal, permanently removed, or detached. See
  [../platform-admin/phone-number-lifecycle.md](../platform-admin/phone-number-lifecycle.md).
- For restore: confirm the number is still scheduled (not yet permanently removed /
  released). Restore is only possible before permanent removal completes.
- For billing: current cycle still counts a scheduled-removal number as held; next
  cycle excludes it.
- Distinguish the operations: **Remove** (customer, schedules provider release),
  **Suspend** (admin pause, keeps billing/limit), **Detach** (admin, removes clinic
  assignment, returns number to inventory, no release).

## What not to expose to the customer

- Provider SIDs, the release job, reconciliation mechanics, Messaging Service, or
  billing-provider internals.
- The admin-only Suspend/Detach operations as if they were customer actions.

## Safe resolution paths

- Remove: confirm it stops service immediately and is restorable until permanent
  removal; bill changes next cycle.
- Restore (still scheduled): can be restored; it returns in its prior state and does
  not by itself enable texting.
- Restore after permanent removal: not possible — a new number must be added.
- Billing concern from a change: explain current vs next cycle; **no immediate
  refund/credit**.
- **Never** promise a fixed restore window or a refund, and **never** manually clear
  a preserved SID / release error / `reconciliation_required` state.

## Escalation criteria

Escalate (engineering, redacted detail) if a number is stuck in
`reconciliation_required`, a provider release failed, or the clinic needs a number
back after permanent removal.

## Related platform-admin docs

- [../platform-admin/phone-number-lifecycle.md](../platform-admin/phone-number-lifecycle.md)
- [../platform-admin/billing-operations.md](../platform-admin/billing-operations.md)

## Customer-safe response summary

> Removing a number stops its calls and texting right away, and it stays restorable
> until it's permanently removed (this is an estimated window, not a fixed number of
> days). Billing changes show on your next cycle — removing a number doesn't create
> an immediate refund or credit. I can check the current status of your number.

## Source of truth

- `AGENTS.md` — "Phone Number Removal Lifecycle"
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — removal + next-cycle billing
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — routing/release behavior
