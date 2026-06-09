---
title: Diagnostics and audit boundaries
slug: diagnostics-and-audit
status: internal
visibility: platform_admin
audience: Platform admin / operator
surface: /admin
category: diagnostics
owner: ops
source_of_truth:
  - MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md
last_verified: 2026-06-09
related:
  - clinic-console
  - support-boundaries
---

# Diagnostics and audit boundaries

## Summary

What the admin diagnostics expose, the mandatory redaction rules, and how the audit
log works. Diagnostics are for triage — they are **read-only, internal, and guarded
server-side**, and they must never leak secrets or raw private data.

## Applies to

`/admin/clinics/[clinicId]` → Diagnostics, `/admin/clinics/[clinicId]/events`, and
`/admin/audit`.

## What platform admin can see

- Redacted call/message/webhook activity for a clinic: type, status, timestamp,
  masked numbers; opt-out state; setup status; a link to public business pages.
- Recent admin activity (audit) for the clinic, and the full `/admin/audit` log.
- Technical details (IDs/SIDs as tails, timestamps) in a compact, collapsed area —
  secondary to the management workflow, never the main experience.

## What must stay hidden

- Secrets of any kind (service-role keys, provider auth tokens, billing-provider
  secret keys, Vercel/Resend keys, full DB URLs, raw setup/recovery tokens).
- Raw payloads: webhook/message/call raw payloads are **never** rendered raw.
- Full phone numbers, full SIDs, full EIN, and the A2P representative's full values
  (show presence only).
- Patient message **bodies** are sensitive: prefer status/keyword over full body;
  treat any body shown as minimal and sensitive.

## Mandatory redaction

- Phone numbers masked (last 4).
- Provider SIDs shown as a short tail only.
- No raw payloads — only safe, structured fields.
- EIN and A2P representative shown as presence only.
- No setup/recovery tokens, no secrets, ever.

The admin guard (`resolvePlatformAdmin`) is the **only** thing protecting
cross-tenant data (service-role reads bypass RLS), so it is mandatory on the layout
**and** every `/api/admin/*` route. Defense-in-depth: redact at the data layer too,
not only in the UI.

## Audit requirements for writes

- Every admin **write** action writes an `admin_audit_events` row: time, actor
  email, action, target, clinic, summary, redacted metadata.
- Metadata stores **changed field names + flags only** — never raw EIN/phone/email
  values, never secrets, never raw payloads.
- Append-only by convention (no update/delete from the app). Read-only diagnostics
  do not require an audit row but should stay compact and secondary.

## Support escalation

If diagnostics are insufficient to resolve an issue, escalate to engineering with
**redacted detail only** (masked numbers, SID tails, audit references). Never paste
raw payloads, full identifiers, or secrets into a ticket or chat.

## Do not

- Do not render raw payloads, full SIDs, full EIN, full phone numbers, or tokens.
- Do not store sensitive values in audit metadata.
- Do not turn the technical details into a customer-facing or full-database dump.

## Source of truth

- `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` §10 (security/privacy), §15
  (redaction), §5.1 (`admin_audit_events`)
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` (what activity is recorded)
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` (admin guard / cross-tenant access)
