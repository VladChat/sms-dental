# 14 — AI Codex / VS Code Workflow

Project: Missed-Call Recovery SaaS for Dental Clinics  
Audience: founder using VS Code + Codex / CodeGPT / VibeCode-style AI coding tools

---

## 1. Purpose

This file explains how to use the documentation package with an AI coding agent instead of a human developer.

The AI agent should build the app milestone-by-milestone from `07-build-plan-and-tasks.md`.

---

## 2. Recommended local workflow

```txt
1. Create/open the GitHub repo locally in VS Code.
2. Copy this docs package into /docs or keep it next to the project.
3. Give the agent START-HERE.md and AGENT-RULES.md first.
4. Ask the agent to implement one milestone at a time.
5. Review diffs before accepting large changes.
6. Run tests/typecheck after each milestone.
7. Commit working milestones.
```

---

## 3. First prompt

Use this prompt:

```txt
You are the AI coding agent for this MVP.

Read docs/START-HERE.md and docs/AGENT-RULES.md first.

Build the app milestone-by-milestone from docs/07-build-plan-and-tasks.md.

Important:
- Do not expand scope.
- Do not ask for production secrets.
- Do not commit .env.local.
- Use config/runtime.config.example.ts for non-secret config.
- Use env/.env.secrets.example only as a secret-name template.
- Use MCP tools only if configured.
- Ask before applying migrations, changing billing, changing Twilio/Vercel production settings, changing DNS, or sending real SMS.
```

---

## 4. Milestone prompt template

For each milestone:

```txt
Implement Milestone <number> from docs/07-build-plan-and-tasks.md.

Before coding:
1. summarize the goal,
2. list files you expect to create/change,
3. mention any missing env vars or provider resources.

Then implement only this milestone.

After coding:
1. summarize changed files,
2. list commands run,
3. list tests passed/failed,
4. list any remaining owner actions.
```

---

## 5. Provider-credential workflow

Do not provide all credentials at once.

Use this sequence:

```txt
Milestone 1-2: no real provider credentials; use placeholders/mocks.
Milestone 3: Supabase dev/staging config.
Milestone 4-6: Twilio staging/test values and webhook URL.
Milestone 9-11: Stripe sandbox/test values.
Milestone 13+: Vercel staging env vars and preview logs.
Production: owner approval only.
```

---

## 6. Recommended branch/commit flow

```txt
main
  └── feat/milestone-1-foundation
  └── feat/milestone-2-db
  └── feat/milestone-3-auth
  └── feat/milestone-4-twilio-voice
  └── feat/milestone-5-sms
```

If the AI agent creates too many changes at once, stop it and ask it to split the work.

---

## 7. Manual review checklist for each AI change

Before accepting a large AI-generated patch:

```txt
[ ] No secrets committed
[ ] No production-only assumptions
[ ] No scope expansion
[ ] RLS not bypassed
[ ] Webhooks validate signatures
[ ] Idempotency is preserved
[ ] Tests or mocked payload checks added when relevant
[ ] UI remains simple and focused
```

---

## 8. When the AI is allowed to be hands-off

Safe hands-off areas:

```txt
UI skeleton
TypeScript types
local utility functions
mock tests
documentation updates
non-production preview logs
read-only MCP calls
```

Not hands-off:

```txt
database migrations
production deploys
billing changes
Twilio live setup
DNS
A2P submissions
real patient messaging
```

---

## 9. If the agent gets stuck

Tell it:

```txt
Do not change architecture. Return to START-HERE.md, AGENT-RULES.md, and the current milestone. Use mocks/placeholders for missing provider resources. Ask only for the smallest missing staging/test value needed.
```

---

## 10. Done means

A milestone is done only when:

```txt
implementation complete
acceptance criteria met
tests/checks run or explicitly blocked
missing owner actions listed
no secrets committed
```
