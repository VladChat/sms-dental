# 11 — AI Access, Secrets, and MCP Handoff

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1 — AI coding agent edition  
Primary audience: founder/owner using VS Code + Codex/CodeGPT/VibeCode-style tools

---

## 1. Purpose

This file replaces the old “give a human developer access” model.

The implementer is an AI coding agent running in the founder's local coding environment.

Correct model:

```txt
Owner owns all vendor accounts.
AI agent works inside local repo/IDE.
AI agent may use MCP connectors where configured.
Real secrets live in .env.local locally or Vercel Environment Variables.
Production changes require owner approval.
```

Incorrect model:

```txt
Send the AI your personal passwords.
Paste production secrets into chat.
Commit .env.local to GitHub.
Give AI unrestricted production access.
Let AI change billing/Twilio/DNS without approval.
```

---

## 2. Access model by service

| Service | How AI should access it | Default environment | Production rule |
|---|---|---|---|
| GitHub | Local repo / GitHub connector / Codex repo access | repo workspace | OK, but owner reviews major changes |
| Supabase | Supabase MCP or CLI against dev/staging | staging/dev | production only with explicit approval |
| Vercel | Vercel MCP or CLI/project env vars | preview/staging | production deploy/env changes require approval |
| Stripe | Stripe MCP sandbox/test or test secret key | sandbox/test | live mode requires approval |
| Twilio | Twilio MCP docs server; app uses test/staging credentials | docs + staging/test | production webhooks/number/A2P require approval |
| DNS/domain | owner manually configures | staging/production setup | AI gives instructions; owner applies changes |

---

## 3. Secrets vs config

Do not use one giant `env/.env.secrets.example` and `config/runtime.config.example.ts` as a dumping ground.

Use:

```txt
config/runtime.config.example.ts
```

For non-secret runtime config and public IDs.

Use:

```txt
env/.env.secrets.example
```

For real private secrets only.

### Non-secret config examples

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
trial days
follow-up defaults
support email
```

These are not passwords, but some may still differ between local/staging/production.

### Real secrets

```txt
SUPABASE_SERVICE_ROLE_KEY
TWILIO_AUTH_TOKEN
TWILIO_API_KEY_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

These must not be committed.

---

## 4. Where real values go

### Local development

Use:

```txt
.env.local
```

This file is local-only and must be in `.gitignore`.

Use dev/staging/test values only.

### Vercel staging/production

Use:

```txt
Vercel -> Project Settings -> Environment Variables
```

Set separate values for:

```txt
Development
Preview
Production
```

Production values should not be exposed to the AI agent unless absolutely necessary.

---

## 5. MCP setup summary

Use MCP where possible to reduce manual copy/paste and make the agent more capable.

Recommended MCPs:

```txt
Supabase MCP -> staging/dev project only
Vercel MCP -> project-specific context if possible
Stripe MCP -> sandbox/test mode only
Twilio MCP -> docs/API specs only, no account actions
```

Detailed setup lives in:

```txt
15-mcp-setup.md
```

---

## 6. Owner approval gates

The AI agent must ask before doing these:

```txt
[ ] Supabase apply_migration
[ ] Supabase SQL that modifies/deletes data
[ ] Vercel production deploy
[ ] Vercel production env var changes
[ ] Stripe live product/price/subscription changes
[ ] Twilio production webhook changes
[ ] Twilio number purchase
[ ] A2P/10DLC campaign submission
[ ] DNS changes
[ ] Sending real SMS to real patient numbers
[ ] Deleting data
```

---

## 7. Recommended implementation phases

### Phase A — Local only

AI can:

```txt
create app
write code
write migrations
write tests
use mocked Twilio/Stripe payloads
```

No provider secrets required.

### Phase B — Staging/dev provider access

Owner creates staging/dev resources and configures MCP/env vars.

AI can:

```txt
apply staging migrations with approval
test Supabase auth/database
test Stripe sandbox checkout
test Twilio webhooks with a staging number
inspect Vercel preview logs
```

### Phase C — Production preparation

AI can generate instructions and checklists.

Owner applies/approves:

```txt
production env vars
production domain/DNS
production Twilio setup
Stripe live mode
final launch
```

---

## 8. What the AI should ask for

The AI should ask only for the minimum current value needed.

Good request:

```txt
I need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for the staging Supabase project to test auth locally.
```

Bad request:

```txt
Give me all production secrets now.
```

---

## 9. Bottom line

The goal is hands-off development, not uncontrolled access.

Use:

```txt
AI + repo + staging MCP + staging env vars + owner approval gates
```

Avoid:

```txt
AI + production secrets + unrestricted vendor access
```
