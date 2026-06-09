# Customer Help — Account Access

Status: scaffold (planned articles)
Audience: Clinic owners · Visibility: `clinic_owner`
Last updated: 2026-06-09

Help for signing in, changing a password, and managing account access.

## Planned articles

| Slug | Title | Visibility | Notes |
|---|---|---|---|
| `change-password` | Change password / account access | clinic_owner | In-session change + forgot-password reset |
| `contact-support` | Contact support | public | Cross-listed in troubleshooting |

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
