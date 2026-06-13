# Codex Local Workspace

This folder holds the local Codex/ChatGPT agent workspace for Missed Calls
Dental. It is for project-specific agent guidance, safe MCP examples, and
skill-style reference instructions. It must never contain provider credentials,
OAuth exports, raw customer data, logs with sensitive identifiers, or copied
values from `.env` or `.env.local`.

## Local Skills

Project-local skills live in `.codex/skills/<skill-name>/SKILL.md`.

Use these files as concise, task-specific guidance for Codex/ChatGPT work in
this repo. They mirror the project safety rules from `AGENTS.md`,
`MVP_BUILD_DOCS/`, `Skills/`, and relevant `.claude/skills/` files.

Current public Codex docs discover repo-scoped skills from `.agents/skills`.
This repo intentionally does not use `.agents/`, so `.codex/skills` is the
approved local workspace unless Vlad explicitly changes that policy. Do not add
`.agents/` as a workaround.

## Commit-Safe vs Local-Only

Safe to commit:

- `.codex/README.md`
- `.codex/config.toml` when it contains only public endpoints, safe defaults,
  and no provider credentials
- `.codex/skills/**/SKILL.md`
- Documentation that explains setup without copying credential values

Keep local-only and out of git:

- `.env`, `.env.local`, and any env file containing real credentials
- OAuth cache files, session exports, browser auth artifacts, or generated local
  credential stores
- Logs or screenshots that include private account, patient, billing, provider,
  or deployment details

## MCP Verification

Current local status as of 2026-06-13:

- `playwright`: enabled; no OAuth required.
- `vercel`: enabled and OAuth-authenticated after the local browser flow.
- `twilioDocs`: enabled; read-only docs/spec lookup with no OAuth required.
- `github`: already present in the Codex MCP list; do not add tokens to repo
  files.
- `supabase`: present with OAuth in the Codex MCP list for project ref
  `qfjpvbvfvhbtebwivcdc`. A metadata-only check confirmed the ref is accessible,
  but account/org/project-name metadata was not exposed. Do not use service-role
  keys for MCP, and do not run SQL or mutations without explicit owner approval.
- `stripe`: intentionally disabled in `.codex/config.toml` until Vlad asks to
  enable it for sandbox/test billing work.
- `sentry`: optional later; not configured here.
- Local repo access: provided by the shared workspace/VS Code/Codex environment.

For Codex CLI, use:

```powershell
codex mcp list
```

Inside a Codex TUI session, use:

```txt
/mcp
```

For VS Code, run these commands from the Command Palette:

- `MCP: List Servers`
- `MCP: Reset Cached Tools` after changing server config
- `MCP: Open Workspace Folder MCP Configuration` to inspect `.vscode/mcp.json`

Use a harmless verification prompt:

```txt
List available MCP servers and confirm which are authenticated without reading or printing any secrets.
```

## OAuth Services

For OAuth-backed services, put only the public MCP URL in config and let the
human complete browser authorization. Do not paste OAuth tokens, API keys,
webhook signing values, database URLs, or provider secrets into MCP config.

Recommended manual commands are documented in `docs/AI-AGENT-LOCAL-SETUP.md`.
Prefer sandbox/test access for Stripe and staging/read-only access for database
work. Production actions still require explicit owner approval and all project
safety gates.

If a local or user-level MCP config contains an inline key in a URL, do not copy
or repeat that value in chat, docs, commits, screenshots, or logs.
