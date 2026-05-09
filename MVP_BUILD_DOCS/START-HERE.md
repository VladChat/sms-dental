# START HERE — AI Coding Agent Version

Use this folder as the single final developer handoff package for building the MVP with an AI coding agent in VS Code / Codex / CodeGPT / Cursor-style tools.

Ignore all previous stage ZIP files, patch ZIP files, and older versions.

---

## 1. Who this package is for

Primary implementer:

```txt
AI coding agent working inside the founder's local development environment
```

Examples:

```txt
VS Code + Codex
VS Code + CodeGPT
Cursor
Claude Code
Windsurf
other MCP-capable coding agents
```

This package is **not written primarily for an outside human contractor**. If a human developer is later hired, create a separate human-access plan.

---

## 2. Product scope

Build a narrow missed-call recovery SaaS for small dental clinics.

The product does:

```txt
missed call detection through Twilio recovery number
automatic SMS recovery flow
basic dental intent and urgency classification
recovery inbox for front desk
manual booked/lost outcome tracking
Stripe billing
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
Fly.io deployment
```

---

## 3. Owner first step

The owner/founder should open and fill:

```txt
OWNER-FILL-THIS-OUT.md
```

Fill only non-secret business/config information there.

Do **not** paste real API secrets, passwords, service-role keys, Stripe secret keys, Twilio auth tokens, or production credentials into markdown files.

---

## 4. Recommended reading order for the AI agent

Give the AI coding agent this instruction:

```txt
Read START-HERE.md first. Then read the numbered files in order. Follow AGENT-RULES.md before editing code or using MCP tools.
```

Reading order:

```txt
AGENT-RULES.md
MVP-Build-Spec-v1.md
00-product-brief.md
01-user-flows.md
02-technical-architecture.md
03-database-schema.md
04-api-and-webhooks.md
05-sms-rules-and-templates.md
06-ui-screens.md
07-build-plan-and-tasks.md
08-compliance-and-onboarding.md
09-test-plan.md
10-env-and-deploy.md
11-access-and-secrets-handoff.md
12-production-launch-checklist.md
13-hosting-decision-no-fly.md
14-ai-codex-vscode-workflow.md
15-mcp-setup.md
OWNER-FILL-THIS-OUT.md
REVIEW-NOTES.md
QA-AUDIT-SUMMARY.md
```

---

## 5. Default stack

```txt
Frontend/backend: Next.js
Hosting: Vercel
Database/Auth: Supabase
Voice/SMS: Twilio
Billing: Stripe
Jobs: Vercel Cron or Supabase scheduled jobs
Config: config/runtime.config.example.ts
Secrets: env/.env.secrets.example -> local .env.local / Vercel Environment Variables
```

---

## 6. AI-agent access model

The AI agent does **not** need personal passwords and does **not** need to be invited as a human user.

Instead:

```txt
GitHub/repo access: through the local VS Code/Codex workspace or GitHub connector
Supabase: use staging/dev Supabase project; optionally connect Supabase MCP
Vercel: use Vercel project; optionally connect Vercel MCP
Stripe: use Stripe sandbox/test; optionally connect Stripe MCP
Twilio: use Twilio MCP for docs/API schemas only; real Twilio account setup remains owner-controlled
Secrets: local .env.local for dev/test only; Vercel Environment Variables for staging/production
```

Production actions require owner approval.

---

## 7. Secrets rule

Use this split:

```txt
config/runtime.config.example.ts
```

For normal non-secret runtime configuration and provider IDs.

```txt
env/.env.secrets.example
```

For real private secrets only.

Never commit:

```txt
.env
.env.local
.env.production
.env.staging
```

---

## 8. MCP safety rule

MCP can make the AI agent more hands-off, but it also increases risk.

Default rule:

```txt
Use MCP freely for docs/search/read-only operations.
Use MCP write operations only in staging/dev.
Never use MCP against production without explicit owner approval.
```

Dangerous actions requiring owner approval:

```txt
Supabase apply_migration / execute destructive SQL
Vercel production deployment or production env changes
Stripe live-mode products/prices/subscriptions
Twilio production webhook changes, number purchase, A2P/campaign actions
DNS changes
Sending real patient SMS
```

---

## 9. First prompt to give Codex / CodeGPT

```txt
You are building this app locally in VS Code using the attached build docs.

Read START-HERE.md and AGENT-RULES.md first.

Important:
- There is no outside human developer.
- Do not request collaborator invites.
- Do not request production secrets.
- Use placeholders until test/staging provider credentials are available.
- Store non-secret runtime settings in config/runtime.config.example.ts.
- Store only real private secrets in env/.env.secrets.example / local .env.local / Vercel Environment Variables.
- Use MCP tools only if configured, preferably against staging/dev resources.
- Ask for owner approval before migrations, production deploys, billing changes, Twilio live settings, DNS changes, or sending real SMS.
- Implement the milestones in 07-build-plan-and-tasks.md in order.
```

---

## 10. One-file summary

If the AI agent gets confused, reset it with this:

```txt
Build the MVP exactly as scoped: missed call -> SMS -> intent/urgency -> inbox -> manual booked/lost -> dashboard -> billing. No AI receptionist, no PMS sync, no phone-system replacement, no Fly.io. Use Vercel, Supabase, Twilio, Stripe. Work locally/staging first. Production requires owner approval.
```
