# OWNER — Fill This Out for AI Coding Agent Setup

Project: Missed-Call Recovery SaaS for Dental Clinics  
Audience: founder/owner  
Purpose: collect non-sensitive information needed by the AI coding agent and deployment setup.

---

## Read this first

Fill this file with **non-sensitive information only**.

Do not paste:

```txt
API secret keys
passwords
auth tokens
Supabase service-role key
Stripe secret key
Stripe webhook secret
Twilio auth token
Twilio API key secret
production database password
real patient data
```

Real secrets go into:

```txt
local development: .env.local
staging/production: Vercel Environment Variables
optional sharing: secure vault
```

---

## 1. Product basics

```txt
Product name:
Working app name:
Founder/admin name:
Founder/admin email:
Support email:
Default timezone:
Default country: US
Default patient language: English
```

Pricing:

```txt
Monthly price:
Annual price, if any:
Trial length: 21 days after live activation
```

Scope confirmation:

```txt
[ ] Missed-call recovery only
[ ] No AI receptionist in v0.1
[ ] No PMS integration in v0.1
[ ] No number porting in v0.1
[ ] No call recording/transcription in v0.1
[ ] No Fly.io in default MVP
```

---

## 2. Domain and URL decisions

Recommended structure:

```txt
Marketing site, optional: https://www.<your-domain>.com
Production app:          https://app.<your-domain>.com
Staging app, optional:   https://staging.<your-domain>.com
```

Fill:

```txt
Primary domain:
Production app URL:
Staging app URL:
Temporary Vercel preview URL:
Marketing URL, optional:
```

Twilio/Stripe webhook base URLs:

```txt
Staging webhook base URL:
Production webhook base URL:
```

---

## 3. Accounts the owner should create/own

```txt
[ ] GitHub account/repo
[ ] Vercel account/project
[ ] Supabase staging/dev project
[ ] Supabase production project, later
[ ] Twilio account
[ ] Stripe account with sandbox/test enabled
[ ] Domain registrar/DNS account
[ ] Sentry/monitoring account, optional
```

No outside human developer invite is required by default.

---

## 4. AI coding agent setup

Which agent/client are you using?

```txt
[ ] VS Code + Codex
[ ] VS Code + CodeGPT
[ ] Cursor
[ ] Claude Code
[ ] Windsurf
[ ] Other:
```

Repo access method:

```txt
[ ] local folder opened in VS Code
[ ] GitHub connector
[ ] Codex connected to GitHub repo
[ ] other:
```

---

## 5. MCP setup tracker

Supabase:

```txt
Staging project ref:
MCP URL:
https://mcp.supabase.com/mcp?project_ref=<PROJECT_REF>&read_only=true

[ ] OAuth connected
[ ] project_ref scoped
[ ] read_only enabled by default
[ ] production not connected
```

Vercel:

```txt
Team slug:
Project slug:
MCP URL:
https://mcp.vercel.com/<TEAM_SLUG>/<PROJECT_SLUG>

[ ] OAuth connected
[ ] project-scoped if possible
[ ] production actions require approval
```

Stripe:

```txt
[ ] Stripe sandbox/test enabled
[ ] Stripe MCP connected to sandbox/test
[ ] live mode not connected or requires approval
```

Twilio:

```txt
MCP URL:
https://mcp.twilio.com/docs

[ ] Twilio docs MCP connected
[ ] understood: Twilio MCP is docs/API-spec only
```

---

## 6. Non-secret runtime config

These can go into `config/runtime.config.example.ts` or Vercel non-secret env vars:

```txt
NEXT_PUBLIC_APP_URL:
NEXT_PUBLIC_SUPABASE_URL:
NEXT_PUBLIC_SUPABASE_ANON_KEY:
TWILIO_ACCOUNT_SID:
TWILIO_API_KEY_SID:
TWILIO_DEFAULT_MESSAGING_SERVICE_SID:
STRIPE_PRICE_ID_MONTHLY:
STRIPE_PRICE_ID_ANNUAL:
SENTRY_DSN, optional:
Support email:
Admin email allowlist:
```

These are not private passwords, but should still be managed carefully and per environment.

---

## 7. Secrets tracker — do not paste values here

Mark only whether configured.

Local `.env.local`:

```txt
[ ] SUPABASE_SERVICE_ROLE_KEY configured
[ ] TWILIO_AUTH_TOKEN configured, if used
[ ] TWILIO_API_KEY_SECRET configured, preferred for app runtime
[ ] STRIPE_SECRET_KEY configured, test mode first
[ ] STRIPE_WEBHOOK_SECRET configured, test mode first
```

Vercel staging:

```txt
[ ] Supabase staging secrets set
[ ] Twilio staging/test secrets set
[ ] Stripe test secrets set
[ ] internal secrets set
```

Vercel production, later:

```txt
[ ] Supabase production secrets set after staging QA
[ ] Twilio production secrets set after activation readiness
[ ] Stripe live secrets set after billing QA
[ ] production secrets not exposed unnecessarily
```

---

## 8. First pilot clinic information

Use fake/test data first.

```txt
Clinic name:
Clinic main phone number:
Clinic callback/front-desk phone number:
Clinic timezone:
Business hours:
Emergency instruction text:
Average recovered appointment value:
```

Real clinic data should not be committed to repo.

---

## 9. Owner approval gates

AI must ask before:

```txt
[ ] applying Supabase migrations
[ ] running SQL that changes data
[ ] production deploy
[ ] production env changes
[ ] Stripe live mode changes
[ ] Twilio live webhook changes
[ ] buying Twilio numbers
[ ] A2P/10DLC campaign submission
[ ] DNS changes
[ ] sending real SMS
```

---

## 10. Initial prompt to AI coding agent

```txt
Read START-HERE.md and AGENT-RULES.md first.

This project is built by an AI coding agent in my local VS Code/Codex-style environment, not by an outside human developer.

Do not ask for collaborator invites.
Do not ask for production secrets.
Use staging/dev resources first.
Use MCP only if configured.
Ask before migrations, production deploys, billing changes, Twilio live changes, DNS changes, or real SMS.
Build the milestones in 07-build-plan-and-tasks.md in order.
```
