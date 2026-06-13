# AI Agent Local Setup

This file documents the local Codex/ChatGPT agent workspace for Missed Calls
Dental. It contains no credentials and does not replace the safety rules in
`AGENTS.md` or `MVP_BUILD_DOCS/AGENT-RULES.md`.

## Files Created

- `AGENTS.md` — updated repo-wide agent guidance and final report format.
- `.codex/README.md` — local Codex workspace notes.
- `.codex/config.toml` — project-scoped Codex MCP config with public endpoints
  only.
- `.codex/skills/*/SKILL.md` — local project skill references.
- `.vscode/mcp.json` — VS Code MCP workspace config with public endpoints only.
- `docs/AI-AGENT-LOCAL-SETUP.md` — this setup guide.

## Local Skills

Local skills are stored under `.codex/skills/`:

- `dental-product`
- `twilio-dental-sms`
- `supabase-postgres`
- `stripe-billing`
- `react-next`
- `ui-ux`
- `cro-seo`

Current public Codex documentation discovers repo skills from `.agents/skills`.
This repo intentionally does not use `.agents/`, so `.codex/skills` is the
approved local workspace unless Vlad explicitly changes that policy.

## Recommended MCPs

Current local status as of 2026-06-13:

- `playwright` — working; no OAuth required.
- `vercel` — working after browser OAuth. Use only for safe inspection unless
  Vlad explicitly authorizes a deploy, env change, domain change, or other
  production mutation.
- `twilioDocs` — working; no OAuth required. Documentation/schema lookup only.
- `github` — already configured in the current Codex MCP list. Do not add or
  paste GitHub tokens into repo config.
- `supabase` — configured with OAuth in the current Codex MCP list for
  project ref `qfjpvbvfvhbtebwivcdc`. A metadata-only MCP check confirmed that
  this ref is accessible; Supabase did not expose account/org/project-name
  metadata in that safe check. Do not use service role keys for MCP config, and
  do not mutate production data or schema without explicit owner approval.
- `stripe` — intentionally disabled in `.codex/config.toml`; optional later.
- `sentry` — not configured; optional later.
- `filesystem/local repo access` — available through Codex/VS Code native
  workspace access. Do not rely on any global filesystem MCP that points at a
  different project path.

Configured now:

- `playwright` — local browser/UI testing through the official Playwright MCP
  package; configured in Codex and VS Code.
- `vercel` — official Vercel remote MCP at `https://mcp.vercel.com`.
- `twilioDocs` — official Twilio docs/spec lookup at
  `https://mcp.twilio.com/docs`; read-only, no Twilio account actions.
- `stripe` — official Stripe remote MCP at `https://mcp.stripe.com`; use
  sandbox/test authorization first. It is present in `.vscode/mcp.json` and
  listed but disabled in `.codex/config.toml` until deliberately enabled for a
  billing task.

Not configured by default:

- `github` — use only if the current client already has authenticated GitHub
  access; do not add a new token to this repo.
- `supabase` — use read-only metadata inspection by default. The current target
  is the Dental SMS project ref `qfjpvbvfvhbtebwivcdc`; any SQL, migration,
  schema, or data operation still requires explicit owner approval.
- `filesystem` — omitted because Codex and VS Code already provide local
  workspace access.
- `sentry` — add later only when the project actively needs Sentry MCP access
  and OAuth is completed by the human.

## Manual Codex MCP Commands

Run these only when you want the MCP added to your Codex user/project config:

```powershell
codex mcp add vercel --url https://mcp.vercel.com
codex mcp add twilio-docs --url https://mcp.twilio.com/docs
```

Vercel uses OAuth. Complete browser authorization yourself when Codex prompts.

Twilio docs MCP is for documentation and schema lookup. It does not replace the
app's live-send guardrails, readiness checks, Twilio signature validation,
idempotency, opt-out handling, or explicit owner approval requirements.

Stripe MCP is official, but billing access must be deliberate:

```powershell
codex mcp add stripe --url https://mcp.stripe.com
```

Authorize Stripe sandbox/test access first. Do not authorize live billing work
unless Vlad explicitly asks for that exact scope.

## VS Code MCP

VS Code uses `.vscode/mcp.json` with a top-level `servers` object. This differs
from Codex `config.toml`, which uses `[mcp_servers.<name>]` tables.

After changing `.vscode/mcp.json`:

1. Restart VS Code, or run `MCP: Reset Cached Tools`.
2. Run `MCP: List Servers`.
3. Start the server you need.
4. Complete browser OAuth only for the service you intentionally want to use.

## Secrets Policy

Do not copy values from `.env`, `.env.local`, provider dashboards, OAuth
callbacks, API key pages, webhook signing pages, or browser sessions into MCP
config.

If a client needs env loading, reference an env file only in a local-only config
and keep the file ignored. The committed MCP files in this repo should contain
only public endpoints, safe package commands, and no credential values.

## Harmless Verification Prompt

Use this prompt after refreshing MCP:

```txt
List available MCP servers and confirm which are authenticated without reading or printing any secrets.
```

If a server is not authenticated, leave browser authorization to the human. Do
not ask an agent to read or print auth files to diagnose it.

Safe CLI checks:

```powershell
codex mcp list
codex mcp get vercel
codex mcp get twilioDocs
```

If a local or user-level MCP config contains an inline key in a URL, do not copy
or repeat that value in chat, docs, commits, screenshots, or logs.
