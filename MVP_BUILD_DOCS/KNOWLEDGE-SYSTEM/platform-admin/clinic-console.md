---
title: Platform admin console and clinic management
slug: clinic-console
status: internal
visibility: platform_admin
audience: Platform admin / operator
surface: /admin
category: admin-console
owner: ops
source_of_truth:
  - MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md
  - MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md
last_verified: 2026-06-14
related:
  - phone-number-lifecycle
  - a2p-review-and-submission
  - billing-operations
  - diagnostics-and-audit
  - support-boundaries
---

# Platform admin console and clinic management

## Summary

`/admin` is the cross-tenant platform owner/operator console. Its clinic detail
page (`/admin/clinics/[clinicId]`) is an **editable super-admin clinic management
console** — not a read-only report. This doc orients an operator to the console
and points to the per-area docs.

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

## Clinic management console — sections (conceptual)

The clinic detail page is an owner-`/account`-style dashboard (left section nav,
one focused panel). It opens by default on the current blocker (typically Phone
number). Sections:

- **Phone number** — assigned numbers (masked), search/select, gated
  purchase/assign, detach. See
  [phone-number-lifecycle.md](phone-number-lifecycle.md).
- **Business profile** — editable owner-level business fields (audited save).
- **SMS approval / A2P review** — editable A2P/representative data (audited save;
  saving stores data only, **never** submits to a carrier). See
  [a2p-review-and-submission.md](a2p-review-and-submission.md).
- **Billing** — billing state/presence only. See
  [billing-operations.md](billing-operations.md).
- **SMS behavior** — read-only. Status: not implemented yet (no settings backend).
- **Admin tools / diagnostics** — Pause/Reactivate clinic, Launch service / Pause
  SMS sending, Internal note, and the Danger zone **Delete clinic** action; plus
  collapsible Recent admin activity, Diagnostics (masked), and Technical details
  (collapsed). See
  [diagnostics-and-audit.md](diagnostics-and-audit.md).

## What is implemented vs blocked/future

**Editable now (audited):** Business profile fields, A2P/representative data,
internal note, clinic active/paused, SMS recovery enable/disable (gated), Twilio
number purchase/assign (behind `TWILIO_NUMBER_PURCHASE_ENABLED`), detach, safe
app-database-only clinic delete from Admin tools -> Danger zone.

**Blocked-with-reason (never simulated):**

- Stripe billing management (collect/start/pause) — **Status: not implemented
  yet** (no real billing backend).
- A2P carrier submission from the panel — gated/allowlisted; **this remains a
  future milestone** for general clinics (see
  [a2p-review-and-submission.md](a2p-review-and-submission.md)).
- Per-clinic SMS behavior settings — **Status: not implemented yet**.

Each blocked action is shown disabled with its exact reason; it is never faked.

## Access boundaries

- `/admin` and every `/api/admin/*` route are guarded server-side by
  `resolvePlatformAdmin`. Clinic owners and front desk are denied; a platform
  admin with no clinic membership is allowed.
- Cross-tenant data is read via the service-role connection (which bypasses RLS),
  so the admin guard is the **only** protection — it is mandatory on the layout and
  every admin API route.

## Safe operator behavior

- Make the smallest change needed; rely on the in-console confirmations for
  state-changing actions.
- Never bypass `resolvePlatformAdmin`, the SMS/opt-out gates, or a blocked action.
- Every write mirrors the owner-side validation, is scoped to the one `clinicId`,
  and writes an `admin_audit_events` row (changed field names + flags only — never
  raw EIN/phone/email).

## Delete clinic danger zone

`Delete clinic` lives only on `/admin/clinics/[clinicId]` under Admin tools ->
Danger zone. It is for explicitly authorized app-database cleanup, usually test
or development clinic cleanup. It is not available from the clinic list table.

The delete flow runs preflight first, then opens an accessible confirmation
dialog. The operator must type `DELETE` exactly. Server-side routes use
`resolvePlatformAdmin()` and the URL clinic id only.

Deletion is app-database-only. It does **not** call Twilio, Stripe, Vercel, DNS,
Supabase management APIs, SMS send paths, provider release/cancel/refund flows,
or `webhook_events`.

The preflight blocks unsafe clinics, including active SMS recovery, active or
provider-linked phone numbers, Stripe/billing state, provider-linked number
purchase or SMS approval state, schema inspection failures, and unknown
clinic-linked rows outside the explicit delete list.

For the operator checklist and full blocker categories, see
`MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` ("Admin clinic deletion danger zone").

## Before changing admin behavior (source files to check)

- `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` (§4 routes/pages, §6 action
  matrix, §15–22 implemented scope)
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` (§17–20 admin auth + role entry
  points)
- The relevant per-area doc in this folder.

## Escalation

If an action that should work is blocked, or a gate appears wrong, escalate to
engineering rather than forcing it.

## Source of truth

- `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` (§4 routes, §15–22 implemented)
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` (§17–20 admin auth)
