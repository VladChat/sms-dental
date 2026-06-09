---
title: I can't sign in
slug: i-cant-sign-in
status: ready
visibility: customer_authenticated
audience: Clinic owner and front desk
surface: /account, /workspace
category: troubleshooting
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md
  - MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md
  - config/runtime.config.ts
last_verified: 2026-06-09
related:
  - ../account-access/change-password-and-account-access
  - contact-support
---

# I can't sign in

## Summary

Most sign-in problems are solved by using the right email, signing in to the right
area for your role, and resetting your password if needed. If you still cannot get
in after a reset, contact support — and never share your password.

## Applies to

Clinic owners and front-desk staff who cannot sign in.

## What this means

A couple of simple things cause most sign-in trouble:

- **Wrong email.** Make sure you are using the exact email your account was set up
  with.
- **Wrong area for your role.** Clinic owners use the **account** area to manage
  the clinic. Front-desk staff use the **workspace** to handle patient replies.
  These are separate areas, so signing in to the wrong one can be confusing.
- **Forgotten or outdated password.** Use the password reset to set a new one.

For your security, the sign-in page shows the same general message whether or not
an account exists for an email, so a generic error does not necessarily mean your
email is wrong.

## What you can do

1. **Double-check your email.** Confirm there are no typos and that it is the email
   your account uses.
2. **Use the correct sign-in area.**
   - Clinic owner → the **account** area.
   - Front-desk staff → the **workspace**.
3. **Reset your password.** On the sign-in page, choose **Forgot password?**, enter
   your account email, and follow the reset link sent to that email to set a new
   password. See
   [Change password and account access](../account-access/change-password-and-account-access.md).
4. **Front-desk staff:** if you have never had access, check with your clinic
   owner or admin — staff access is managed by the clinic, and team invites are a
   feature the clinic owner sets up.
5. **Still stuck?** Contact support (see below).

## What to expect

- The password reset link is sent to your account email — check your spam folder if
  you do not see it.
- After resetting, you should be able to sign in with the new password.
- Owners and staff land in different areas after signing in (account vs workspace);
  that is expected.

## When to contact support

Contact support if:

- you reset your password and still cannot sign in,
- you are not sure which email your account uses, or
- you are front-desk staff and are unsure whether you should have access (after
  checking with your clinic owner).

When you reach out, include your **clinic name** and **account email**. Do **not**
send your password or full payment card details — support will never ask for your
password.

Email: **support@missedcallsdental.com**

## Related articles

- [Change password and account access](../account-access/change-password-and-account-access.md)
- [Contact support](contact-support.md)

## Source of truth

- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` — sign-in, password reset, owner vs
  front-desk access, generic error behavior
- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` — front desk uses the separate workspace
- `config/runtime.config.ts` — support email (`app.supportEmail`)
