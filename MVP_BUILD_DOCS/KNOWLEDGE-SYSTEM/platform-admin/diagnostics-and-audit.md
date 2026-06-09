---
title: Diagnostics and audit boundaries
slug: diagnostics-and-audit
status: internal
visibility: platform_admin
audience: Platform operator
surface: /admin
category: diagnostics
owner: ops
source_of_truth:
  - MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md
last_verified: 2026-06-09
related:
  - clinic-console
  - support-boundaries
---

## Summary

What the admin diagnostics expose, the mandatory redaction rules, and how the
audit log works. Diagnostics are for triage — they must never leak secrets or raw
private data.

## Applies to

`/admin/clinics/[clinicId]` → Diagnostics and `/admin/clinics/[clinicId]/events`,
plus `/admin/audit`.

## What diagnostics show

- Redacted call/message/webhook activity for a clinic: type, status, timestamp,
  masked numbers; opt-out state; setup status; a link to public business pages.
- Patient message **bodies** are sensitive: prefer status/keyword over full body
  where the task allows; treat any body shown as sensitive and minimal.

## Mandatory redaction

- Phone numbers masked (last 4).
- Twilio SIDs shown as a short tail only.
- **No raw payloads**: `webhook_events.payload`, `messages.raw_payload`,
  `call_events.raw_payload` are never rendered raw — only safe fields.
- EIN and A2P representative shown as **presence only**, never full values.
- No setup/recovery tokens, no secrets, ever.

The admin guard (`resolvePlatformAdmin`) is the **only** thing protecting
cross-tenant data (service-role reads bypass RLS), so it is mandatory on the
layout and every `/api/admin/*` route. Defense-in-depth: redact at the data layer
too.

## Audit log

- Every admin **write** action writes an `admin_audit_events` row (time, actor
  email, action, target, clinic, summary, redacted metadata).
- Metadata stores **changed field names + flags only** — never raw EIN/phone/email
  values, never secrets, never raw payloads.
- Append-only by convention (no update/delete from the app). Each clinic page shows
  its own recent admin activity; `/admin/audit` is the full log.

## Expected result

An operator can triage a clinic's recent activity and see who changed what,
without ever seeing secrets or raw private data.

## Escalation

If diagnostics are insufficient to resolve an issue, escalate to engineering with
redacted detail only (masked numbers, SID tails, audit references) — never paste
raw payloads or secrets into a ticket.

## Do not

- Do not render raw payloads, full SIDs, full EIN, full phone numbers, or tokens.
- Do not store sensitive values in audit metadata.

## Source of truth

- `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` §10 (security/privacy), §15
  (redaction), §5.1 (`admin_audit_events`)
