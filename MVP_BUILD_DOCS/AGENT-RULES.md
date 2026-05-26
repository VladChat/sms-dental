# AGENT RULES — For Codex / CodeGPT / AI Coding Agents

Project: Missed-Call Recovery SaaS for Dental Clinics  
Audience: AI coding agent operating in VS Code or another coding IDE

---

## 0. Current source of truth and active milestone

Before implementing anything, read `PROJECT-CONTEXT.md` first.

Current live state:

- Backend Foundation v1 is built, committed, pushed, deployed, and reachable at `https://app.missedcallsdental.com`.
- Supabase foundation migration has been applied.
- Vercel production backend can reach Supabase through the Supabase transaction pooler.
- `PUBLIC_WEBHOOK_BASE_URL` is set to `https://app.missedcallsdental.com`.
- `docs/` remains the GitHub Pages marketing website and must stay untouched unless explicitly requested.

Current active milestone:

- Twilio webhook setup and inbound verification.
- Configure Twilio webhooks only after owner approval.
- Do not send outbound SMS yet.
- Do not build the dashboard yet.
- Do not create Stripe resources yet.

If this file conflicts with `PROJECT-CONTEXT.md`, `OPERATIONS-RUNBOOK.md`, `SETUP-LOG.md`, `backend-foundation-handoff.md`, or `.env.local.example`, use the newer/current source for the current implementation step.

---

## 1. Prime directive

Build the MVP described in the docs. Do not expand scope.

The required MVP flow is:

```txt
missed call -> Twilio webhook -> first SMS -> inbound reply/callback -> recovery inbox -> manual booked/lost -> dashboard/billing
```

Do not build:

```txt
AI receptionist
PMS integration
dental CRM
call recording/transcription
number porting
Fly.io deployment
```

---

## 2. Work style

Before implementing a milestone:

1. Read the relevant doc.
2. Identify files to change.
3. Make the smallest coherent change.
4. Run tests/typecheck when available.
5. Report what changed.
6. Do not skip acceptance criteria.
7. Decide whether operations documentation must be updated.

---

## 3. Operational documentation update rule

At the end of every backend, infrastructure, deployment, DNS, Supabase, Vercel, Twilio, Stripe, or production-like task, the agent must decide whether the task created durable operational knowledge.

Durable operational knowledge includes:

- DNS changes.
- Vercel project/domain/env/deploy changes.
- Supabase migrations, schema changes, pooler/direct connection lessons, or RLS changes.
- Twilio webhook, phone number, Messaging Service, toll-free verification, or SMS/call test changes.
- Stripe product, price, webhook, billing, or subscription changes.
- New public URLs or webhook URLs.
- New required environment variable names.
- Production/test verification results.
- Confirmed errors and confirmed fixes.
- Important commit hashes, deployment IDs, provider resource IDs, or operational decisions.
- Security rotations or credential-handling lessons.

Update only the relevant documents:

- `MVP_BUILD_DOCS/SETUP-LOG.md` for chronological facts.
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` for how to operate, verify, or troubleshoot the system.
- `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md` for reusable setup steps and best practices.

Do not document:

- Secrets, passwords, full DB URLs with passwords, API keys, auth tokens, service role key values, or private patient data.
- Long raw logs.
- Temporary failed commands unless they produced a confirmed reusable fix.
- Speculation.
- Duplicate facts already recorded clearly.
- Minor local-only edits with no operational value.

Final reports must include one of these lines:

```txt
Operations docs updated: yes
```

or:

```txt
Operations docs update needed: no
```

---

## 4. Secrets and config

Never write real secrets into source-controlled files.

Allowed in repo:

```txt
.env.local.example
MVP_BUILD_DOCS/env/.env.secrets.example
MVP_BUILD_DOCS/config/runtime.config.example.ts
```

Forbidden in repo:

```txt
.env
.env.local
.env.production
.env.staging
.local-agent/
real API keys
real Twilio auth tokens
real Stripe secret keys
real Supabase service-role keys
full database URLs with passwords
```

Use environment variables at runtime.

---

## 5. MCP/tool use rules

Use MCP tools only when configured by the owner.

Safe without approval:

```txt
read docs
search docs
read staging logs
list staging schema
generate TypeScript types from staging
```

Requires owner approval:

```txt
apply Supabase migrations
execute SQL that changes data or schema
change Vercel production env vars
deploy production
create or change Stripe live products/prices/subscriptions
change Twilio production webhook URLs
purchase Twilio numbers
send real patient SMS
modify DNS
```

Never connect MCP to production data unless the owner explicitly says so.

---

## 6. Database rules

- Use migrations for schema changes.
- Keep RLS enabled for multi-tenant tables.
- Never rely on client-side filtering for tenant isolation.
- Store raw provider payloads in the agreed raw payload column for that table.
- Use unique provider IDs for idempotency: `CallSid`, `MessageSid`, Stripe `event.id`.
- Use `SUPABASE_DB_URL` for app/runtime/serverless pooler access.
- Use `SUPABASE_DB_DIRECT_URL` only for local/admin/migration work.
- For Supabase transaction pooler connections, keep prepared statements disabled in the Postgres client.

---

## 7. Webhook rules

Twilio webhooks:

```txt
validate X-Twilio-Signature
parse application/x-www-form-urlencoded
respond quickly
do heavy work in jobs where possible
be idempotent
```

Stripe webhooks:

```txt
validate Stripe-Signature
use raw request body
store processed event IDs
be idempotent
```

---

## 8. UI rules

Keep the UI narrow and operational.

Do not create a CRM.

Prioritize:

```txt
Overview
Recovery Inbox
Opportunity Detail
Settings
Billing
Admin/Activation
```

The front desk must be able to quickly see urgent conversations and mark booked/lost.

For dashboard, UI mockups, landing page redesign, admin screens, or other design-heavy work, consider using Claude Design for visual prototypes before implementation.

---

## 9. Messaging rules

Use deterministic rules, not conversational AI.

Do not put diagnosis, treatment details, insurance details, x-rays, prescriptions, or detailed symptoms into automated SMS.

Always respect STOP/opt-out.

Do not send outbound SMS until clinic mapping, opt-out enforcement, duplicate suppression, and owner approval are complete.

---

## 10. Production rule

Do not treat a successful deployment as production readiness.

Production readiness requires:

```txt
staging E2E pass
RLS verification
Twilio webhook verification
Stripe webhook verification
STOP handling test
follow-up cancellation test
callback bridge test
owner approval
```

---

## 11. When blocked

If a provider credential or account setup is missing:

1. Continue with mock implementation or placeholder.
2. Document exactly what value is needed.
3. Ask only for the minimum test/staging value required for the current milestone.
4. Do not ask for production secrets in chat.
