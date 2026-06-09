# Customer Help — Account Access

Status: active (articles ready; not yet published)
Audience: Clinic owners · Visibility: `clinic_owner`
Last updated: 2026-06-09

Help for signing in, changing a password, and managing account access.

## Articles

| Article | Title | Visibility | Status | Notes |
|---|---|---|---|---|
| [change-password-and-account-access.md](change-password-and-account-access.md) | Change password and account access | clinic_owner | ready | Sign in, reset, in-session change; owner vs front desk |
| [../troubleshooting/contact-support.md](../troubleshooting/contact-support.md) | Contact support | customer_authenticated | ready | Lives in troubleshooting; cross-listed here |

## Customer-safe notes

- **Sign in:** owners sign in at the app login. Describe the experience, not the
  auth internals. Do not expose tokens, cookies, Supabase mechanics, or
  role-resolution logic.
- **Change password (signed in):** owners can change their password from
  `/account` → Account access → Change password (enter current password, new
  password, confirm). Password rule: at least 8 characters with at least one
  letter and one number.
- **Forgot password:** from the login page, use "Forgot password?" to get a reset
  link by email; the link opens a page to set a new password. The reset link is
  sent to the account email only.
- **Team access** is owner-managed; staff invites are a future feature
  (not connected yet). Do not describe invite sending as if it works today.
- Never reveal: reset tokens, recovery links, admin emails, internal allowlists,
  or other accounts.

## Source of truth

- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` — login, reset flow (§3.3),
  in-session change (§16), team access state (§6)

## Need more help?

Contact support: support@missedcallsdental.com
