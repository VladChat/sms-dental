# Auth and Access Control

Status: Active (Phase 1 foundation)  
Last updated: 2026-06-01

This document is the auth/access source of truth for the current repository.
It describes the legacy onboarding token flow, the new owner password login
foundation, owner password reset flow, route ownership, and what remains for
future staff invites.

## 1. Product boundary

- `/setup/{token}`: onboarding entry link from setup email.
- `/login`: normal returning-user sign-in route.
- `/forgot-password`: start password reset.
- `/auth/callback`: Supabase Auth PKCE callback exchange route.
- `/reset-password`: set a new password from a valid recovery session.
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
   - business name
   - business phone
   - ZIP code
   - country (United States, read-only)
   - read-only login email
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

### 3.3 Password reset flow

1. Owner opens `/login` and selects `Forgot password?`.
2. Owner submits email on `/forgot-password`.
3. `POST /api/auth/forgot-password` validates email and calls
   `supabase.auth.resetPasswordForEmail(...)` with:
   `/auth/callback?next=/reset-password`.
4. UI always shows generic success for normal requests:
   `If an account exists for this email, we'll send a password reset link.`
5. Recovery email links to the **app domain** (anti-phishing):
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
   — not `{{ .ConfirmationURL }}`, whose first hop is the raw Supabase
   project-ref domain (`https://<ref>.supabase.co/auth/v1/verify...`) and triggers
   Gmail phishing warnings against the Missed Calls Dental sender.
6. `/auth/callback` supports **both** the `token_hash`+`type` flow (calls
   `supabase.auth.verifyOtp({ token_hash, type })`) and the legacy PKCE `code`
   flow (`exchangeCodeForSession`), establishes the session cookies, and
   redirects safely:
   - allows internal relative `next` paths only
   - defaults to `/account` when `next` is missing/unsafe
   - on failure redirects to `/login?error=invalid_or_expired_link`
7. `/reset-password` requires an active authenticated session from the recovery
   flow; otherwise it shows:
   `This reset link is expired or invalid. Request a new password reset link.`
8. `POST /api/auth/update-password` validates:
   - password + confirm match
   - same password rule as setup (>=8 chars, at least one letter, one number)
   - authenticated session exists
9. On success, password is updated through Supabase Auth and user is redirected
   to `/account`.

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

Reset behavior in this phase:

- password reset is available from `/login` via `/forgot-password`
- account-page `Change password` remains a placeholder until an in-session
  account-settings password change flow is explicitly scoped

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
- Full role/RLS cutover across all product tables.

## 10. Supabase Auth URL + email sender configuration (canonical)

> **Applied 2026-06-01 (via Supabase Management API,
> `PATCH /v1/projects/qfjpvbvfvhbtebwivcdc/config/auth`):** Site URL =
> `https://app.missedcallsdental.com`; redirect allow list =
> `https://app.missedcallsdental.com/auth/callback` +
> `http://localhost:3000/auth/callback`; Custom SMTP = Resend
> (`smtp.resend.com:465`, user `resend`) sending as
> `Missed Calls Dental <no-reply@mail.missedcallsdental.com>`. Independently
> re-verified by a second GET. The BEFORE state had Site URL
> `http://localhost:3000` and an **empty** redirect allow list — that empty list
> is why GoTrue fell back to the localhost Site URL. Browser/inbox E2E (open the
> fresh email → link → `/reset-password` → set password → login → `/account`)
> remains an operator step. See `SETUP-LOG.md` (2026-06-01) and
> `OPERATIONS-RUNBOOK.md` for the apply method (use curl — the Management API is
> behind Cloudflare and 1010-blocks python-urllib writes) and the token-revoke
> reminder. The settings below are the canonical reference.

The reset `redirectTo` is built **in code** from committed runtime config, not
from any env var:

- `POST /api/auth/forgot-password` calls `getAppDomains()` (`lib/env.ts`), which
  reads `runtimeConfig.app.appBaseUrl` (`config/runtime.config.ts` =
  `https://app.missedcallsdental.com`). It sends:
  `https://app.missedcallsdental.com/auth/callback?next=/reset-password`.
- `APP_BASE_URL` (env) is **not read by current code** — only a stale comment in
  `lib/onboarding/tokens.ts` mentions it. Changing it on Vercel does not affect
  the reset link.

So a localhost reset link is **not** an app bug — it comes from Supabase Auth
settings. Supabase GoTrue ignores an emailed `redirect_to` that is not in the
**Redirect URLs** allow list and substitutes the project **Site URL** into
`{{ .ConfirmationURL }}`. If Site URL is `http://localhost:3000`, recovery links
point to localhost.

Required Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://app.missedcallsdental.com`
- **Redirect URLs** (allow list):
  - `https://app.missedcallsdental.com/auth/callback`
  - `http://localhost:3000/auth/callback` (local dev only; keep intentionally)

After changing these, send a **fresh** reset email — old emails keep the old
(localhost) link and cannot be retro-fixed.

Required Supabase Dashboard → **Authentication → Emails (Custom SMTP)** for
branded sender (replaces the default `noreply@mail.app.supabase.io`):

- Provider: **Resend SMTP**
- Host `smtp.resend.com`, Port `465`, Username `resend`
- Password: Resend SMTP credential / API key (from the Resend dashboard — never
  printed, logged, or committed)
