---
title: Phone number lifecycle and admin operations
slug: phone-number-lifecycle
status: internal
visibility: platform_admin
audience: Platform admin / operator
surface: /admin
category: lifecycle
owner: ops
source_of_truth:
  - AGENTS.md
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md
last_verified: 2026-06-10
related:
  - clinic-console
  - billing-operations
  - support-boundaries
---

# Phone number lifecycle and admin operations

## Summary

The full lifecycle of a clinic business number and the distinct operations that
act on it. **Remove, Restore, Suspend, and Detach are different operations — do
not conflate them.** Customer "Remove number" is a lifecycle removal; provider
release happens later. Suspend and Detach are platform-admin operations.

## Applies to

Platform operators managing numbers from `/admin/clinics/[clinicId]` → Phone
number, and operators backing the
[number-removal-restore-detach runbook](../support-runbooks/number-removal-restore-detach.md).

## Number types (durable)

Every number has a durable `number_type`: `toll_free` or `local`.

- First toll-free number: **included in plan**. Additional toll-free: paid add-on.
- Local number: **always a paid add-on** (even the first, even during trial)
  because of A2P 10DLC registration/compliance.
- Toll-free uses toll-free verification; local uses A2P 10DLC Brand/Campaign. The
  A2P submission package contains **local numbers only**; toll-free numbers are
  never added to a local A2P campaign.
- Type, slot class (included vs additional), price, billing quantity, and
  lifecycle state are decided **server-side only**. The client never decides them.
  Billing amounts come from `config/billing.config.ts` — never hard-coded.

## Lifecycle states

- **Active** — assigned and eligible for routing under the normal routing gates.
  This lifecycle state is separate from per-number texting approval/capability.
- **Suspended** — paused by admin within the same clinic; routing inactive; the
  number, billing quantity, and limit count are kept (still billed, still counts
  toward the limit).
- **Scheduled removal** — customer removed the number; routing stopped immediately;
  the row remains assigned, visible, and restorable until permanent removal.
- **Permanently removed** — terminal state after the provider release completed
  (handled by the secured release job). Not restorable.
- **Detached** — admin removed the clinic assignment without releasing the provider
  number; the number returns to assignable inventory.

Number rows/history are **never physically deleted** — lifecycle history is
preserved internally for audit/reconciliation. If a delayed provider release
fails, the existing SID and release error are preserved for reconciliation; do not
clear or overwrite them.

## Texting approval/capability status

Each `clinic_phone_numbers` row has its own texting approval/capability fields:
`texting_status`, `texting_status_source`, and `texting_status_updated_at`.
Allowed statuses are `preparing`, `waiting_for_approval`, `active`, and `failed`.
Provider diagnostics are stored separately in `texting_provider_status`,
`texting_provider_error_code`, `texting_provider_error_message`, and
`texting_provider_synced_at`; these help operators diagnose pending/failed states
without changing routing, billing, or lifecycle.

Do not use `clinics.sms_status` as the customer-facing status for every number.
`clinics.sms_status` remains the clinic-wide SMS approval / local A2P workflow
state. Owner-facing number cards combine lifecycle and capability: a number with
`is_active=false` or `removal_status='scheduled'` renders texting as not active
even if its stored `texting_status` is `active`.

Assignment defaults are conservative: owner-purchased numbers, admin-assigned
existing numbers, and reassigned detached rows start as
`texting_status='waiting_for_approval'`, source `assignment_default`. Toll-free
rows become `active` only after a reliable number-specific toll-free verification
source confirms approval. Local rows may become `active` only from a reliable
local/A2P success transition for the covered active local numbers.

The automatic sync service is the normal source of updates:

- toll-free numbers read Twilio Toll-Free Verification status for that PN SID;
- local numbers read the existing A2P/Messaging Service readiness model;
- the protected cron performs bounded stale-row reconciliation;
- number purchase/assignment/restore and live A2P refresh/submit success trigger
  best-effort immediate sync;
- the admin **Run readiness sync** button calls the same service as a fallback.

Do not manually mark a number active unless provider approval for that exact
number has been independently verified and the automatic sync path is unavailable.

## Operations at a glance

