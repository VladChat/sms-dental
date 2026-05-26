# Agent Prompt Rule Addendum — Operational Docs

Status: Active  
Purpose: Reminder for future ChatGPT/Codex/Claude prompts

This addendum records how future prompts should be written for this project.

---

## Default prompt requirement

For every backend, infrastructure, deployment, DNS, Supabase, Vercel, Twilio, Stripe, or production-like task, the prompt should explicitly require the agent to:

1. perform the requested work;
2. verify the result;
3. decide whether operational documentation must be updated;
4. update the relevant docs if needed;
5. commit and push only approved files when a commit is requested.

The agent should not finish with only a technical report if durable project knowledge changed.

---

## Durable project knowledge examples

Update docs when a task changes or confirms:

- Vercel deployment method, domain, alias, env vars, deployment ID, or production behavior
- Supabase migration, schema, pooler/direct connection behavior, RLS, or DB verification result
- Twilio webhook configuration, account status, trial/paid limitation, call/SMS verification, or delivery behavior
- Stripe products, prices, checkout, webhooks, billing rules, or subscription behavior
- DNS records or provider instructions
- public URLs and webhook URLs
- first successful end-to-end tests
- confirmed errors and confirmed fixes
- operational ordering lessons that prevent future mistakes

Do not update docs for noise, temporary failed commands, raw logs, speculation, duplicate facts, or secrets.

---

## Standard prompt block to include

Use this block in future agent prompts when relevant:

```txt
Operational documentation:
At the end of this task, decide whether this created durable operational knowledge.
If yes, update the relevant docs:
- MVP_BUILD_DOCS/SETUP-LOG.md
- MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
- MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md
- MVP_BUILD_DOCS/backend-foundation-v1.md if this changes foundation status
- MVP_BUILD_DOCS/PROJECT-CONTEXT.md if this changes product/architecture understanding

Do not write secrets, full DB URLs with passwords, API keys, tokens, private patient data, or raw customer data into docs.

Final report must include:
- operations docs updated: yes/no
- docs files changed if yes
```

---

## Current next prompt direction

The next agent task should focus on:

```txt
Clinic / phone mapping + safe first SMS logic
```

The task should keep outbound SMS disabled until mapping, opt-out handling, duplicate suppression, and explicit owner approval are implemented.
