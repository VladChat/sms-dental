# AGENT RULES — For Codex / CodeGPT / AI Coding Agents

Project: Missed-Call Recovery SaaS for Dental Clinics  
Audience: AI coding agent operating in VS Code or another coding IDE

---

## 0. Current source of truth and active milestone

Before implementing anything, read `PROJECT-CONTEXT.md` first.

Current live state:

- Backend Foundation v1 is built, committed, pushed, deployed, and reachable at `https://app.missedcallsdental.com`.
- Supabase foundation migration has been applied.
- Supabase migration `20260603000200_self_service_number_purchasing.sql` has been applied and verified.
- Vercel production backend can reach Supabase through the Supabase transaction pooler.
- `PUBLIC_WEBHOOK_BASE_URL` is set to `https://app.missedcallsdental.com`.
- Twilio webhooks are configured by API.
- Inbound SMS webhook has been verified.
- Inbound voice webhook is verified end-to-end.
- Self-service owner number purchasing is deployed in code; real Twilio purchasing remains disabled by `TWILIO_NUMBER_PURCHASE_ENABLED=false`.
- Stripe test-mode subscription Checkout, webhook handling, and production test Price ID env vars exist. Stripe remains test-mode.
- SMS recovery remains separately gated and is not automatically enabled by number assignment or billing.
- `docs/` remains the GitHub Pages marketing website and must stay untouched unless explicitly requested.

Current operational status / next safe work:

- Owner/admin production browser QA for the deployed self-service number purchase flow.
- UI cleanup and documentation/source-of-truth cleanup.
- Deliberate go-live decision before flipping `TWILIO_NUMBER_PURCHASE_ENABLED=true` for real Twilio number purchases.
- Future live Stripe rollout requires explicit approval; current Stripe resources and keys are test-mode only.
- Do not build a full CRM, recovery inbox, or broad dashboard unless explicitly scoped.

If this file conflicts with `PROJECT-CONTEXT.md`, `OPERATIONS-RUNBOOK.md`, `SETUP-LOG.md`, `backend-foundation-handoff.md`, or `.env.local.example`, use the newer/current source for the current implementation step.

---

## 1. Prime directive

Build the MVP described in the docs. Do not expand scope.

The required MVP flow is:

```txt
call event reaches system -> Twilio webhook -> safe SMS recovery -> inbound reply/callback -> recovery inbox -> manual booked/lost -> dashboard/billing
```

Important:

The app cannot automatically detect calls to an unrelated clinic phone number. For MVP, the call must reach the system through conditional forwarding, the system-prepared local-number path, or a future approved provider integration. Future versions may add direct phone-provider integrations.

Do not build:

```txt
AI receptionist
PMS integration
dental CRM
call recording/transcription
number porting
full phone-provider integration layer in the first MVP
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
- Twilio webhook, phone number, Messaging Service, toll-free verification, trial limitation, or SMS/call test changes.
- Phone event strategy changes, including forwarding mode, local-number default path behavior, and caller ID preservation tests.
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

Do not document secrets, passwords, full DB URLs with passwords, API keys, auth tokens, service role key values, private patient data, long raw logs, speculation, or duplicate facts.

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

---

## 5. Approval-required actions

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
upgrade provider account or change paid billing settings
```

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

## 8. Messaging rules

Use deterministic rules, not conversational AI.

Do not put diagnosis, treatment details, insurance details, x-rays, prescriptions, or detailed symptoms into automated SMS.

Always respect STOP/opt-out.

Do not send outbound SMS until clinic mapping, opt-out enforcement, duplicate suppression, and owner approval are complete.

---

## 9. UI rules

Keep the UI narrow and operational. Do not create a CRM.

For dashboard, UI mockups, landing page redesign, admin screens, or other design-heavy work, consider using Claude Design for visual prototypes before implementation.

For all forms, onboarding/setup flows, settings screens, and user-input UIs, follow the project-wide Form and Onboarding Scope Rule in `AGENTS.md`: ask only for what is needed for the next immediate step, defer non-essential fields, and explain why required fields are needed.

---

## 10. Production rule

Do not treat a successful deployment as production readiness.

Production readiness requires staging E2E pass, RLS verification, Twilio webhook verification, Stripe webhook verification, STOP handling test, follow-up cancellation test, callback bridge test, and owner approval.
