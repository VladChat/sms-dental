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

- `.env.local` purpose: local secret/credential values only. Never commit.
- `.env.local.example` purpose: secret-only template with variable names only. No real values.

Secret/credential variables:

- `SUPABASE_DB_URL`
- `SUPABASE_DB_DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VERCEL_TOKEN`
- `RESEND_API_KEY`

Operational exception currently still required by active code:

- `INTERNAL_ADMIN_SECRET` (protects internal health endpoint auth in `app/api/internal/health/route.ts`)

Removed variables:

- `JOB_RUNNER_SECRET` (placeholder/dead in current app code; do not reintroduce unless a real production requirement is designed and documented)

## Committed Runtime Config Ownership

Non-secret application/runtime settings live in committed config under `config/runtime.config.ts`:

- public app/site URLs
- Twilio phone number / Twilio phone number SID / Twilio messaging service SID
- Stripe account ID
- setup email sender config
- onboarding safety flags (`twilioNumberPurchaseEnabled`, `ownerTestSetupLinkFallback`)

Future agent rule:

Before adding a new variable, classify it first:

1. secret/credential -> `.env.local` or Vercel env
2. non-secret runtime config -> committed `config/`
3. dead/test placeholder -> do not add

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
