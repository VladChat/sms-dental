# 15 — MCP Setup for AI Coding Agents

Project: Missed-Call Recovery SaaS for Dental Clinics  
Audience: founder using VS Code + Codex / CodeGPT / Cursor-style MCP clients

---

## 1. Purpose

MCP can let the AI coding agent interact with external services more directly.

Use MCP to reduce manual copy/paste, inspect staging resources, debug logs, and generate provider-specific code.

Do not use MCP as unrestricted production access.

---

## 2. Recommended MCP policy

```txt
Supabase MCP: yes, staging/dev project only
Vercel MCP: yes, project scoped if possible
Stripe MCP: yes, sandbox/test only
Twilio MCP: yes, docs/API specs only
Production MCP access: no by default
Manual approval: always for write/destructive/paid/live actions
```

---

## 3. Supabase MCP

Use for:

```txt
list tables
inspect staging schema
generate TypeScript types
read staging logs
apply migrations to staging after approval
search Supabase docs
```

Do not use against production by default.

Recommended URL pattern:

```txt
https://mcp.supabase.com/mcp?project_ref=YOUR_STAGING_PROJECT_REF&read_only=true
```

For controlled write testing in staging, remove `read_only=true` only temporarily and only with owner approval:

```txt
https://mcp.supabase.com/mcp?project_ref=YOUR_STAGING_PROJECT_REF
```

Recommended settings:

```txt
project_ref: always set
read_only: true by default
features: database,docs,development,debugging
```

Example MCP config for compatible clients:

```json
{
  "mcpServers": {
    "supabase-staging-readonly": {
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_STAGING_PROJECT_REF&read_only=true"
    }
  }
}
```

Owner action:

```txt
Log in through the browser OAuth flow when the MCP client asks.
Approve only staging/dev access.
Do not connect production unless explicitly intended.
```

---

## 4. Vercel MCP

Use for:

```txt
search Vercel docs
inspect deployments
analyze deployment logs
manage preview/staging context
```

General MCP URL:

```txt
https://mcp.vercel.com
```

Project-specific MCP URL pattern:

```txt
https://mcp.vercel.com/YOUR_TEAM_SLUG/YOUR_PROJECT_SLUG
```

Example MCP config:

```json
{
  "mcpServers": {
    "vercel": {
      "url": "https://mcp.vercel.com/YOUR_TEAM_SLUG/YOUR_PROJECT_SLUG"
    }
  }
}
```

Owner action:

```txt
Authorize through OAuth.
Prefer project-specific access.
Do not allow production deploy/env var changes without approval.
```

---

## 5. Stripe MCP

Use for:

```txt
search Stripe docs
create/list sandbox products
create/list sandbox prices
inspect sandbox customers/subscriptions
debug test checkout flow
```

Remote MCP URL:

```txt
https://mcp.stripe.com
```

Example MCP config:

```json
{
  "mcpServers": {
    "stripe-sandbox": {
      "url": "https://mcp.stripe.com"
    }
  }
}
```

Owner action:

```txt
Authorize Stripe MCP in sandbox/test mode first.
Keep live mode separate.
Do not let the agent create/cancel/update live subscriptions without approval.
```

If using local Stripe MCP instead of OAuth, use only a restricted test key:

```json
{
  "mcpServers": {
    "stripe-local-test": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp@latest"],
      "env": {
        "STRIPE_SECRET_KEY": "sk_test_RESTRICTED_OR_TEST_KEY"
      }
    }
  }
}
```

Never put a live unrestricted Stripe secret key in MCP config.

---

## 6. Twilio MCP

Use for:

```txt
search Twilio docs
retrieve API schemas
confirm webhook payload fields
confirm TwiML parameters
confirm Messaging/Voice API usage
```

Twilio MCP URL:

```txt
https://mcp.twilio.com/docs
```

Example MCP config:

```json
{
  "mcpServers": {
    "twilio-docs": {
      "url": "https://mcp.twilio.com/docs"
    }
  }
}
```

Important limitation:

```txt
Twilio MCP is docs/API-spec oriented and read-only.
It does not execute actions in your Twilio account.
```

Real Twilio setup still needs owner-controlled Dashboard/API work:

```txt
buy recovery number
create Messaging Service
configure webhooks
submit A2P/10DLC
attach number to service/campaign
run live tests
```

---

## 7. Suggested `.cursor/mcp.json` / compatible MCP config

Use this as a starting point and replace placeholders.

```json
{
  "mcpServers": {
    "supabase-staging-readonly": {
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_STAGING_PROJECT_REF&read_only=true"
    },
    "vercel": {
      "url": "https://mcp.vercel.com/YOUR_TEAM_SLUG/YOUR_PROJECT_SLUG"
    },
    "stripe-sandbox": {
      "url": "https://mcp.stripe.com"
    },
    "twilio-docs": {
      "url": "https://mcp.twilio.com/docs"
    }
  }
}
```

If the current AI client does not support MCP, skip this file and use provider dashboards/CLI manually.

---

## 8. Approval gates for MCP tool calls

Require owner approval for:

```txt
Supabase:
- apply_migration
- execute_sql that writes/updates/deletes
- schema changes
- any production access

Vercel:
- production deploy
- production environment variable changes
- project deletion or domain changes

Stripe:
- live mode changes
- creating live products/prices
- cancelling/updating subscriptions
- refunds or disputes

Twilio:
- no account actions through MCP currently
- still require approval for Dashboard/API changes outside MCP
```

---

## 9. Recommended sequence

```txt
1. Start with no MCP and build local skeleton.
2. Add Supabase MCP for staging schema/logs.
3. Add Vercel MCP for preview logs once deployed.
4. Add Stripe MCP sandbox before billing milestone.
5. Add Twilio MCP docs before webhook milestones.
6. Keep production disconnected until staging passes.
```

---

## 10. Troubleshooting

If MCP auth fails:

```txt
use provider dashboard manually
use CLI manually
use placeholders in code
continue with mocks
document exact missing setup
```

Do not block the whole MVP because an MCP client is unavailable.

---

## 11. Source notes

These instructions are based on the official MCP documentation for Supabase, Vercel, Stripe, and Twilio as of May 2026. If a provider changes MCP capabilities, follow the provider's current documentation and keep the safety policy: staging first, production only with approval.
