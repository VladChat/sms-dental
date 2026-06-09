# Customer Help

Status: active (all category articles promoted to ready; not yet published)
Last updated: 2026-06-09

Customer-safe help for clinic **owners** and **front-desk staff**. Everything in
this tree must follow the customer-safety rules below and the visibility hard
rules in [../01-AUDIENCE-AND-ACCESS-MODEL.md](../01-AUDIENCE-AND-ACCESS-MODEL.md).

## Customer-safety rules (apply to every article here)

- Use customer vocabulary: **"business number", "local number", "toll-free
  number", "texting service", "SMS approval"**.
- Do **not** say "Twilio" unless the customer UI the article describes already
  says it. Do not introduce provider/brand names the customer never sees.
- Explain only **customer-relevant consequences** (what they see, what changes
  for them, what to do next).
- Never expose: provider SIDs, raw errors, cron jobs, database fields, Stripe
  internals, internal allowlists, admin emails, internal workflow, or other
  clinics' data.
- Owner-only topics (billing, SMS approval, legal/registration, account setup)
  use `visibility: clinic_owner`. Staff-safe topics use `visibility:
  clinic_staff`. General product explanation uses `public` or
  `customer_authenticated`.
- Front-desk staff must never see billing, EIN/legal details, SMS approval
  controls, approval documents, owner setup, Twilio detail, or internal IDs
  (see [workspace/README.md](workspace/README.md) and `FRONT-DESK-WORKSPACE.md`).
- Every customer article ends with a **contact support** path
  (`support@missedcallsdental.com`).

## Categories

- [getting-started/](getting-started/README.md) — what the product does, how
  recovery works, why texting starts after approval.
- [phone-numbers/](phone-numbers/README.md) — business numbers, toll-free vs
  local, remove/restore.
- [sms-approval/](sms-approval/README.md) — what SMS approval is and what info is
  needed.
- [billing/](billing/README.md) — the plan, the bill, current vs next cycle.
- [missed-calls-and-messages/](missed-calls-and-messages/README.md) — patient
  replies and opt-out.
- [account-access/](account-access/README.md) — password and sign-in.
- [workspace/](workspace/README.md) — front-desk staff handling of replies.
- [troubleshooting/](troubleshooting/README.md) — common issues and contacting
  support.

See [../07-CONTENT-INVENTORY.md](../07-CONTENT-INVENTORY.md) for the full article
list and status.
