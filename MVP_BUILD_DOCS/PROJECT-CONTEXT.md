# Project Context — Missed Calls Dental

This is the master project context document for AI coding agents working on this repository.

Read this file before backend, frontend, infrastructure, Twilio, Supabase, Stripe, Vercel, or dashboard work.

This document summarizes the product goal, repository structure, implementation direction, safety rules, and current known state. More detailed specifications remain in the numbered `MVP_BUILD_DOCS/` files and project skills.

---

## 1. Project Identity

Product name:

```txt
Missed Calls Dental  Internal project name sometimes used:

Dental SMS

Primary domain:

https://missedcallsdental.com

Product type:

B2B SaaS for small dental clinics

Primary customer:

Small dental clinics and dental offices with front desk call volume

Primary business goal:

Help dental offices recover missed patient calls and convert them into appointment opportunities.
2. Core Problem

Dental offices miss phone calls.

A missed phone call can mean:

a lost new patient
a delayed appointment request
extra manual follow-up work for the front desk
lower trust if the patient never hears back

Many patients do not call back after a missed call. The product acts as a missed-call recovery layer.

3. Core Solution

Missed Calls Dental detects missed call events and sends a professional SMS follow-up to the caller.

The product should behave like a simple, trustworthy recovery assistant for the dental front desk.

Core idea:

missed call -> verified backend event -> safe SMS follow-up -> patient reply -> front desk follow-up -> booked/lost outcome

The product is not an AI receptionist in the MVP. It is not a dental CRM. It is not a PMS integration. It is not a phone system replacement.

4. MVP Scope

The MVP should include:

missed call detection through Twilio
automatic or controlled SMS recovery flow
inbound SMS handling
STOP / START / HELP handling
basic conversation records
simple front desk recovery inbox later
manual booked/lost outcome tracking later
Supabase/Postgres database
Stripe billing later
Vercel-hosted Next.js app/backend later

The MVP should not include:

AI receptionist behavior
medical diagnosis
dental advice
call recording
transcription
number porting
PMS integration
complex CRM features
aggressive sales automation
fake urgency
fake medical claims
5. Current Repository Structure

Current repository path on the owner's Windows machine:

C:\Users\vladi\Documents\vcoding\projects\sms-dental

GitHub repository:

https://github.com/VladChat/sms-dental.git

Main branch:

main

Important folders:

docs/

The existing public marketing website. It is deployed by GitHub Pages. Do not modify it unless the user explicitly asks.

app/

Reserved for the future Next.js SaaS app, clinic dashboard, and backend API routes. Use this direction for backend/app implementation.

MVP_BUILD_DOCS/

Planning, architecture, compliance, access, deployment, and handoff documentation.

Skills/

Universal project/reference instructions for agents.

.claude/skills/

Claude-specific skills for Claude Code.

.local-agent/

Local-only ignored agent notes. This folder must not be committed.

.env.local

Local-only secrets file. Must never be committed and values must never be printed.

.env.local.example

Commit-safe placeholder file with environment variable names only.

6. Current Website Hosting

The current public marketing website lives in:

docs/

Current local static website preview:

http://localhost:8080/

Current production website:

https://missedcallsdental.com

Current production hosting:

GitHub Pages from docs/

Do not break the existing GitHub Pages site.

Keep:

docs/CNAME

Do not restore a root CNAME.

7. Future App / Backend Hosting Direction

The future SaaS app and backend should be built as a Next.js App Router app using the existing app/ direction.

Do not create a separate backend/ folder unless the user explicitly changes the architecture.

Planned hosting:

Vercel

Likely future app/backend domain:

https://app.missedcallsdental.com

The current Vercel account/team known from MCP verification:

Team name: vladchat-1500's projects
Team slug: vladchat-1500s-projects
Team ID: team_1F2PWbZbJldYTbtZ8HlEVMCm

At the time this context was written, no Vercel project existed yet for this repository.

Do not create a Vercel project or deploy without explicit user approval.

8. Required Services

The project uses or plans to use:

Twilio

For phone number, call webhooks, SMS sending, inbound SMS, and delivery status callbacks.

Supabase / Postgres

For database, future auth, clinic records, messages, webhook events, and app data.

Stripe

For billing and subscriptions later.

Vercel

For future Next.js app/backend hosting.

GitHub

For source control.

9. Required Environment Variable Names

The repository currently uses these environment variable names.

Never print values. Never commit real values.

SUPABASE_DB_URL
SUPABASE_SERVICE_ROLE_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
TWILIO_PHONE_NUMBER_SID
TWILIO_MESSAGING_SERVICE_SID
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_ACCOUNT_ID
JOB_RUNNER_SECRET
INTERNAL_ADMIN_SECRET

Local development values belong in:

.env.local

Committed placeholders belong in:

.env.local.example

Vercel values later belong in:

Vercel Project Settings -> Environment Variables

Do not duplicate secrets into app/.

10. Agent Access Model

Agents do not need personal account passwords.

Correct access model:

GitHub through local repo or GitHub connector
Vercel through Vercel MCP / CLI after owner authorization
Supabase through CLI/MCP only when configured and approved
Stripe through test/sandbox mode only when configured and approved
Twilio through local env / console / approved tools only

Agents must not ask the user to paste passwords into chat.

Agents may ask the user to approve browser-based OAuth flows or paste secrets directly into local terminal/config files, but not into chat.

11. Backend Foundation Direction

The first backend milestone is a local, safe, buildable foundation.

It should create:

root Next.js/Vercel project foundation
app/ App Router structure
app/api/health
internal health route protected by INTERNAL_ADMIN_SECRET
lazy env validation
Supabase/Postgres helper using SUPABASE_DB_URL
Supabase migration SQL under supabase/migrations/
Twilio signature validation helper
Twilio incoming voice webhook route
Twilio incoming SMS webhook route
Twilio message status callback route
Stripe webhook placeholder
structured logging
idempotency-ready event handling

It should not:

deploy
create Vercel project
apply Supabase migrations to live DB
change Twilio Console
send SMS
create Stripe resources
modify docs/
commit or push without explicit instruction
12. Planned Webhook URLs

Likely future Twilio voice webhook:

https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming

Likely future Twilio inbound SMS webhook:

https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming

Likely future Twilio message status callback:

https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status

Likely future Stripe webhook:

https://app.missedcallsdental.com/api/webhooks/stripe

These URLs should not be configured in Twilio or Stripe until the backend is deployed and explicitly approved by the user.

13. Database Direction

Use Supabase/Postgres.

Initial foundation tables should likely include:

clinics
clinic_phone_numbers
webhook_events
call_events
patient_conversations
messages
opt_outs

Design principles:

use UUID primary keys
include created_at and updated_at where appropriate
add idempotency constraints for webhooks
avoid unnecessary PHI
do not store patient names until needed
store phone numbers and event metadata carefully
prepare for future clinic dashboard
respect opt-out status before any outbound SMS

Do not apply migrations to production without explicit approval.

14. SMS and Compliance Rules

SMS must be professional, clear, and dental-office appropriate.

Avoid:

spammy wording
fake urgency
discounts as pressure
diagnosis or medical advice
claims like “you need treatment”
aggressive sales copy
fake guarantees

Respect:

STOP
START
HELP
opt-out state
clear sender identity
patient trust

Default safe SMS style:

Hi, this is {{clinic_name}}. We missed your call. Would you like us to help schedule an appointment?

Do not send real SMS without explicit user approval.

15. Product Tone

The product should feel:

professional
clear
simple
trustworthy
calm
dental-office appropriate
B2B SaaS, not childish
good enough for Stripe verification
good enough for Twilio review
good enough for real clinic customers

Avoid:

fake testimonials
fake statistics
vague AI hype
childish UI
messy startup design
unsupported medical or revenue claims
16. Safety Boundaries

Always follow these rules:

Do not commit secrets.
Do not print .env.local values.
Do not commit .env.local.
Do not commit .local-agent/.
Do not modify docs/ unless explicitly requested.
Do not send SMS without explicit approval.
Do not change Twilio Console webhooks without explicit approval.
Do not deploy without explicit approval.
Do not create Vercel/Supabase/Stripe/Twilio cloud resources without explicit approval.
Do not run destructive SQL.
Do not create live Stripe resources without approval.
Do not make DNS changes without approval.
Do not make fake medical claims.
17. Read These Files for More Detail

Before coding, read:

MVP_BUILD_DOCS/PROJECT-CONTEXT.md
MVP_BUILD_DOCS/START-HERE.md
MVP_BUILD_DOCS/AGENT-RULES.md
MVP_BUILD_DOCS/backend-foundation-handoff.md
app/README.md
.env.local.example
AGENTS.md
Skills/missed-calls-dental-product-context.md

For backend implementation, also read:

MVP_BUILD_DOCS/02-technical-architecture.md
MVP_BUILD_DOCS/03-database-schema.md
MVP_BUILD_DOCS/04-api-and-webhooks.md
MVP_BUILD_DOCS/05-sms-rules-and-templates.md
MVP_BUILD_DOCS/10-env-and-deploy.md
MVP_BUILD_DOCS/11-access-and-secrets-handoff.md

For Twilio/SMS work, read:

Skills/twilio-dental-sms.md

For Supabase/Postgres work, read:

Skills/supabase-postgres-best-practices.md

For Stripe work, read:

Skills/stripe-best-practices.md

For UI/design/copy work, read:

Skills/page-cro-dental-saas.md
Skills/copywriting.md
Skills/frontend-design.md
18. Current Immediate Next Step

The immediate next engineering step is Backend Foundation v1.

That means:

Create a safe local Next.js/Vercel foundation in the existing app/ direction, with API route skeletons, environment handling, Supabase migration SQL, Twilio webhook validation, Stripe webhook placeholder, structured logging, and documentation.

Do not deploy or change production systems during Backend Foundation v1.