- Sender email `no-reply@missedcallsdental.com`, Sender name `Missed Calls Dental`
- Requires the sending domain to be **verified in Resend**. The transactional
  setup-email path already uses the verified **subdomain** `mail.missedcallsdental.com`
  (`runtimeConfig.email.defaultSetupFrom`). The root domain
  `missedcallsdental.com` may need separate Resend verification (SPF/DKIM DNS) to
  send from `no-reply@missedcallsdental.com`. If only the subdomain is verified,
  a safe interim branded sender is
  `Missed Calls Dental <no-reply@mail.missedcallsdental.com>`.

**Reset Password** email template (anti-phishing, applied 2026-06-01): the
recovery template links to the **app domain**, not the raw Supabase project-ref
domain:

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
```

Do **not** use `{{ .ConfirmationURL }}` in the recovery template — its first hop
is `https://<project-ref>.supabase.co/auth/v1/verify...`, which Gmail flags as
phishing because it mismatches the Missed Calls Dental sender. `/auth/callback`
handles this `token_hash`+`type` link via `verifyOtp` (alongside the legacy PKCE
`code` flow). The template field is `mailer_templates_recovery_content` on the
Management API `config/auth` endpoint. Never hardcode localhost, production
tokens, or full reset links in the template.

## 11. Next phase

Phase 2 target:

- owner invite flow for front-desk staff by email
- invite acceptance + password creation
- `front_desk` membership activation
- workspace-only access for staff
- owner-only restriction for billing/legal/setup sections

## 12. Permission matrix (current vs intended)

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

## 13. Copy/UI cleanup follow-up (2026-05-31)

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

## 14. Production incident fix — setup submit 500 (2026-06-01)

Observed production symptom:

- `/setup/{token}` submit showed `We couldn't reach the server.` after
  `Continue setup`.

Root cause:

- Production logs showed `POST /api/onboarding/[token]/clinic` failing with:
  `relation "public.profiles" does not exist` (Postgres `42P01`).
- The owner-auth migration creating `public.profiles` and
  `public.clinic_memberships` had not been applied on production DB.

Resolution:

1. Applied migration:
   `supabase/migrations/20260531000100_auth_profiles_memberships.sql`
   against production DB.
2. Added minimal hardening so account-link DB failures return structured JSON
   error (`account_link_failed`) instead of unhandled 500.
3. Updated setup form submit parsing to tolerate non-JSON server responses
   without falling into a misleading network-only message path.

## 15. Auth login + reset polish (2026-06-01)

Canonical sign-in is `https://app.missedcallsdental.com/login` (real auth). It now
mirrors the marketing sign-in design (brand header, centered card, footer legal
links) using shared design tokens + new `.auth-*` classes in `app/globals.css`;
`LoginForm` behavior is unchanged. `docs/sign-in.html` is a redirect/handoff to the
app login (meta refresh + JS replace + fallback link, `noindex`), and all marketing
pages' Sign in nav links point to the app login. Do not re-add a marketing login
form.

`/reset-password` form:

- A read-only account **email** field (`autocomplete="username"`, value from the
  recovery session `getUser().email`) precedes the password fields so the browser's
  "Save password?" stores email + new password. The email cannot be edited during
  reset.
- Both password fields use `autocomplete="new-password"`. Show/Hide flips
  `-webkit-text-security` and keeps `type="password"` constant, so Chrome's
  strong-password generator is not re-triggered on a non-empty field (no remount;
  stable key/value/name/id/autocomplete).

Recovery email copy (supersedes the earlier subject in section 10): sender display
name `Missed Calls Dental`; subject exactly `Reset your password`; body/snippet
begins "We received a request to reset the password for your account." The
app-domain `{{ .SiteURL }}/auth/callback?token_hash=...&type=recovery&next=/reset-password`
link is unchanged; do not reintroduce `{{ .ConfirmationURL }}`.

## 15. Setup link idempotency (2026-06-01)

Reopening a used `/setup/{token}` link must not restart setup or ask for a new
password. Canonical completed marker: **an owner auth account exists for the
setup request's `owner_email`** (`isSetupAlreadyCompleted` in
`lib/onboarding/verify.ts`). The form's only job is to create that account +
password, so once it exists, setup is complete. This marker is true for old links
(no backfill/migration) and is not bypassable by reopening a stale email link;
`setup_requests.status` is not used here because it keeps advancing past
`clinic_details_completed` after the account is created.

State handling at `/setup/{token}`:

- invalid/expired/cancelled token → unchanged invalid-link card;
- completed + signed in → server-side redirect to `/account`
  (`supabase.auth.getUser()`); 
- completed + signed out → no-password completed-state card
  (`Account setup is already complete` / `Sign in to continue to your account.` /
  `Sign in` → `/login`);
- first-time, not-yet-created → existing onboarding form (office + password).

`POST /api/onboarding/[token]/clinic` enforces the same check before any writes
and returns `{ ok:true, completed:true, redirect }` for an already-created
account, so a stale re-submit cannot create a duplicate auth user/clinic,
overwrite the password, or rerun setup. The setup token is still never logged;
the completion check uses only the owner email.