| Action | Actor | Immediate effect | Provider release? | Billing effect | Restorable? | Customer-facing? |
|---|---|---|---|---|---|---|
| Remove number | Clinic owner | Stops calls/text routing immediately; schedules removal | No — delayed until permanent removal | Next cycle only; no immediate refund/credit/charge | Yes, until permanent removal completes | Yes — action is "Remove number" |
| Restore number | Clinic owner | Resumes prior state/role | N/A — not yet released | Re-included next cycle | N/A | Yes |
| Suspend number | Platform admin | Pauses routing within the same clinic | No | Still billed; still counts toward limit | Yes — via reactivate | No (admin-only) |
| Detach from clinic | Platform admin | Removes clinic assignment; returns number to assignable inventory | No — provider number kept | No change by itself (billing quantity / Messaging Service unchanged) | Re-assignable to a clinic (not the customer "restore" flow) | No (admin-only) |
| Permanently removed | System (release job) | Provider number released; terminal state | Yes — release completed | Excluded going forward | No | Reflects the prior customer Remove |
| Assign existing number | Platform admin | Maps a number to the clinic and configures webhooks | N/A — assign, not release | Per number type/slot, server-side | N/A | No (admin-only); result visible to owner |

## Operation details

### Remove number (customer lifecycle removal)
Customer-facing action text is **"Remove number"**, never "Release number". It
**immediately** stops calls/texting routing for that number and schedules removal.
Provider release is **delayed** until permanent removal — customer removal does not
release the provider number right away. The restore window is an **estimated
pre-renewal deadline**, not a fixed grace period; **do not promise a fixed window**
(e.g. "30 days"). Billing changes apply **next cycle only**; no immediate
refund/credit/charge.

### Restore number
Allowed **only** while the row is still scheduled, before the estimated permanent
removal time, and before provider release has completed. After permanent removal,
not restorable — a new number must be added.

### Suspend number (admin)
Same-clinic pause. Keeps the number, the billing quantity, and the limit count. No
provider release. Reversible via reactivate. A suspended number is still billed and
still counts toward the clinic's number limit.

### Detach from clinic (admin)
Removes the **clinic assignment** without releasing the provider number and without
changing billing quantity / the Messaging Service by itself. Keeps the row and
history for audit, and returns the eligible number to **assignable inventory** so
it can be assigned to a clinic later. Distinct from Remove (which schedules
provider release) and from Suspend (which keeps the same-clinic assignment).

### Assign existing number (admin)
From the Phone number panel: search → select → confirm → assign (including an
already-owned/detached number). Same provisioning architecture as onboarding.
Gated by `TWILIO_NUMBER_PURCHASE_ENABLED`; when off, the action is blocked with a
reason — no provider call, no DB write. On success it configures Voice/SMS
webhooks, attaches the Messaging Service best-effort, stores the mapping, and
writes an audit row. The number's texting status starts as
`waiting_for_approval`. **SMS recovery is not enabled by assignment.**

## Limits

Default cap is **5 total held** business numbers per clinic
(`defaultSelfServiceBusinessNumberLimit`). Held = assigned (active or suspended) +
purchased-but-awaiting-reconciliation. A platform admin can raise the limit (1–100,
never below the held count).

## Customer-safe explanation vs internal explanation

- **Customer-safe:** "Removing a number stops its calls and texting right away, and
  it stays restorable until it's permanently removed. Billing changes show on your
  next cycle." No mention of providers, SIDs, release jobs, or reconciliation.
- **Internal:** the scheduled-removal state, the estimated provider-release
  deadline, the release job, and reconciliation handling — for operators only.

### What NOT to say to customers
- Do not say "Release number" — the customer action is "Remove number".
- Do not promise a fixed restore window (e.g. "30 days").
- Do not promise a refund or credit from remove/restore.
- Do not mention provider SIDs, the release job, Messaging Service, or
  reconciliation mechanics.
- Do not describe Suspend/Detach as customer actions — they are admin-only.

### What NOT to do operationally
- Do not manually clear or overwrite a preserved SID / release error or a
  `reconciliation_required` state.
- Do not set `clinics.sms_status='active'` to make one assigned number look
  approved. Update that number's own `texting_status` only after provider
  verification.
- Do not force a provider release outside the secured release job.
- Do not use Detach when the customer asked to keep the number (Suspend or leave
  active instead), and do not use Remove when only a pause is intended.
- Do not bypass `TWILIO_NUMBER_PURCHASE_ENABLED` or assign/purchase outside the
  gated flow.

## Escalation

If a provider release failed, a number is stuck in `reconciliation_required`, or a
customer needs a number back after permanent removal, escalate to engineering with
redacted detail (masked phone, SID tail). Do not attempt manual recovery.

## Source of truth

- `AGENTS.md` — "Toll-free vs Local Number Model" and "Phone Number Removal
  Lifecycle"
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — removal/next-cycle billing, suspend
  behavior, local vs toll-free
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — routing/release behavior
- `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` §21–22 — admin
  purchase/assign/search; detach is the admin assignment-removal operation
