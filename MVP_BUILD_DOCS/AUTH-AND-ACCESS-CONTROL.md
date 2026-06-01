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

## 6. Account access and team access surface

`/account` now separates setup progress from permanent account settings:

- `Setup` group: Phone number, Business profile, SMS approval, Billing.
- `Account` group: Account access, Team access.

`Account access` replaces the old Security label and is not part of setup
progress numbering/status.

`Account access` currently includes:

- login email (read-only)
- password status (`Password is set`)
- `Change password` placeholder modal (non-mutating; no fake save)
- sign out action

`Team access` is owner-only UI shell in this phase:

- workspace link guidance (`/workspace`, same link for all users)
- invite form shell (`Front desk` only) with safe placeholder on submit
- owner row from real account membership
- sample rows only when no real staff memberships are present

Staff invite send/accept backend remains next-phase work.

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

## 11. Permission matrix (current vs intended)

Current role routes:

- `owner` -> `/account`, `/workspace`
- `front_desk` -> intended `/workspace` only (invite/auth lifecycle not built yet)
- `admin` -> currently treated as account-capable role, future internal admin
  scope to be defined

Current state notes:

- `/account` and `/workspace` use auth session + membership as primary guard.
- Some API routes enforce role checks (for example, front-desk blocked from
  account business/SMS approval mutation endpoints), but full route/API matrix
  enforcement is still partial.
- Legacy `mcd_account` setup-token fallback remains active for compatibility.

Intended next-phase completion:

- enforce canonical route/API permission matrix end-to-end
- deliver staff invite + acceptance lifecycle
- activate front-desk-only workspace access with owner/admin restrictions

## 12. Copy/UI cleanup follow-up (2026-05-31)

This pass made focused UI/copy cleanup only; it did not add invite backend,
invite email delivery, invite acceptance, or full RBAC completion.

Changes:

- `/setup/{token}` removed extra subtitle copy and standardized fallback error:
  `Could not save your account setup. Please check your entries.`
- `/account` header copy simplified to a short status line:
  `Texting starts after approval.`
- component file rename:
  - `app/setup/[token]/_components/SecurityCard.tsx`
  - -> `app/setup/[token]/_components/AccountAccessCard.tsx`
- team access now separates real members from a distinct `Sample staff examples`
  block, with local hide state stored in browser storage only.
- team action labels are simplified to:
  - owner row: `—`
  - sample invited/active staff: `Remove`
  - sample access removed staff: `Restore`

`Restore` is a future invite-restart action. In this phase it does not mutate
memberships.
