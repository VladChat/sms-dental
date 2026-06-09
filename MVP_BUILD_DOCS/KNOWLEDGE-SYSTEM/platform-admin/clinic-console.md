---
title: Platform admin console and clinic management
slug: clinic-console
status: internal
visibility: platform_admin
audience: Platform operator
surface: /admin
category: admin-console
owner: ops
source_of_truth:
  - MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md
  - MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md
last_verified: 2026-06-09
related:
  - phone-number-lifecycle
  - a2p-review-and-submission
  - billing-operations
  - diagnostics-and-audit
  - support-boundaries
---

## Summary

`/admin` is the cross-tenant platform owner/operator console. Its clinic detail
page (`/admin/clinics/[clinicId]`) is an **editable super-admin clinic management
console** — not a read-only report. This doc orients an operator to the console
and points to the per-area runbooks.

## Applies to

The platform operator signed in at `/admin/login`. Authorization is
`resolvePlatformAdmin()` (authenticated email in `PLATFORM_ADMIN_EMAILS` OR
`profiles.is_internal_admin`). Clinic membership does **not** grant admin access.

## The three surfaces (do not mix)

- `/account` — clinic **owner/admin** dashboard (per-clinic).
- `/workspace` — **front-desk** operational view (per-clinic).
- `/admin` — **platform owner/operator** console (cross-tenant). ← this console.

## Console pages

- `/admin` — operations overview (KPIs, recent failures).
- `/admin/clinics` — all clinics; server-side search + status filters.
- `/admin/clinics/[clinicId]` — editable management console (see below).
- `/admin/clinics/[clinicId]/events` — redacted call/message/webhook diagnostics.
- `/admin/audit` — platform admin audit log (`admin_audit_events`).

## Clinic management console — sections

The clinic detail page is an owner-`/account`-style dashboard (left section nav,
one focused panel). Sections (default opens on the current blocker, typically
Phone number):

- **Phone number** — assigned numbers (masked), search/select, gated
  purchase/assign, detach. See
  [phone-number-lifecycle.md](phone-number-lifecycle.md).
- **Business profile** — editable owner-level business fields (audited save).
- **SMS approval** — editable A2P/representative data (audited save; saving stores
  data only, never submits to a carrier). See
  [a2p-review-and-submission.md](a2p-review-and-submission.md).
- **Billing** — billing state (presence only). See
  [billing-operations.md](billing-operations.md).
- **SMS behavior** — read-only for now (no settings backend).
- **Admin tools** — Pause/Reactivate clinic, Launch service / Pause SMS sending,
  Internal note; plus collapsible Recent admin activity, Diagnostics (masked), and
  Technical details (collapsed).

## What is editable vs blocked

- **Editable now (audited):** Business profile fields, A2P/representative data,
  internal note, clinic active/paused, SMS recovery enable/disable (gated),
  Twilio number purchase/assign (behind `TWILIO_NUMBER_PURCHASE_ENABLED`), detach.
- **Blocked-with-reason (never simulated):** Stripe billing management, A2P carrier
  submission from this panel, and any action whose real backend does not exist.
  Each shows the exact blocking reason.

## Expected result

Every write action mirrors the owner-side validation, is scoped to the one
`clinicId`, and writes an `admin_audit_events` row. Audit metadata stores changed
field names + flags only — never raw EIN/phone/email values.

## Escalation

If an action that should work is blocked, or a gate appears wrong, escalate to
engineering rather than forcing it. Never bypass `resolvePlatformAdmin` or the
opt-out/SMS gates.

## Safety notes

No secrets in the console or in these docs. Redaction is mandatory: phones masked
to last 4, SID tails only, no raw payloads, EIN/representative as presence only.

## Source of truth

- `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` (§4 routes, §15–22 implemented)
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` (§17–20 admin auth)
