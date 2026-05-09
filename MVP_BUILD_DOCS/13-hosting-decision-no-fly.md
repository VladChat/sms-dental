# 13 — Hosting Decision: No Fly.io for MVP

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1 — AI coding agent edition  
Primary audience: founder, AI coding agent

---

## Decision

Fly.io is not part of the default MVP stack.

Default MVP stack:

```txt
Frontend/backend: Next.js
Hosting: Vercel
Database/Auth: Supabase
Voice/SMS: Twilio
Billing: Stripe
Background jobs: Vercel Cron or Supabase scheduled job
Monitoring: Sentry or equivalent
```

---

## Why this decision exists

Earlier drafts mentioned Fly.io as a generic Node-compatible deployment option. That created confusion.

The MVP does not need a persistent custom server or Docker deployment by default.

Vercel is simpler for:

```txt
Next.js app
API routes
Twilio/Stripe webhooks
Preview deployments
Vercel Cron
domain attachment
```

---

## What the AI agent should do

Use Vercel deployment assumptions.

Do not create:

```txt
fly.toml
Dockerfile for production
Fly machines
Fly deploy tokens
Fly-specific instructions
```

Unless the owner explicitly changes the decision.

---

## Vercel and MCP

The AI agent may use Vercel MCP to inspect preview/staging deployments and logs if configured.

Production deploys and production environment variable changes require owner approval.

---

## Background jobs without Fly.io

Use:

```txt
Option A: Vercel Cron -> secured /api/jobs/process-due-followups endpoint
Option B: Supabase scheduled job / pg_cron -> secured job endpoint
```

Default recommendation:

```txt
Vercel Cron for the MVP unless Supabase scheduling proves easier in implementation.
```

---

## Bottom line

No Fly.io access, token, account, or deployment plan is needed for MVP v0.1.
