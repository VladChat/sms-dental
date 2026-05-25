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

1. `MVP_BUILD_DOCS/OWNER-SETTINGS.md`
2. `config/runtime.config.ts`
3. `Skills/missed-calls-dental-product-context.md`
4. relevant `.claude/skills/*/SKILL.md`

## Required Reading Before Coding

- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`
- `MVP_BUILD_DOCS/START-HERE.md`
- `MVP_BUILD_DOCS/AGENT-RULES.md`
- `Skills/missed-calls-dental-product-context.md`

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

## Canonical Project Values

- Public brand: `Missed Calls Dental`
- Domain: `https://missedcallsdental.com/`
- Public support email: `support@missedcallsdental.com`
- Public price: `$99/month`
- Trial wording: `14-day trial starts after setup is ready · then $99/month`

## Security Rules

- Do not commit secrets.
- Do not commit `.env.local`.
- Do not commit `.env`.
- Do not commit `.claude/settings.local.json`.
- Keep secrets only in local ignored files.
- Public website copy must not expose private/admin email addresses.

## Project Structure Rules

- Keep the public website in `docs/`.
- Keep `docs/CNAME`.
- Do not restore root `CNAME`.
- Do not start backend implementation until this cleanup is committed and the working tree is clean.
