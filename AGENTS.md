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

## Project Structure Rules

- Keep the public website in `docs/`.
- Keep `docs/CNAME`.
- Do not restore root `CNAME`.
- Keep the SaaS app/backend in the existing `app/` direction unless Vlad explicitly changes the architecture.
- Do not create a separate `backend/` folder unless Vlad explicitly approves the architecture change.
