# Backend Foundation Handoff

## Current Architecture

- `docs/` = GitHub Pages marketing site
- `app/` = reserved future SaaS/backend app
- Do not use `backend/` unless the user explicitly decides to change architecture.
- Current site must remain unchanged.
- Backend will be built later by Claude.

## Required Services

- Supabase
- Twilio
- Stripe
- Vercel

## Required Environment Variable Names

- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `TWILIO_PHONE_NUMBER_SID`
- `TWILIO_MESSAGING_SERVICE_SID`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ACCOUNT_ID`
- `JOB_RUNNER_SECRET`
- `INTERNAL_ADMIN_SECRET`

## Future First Backend Tasks for Claude

1. Create root Next.js/Vercel app foundation without breaking `docs/`.
2. Add `app/api/health` route.
3. Add Supabase server helper.
4. Add Supabase migrations.
5. Add Twilio signature validation helper.
6. Add Twilio incoming voice webhook route.
7. Add Twilio incoming SMS webhook route.
8. Add Twilio message status route.
9. Add Stripe webhook placeholder only.
10. Add structured logging and idempotency rules.

## Safety Requirements

- no secrets in Git
- no fake medical claims
- no SMS sending before explicit test approval
- no production deploy without user approval
- no changes to `docs/` without user approval
