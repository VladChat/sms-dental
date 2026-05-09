# 07 — Build Plan and Tasks

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1  
Stage: 4 — Build Plan and Tasks  
Primary audience: AI coding agent / technical founder / project manager

---

## 1. Purpose of this file

This file turns the MVP specification into an implementation plan.

The goal is to give the AI coding agent a clear build sequence with milestones, tasks, acceptance criteria, likely files, dependencies, and implementation notes.

This build plan assumes:

- frontend/backend: Next.js app;
- database/auth: Supabase;
- phone/SMS: Twilio;
- billing: Stripe;
- deployment: Vercel;
- MVP scope: missed-call recovery only.

The MVP must not expand into AI receptionist, dental CRM, PMS integration, number porting, call recording, or automated booking.

---

## 2. Recommended implementation order

Build in this order:

```txt
1. App foundation
2. Database and RLS
3. Auth and clinic setup
4. Twilio voice webhook
5. First SMS automation
6. Incoming SMS and intent detection
7. Recovery Inbox UI
8. Opportunity detail and manual outcomes
9. Follow-up jobs
10. Callback bridge
11. Stripe billing
12. Admin/concierge tools
13. Testing, QA and deployment hardening
```

Reason:

- Twilio and Stripe depend on stable DB models.
- Inbox depends on calls/messages/opportunities existing.
- Follow-ups should come after first SMS and incoming SMS cancellation rules.
- Billing should not start trial until activation flow is clear.
- Admin tools are required for concierge onboarding but can be developed after core flows exist.

---

## 3. Definition of MVP complete

The MVP is complete when a real clinic can run this flow:

```txt
patient calls clinic -> clinic misses call -> call forwards to recovery number -> app detects missed call -> first SMS is sent -> patient replies -> intent/urgency is detected -> front desk sees item in inbox -> front desk marks booked/lost -> dashboard updates
```

Minimum production criteria:

- webhooks validate signatures;
- webhook processing is idempotent;
- no duplicate SMS for duplicate webhooks;
- opt-out is respected;
- urgent replies are prioritized;
- follow-ups cancel correctly;
- clinic data is isolated by RLS/server checks;
- Stripe status gates live usage;
- admin can manually activate first clinics.

---

## 4. Milestone 1 — App Foundation

### Goal

Create the application shell, repository structure, environment configuration, and deployment baseline.

### Tasks

#### Task 1.1 — Create Next.js app

Description:

Create the main app using the selected Next.js version and app router.

Likely files:

```txt
app/layout.tsx
app/page.tsx
app/(auth)/login/page.tsx
app/(app)/dashboard/page.tsx
components/
lib/
```

Acceptance criteria:

- app runs locally;
- basic layout renders;
- TypeScript enabled;
- linting/formatting configured;
- environment variables are loaded safely.

---

#### Task 1.2 — Set up project structure

Recommended structure:

```txt
app/
  (auth)/
  (app)/
  api/
components/
lib/
  supabase/
  twilio/
  stripe/
  auth/
  clinics/
  calls/
  messages/
  opportunities/
  followups/
  billing/
  jobs/
supabase/
  migrations/
  seed.sql
types/
tests/
```

Acceptance criteria:

- project has clear module boundaries;
- provider-specific logic is not mixed directly into UI components;
- domain logic is reusable from API routes and jobs.

---

#### Task 1.3 — Configure runtime config and secrets split

Description:

Create a clean split between non-secret runtime configuration and private secrets.

Files:

```txt
config/runtime.config.ts or config/runtime.config.example.ts
env/.env.secrets.example
.gitignore
```

Rules:

- non-secret provider IDs and app URLs belong in runtime config or non-secret env vars;
- real private secrets belong only in `.env.local` locally and Vercel Environment Variables in staging/production;
- `.env.local` must never be committed;
- do not use a giant `env/.env.secrets.example` and `config/runtime.config.example.ts` containing both config and secrets.

Minimum secret names:

```txt
SUPABASE_SERVICE_ROLE_KEY
TWILIO_AUTH_TOKEN
TWILIO_API_KEY_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
JOB_RUNNER_SECRET
INTERNAL_ADMIN_SECRET
```

