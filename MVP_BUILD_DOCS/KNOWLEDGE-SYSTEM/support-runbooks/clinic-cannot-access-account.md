---
title: Clinic cannot access account
slug: clinic-cannot-access-account
status: internal
visibility: internal_ops
audience: Internal support / operator
surface: support
category: runbook
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md
  - MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md
last_verified: 2026-06-09
related:
  - ../platform-admin/support-boundaries
  - ../customer-help/account-access/change-password-and-account-access
---

# Clinic cannot access account

## Purpose

Help an owner or front-desk user regain access via the correct sign-in area and the
password reset, without exposing auth internals or revealing whether an email has an
account.

## Audience / visibility

Internal support / operator. `visibility: internal_ops`. Internal-only.

## Symptom

A clinic owner or staff member can't sign in, didn't get a reset email, or lands on
the wrong page after signing in.

## Customer-safe explanation

Sign-in uses separate areas by role. Most access issues are resolved by using the
correct area and the "Forgot password?" reset.

## Internal triage checklist

- Confirm role and correct entry point: owner → account sign-in (`/account`), front
  desk → workspace sign-in (`/workspace`), platform admin → `/admin`.
- Confirm whether they requested a reset and whether the email arrived (ask them to
  check spam). Reset links expire and are single-use; old emails keep the old link.
- A platform-admin account using the owner sign-in gets a clear "use admin sign in"
  message — that is expected, not a bug.
- Front-desk staff: staff access is managed by the clinic owner; broad staff
  invites are a future capability — confirm the owner expects them to have access.
- Note: a localhost reset link is an auth Site-URL / allow-list configuration issue,
  not an app code bug (see source).

### What info to request
- Clinic name and the account email being used; their role (owner vs front desk).

### What NOT to request
- **Never** request a password. Never ask for full payment card details.

## What not to expose to the customer

- Whether a specific email has an account (the product returns a generic message by
  design).
- Reset/setup tokens, recovery links, or any auth implementation detail
  (cookies/token-hash/PKCE/tables/guards).

## Safe resolution paths

- Point the user to the correct sign-in area for their role and the "Forgot
  password?" reset; have them request a fresh link if the old one fails.
- Front-desk access not yet granted: direct them to their clinic owner.
- **Never** manually reset a password outside the supported flow, and never share or
  log tokens.

## Escalation criteria

Escalate (engineering / platform admin) if reset emails consistently fail to send,
links resolve to localhost despite correct settings, or membership/role looks wrong.
Never paste tokens into a ticket.

## Related platform-admin docs

- [../platform-admin/support-boundaries.md](../platform-admin/support-boundaries.md)

## Customer-safe response summary

> Please sign in using the area for your role and, if needed, use "Forgot password?"
> to get a fresh reset link by email (it expires, so request a new one if the old
> one doesn't work, and check your spam folder). If you're front-desk staff, your
> clinic owner manages access. Let me know if the reset email doesn't arrive and
> I'll dig in further.

## Source of truth

- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` (§3 flows, §17 role entry points, §10
  Auth URL config)
- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` (front desk uses the separate workspace)
