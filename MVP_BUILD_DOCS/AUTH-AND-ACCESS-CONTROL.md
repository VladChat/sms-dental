# Auth and Access Control

Status: Active (Phase 1 foundation)  
Last updated: 2026-05-31

This document is the auth/access source of truth for the current repository.
It describes the legacy onboarding token flow, the new owner password login
foundation, route ownership, and what remains for future staff invites.

## 1. Product boundary

- `/setup/{token}`: onboarding entry link from setup email.
- `/login`: normal returning-user sign-in route.
- `/account`: owner/admin account dashboard.
- `/workspace`: front-desk operational workspace; currently owner-accessible
  preview in this phase.

## 2. Legacy flow (kept temporarily)

Legacy account context uses the `mcd_account` httpOnly cookie containing the
raw setup token.

- Setup link validates against `setup_requests`.
- Cookie context resolves clinic/account pages via token lookup.
- `/account` and `/workspace` can still fall back to this path while auth
  rollout is verified.

This fallback remains intentionally for backward compatibility and lockout
prevention. It is not the long-term auth model.

## 3. New owner auth flow (Phase 1)

### 3.1 First entry via setup link

1. Owner opens `/setup/{token}`.
2. Token is validated.
3. Setup page shows:
   - read-only login email
   - clinic name
   - main office phone
   - ZIP code
   - create password
   - confirm password
4. Owner submits `Continue setup`.
5. Server:
   - creates/updates clinic
   - creates owner auth user in Supabase Auth (if missing)
   - upserts `profiles` row
   - upserts `clinic_memberships` row with `role='owner'`
   - establishes authenticated session
   - redirects to `/account`

If auth user already exists for the setup email, no duplicate user is created.
The user gets a safe login path via `/login`.

### 3.2 Returning login

1. Owner opens `/login`.
2. Signs in with email + password.
3. Membership is resolved.
4. Redirect rules:
   - `owner` or `admin` -> `/account`
   - `front_desk` (future) -> `/workspace`

If no active membership exists, the response is a safe generic error.

## 4. Data model (Phase 1)

Migration:

- `supabase/migrations/20260531000100_auth_profiles_memberships.sql`

New tables:

- `public.profiles`
  - `id uuid` references `auth.users(id)`
  - `email`
  - `full_name`
  - `is_internal_admin`
  - timestamps
- `public.clinic_memberships`
  - `clinic_id`
  - `profile_id`
  - `role` (`owner | front_desk | admin`)
  - `status` (`active | inactive`)
  - timestamps
  - unique `(clinic_id, profile_id)`

RLS direction in this phase:

- RLS enabled on both new tables.
- Minimal self-read/self-write policies on `profiles`.
- Self-read policy on `clinic_memberships`.
- No risky full-RLS cutover on existing legacy product tables yet.

## 5. Guard model

Primary guard path:

- Supabase authenticated session (`auth.getUser()`) + active clinic membership.

Fallback guard path:

- legacy `mcd_account` token cookie for existing onboarding contexts.

Current behavior:

- `/account`: auth+membership primary, token fallback.
- `/workspace`: auth+membership primary, token fallback.
- `/login`: redirects away if already signed in with active membership.

## 6. Account security surface

`/account` now includes a minimal owner-only `Security` section:

- login email
- password status (`Password sign-in enabled`)
- sign out action

Password change UI is not included in this phase.

## 7. Backfill and migration notes

Existing setup-token accounts can complete password setup by reopening setup
links and submitting the updated setup form.

Operational backfill procedure (if needed for edge cases):

1. Identify setup requests with `clinic_id` but missing auth-owned membership.
2. Ensure/create `auth.users` for `owner_email`.
3. Upsert `profiles`.
4. Upsert `clinic_memberships` with `role='owner'`, `status='active'`.
5. Verify owner can sign in via `/login`.

Do not remove token fallback until this flow is verified for existing accounts.

## 8. Security constraints

- No raw password storage in app tables.
- No manual password hashing in app code.
- Supabase Auth owns password handling.
- Setup tokens are never logged.
- Passwords are never logged.
- Secrets remain out of committed files.

## 9. Not in Phase 1

- Staff invites/team management.
- Google login.
- Apple login.
- Full password reset UI.
- Full role/RLS cutover across all product tables.

## 10. Next phase

Phase 2 target:

- owner invite flow for front-desk staff by email
- invite acceptance + password creation
- `front_desk` membership activation
- workspace-only access for staff
- owner-only restriction for billing/legal/setup sections
