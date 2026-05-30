# 10 — Environment and Deployment

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1 — AI coding agent edition  
Primary audience: founder, AI coding agent, technical operator

---

## Current project override — May 2026

Use this file as deployment reference, but apply the current repository decisions below:

- The existing public marketing website remains in `docs/` and is hosted by GitHub Pages at `https://missedcallsdental.com`.
- The future Next.js SaaS app/backend should use the existing `app/` direction and deploy to Vercel later.
- The likely future app/backend domain is `https://app.missedcallsdental.com`.
- There is currently no Vercel project for this repository.
- Do not create a Vercel project, deploy, change DNS, or configure production webhooks without explicit user approval.
- The current committed root env template is `.env.local.example`.
- The real local secrets file is `.env.local`; never commit or print it.

If this file conflicts with `PROJECT-CONTEXT.md`, use `PROJECT-CONTEXT.md` for the current state.

---

## 1. Purpose

This file defines environments, configuration/secrets split, deployment model, URLs, webhooks, jobs, and production launch expectations.

Default MVP stack:

```txt
Frontend/backend: Next.js
Hosting: Vercel
Database/Auth: Supabase
Voice/SMS: Twilio
Billing: Stripe
Jobs: Vercel Cron or Supabase scheduled job
Monitoring: Sentry or equivalent
```

Do not use Fly.io for the MVP unless the owner explicitly changes the hosting decision later.

---

## 2. Environments

Use three environments:

```txt
local
staging
production
```

### Local

Used for:

```txt
AI coding in VS Code/Codex
unit tests
component tests
mocked Twilio/Stripe payloads
local database migrations
```

Local may use:

```txt
local Supabase
or separate Supabase dev/staging project
```

### Staging

Used for:

```txt
real webhook testing
Twilio test/staging number
Stripe test mode
Vercel preview/staging deployment
full E2E QA
```

Staging must not share patient data with production.

### Production

Used only after staging passes.

Production requires:

```txt
production domain
production Supabase project
production Twilio configuration
Stripe live mode
production Vercel environment variables
monitoring and launch checklist
```

---

## 3. Domain and URL plan

Recommended:

```txt
Marketing site:          https://missedcallsdental.com
Production app planned:  https://app.missedcallsdental.com
Staging app, optional:   https://staging.missedcallsdental.com
```

Temporary staging can use a Vercel preview URL.

Production webhooks should use stable production app URL:

```txt
https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming
https://app.missedcallsdental.com/api/webhooks/twilio/voice/call-status
https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming
https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status
https://app.missedcallsdental.com/api/webhooks/stripe
```

Do not point production Twilio/Stripe webhooks at temporary preview URLs.

---

## 4. Config and secrets split

For the older MVP package, these examples exist under `MVP_BUILD_DOCS/`. For the current repository, use the root `.env.local.example` as the active committed env-name template.

Reference examples:

```txt
config/runtime.config.example.ts
env/.env.secrets.example
```

### Non-secret runtime config

`config/runtime.config.example.ts` contains non-secret config and provider IDs:

```txt
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
TWILIO_ACCOUNT_SID
TWILIO_API_KEY_SID
TWILIO_DEFAULT_MESSAGING_SERVICE_SID
STRIPE_PRICE_ID_MONTHLY
STRIPE_PRICE_ID_ANNUAL
SENTRY_DSN
support/admin emails
trial days
follow-up defaults
```

These are not private passwords, but many are environment-specific.

### Real private secrets

`env/.env.secrets.example` contains secret names only:

