# START HERE — AI Coding Agent Version

Use this folder as the current developer handoff package for building the MVP with an AI coding agent.

Ignore previous stage ZIP files, patch ZIP files, and older versions.

---

## Current Source of Truth — May 2026

Start with `PROJECT-CONTEXT.md`. It is the master context file for the current repository state, product goal, hosting plan, safety boundaries, phone event strategy, and current implementation step.

The numbered files in this folder are useful reference documents, but they are roadmap/spec material. If any older document conflicts with `PROJECT-CONTEXT.md`, `AGENTS.md`, `.env.local.example`, `OPERATIONS-RUNBOOK.md`, `SETUP-LOG.md`, or `backend-foundation-v1.md`, use the newer files.

Current implementation state:

- `docs/` remains the existing GitHub Pages marketing website and must not be changed unless explicitly requested.
- `app/` is the Next.js SaaS app/backend direction.
- App/backend hosting is Vercel at `https://app.missedcallsdental.com`.
- Backend Foundation v1 is deployed and can reach Supabase.
- Twilio webhooks are configured by API.
- Inbound SMS webhook has been verified.
- Inbound voice verification is pending because Twilio Trial account restrictions block realistic inbound voice testing from unverified callers.

---

## Product scope

Build a narrow missed-call recovery SaaS for small dental clinics.

The app does not automatically detect calls to an unrelated clinic phone number. For MVP, call events reach the system through:

```txt
conditional forwarding mode
tracking number mode
hybrid mode
```

Conditional forwarding mode:

```txt
clinic main number -> no-answer/busy/after-hours forwarding -> assigned Twilio recovery number -> backend webhook
```

Tracking number mode:

```txt
clinic publishes assigned Twilio number on website/ads/campaign -> backend webhook
```

Hybrid mode uses both.

Future versions may add direct provider integrations.

The product does:

```txt
call event ingestion through supported phone event paths
automatic SMS recovery flow after approval/configuration
inbound SMS handling
recovery inbox later
manual booked/lost outcome tracking later
Stripe billing later
Supabase database/auth
Vercel deployment
```

The product does not do in v0.1:

```txt
AI receptionist
dental CRM
PMS integration
phone system replacement
call recording/transcription
number porting
direct integrations with every phone provider
Fly.io deployment
```

---

## Recommended reading order for the AI agent

```txt
PROJECT-CONTEXT.md
AGENT-RULES.md
OPERATIONS-RUNBOOK.md
SETUP-LOG.md
REPEATABLE-SETUP-CHECKLIST.md
backend-foundation-v1.md
backend-foundation-handoff.md
task-specific numbered docs
```

For Twilio/SMS work, also read:

```txt
Skills/twilio-dental-sms.md
Skills/missed-calls-dental-product-context.md
```

---

## Default stack

```txt
Frontend/backend: Next.js
Hosting: Vercel
Database/Auth: Supabase
Voice/SMS: Twilio
Billing: Stripe
Jobs: Vercel Cron or Supabase scheduled jobs
Secrets: local .env.local / Vercel Environment Variables
```

---

## Safety rules

Never commit:

```txt
.env
.env.local
.env.production
.env.staging
.local-agent/
real provider secrets
full database URLs with passwords
```

Dangerous actions requiring owner approval:

```txt
Supabase apply_migration / execute destructive SQL
Vercel production deployment or production env changes
Stripe live-mode products/prices/subscriptions
Twilio production webhook changes, number purchase, A2P/campaign actions
Twilio account upgrade or paid billing changes
DNS changes
Sending real patient SMS
```

---

## One-file summary

If the AI agent gets confused, reset it with this:

```txt
Build the MVP exactly as scoped: a call event reaches the system through conditional forwarding, a dedicated tracking number, or later provider integrations. The backend validates the event, records it, sends safe SMS recovery only after approval/configuration, handles replies, shows a recovery inbox, and later supports billing. No AI receptionist, no PMS sync, no phone-system replacement, no Fly.io. Use Vercel, Supabase, Twilio, Stripe. Work locally/staging first. Production actions require owner approval.
```
