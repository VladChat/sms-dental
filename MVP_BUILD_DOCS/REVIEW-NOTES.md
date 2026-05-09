# REVIEW NOTES — AI Coding Agent QA Pass

This package was reviewed and revised for the actual implementation model:

```txt
Founder uses VS Code + Codex/CodeGPT/VibeCode-style AI coding agent
```

not:

```txt
outside human developer/contractor
```

---

## Major corrections

1. Added `AGENT-RULES.md` for AI coding agent behavior, scope boundaries, approval gates, and safety rules.
2. Added `14-ai-codex-vscode-workflow.md` with milestone prompts and VS Code/Codex workflow.
3. Added `15-mcp-setup.md` with Supabase, Vercel, Stripe, and Twilio MCP setup guidance.
4. Replaced human-developer access assumptions with AI-agent access model in `11-access-and-secrets-handoff.md`.
5. Rewrote `11-access-and-secrets-handoff.md` as the AI-agent access, secrets, and MCP handoff file.
6. Updated `START-HERE.md` to say this package is for AI coding agents, not primarily for a human contractor.
7. Updated `OWNER-FILL-THIS-OUT.md` so the owner tracks MCP setup, non-secret config, and approval gates.
8. Updated `10-env-and-deploy.md` to separate:
   - `config/runtime.config.example.ts` for non-secret config;
   - `env/.env.secrets.example` for private secrets only.
9. Removed the confusing duplicate `OWNER-CONFIG-ONLY.md`.
10. Removed the confusing duplicate `config/app.config.example.ts`.
11. Preserved Vercel as the default host and kept Fly.io out of the MVP.
12. Added manual approval gates for:
   - Supabase migrations/destructive SQL;
   - Vercel production deploy/env changes;
   - Stripe live mode;
   - Twilio production settings;
   - DNS;
   - real SMS.

---

## MCP facts reflected in the docs

- Supabase MCP can be project-scoped and read-only; use staging/dev by default.
- Vercel MCP supports OAuth and project context; use staging/preview first.
- Stripe MCP supports OAuth and sandbox/live separation; use sandbox/test first.
- Twilio MCP is read-only/docs/API-spec oriented and does not execute actions in your Twilio account.

---

## Remaining owner decisions

The owner still must choose/provide:

```txt
product name
domain
GitHub repo
Vercel project
Supabase staging project
Stripe sandbox setup
Twilio account/test number
first pilot clinic test data
production launch approval
```

No production secrets should be placed in markdown files.
