---
title: Clinic cannot access account
slug: clinic-cannot-access-account
status: internal
visibility: internal_ops
audience: Support / platform operator
surface: support
category: runbook
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md
last_verified: 2026-06-09
related:
  - ../customer-help/account-access/README
  - ../platform-admin/support-boundaries
---

## Symptom

A clinic owner (or staff member) can't sign in, didn't get a reset email, or lands
on the wrong page after login.

## Customer-safe explanation

Sign-in uses one account system with separate entry points by role. Most access
issues are resolved by using the correct login and the forgot-password reset.

## Likely causes / scenarios

1. Forgot password / needs a reset.
2. Reset link expired or was from an old email.
3. Using the wrong login entry for their role (owner vs front desk vs platform
   admin).
4. Owner trying to reach a page their role doesn't cover.
5. Front-desk staff expecting access before staff invites exist (still owner-
   accessible preview today).

## Triage questions (customer-safe)

- Which email are you using to sign in?
- Are you the clinic owner, or front-desk staff?
- Did you request a password reset? Did the email arrive (check spam)?

## Safe checks (internal)

- Confirm the correct entry point: owner → `/login` (`/account`), front desk →
  `/workspace/login` (`/workspace`), platform admin → `/admin/login` (`/admin`).
- Reset flow: forgot-password → emailed link → `/auth/callback` →
  `/reset-password`. Links point to the app domain and expire; old emails keep the
  old link.
- Role-mismatch: a platform-admin account using `/login` gets a clear "use admin
  sign in" message — that's expected.
- A localhost reset link is a Supabase Auth Site URL / allow-list issue, **not** an
  app code bug.

## Key rules to communicate

- Use the correct login for your role and the forgot-password link to reset.
- Reset links expire and are single-use; request a fresh one if needed.
- For security, the product shows a generic "if an account exists…" message — do
  not reveal whether a given email has an account.

## Do not

- Do not reveal whether a specific email has an account.
- Do not share, display, or log reset/setup tokens or recovery links.
- Do not manually reset a password outside the supported flow, or expose internal
  auth mechanics to the customer.

## Escalation

Escalate if reset emails consistently fail to send, links resolve to localhost
despite correct settings, or membership/role looks wrong. Engineering/platform
admin. Never paste tokens into a ticket.

## Customer-safe response summary

> Please sign in using the login for your role and, if needed, use "Forgot
> password?" to get a fresh reset link by email (it expires, so request a new one
> if the old one doesn't work, and check your spam folder). If you're front-desk
> staff, your clinic owner manages access today. Let me know if the reset email
> doesn't arrive and I'll dig in further.

## Source of truth

- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` (§3 flows, §17 role entry points,
  §10 Supabase Auth URL config)
