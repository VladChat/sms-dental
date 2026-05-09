# MVP Build Docs Roadmap

Project: Missed-call recovery SaaS for small dental clinics  
Version: v1 / staged build-spec package  
Audience: product owner, AI coding agent, technical implementer  
Primary goal: give the AI coding agent enough implementation context to build the MVP without inventing the product scope.

---

## 1. Product being built

We are building a narrow SaaS product for small dental clinics:

> Missed call -> automatic SMS -> dental-specific qualification -> front desk handoff -> manual booked/recovered outcome.

The product is not a phone system replacement. It is a recovery layer on top of the clinic's existing main phone number.

The clinic keeps its existing public number. The app gives each clinic a separate Twilio recovery number. The clinic configures no-answer / busy call forwarding from the main phone number to the recovery number. When a call reaches the recovery number, the app treats it as a missed-call recovery event, sends SMS, tracks replies, and shows the opportunity in a small front desk inbox.

---

## 2. Final documentation package

The core implementation package contains these eight implementation files:

```text
00-product-brief.md
01-user-flows.md
02-technical-architecture.md
03-database-schema.md
04-api-and-webhooks.md
05-sms-rules-and-templates.md
06-ui-screens.md
07-build-plan-and-tasks.md
```

Operational, launch, and AI-agent files included in the final package:

```text
08-compliance-and-onboarding.md
09-test-plan.md
10-env-and-deploy.md
11-access-and-secrets-handoff.md
12-production-launch-checklist.md
13-hosting-decision-no-fly.md
14-ai-codex-vscode-workflow.md
15-mcp-setup.md
AGENT-RULES.md
```

---

## 3. Staged execution plan

### Stage 1 — Product scope and flows

Files included:

```text
README-build-docs-roadmap.md
MVP-Build-Spec-v1.md
00-product-brief.md
01-user-flows.md
```

Purpose:

- lock the MVP scope;
- prevent scope creep;
- define user roles;
- define the main operational flows;
- describe what the app must and must not do.

AI-agent outcome:

The AI coding agent should understand the product, users, workflows, and MVP boundaries before looking at database tables or APIs.

---

### Stage 2 — Architecture and database

Files included:

```text
02-technical-architecture.md
03-database-schema.md
```

Purpose:

- define the stack;
- define system components;
- define Supabase tables;
- define relationships, indexes, unique constraints, and RLS expectations;
- define state machines for calls, messages, conversations, and opportunities.

AI-agent outcome:

The AI coding agent should be able to create migrations and understand the system architecture.

---

### Stage 3 — APIs, webhooks, SMS rules

Files included:

```text
04-api-and-webhooks.md
05-sms-rules-and-templates.md
```

Purpose:

- define all Twilio endpoints;
- define Stripe webhook behavior;
- define internal app endpoints;
- define idempotency rules;
- define deterministic SMS automation;
- define message templates and intent detection rules.

AI-agent outcome:

The AI coding agent should be able to implement backend endpoints and the rules engine.

---

### Stage 4 — UI and build tasks

Files included:

```text
06-ui-screens.md
07-build-plan-and-tasks.md
```

Purpose:

- define the app screens;
- define visible data and actions on each screen;
- split the work into milestones;
- write implementation tasks with acceptance criteria.

AI-agent outcome:

The AI coding agent should know exactly what to build, in what order, and how to verify each step.

---

### Stage 5 — Operational hardening

Files delivered after the core eight:

```text
08-compliance-and-onboarding.md
09-test-plan.md
10-env-and-deploy.md
```

Purpose:

- document clinic onboarding;
- document Twilio/A2P operational steps;
- document manual activation QA;
- document deployment environment variables;
- document end-to-end testing scenarios.

AI-agent outcome:

The product can move from development to pilot clinics with fewer operational surprises. Stage 5 is now included in the cumulative v1 package.

---


### Stage 6 — AI agent and MCP workflow

Goal:

- define how the AI coding agent works in VS Code/Codex/CodeGPT;
- define MCP setup for Supabase, Vercel, Stripe, and Twilio;
- define approval gates for dangerous actions;
- separate non-secret config from private secrets.

Files:

```text
AGENT-RULES.md
11-access-and-secrets-handoff.md
14-ai-codex-vscode-workflow.md
15-mcp-setup.md
config/runtime.config.example.ts
env/.env.secrets.example
mcp/mcp.config.example.json
```

AI-agent outcome:

The AI coding agent knows how to work hands-off in staging/dev while avoiding uncontrolled production access.

---

## 4. Hard MVP boundaries

The MVP includes:

- clinic account and settings;
- one recovery number per clinic;
- Twilio voice webhook for missed-call detection;
- first SMS after missed call;
- inbound SMS handling;
- deterministic intent/urgency classification;
- recovery inbox;
- manual mark booked / lost;
- simple dashboard metrics;
- callback bridge to the clinic;
- Stripe billing after activation;
- admin/concierge view for early clinics.

The MVP does not include:

- AI receptionist;
- voice bot;
- full dental CRM;
- PMS integration;
- automated appointment booking inside PMS;
- number porting;
- hosted SMS as the default setup;
- call recording;
- transcription;
- diagnosis or treatment advice;
- multi-location enterprise support;
- WhatsApp or omnichannel messaging.

---

## 5. Recommended implementation stack

The recommended implementation stack for this MVP:

```text
Frontend: Next.js / React
Backend: Next.js API routes or server routes
Database: Supabase Postgres
Auth: Supabase Auth
Voice/SMS: Twilio
Billing: Stripe
Hosting: Vercel
Background jobs: Vercel Cron or Supabase scheduled jobs
Admin operations: internal admin pages inside the app
```

Detailed architecture will be defined in `02-technical-architecture.md`.

---

## 6. AI coding agent guidance

Build the smallest version that proves this business workflow:

1. A missed clinic call creates an incident.
2. The patient receives an SMS quickly.
3. The patient replies or calls back.
4. Front desk sees the opportunity.
5. Front desk marks it as booked or lost.
6. Owner sees recovered appointments and estimated recovered revenue.

Do not optimize for automation before the first pilot clinics. The first version should be operationally simple, observable, and manually correct.

---

## 7. Definition of done for the full MVP documentation package

The documentation package is ready for a developer when it answers:

- What product are we building?
- What product are we explicitly not building?
- Who are the users?
- What are the user flows?
- What is the tech stack?
- What are the database tables?
- What are the state transitions?
- What are the API routes and webhooks?
- What SMS rules should the app follow?
- What screens should the app have?
- What are the implementation milestones?
- How should the MVP be tested?
- How should a clinic be activated?

---

## Hosting correction

This version removes Fly.io from the default deployment plan. The default MVP deployment target is now Vercel for the Next.js application, with Supabase for database/auth and Vercel Cron or Supabase scheduled jobs for follow-up processing.

Fly.io should only be considered later if the project specifically needs a persistent Node server or a custom worker runtime.


## AI/MCP correction

This version is revised for VS Code + Codex/CodeGPT/VibeCode-style development. It removes the assumption that a human contractor must be invited into every vendor account. MCP setup is documented in `15-mcp-setup.md`, and approval rules are documented in `AGENT-RULES.md` and `11-access-and-secrets-handoff.md`.
