# AGENT RULES — For Codex / CodeGPT / AI Coding Agents

Project: Missed-Call Recovery SaaS for Dental Clinics  
Audience: AI coding agent operating in VS Code or another coding IDE

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

---

## 3. Secrets and config

Never write real secrets into source-controlled files.

Allowed in repo:

```txt
env/.env.secrets.example
config/runtime.config.example.ts
```

Forbidden in repo:

```txt
.env
.env.local
.env.production
.env.staging
real API keys
real Twilio auth tokens
real Stripe secret keys
real Supabase service-role keys
```

Use environment variables at runtime.

---

## 4. MCP/tool use rules

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

## 5. Database rules

- Use migrations for schema changes.
- Keep RLS enabled for multi-tenant tables.
- Never rely on client-side filtering for tenant isolation.
- Store raw provider payloads in `payload_json` where specified.
- Use unique provider IDs for idempotency: `CallSid`, `MessageSid`, Stripe `event.id`.

---

## 6. Webhook rules

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

## 7. UI rules

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

---

## 8. Messaging rules

Use deterministic rules, not conversational AI.

Do not put diagnosis, treatment details, insurance details, x-rays, prescriptions, or detailed symptoms into automated SMS.

Always respect STOP/opt-out.

---

## 9. Production rule

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

## 10. When blocked

If a provider credential or account setup is missing:

1. Continue with mock implementation or placeholder.
2. Document exactly what value is needed.
3. Ask only for the minimum test/staging value required for the current milestone.
4. Do not ask for production secrets.
