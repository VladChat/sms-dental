# Agent Instructions

This repository intentionally has two valid instruction layers:

1. `.claude/skills/` — Claude-specific skills for Claude Code.
2. `Skills/*.md` — universal project/reference instructions for all agents.

Keep both layers.

Do not use obsolete instruction systems:

- `.agents/`
- `.agents/Skills/`
- `.github/skills/`

Do not delete `.claude/skills/`.
Do not create or install new instruction systems during cleanup unless Vlad explicitly asks.

## Source Priority for Project Facts

When project values conflict, use this priority:

1. `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`
2. `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` for pricing, billing, usage, subscriptions, and number-purchase policy
3. `MVP_BUILD_DOCS/OWNER-SETTINGS.md`
4. `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
5. `MVP_BUILD_DOCS/SETUP-LOG.md`
6. `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md`
7. `config/runtime.config.ts`
8. `Skills/missed-calls-dental-product-context.md`
9. relevant `.claude/skills/*/SKILL.md`

## Required Reading Before Coding

- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`
- `MVP_BUILD_DOCS/START-HERE.md`
- `MVP_BUILD_DOCS/AGENT-RULES.md`
- `Skills/missed-calls-dental-product-context.md`

## Form and Onboarding Scope Rule (Project-Wide)

For every form, onboarding step, setup flow, dashboard setting, or user-input screen, ask only for information required to complete the next immediate step.

Do not collect fields only because they may be useful later. Move non-essential fields to profile completion, settings, admin review, billing/compliance, or later onboarding steps.

If a field is required, add a short customer-facing explanation of why it is needed.

This follows established form UX best practices, including Nielsen Norman Group's EAS framework: eliminate unnecessary fields first, automate where possible, and simplify what remains.

Example:

If the next step only needs clinic identity, office phone, and ZIP code, ask only for those fields. Do not ask for legal business name, owner phone, timezone, compliance details, billing details, or test data until those fields are actually required for the next step.

## Minimum Necessary Information Rule (Project-Wide)

Use only the minimum necessary information for every provider payload, UI, form, prompt, log, document, and workflow. Extra information increases confusion and provider rejection risk.

- Do not send, display, collect, duplicate, or store optional information unless it is required for the immediate task.
- For any external provider payload (Twilio, Stripe, etc.), include only required or conditionally-required fields. If a provider field is optional, omit it by default.
- If a field is required, use the correct stored value. Never invent, guess, or substitute unrelated data (e.g. do not send one entity's website/EIN/address for another). If a required value is missing, BLOCK the action and show the exact missing field.
- Separate "submitted to provider" from "internal diagnostics". Internal/admin-only data (readiness, SIDs, statuses, sync timestamps, blocking reasons, support/compliance URLs) must not be sent to external providers unless that provider requires the field.
- Do not duplicate statuses or repeat the same field across a UI/payload.
- Protect secrets and sensitive identifiers (e.g. full EIN/tax ID): a full value may be sent to a provider only when required, but must never be shown in full in UI, written to logs, or stored in snapshots/diagnostics.

## Toll-free vs Local Number Model (Project-Wide)

Business numbers have a durable `number_type`: `toll_free` or `local`. This is a
fixed product rule:

- The FIRST toll-free number is included in the plan. An additional toll-free
  number is a paid add-on (`$20/month`).
- A local number is ALWAYS a paid add-on before assignment — even the first
  number and even during the free trial — because of A2P 10DLC registration and
  compliance.
- Local numbers use A2P 10DLC Brand/Campaign approval. Toll-free numbers use
  toll-free verification (NOT A2P Brand/Campaign). The A2P review/submission
  package includes LOCAL numbers only; toll-free numbers are never added to a
  local A2P campaign.
- Do not call any number "free". Use "included in plan".
- Customer-facing prices must come from `config/billing.config.ts` (the breakdown
  builders), never hard-coded in components. Every breakdown row ends in
  "included in plan", "included", "$X/month", or "$X one-time".
- Use minimum necessary information. Do not duplicate statuses or repeat the same
  field across a card/payload.
- The number type, slot class (included vs additional), price, Stripe quantity,
  and fees are decided server-side only. The client never decides them.
- Local purchase is fail-closed: until the local Stripe Price IDs are configured
  (`hasLocalNumberBillingConfigured` in `lib/env.ts`), the server refuses to buy
  or assign a local number. Owners may still SEARCH local numbers.

## Phone Number Removal Lifecycle (Project-Wide)

- Customer-facing action text is `Remove number`, never `Release number`.
- Remove number immediately deactivates routing/service for that number.
- Twilio release is delayed until permanent removal; customer removal does not
  immediately release the Twilio number.
- Customer can restore the number before permanent removal if release has not
  completed.
- Billing changes apply next cycle only; do not promise or create a refund or
  credit for the current period from the remove/restore action itself.
- Local SMS compliance is charged once if at least one billable local number
  remains for that billing view.
- Number rows are not physically deleted from `clinic_phone_numbers`; preserve
  lifecycle history for audit/reconciliation.
- If delayed Twilio release fails, preserve the existing Twilio SID and the
  release error for reconciliation. Do not silently clear or overwrite them.

## Sample Domain Rule

When fake/demo/sample domains or emails are needed in UI copy, docs, tests, or
examples, use only `example.com`.

Approved sample emails:

- `owner@example.com`
- `frontdesk@example.com`
- `reception@example.com`
- `staff@example.com`

For infrastructure, deployment, DNS, Supabase, Vercel, Twilio, Stripe, or production-like work, also read:

- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`
- `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md`

For Twilio/SMS work, read:

- `Skills/twilio-dental-sms.md`
- `.claude/skills/twilio-sms-compliance/SKILL.md` (if present)

For Stripe work, read:

- `Skills/stripe-best-practices.md`
- `.claude/skills/stripe-billing/SKILL.md` (if present)

For Supabase/Postgres work, read:

- `Skills/supabase-postgres-best-practices.md`
- `.claude/skills/supabase-postgres/SKILL.md` (if present)

For public website, CRO, copy, or design work, read:

- `Skills/page-cro-dental-saas.md`
- `Skills/copywriting.md`
- `Skills/frontend-design.md`
- `.claude/skills/landing-page-cro/SKILL.md` (if present)
- `.claude/skills/copywriting/SKILL.md` (if present)
- `.claude/skills/frontend-design/SKILL.md` (if present)

## Operational Documentation Update Rule

At the end of every backend, infrastructure, deployment, DNS, Supabase, Vercel, Twilio, Stripe, or production-like task, the agent must decide whether the task created durable operational knowledge.

Durable operational knowledge means information that will still matter later for operating this project, debugging it, auditing it, or repeating this setup in another similar project.

If yes, update the correct file before final report:

- `MVP_BUILD_DOCS/SETUP-LOG.md` — chronological facts: what changed, date, result, commit hash, deploy ID, provider resource name, verification result.
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — how to operate, verify, troubleshoot, or safely repeat an operational procedure for this project.
- `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md` — reusable best practices or steps that should carry into future similar projects.

If no operations documentation update is needed, explicitly say in the final report:

```txt
Operations docs update needed: no
```

Do not add noise. Do not record temporary failed commands, long logs, speculation, duplicate facts, or one-off debugging attempts unless they produced a confirmed reusable fix.

Never write secrets, passwords, full database URLs with passwords, API keys, tokens, service role key values, private patient data, or raw customer data into any documentation file.

## Canonical Project Values

- Public brand: `Missed Calls Dental`
- Domain: `https://missedcallsdental.com/`
- Public support email: `support@missedcallsdental.com`
- Public price: `$99/month`
- Trial baseline: `21-day free trial`
- Current billing and number-purchase rule: first business number purchase is self-service and included with the base plan; no charge occurs on first-number purchase; the current backend starts the trial after first successful number assignment; paid plan starts only through explicit Stripe Checkout and webhook-confirmed active subscription; additional numbers require active paid subscription and explicit `$20/month` consent; SMS recovery enablement is separate and never automatic.

## Security Rules

- Do not commit secrets.
- Do not commit `.env.local`.
- Do not commit `.env`.
- Do not commit `.claude/settings.local.json`.
- Do not commit `.local-agent/`.
- Keep secrets only in local ignored files.
- Public website copy must not expose private/admin email addresses.
- Do not paste or print full secret values in reports or documentation.
- `.env.local` is secret-only. Keep only actual secrets/credentials in it, such as API keys, auth tokens, webhook signing secrets, service-role keys, database URLs containing passwords, and documented credential pairs such as Twilio Account SID + Auth Token.
- Do not place public URLs, feature flags, product constants, onboarding rules, sender email config, Twilio resource SIDs, Stripe account IDs, or other non-secret settings in `.env.local`; put those in committed config files under `config/`.
- Never add fake placeholder secrets such as `local-dev-secret-change-later`.
- `INTERNAL_ADMIN_SECRET` is intentionally removed from MVP and must not be reintroduced unless a real internal/admin auth design is explicitly requested and documented.

## Destructive Confirmation Modal Rule (Project-Wide)

Destructive confirmation modals with consent checkboxes must use the shared `ConfirmationDialog` shell and the existing standardized consent/authorization panel pattern. Do not create custom one-off modal components or custom one-off warning panels.

- Use `ConfirmationDialog` (from `./ConfirmationDialog`) as the modal wrapper/backdrop/shell for all confirmation dialogs — including destructive ones.
- Render the consequence content as `children` of `ConfirmationDialog` using the `acct-consent` CSS class, exactly as the local-number authorization block does in `OwnerNumberSearch`.
- Emphasize the primary consequence through typography/weight (`fontWeight: 700`, `t-body`) inside the standard `acct-consent` panel — not through a separate loose red warning block and not through one-off custom panel styles.
- Do not use one-off inline panel styles with error tokens (`--error-bg`, `--error-border`, `--error-text`) for the panel background/border. The `acct-consent` class provides the standard tinted panel.
- Integrate the consent checkbox inside the `acct-consent` panel, below the consequence text.
- For destructive actions, use `ConfirmationDialog` optional props: `primaryDisabled={!acknowledged}`, `actionsLayout="stacked"`, `primaryClassName="btn btn-danger acct-primary-action"`. These props have safe defaults that do not affect existing callers.
- Do not extend `ConfirmationDialog` beyond the documented optional props without updating this rule.

## Project Structure Rules

- Keep the public website in `docs/`.
- Keep `docs/CNAME`.
- Do not restore root `CNAME`.
- Keep the SaaS app/backend in the existing `app/` direction unless Vlad explicitly changes the architecture.
- Do not create a separate `backend/` folder unless Vlad explicitly approves the architecture change.
