# Customer Help — Troubleshooting

Status: scaffold (planned articles)
Audience: Clinic owners and staff · Visibility: `public` / `customer_authenticated`
Last updated: 2026-06-09

Customer-safe troubleshooting and the path to contacting support. These articles
help a customer self-diagnose common situations; deeper diagnosis is internal
(see [../../support-runbooks/README.md](../../support-runbooks/README.md)).

## Planned articles

| Slug | Title | Visibility | Notes |
|---|---|---|---|
| `contact-support` | Contact support | public | How and when to reach support |
| `texting-not-working-yet` | My texting isn't working yet | customer_authenticated | Usually SMS approval not complete / not enabled |
| `i-cant-sign-in` | I can't sign in | customer_authenticated | Reset password; role-specific login |

## Customer-safe notes

- For "texting not working yet": the most common cause is that SMS approval is not
  complete or texting is not yet enabled for the clinic. Point to
  [../sms-approval/README.md](../sms-approval/README.md) and set the expectation
  that texting starts after approval. Do not expose gates, modes, or provider
  status codes.
- For sign-in issues: point to the forgot-password flow and the correct login
  entry for their role. Do not reveal whether a specific email has an account
  (the product returns a generic message by design).
- Keep customer troubleshooting to safe, self-service steps. Anything requiring
  internal diagnostics is a support escalation, handled via the internal
  runbooks — do not document internal checks here.
- Always provide the support contact.

## Contact support

- Email: **support@missedcallsdental.com**
- Include: clinic name and a clear description of what you expected vs. what
  happened. Do not send passwords or full payment details.

## Source of truth

- `README.md` (support email), `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`
  (sign-in), `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` (why texting is
  gated) — all translated to customer-safe wording.