Acceptance criteria:

- app fails loudly when required server secrets are missing;
- server secrets are never exposed to client bundle;
- `.gitignore` excludes `.env`, `.env.local`, `.env.production`, `.env.staging`;
- docs point to `env/.env.secrets.example` and `config/runtime.config.example.ts`, not a single `env/.env.secrets.example` and `config/runtime.config.example.ts`.

---
#### Task 1.4 — Deploy empty app

Description:

Deploy the baseline app to Vercel.

Acceptance criteria:

- production URL is live;
- health check endpoint works;
- environment variables are configured;
- app can receive public webhooks.

Recommended health endpoint:

```txt
GET /api/health
```

Response:

```json
{ "ok": true }
```

---

## 5. Milestone 2 — Database and RLS

### Goal

Implement the Supabase schema and data isolation rules.

### Tasks

#### Task 2.1 — Create initial migrations

Tables:

- `clinics`
- `profiles`
- `phone_numbers`
- `patients`
- `calls`
- `missed_calls`
- `conversations`
- `messages`
- `appointment_opportunities`
- `followups`
- `templates`
- `automations`
- `subscriptions`
- `audit_logs`

Acceptance criteria:

- all tables exist;
- primary keys are UUIDs;
- timestamps use `timestamptz`;
- foreign keys are defined;
- important provider IDs have unique constraints;
- enums/check constraints exist where needed.

---

#### Task 2.2 — Add indexes and uniqueness constraints

Required unique constraints:

```txt
calls.twilio_call_sid unique
messages.twilio_message_sid unique when not null
patients(clinic_id, phone_e164) unique
phone_numbers.e164 unique
subscriptions.stripe_subscription_id unique when not null
audit/provider events unique where applicable
```

Acceptance criteria:

- duplicate Twilio webhook payloads cannot create duplicate call/message records;
- inbox queries are indexed;
- dashboard date range queries are indexed.

---

#### Task 2.3 — Add RLS policies

RLS rules:

- clinic users can access only their clinic records;
- front desk cannot access billing/admin-only data if not needed;
- admin can access all clinics;
- service role can process webhooks/jobs.

Acceptance criteria:

- RLS enabled on tenant-scoped tables;
- cross-clinic reads fail;
- server-side service role can process webhooks;
- tests or manual SQL checks confirm isolation.

---

#### Task 2.4 — Seed default templates and automation settings

Seed:

- `first_missed_call_a`
- `first_missed_call_b`
- `new_patient`
- `existing_patient`
- `emergency`
- `cleaning_request`
- `appointment_request`
- `reschedule`
- `no_reply_15m`
- `next_day_followup`
- `after_hours`

Default automation settings:

```txt
first_sms_delay_sec = 15
followup_1_delay_min = 15
followup_2_time_local = 09:00
callback_timeout_sec = 15
```

Acceptance criteria:

- new clinic can receive default templates/settings;
- templates support variables;
- templates are versioned or auditable.

---

## 6. Milestone 3 — Auth and Clinic Setup

### Goal

Allow owner signup/login and clinic setup.

### Tasks

#### Task 3.1 — Implement Supabase Auth

Acceptance criteria:

- users can sign up;
- users can sign in/out;
- auth session works in server/client routes;
- protected routes redirect unauthenticated users.

---

#### Task 3.2 — Create clinic and owner profile on signup

Logic:

1. Create auth user.
2. Create `profiles` row.
3. Create `clinics` row with status `signup_started`.
4. Link owner to clinic.
5. Create default automation/settings/templates.

Acceptance criteria:

- signup creates all required records;
- partial signup failure is handled;
- duplicate email/clinic cases show clear errors.

---

#### Task 3.3 — Build setup/settings form

Fields:

- clinic name;
- main phone;
- callback destination phone;
- timezone;
- business hours;
- emergency instructions;
- average recovered appointment value.

Acceptance criteria:

- settings save successfully;
- phone numbers are normalized;
- timezone is required;
- changes are audit logged.

---

## 7. Milestone 4 — Twilio Voice Incoming Webhook

### Goal

Detect forwarded missed calls and create missed-call incidents.