```txt
SUPABASE_SERVICE_ROLE_KEY
TWILIO_AUTH_TOKEN
TWILIO_API_KEY_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Real values go into:

```txt
local: .env.local
staging/production: Vercel Environment Variables
optional: secure vault
```

Never commit `.env.local`.

---

## 5. Vercel deployment

Recommended flow:

```txt
1. Connect GitHub repo to Vercel.
2. Create Vercel project.
3. Configure staging/preview env vars.
4. Deploy preview/staging.
5. Run QA.
6. Configure production env vars.
7. Attach production domain.
8. Deploy production only after approval.
```

AI agent may inspect Vercel preview logs via Vercel MCP if configured.

Production deploys require owner approval.

---

## 6. Supabase deployment

Recommended flow:

```txt
1. Create Supabase staging/dev project.
2. Apply migrations to staging.
3. Verify RLS policies.
4. Generate TypeScript types.
5. Run E2E flow in staging.
6. Create production Supabase project later.
7. Apply reviewed migrations to production.
```

AI agent may use Supabase MCP for staging/dev.

Production database changes require owner approval.

---

## 7. Stripe setup

Use Stripe sandbox/test first.

Required setup:

```txt
Product
Monthly price
Annual price, optional
Checkout
Customer Portal
Webhook endpoint
```

Use Stripe live mode only after billing QA passes.

AI agent may use Stripe MCP in sandbox/test.

Live-mode Stripe changes require owner approval.

---

## 8. Twilio setup

Twilio setup includes:

```txt
recovery number
Messaging Service
Advanced Opt-Out
voice webhook URLs
messaging webhook URLs
status callback URLs
A2P/10DLC compliance path
```

Twilio MCP is for docs/API schemas only. It does not execute account actions.

Owner must approve:

```txt
number purchase
production webhook changes
A2P/10DLC submission
sending real SMS
```

---

## 9. Background jobs

MVP options:

```txt
Option A: Vercel Cron calls /api/jobs/process-due-followups
Option B: Supabase scheduled job / pg_cron calls secured endpoint
```

Job endpoint must require:

```txt
```

Job must process:

```txt
pending first SMS
15-minute follow-up
next-business-day follow-up
controlled resend if undelivered
```

---

## 10. Health check

Add:

```txt
GET /api/health
```

Response:

```json
{
  "ok": true,
  "env": "staging",
  "version": "..."
}
```

Do not expose secrets or provider credentials.

---

## 11. Logging and monitoring

Log:

```txt
webhook received
signature validation result
state transitions
SMS send attempts
message status callbacks
call status callbacks
Stripe event processing
admin actions
job runs
```

Do not log:

```txt
secret keys
full auth headers
unredacted patient-sensitive content where avoidable
```

Recommended monitoring:

```txt
Sentry or equivalent
Vercel logs
Supabase logs
Twilio logs
Stripe logs
```

---

## 12. Deployment checklist

Before staging:

```txt
[ ] repo connected to Vercel
[ ] Supabase staging project created
[ ] runtime config set
[ ] staging secrets set
[ ] migrations applied
[ ] auth works
[ ] mocked webhook tests pass
```

Before production:

```txt
[ ] staging E2E passed
[ ] production domain chosen
[ ] production Supabase project created
[ ] production env vars set in Vercel
[ ] Twilio production setup ready
[ ] Stripe live setup ready
[ ] STOP/opt-out tested
[ ] RLS tested
[ ] owner approval recorded
```

---

## 13. Rollback plan

If deploy breaks:

```txt
rollback Vercel deployment
disable cron job if needed
pause automation for affected clinic
inspect logs
```

If SMS automation misbehaves:

```txt
disable clinic automation
stop follow-up job
pause Messaging Service if needed
manual front desk follow-up
```

If database migration breaks:

```txt
stop deploy
restore from backup if needed
apply rollback migration
verify RLS and data integrity
```

---

## 14. Production launch acceptance criteria

```txt
[ ] production app loads
[ ] login works
[ ] clinic settings work
[ ] Twilio voice webhook works
[ ] first SMS works
[ ] inbound SMS works
[ ] STOP works
[ ] callback bridge works
[ ] dashboard updates
[ ] billing works
[ ] monitoring enabled
[ ] no secrets committed
```
