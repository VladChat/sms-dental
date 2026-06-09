# Customer Help — Phone Numbers

Status: active (articles ready; not yet published)
Audience: Clinic owners · Visibility: `clinic_owner`
Last updated: 2026-06-09

Help for choosing and managing the clinic's business number(s).

## Articles

| Article | Title | Visibility | Status | Notes |
|---|---|---|---|---|
| [toll-free-vs-local-numbers.md](toll-free-vs-local-numbers.md) | Toll-free vs local numbers | clinic_owner | ready | What each is and the customer-relevant differences |
| [remove-a-number.md](remove-a-number.md) | Remove a number | clinic_owner | ready | Stops service immediately; restorable before permanent removal |
| [restore-a-removed-number.md](restore-a-removed-number.md) | Restore a removed number | clinic_owner | ready | Only before permanent removal; no fixed restore window promised |

## Customer-safe notes

- Use **"business number", "local number", "toll-free number"** and **"texting
  service"**. Do not say "Twilio" (the customer UI does not). Do not show
  provider SIDs, raw errors, cron/release-job mechanics, database fields, or
  Stripe internals.
- **Toll-free vs local (customer-relevant points only):**
  - The first toll-free number is **included in plan** (never say "free").
  - An additional toll-free number is a paid add-on.
  - A local number is always a paid add-on (even the first, even during the free
    trial) because of texting registration/compliance.
  - Local numbers go through **SMS approval** before texting works; toll-free uses
    a separate verification. Keep this at a customer level — "A2P/10DLC" is
    internal terminology, not customer copy.
  - **All prices must be sourced from the canonical billing files** — never
    hard-code amounts in an article. Cite
    [../billing/README.md](../billing/README.md), `config/billing.config.ts`, and
    `BILLING-AND-USAGE-POLICY.md`.
- **Remove a number** (from the project-wide lifecycle rule):
  - The customer-facing action is **"Remove number"**, never "Release number".
  - Removing a number **stops calls/texting routing for it immediately**.
  - The number stays visible and **restorable until permanent removal**; do not
    promise a fixed window (e.g. "30 days").
  - Billing changes apply **next cycle only** — removing does not create an
    immediate refund or credit.
- **Restore a number:** allowed only while the number is still scheduled and
  before permanent removal has completed. If permanent removal already happened,
  the number cannot be restored and a new number must be added.
- Explain only what the customer experiences. The detailed lifecycle (suspend,
  detach, permanent removal mechanics) is internal — see
  [../../platform-admin/phone-number-lifecycle.md](../../platform-admin/phone-number-lifecycle.md).

## Source of truth

- `AGENTS.md` — "Toll-free vs Local Number Model" and "Phone Number Removal
  Lifecycle"
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — pricing and next-cycle billing
- `config/billing.config.ts` — canonical amounts and breakdown builders

## Need more help?

Contact support: support@missedcallsdental.com