### Task 4.1 — Implement Twilio signature validation helper

Likely files:

```txt
lib/twilio/validate-signature.ts
lib/twilio/request.ts
```

Acceptance criteria:

- valid Twilio requests pass;
- invalid signatures return 403;
- validation uses full public URL and form params;
- no secrets are logged.

---

### Task 4.2 — Implement endpoint

Endpoint:

```txt
POST /api/webhooks/twilio/voice/incoming
```

Likely files:

```txt
app/api/webhooks/twilio/voice/incoming/route.ts
lib/calls/handle-incoming-voice.ts
lib/calls/classify-incoming-call.ts
```

Logic:

1. Validate signature.
2. Parse form-encoded payload.
3. Normalize phone numbers.
4. Find clinic by `To` recovery number.
5. Upsert `calls` by `CallSid`.
6. Classify as `forwarded_missed_call`, `callback`, or `unknown`.
7. For forwarded missed call, create `missed_calls`, `conversation`, `appointment_opportunity`, and first SMS job/followup.
8. Return TwiML.

Acceptance criteria:

- call to recovery number creates `calls` row;
- forwarded missed call creates `missed_calls` row;
- duplicate `CallSid` does not duplicate rows;
- endpoint returns valid TwiML quickly;
- unknown clinic returns safe TwiML or rejects without crashing.

---

### Task 4.3 — Return missed-call TwiML

Response:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry we missed your call. We'll text you right away.</Say>
  <Hangup/>
