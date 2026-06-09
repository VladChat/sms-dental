---
title: Platform-admin support boundaries
slug: support-boundaries
status: internal
visibility: platform_admin
audience: Platform admin / operator
surface: /admin
category: boundaries
owner: ops
source_of_truth:
  - MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md
  - MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md
  - MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md
last_verified: 2026-06-09
related:
  - clinic-console
  - phone-number-lifecycle
  - a2p-review-and-submission
  - billing-operations
---

# Platform-admin support boundaries

## Summary

What a platform operator may and may not do, what is safe to say to customers, and
when to escalate. Use this to stay inside the guardrails when acting on a clinic at
a customer's request.

## Applies to

All platform operator work in `/admin`, and operators supporting clinics via the
[support runbooks](../support-runbooks/README.md).

## Role boundaries — front desk vs owner vs platform admin

- **Front desk (`/workspace`)** — patient replies/requests only. Must **never** see
  billing, EIN/legal details, SMS approval controls, owner setup, provider
  technical details, internal IDs, or raw records.
- **Clinic owner (`/account`)** — their own clinic's profile, numbers, SMS approval,
  and billing. Owners must **not** see `/admin`.
- **Platform admin (`/admin`)** — cross-tenant operations, diagnostics (redacted),
  audit. Platform-admin status is **not** clinic-owner access, and clinic-owner
  status is **not** platform-admin access.

Never use one role's access to do another role's job, and never imply a front-desk
user can see owner-only data.

## May do (audited)

- View redacted diagnostics and the audit log.
- Edit/save Business profile and A2P/representative data (stores data only).
- Update the internal note.
- Pause / reactivate a clinic.
- Disable SMS recovery (always safe); enable SMS recovery only when all gates pass
  (active + assigned number + A2P info complete + ops `SMS_RECOVERY_MODE=live`).
- Search / assign / detach / suspend numbers (assignment gated by
  `TWILIO_NUMBER_PURCHASE_ENABLED`).
- Resend the setup link (rate-limited; token never logged) — where implemented.

## Must NOT do

- Bypass `resolvePlatformAdmin` or act without an authorized session.
- Bypass opt-out (STOP/START) or the SMS gates to "make texting work".
- Submit live A2P for a non-allowlisted clinic, or enable live SMS on a
  mock/approved-looking brand.
- Make live billing changes (test-mode only; live needs a separate approved
  rollout).
- Expose secrets, raw payloads, full SIDs/EIN, tokens, or other clinics' data.
- Promise refunds/credits, or promise exact approval timing.

## Blocked-by-design (shown disabled with exact reason — never simulate)

- Billing management (collect/start/pause) — **Status: not implemented yet**.
- Real A2P carrier submission from the panel — gated/allowlisted; **future
  milestone** for general clinics.
- Number purchase when `TWILIO_NUMBER_PURCHASE_ENABLED` is off.

When an action is blocked, communicate the reason; do not force a workaround.

## Customer-safe wording vs internal-only wording

- **Customer-safe:** "SMS approval", "business number", "texting service", "current
  billing period / next cycle", "we'll review your account status."
- **Internal-only (never to customers):** A2P/10DLC/brand/campaign, provider names,
  SIDs, submission modes, allowlists, billing-provider IDs, release-job /
  reconciliation mechanics, internal flags, gates.

Each support runbook ends with a customer-safe response summary — use that wording
with customers, not the internal triage detail.

## What only developer/operator should investigate

- Stuck `reconciliation_required` numbers, failed provider releases, quantity
  mismatches, apparent double-billing.
- A2P submissions stuck pending or readiness contaminated by a mock brand.
- Reset emails consistently failing, or membership/role that looks wrong.
- Anything needing a blocked backend, a schema change, or a live provider action.

## Escalation

Escalate the items above to engineering with **redacted detail only** (masked
numbers, SID tails, audit references). Never paste tokens, secrets, or raw payloads.

## Source of truth

- `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` §6 (action matrix), §9
  (existing-feature protection), §10 (security/privacy)
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` §17 (role separation / entry points)
- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` (front-desk minimum-necessary boundary)
