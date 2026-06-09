---
title: Platform-admin support boundaries
slug: support-boundaries
status: internal
visibility: platform_admin
audience: Platform operator
surface: /admin
category: boundaries
owner: ops
source_of_truth:
  - MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md
  - MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md
last_verified: 2026-06-09
related:
  - clinic-console
  - phone-number-lifecycle
  - a2p-review-and-submission
  - billing-operations
---

## Summary

What a platform operator may and may not do, and which actions are
blocked-by-design until their real backends exist. Use this to stay inside safe
guardrails when helping a clinic.

## Applies to

All platform operator work in `/admin`, especially when acting on a clinic at a
customer's request.

## May do (audited)

- View redacted diagnostics and the audit log.
- Edit/save Business profile and A2P/representative data (stores data only).
- Update the internal note.
- Pause / reactivate a clinic (`is_active`).
- Disable SMS recovery (always safe); enable SMS recovery only when all gates pass
  (active + assigned number + A2P info complete + ops `SMS_RECOVERY_MODE=live`).
- Search / assign / detach numbers (assignment gated by
  `TWILIO_NUMBER_PURCHASE_ENABLED`).
- Resend the setup link (rate-limited; token never logged) — where implemented.

## Must NOT do

- Bypass `resolvePlatformAdmin` or act without an authorized session.
- Bypass opt-out (STOP/START) or the SMS gates to "make texting work".
- Submit live A2P for a non-allowlisted clinic, or enable live SMS on a mock/
  approved-looking brand.
- Make live Stripe changes (test-mode only; live needs a separate approved
  rollout).
- Expose secrets, raw payloads, full SIDs/EIN, tokens, or other clinics' data.
- Treat platform-admin status as clinic-owner access, or vice versa — they are
  separate by design.

## Blocked-by-design (shown disabled with exact reason — never simulate)

- Stripe billing management (collect/start/pause).
- Real A2P carrier submission from the panel (until its backend/allowlist gate).
- Twilio number purchase when `TWILIO_NUMBER_PURCHASE_ENABLED` is off.

When an action is blocked, communicate the reason; do not force a workaround.

## Customer-data handling

- Apply minimum-necessary: show only what is needed to resolve the issue.
- Patient message bodies are sensitive; prefer status/keyword.
- Never read or expose data for a clinic you are not actively supporting beyond
  what the task requires.

## Escalation

Anything requiring a blocked backend, a schema change, a stuck reconciliation, or
a live provider action beyond the allowlisted test scope goes to engineering with
redacted detail only.

## Source of truth

- `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` §6 (action matrix), §9
  (existing-feature protection), §10 (security/privacy)
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` §17 (role separation)