</Response>
```

Acceptance criteria:

- Twilio accepts response;
- no slow work delays TwiML response;
- response is XML with correct content type.

---

## 8. Milestone 5 — First SMS Automation

### Goal

Send the first recovery SMS after a missed call.

### Task 5.1 — Implement SMS send service

Likely files:

```txt
lib/twilio/send-sms.ts
lib/messages/create-outbound-message.ts
lib/messages/render-template.ts
```

Acceptance criteria:

- can send SMS through Twilio Messaging Service;
- stores outbound message row;
- stores Twilio `MessageSid`;
- records body redacted or safe body;
- respects patient opt-out.

---

### Task 5.2 — Implement first SMS job

Options:

- Supabase scheduled job;
- queue table polled by worker;
- simple server cron for MVP.

Recommended MVP:

```txt
followups table acts as job table
```

Logic:

1. On missed call, create followup/job with `step_key = first_sms` and `scheduled_for = now + 15 seconds`.
2. Worker finds due jobs.
3. Worker verifies eligibility.
4. Worker sends SMS.
5. Worker marks job completed or failed.

Acceptance criteria:

- first SMS sends once;
- retry does not duplicate SMS;
- failed job records error;
- job respects clinic status and opt-out.

---

### Task 5.3 — Implement outbound SMS status webhook

Endpoint:

```txt
POST /api/webhooks/twilio/messaging/status
```

Acceptance criteria:

- validates Twilio signature;
- updates message status;
- stores error codes;
- ignores stale status transitions;
- duplicate callbacks are safe.

---

## 9. Milestone 6 — Incoming SMS and Intent Detection

### Goal

Process patient SMS replies and classify basic dental intent/urgency.

### Task 6.1 — Implement incoming SMS webhook

Endpoint:

```txt
POST /api/webhooks/twilio/messaging/incoming
```

Logic:

1. Validate signature.
2. Find clinic by `To` recovery number or Messaging Service.
3. Find/create patient by `From`.
4. Find open conversation.
5. Store inbound message by `MessageSid`.
6. Handle `OptOutType` if present.
7. Classify intent/urgency.
8. Update conversation/opportunity.
9. Cancel pending follow-ups.

Acceptance criteria:

- inbound SMS appears in conversation;
- duplicate `MessageSid` is ignored safely;
- STOP/HELP/START are handled;
- reply cancels pending automated follow-ups.

---

### Task 6.2 — Implement deterministic intent classifier

Likely file:

```txt
lib/messages/classify-intent.ts
```

Rules:

```txt
"1" -> new_patient
"2" -> existing_patient
"3" -> urgent_tooth_pain
"4" -> cleaning
"5" -> reschedule
contains pain/emergency/swelling -> urgent_tooth_pain
contains cleaning -> cleaning
contains reschedule/cancel/move -> reschedule
contains appointment/book/schedule -> appointment_request
else -> unknown
```

Acceptance criteria:

- numeric replies classify correctly;
- keyword fallback works;
- urgent terms set urgency to `urgent`;
- classifier does not generate patient-facing medical advice.

---

### Task 6.3 — Create auto-response templates by intent

Optional for v0.1 but recommended.

Acceptance criteria:

- new patient gets next prompt;
- urgent patient gets urgent/safe instruction;
- cleaning/reschedule get simple operational reply;
- every outbound respects opt-out and max-message rules.

---

## 10. Milestone 7 — Recovery Inbox UI

### Goal

Give front desk a simple operational inbox.

### Task 7.1 — Build inbox data query

Likely files:

```txt
lib/opportunities/list-inbox-items.ts
app/(app)/inbox/page.tsx
```

Acceptance criteria:

- returns current clinic only;
- shows open opportunities by default;
- urgent items sorted first;
- supports basic filters;
- performs acceptably with realistic first-clinic data.

---

### Task 7.2 — Build inbox page

UI data:

- patient phone;
- last message;
- intent;
- urgency;
- status;
- missed time;
- last activity.

Actions:

- open detail;
- mark contacted;
- mark booked;
- mark lost;
- pause automation.

Acceptance criteria:

- user can triage opportunities;
- urgent items are obvious;
- empty state is clear;
- row actions call authenticated endpoints.

---

## 11. Milestone 8 — Opportunity Detail and Manual Outcomes

### Goal

Allow front desk to inspect the conversation and mark final outcome.

### Task 8.1 — Build opportunity detail query

Acceptance criteria:

- loads opportunity;
- loads missed call;
- loads patient;
- loads conversation;
- loads messages;
- loads call events;
- loads follow-up jobs.

---

### Task 8.2 — Build opportunity detail page

Route:

```txt
/opportunities/[id]
```

Acceptance criteria:

- timeline renders events chronologically;
- message history is clear;
- call log is visible;
- notes can be added;
- status changes are visible immediately.

---

### Task 8.3 — Implement mark booked endpoint/action

Endpoint:

```txt
POST /api/opportunities/:id/mark-booked
```

Logic:

1. Verify authenticated user and clinic access.
2. Update opportunity status to `booked`.
3. Set `booked_at` and value.
4. Close missed call/conversation.
5. Cancel pending follow-ups.
6. Write audit log.

Acceptance criteria:

- booked status updates correctly;
- dashboard metrics update;
- follow-ups are cancelled;
- action is audit logged.

---

### Task 8.4 — Implement mark lost endpoint/action

Endpoint:

```txt
POST /api/opportunities/:id/mark-lost
```

Acceptance criteria:

- lost status updates correctly;
- close reason is stored;
- follow-ups are cancelled;
- action is audit logged.

---

## 12. Milestone 9 — Follow-up Jobs

### Goal

Send follow-up SMS only when appropriate.

### Task 9.1 — Implement follow-up scheduling

On first SMS sent, schedule:

```txt
followup_15m -> first_sms_sent_at + 15 minutes
followup_next_business_day -> next business day 09:00 clinic local time
```

Acceptance criteria:

- follow-up jobs are created;
- `scheduled_for` stored in UTC;
- clinic timezone is used;
- closed/responded/callback/opt-out cases are excluded.

---

### Task 9.2 — Implement follow-up worker

Logic:

1. Find due jobs.
2. Lock/claim job.
3. Re-check eligibility.
4. Render template.
5. Send SMS.
6. Mark completed/skipped/failed.

Acceptance criteria:

- worker is idempotent;
- max 3 automated SMS per incident;
- jobs do not send after reply/callback/booked/lost/STOP;
- failed jobs are observable.

---

## 13. Milestone 10 — Callback Bridge

### Goal

If patient calls the recovery number back, connect them to the clinic.

### Task 10.1 — Improve call classification

Rules:

- if `ForwardedFrom` matches clinic main number => forwarded missed call;
- if open conversation exists and last outbound SMS predates call => callback;
- if ambiguous with no open conversation => treat as forwarded missed call;
- log classification reason.

Acceptance criteria:

- callbacks are usually bridged;
- forwarded misses still create incidents;
- classification reason stored for debugging.

---

### Task 10.2 — Return callback bridge TwiML

TwiML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" timeout="15">
    <Number
      statusCallbackEvent="initiated ringing answered completed"
      statusCallback="https://app.example.com/api/webhooks/twilio/voice/call-status"
      statusCallbackMethod="POST">
      +13125550000
    </Number>
  </Dial>
</Response>
```

Acceptance criteria:

- patient callback dials clinic callback destination;
- status callbacks are sent;
- child call statuses are stored;
- callback cancels pending follow-ups.

---

### Task 10.3 — Implement call status webhook

Endpoint:

```txt
POST /api/webhooks/twilio/voice/call-status
```

Acceptance criteria:

- validates signature;
- stores child call events;
- updates callback status;
- answered callback updates opportunity state;
- duplicate callbacks are safe.

---

## 14. Milestone 11 — Stripe Billing

### Goal

Implement subscription billing with activation-based trial start.

### Task 11.1 — Create Stripe Checkout flow

Rule:

```txt
Only clinics with status activation_ready can start trial.
```

Acceptance criteria:

- owner can open Checkout only when eligible;
- Checkout creates subscription with trial;
- local clinic/subscription state updates after webhook;
- no trial starts at signup.

---

### Task 11.2 — Implement Stripe webhook

Endpoint:

```txt
POST /api/webhooks/stripe
```

Events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.paid`
- `invoice.payment_failed`

Acceptance criteria:

- validates raw body signature;
- stores processed event id;
- idempotent processing;
- updates subscription status;
- updates clinic status when necessary.

---

### Task 11.3 — Implement Billing page and Customer Portal

Acceptance criteria:

- owner sees current status;
- trial countdown visible;
- portal link works;
- past-due banner appears when payment fails.

---

## 15. Milestone 12 — Admin / Concierge Tools

### Goal

Support manual onboarding and QA for the first 5–10 clinics.

### Task 12.1 — Build admin clinic list

Acceptance criteria:

- admin sees all clinics;
- can filter by setup/A2P/activation status;
- can open clinic detail;
- non-admin users cannot access.

---

### Task 12.2 — Build admin clinic detail

Fields:

- recovery number;
- Twilio number SID;
- Messaging Service SID;
- A2P status;
- activation checklist;
- internal notes;
- recent calls/messages.

Acceptance criteria:

- admin can update setup fields;
- every update is audit logged;
- activation-ready cannot be set before checklist is complete.

---

### Task 12.3 — Add test tools

Admin actions:

- send test SMS;
- copy forwarding instructions;
- mark forwarding test passed;
- mark live missed-call test passed;
- mark live SMS test passed.

Acceptance criteria:

- tests create logs;
- test SMS respects safe sending rules;
- setup checklist reflects test status.

---

## 16. Milestone 13 — Testing, QA and Deployment Hardening

### Goal

Make MVP safe enough for first pilot clinics.

### Task 13.1 — Add webhook tests

Test cases:

- valid Twilio voice webhook;
- invalid Twilio signature;
- duplicate `CallSid`;
- valid inbound SMS;
- duplicate `MessageSid`;
- STOP handling;
- valid Stripe webhook;
- duplicate Stripe event.

Acceptance criteria:

- critical webhook behavior is covered;
- idempotency is verified;
- invalid signatures cannot mutate DB.

---

### Task 13.2 — Add state transition tests

Test cases:

- missed call -> detected;
- first SMS -> sms_sent;
- inbound reply -> engaged;
- urgent reply -> urgent;
- callback -> callback_in_progress/handoff;
- mark booked -> recovered;
- mark lost -> closed_lost;
- opt-out -> opted_out.

Acceptance criteria:

- invalid transitions are prevented;
- follow-ups cancel correctly;
- dashboard metrics remain consistent.

---

### Task 13.3 — Add operational logging

Log categories:

- webhook received;
- signature validation failed;
- record created/upserted;
- SMS send attempted;
- SMS send failed;
- status callback received;
- follow-up skipped/cancelled;
- admin activation status changed;
- billing event processed.

Acceptance criteria:

- logs are useful for debugging first pilots;
- no secrets are logged;
- patient content is minimized/redacted where reasonable.

---

### Task 13.4 — Add alerts

Minimum alerts:

- Twilio voice webhook non-200;
- first SMS not sent within 60 seconds after missed call;
- high failed/undelivered SMS rate;
- Stripe webhook verification failure;
- active clinic payment failure;
- A2P pending too long;
- urgent opportunity with no action during business hours.

Acceptance criteria:

- critical failures notify operator;
- alert threshold is configurable;
- alerts include clinic and event IDs without exposing secrets.

---

## 17. Suggested sprint breakdown

### Sprint 1 — Foundation and database

Deliverables:

- app shell;
- Supabase connection;
- schema migrations;
- RLS baseline;
- auth/signup;
- clinic settings skeleton.

### Sprint 2 — Twilio missed-call detection and first SMS

Deliverables:

- voice webhook;
- TwiML response;
- call/missed_call creation;
- first SMS job;
- SMS status webhook.

### Sprint 3 — Incoming SMS and inbox

Deliverables:

- inbound SMS webhook;
- intent/urgency classifier;
- Recovery Inbox;
- Opportunity Detail;
- mark booked/lost.

### Sprint 4 — Follow-ups, callback bridge and billing

Deliverables:

- follow-up jobs;
- callback bridge;
- Stripe Checkout/webhook;
- Billing page.

### Sprint 5 — Admin tools and production hardening

Deliverables:

- admin clinic list/detail;
- activation checklist;
- test tools;
- logging/alerts;
- QA pass;
- pilot launch readiness.

---

## 18. AI coding agent handoff checklist

Before development starts, confirm:

- Supabase project exists;
- Twilio paid account exists;
- Stripe account exists;
- hosting account exists;
- app domain or staging URL exists;
- initial Twilio number strategy is accepted;
- first clinic onboarding will be concierge/manual;
- A2P setup will be handled manually at first;
- no PMS integration is required;
- no AI receptionist is required;
- no call recording/transcription is required.

---

## 19. Build order checklist

Use this as the high-level tracker:

```txt
[ ] Create Next.js app
[ ] Configure Supabase
[ ] Create DB migrations
[ ] Add RLS policies
[ ] Implement auth
[ ] Implement clinic setup
[ ] Implement Twilio signature validation
[ ] Implement incoming voice webhook
[ ] Create missed-call incident records
[ ] Create first SMS job
[ ] Send first SMS through Twilio
[ ] Implement SMS status webhook
[ ] Implement inbound SMS webhook
[ ] Implement intent/urgency classifier
[ ] Build Recovery Inbox
[ ] Build Opportunity Detail
[ ] Implement mark booked/lost/contacted
[ ] Implement follow-up jobs
[ ] Implement callback bridge
[ ] Implement Stripe Checkout
[ ] Implement Stripe webhook
[ ] Build Billing page
[ ] Build Admin Clinic List
[ ] Build Admin Clinic Detail
[ ] Add testing tools
[ ] Add logs and alerts
[ ] Run live Twilio QA
[ ] Run live Stripe QA
[ ] Prepare first clinic activation checklist
```

---

## 20. Out-of-scope guardrail for developers

Do not add these in MVP unless explicitly approved:

- AI receptionist;
- voice bot;
- call recording;
- transcription;
- PMS integration;
- automated booking inside dental software;
- insurance fields;
- dental chart fields;
- treatment plan fields;
- number porting;
- hosted SMS as default;
- multi-location hierarchy;
- marketing campaign builder;
- generic CRM features.

The MVP wins by staying narrow and shipping a reliable recovery loop.


## 21. AI/MCP execution note

This build plan assumes an AI coding agent in VS Code/Codex/CodeGPT. The agent should implement one milestone at a time, use MCP only if configured, and ask for owner approval before migrations, production deploys, Twilio live settings, Stripe live changes, DNS changes, or real SMS.
