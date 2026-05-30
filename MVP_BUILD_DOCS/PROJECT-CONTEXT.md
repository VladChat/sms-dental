# Project Context — Missed Calls Dental

This is the master project context document for AI coding agents working on this repository.

Read this file before backend, frontend, infrastructure, Twilio, Supabase, Stripe, Vercel, or dashboard work.

This document summarizes the product goal, repository structure, implementation direction, safety rules, and current known state. More detailed specifications remain in the numbered `MVP_BUILD_DOCS/` files and project skills.

---

## 1. Project Identity

- **Product name:** Missed Calls Dental
- **Internal project name sometimes used:** Dental SMS
- **Primary domain:** `https://missedcallsdental.com`
- **Product type:** B2B SaaS for small dental clinics
- **Primary customer:** Small independent dental offices with front desk call volume
- **Primary business goal:** Help dental offices recover missed patient calls and convert them into appointment opportunities.

---

## 2. Core Problem

Dental offices miss phone calls. Missed calls can mean lost new patients, delayed appointment requests, extra front-desk work, and lower trust if the patient never hears back.

Many patients do not call back after a missed call. The product acts as a missed-call recovery layer.

---

## 3. Core Solution

Missed Calls Dental sends a professional SMS follow-up after a call event reaches our system.

Core idea:

`call event -> verified backend event -> safe SMS follow-up -> patient reply -> front desk follow-up -> booked/lost outcome`

The product is not an AI receptionist in the MVP. It is not a dental CRM. It is not a PMS integration. It is not a phone system replacement.

Important clarification:

Missed Calls Dental cannot automatically detect calls to an unrelated clinic phone number. A call must reach the system through one of the supported phone event strategies below.

---

## 4. MVP Phone Event Strategy

The MVP supports two practical ways for a dental office call to reach our system, plus a hybrid option.

### Option A — Conditional forwarding mode

The clinic keeps its existing main phone number.

The clinic or its phone provider configures no-answer, busy, unavailable, or after-hours forwarding to the assigned Twilio recovery number.

Flow:

`patient calls clinic main number -> clinic misses / busy / after-hours -> clinic phone provider forwards call to Twilio number -> Twilio webhook -> backend event -> SMS recovery`

This is the preferred MVP path for clinics that want to keep their main published number.

Requirements:

- The clinic's phone provider must support conditional forwarding.
- The forwarded call should preserve the original caller ID. If `From` becomes the clinic number instead of the patient number, SMS recovery cannot reliably message the patient.
- Voicemail should not answer before forwarding happens.

### Option B — Tracking number mode

The clinic uses the assigned Twilio number as a dedicated tracking/recovery number.

The clinic can publish this number on:

- a campaign landing page
- Google Ads
- print mailers
- a website CTA
- a special promotion or new-patient campaign

Flow:

`patient calls tracking number -> Twilio webhook -> backend event -> SMS recovery`

This is simpler technically because the call reaches Twilio directly. It may be useful for ads or campaigns even if the clinic does not want to change its main phone system.

### Option C — Hybrid mode

The clinic can use both:

- main clinic number with no-answer/busy forwarding to the Twilio recovery number
- dedicated Twilio tracking number for selected campaigns or channels

This may be the most practical setup for early customers.

### Future direction — direct provider integrations

Future versions may integrate directly with phone providers or dental communication platforms.

Possible future flow:

`RingCentral / Dialpad / Weave / Nextiva / other provider webhook -> backend missed-call event -> Twilio SMS`

This is not required for the first MVP.

---

## 5. MVP Scope

The MVP should include:

- call event ingestion through Twilio webhooks
- support for conditional forwarding mode and local-number onboarding for direct call routing
- automatic or controlled SMS recovery flow
- inbound SMS handling
- STOP / START / HELP handling
- basic conversation records
- simple front desk recovery inbox later
- manual booked/lost outcome tracking later
- Supabase/Postgres database
- Stripe billing later
- Vercel-hosted Next.js app/backend

The MVP should not include:

- AI receptionist behavior
- medical diagnosis
- dental advice
- call recording
- transcription
- number porting
- direct phone provider integrations in the first version
- PMS integration
- complex CRM features
- aggressive sales automation
- fake urgency
- fake medical claims

---

## 6. Current Repository Structure

- **Owner's local repository path:** `C:\Users\vladi\Documents\vcoding\projects\sms-dental`
- **GitHub repository:** `https://github.com/VladChat/sms-dental.git`
- **Main branch:** `main`

Important folders and files:

- `docs/` — Existing public marketing website. It is deployed by GitHub Pages. Do not modify it unless the user explicitly asks.
- `app/` — Next.js SaaS app/backend direction.
- `MVP_BUILD_DOCS/` — Planning, architecture, compliance, access, deployment, operations, and handoff documentation.
- `Skills/` — Universal project/reference instructions for agents.
- `.claude/skills/` — Claude-specific skills for Claude Code.
- `.local-agent/` — Local-only ignored agent notes. This folder must not be committed.
- `.env.local` — Local-only secrets file. Must never be committed and values must never be printed.
- `.env.local.example` — Commit-safe placeholder file with environment variable names only.

---

## 7. Current Website Hosting

- **Current public marketing website folder:** `docs/`
- **Current local static website preview:** `http://localhost:8080/`
- **Current production website:** `https://missedcallsdental.com`
- **Current production hosting:** GitHub Pages from `docs/`

Do not break the existing GitHub Pages site. Keep `docs/CNAME`. Do not restore a root `CNAME`.

---

## 8. App / Backend Hosting

The SaaS app and backend are built as a Next.js App Router app using the existing `app/` direction.

Do not create a separate `backend/` folder unless the user explicitly changes the architecture.

- **Hosting:** Vercel
- **App/backend domain:** `https://app.missedcallsdental.com`
- **Vercel fallback domain:** `https://sms-dental.vercel.app`
- **Vercel project:** `sms-dental`
- **Vercel team slug:** `vladchat-1500s-projects`
- **Vercel team ID:** `team_1F2PWbZbJldYTbtZ8HlEVMCm`

Do not deploy, modify env vars, or change domains without explicit user approval.

---

## 9. Required Services

The project uses or plans to use:

- **Twilio** — Phone number, call webhooks, SMS sending, inbound SMS, and delivery status callbacks.
- **Supabase / Postgres** — Database, future auth, clinic records, messages, webhook events, and app data.
- **Stripe** — Billing and subscriptions later.
- **Vercel** — Next.js app/backend hosting.
- **GitHub** — Source control.
- **Namecheap** — DNS for `missedcallsdental.com`.

---

## 10. Required Secret Environment Variable Names

`.env.local` is secret-only. Never print values. Never commit real values.

- `SUPABASE_DB_URL`
- `SUPABASE_DB_DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VERCEL_TOKEN`
- `RESEND_API_KEY`
- `INTERNAL_ADMIN_SECRET`
- `PUBLIC_WEBHOOK_BASE_URL`

Non-secret runtime settings belong in committed config under `config/runtime.config.ts`:

- app/public domains
- Twilio resource IDs (`TWILIO_PHONE_NUMBER`, `TWILIO_PHONE_NUMBER_SID`, `TWILIO_MESSAGING_SERVICE_SID`)
- Stripe account ID (`STRIPE_ACCOUNT_ID`)
- setup email sender config
- onboarding safety feature flags

Local development values belong in `.env.local`.

Committed placeholders belong in `.env.local.example`.

Vercel values belong in Vercel Project Settings → Environment Variables.

Do not duplicate secrets into `app/`.

---

## 11. Backend Foundation State

Backend Foundation v1 has been built, committed, pushed, deployed, and verified.

Current live backend:

- `https://app.missedcallsdental.com`

Verified:

- `/api/health` passes.
- `/api/internal/health` passes.
- deployed `db.ok` is true.
- Supabase foundation migration has been applied.
- Twilio inbound SMS webhook has been verified.
- Twilio voice webhook route exists and is configured, but real voice testing is blocked until Twilio account trial restrictions are resolved.

---

## 12. Webhook URLs

Live Twilio voice webhook:

- `https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming`

Live Twilio inbound SMS webhook:

- `https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming`

Live Twilio message status callback:

- `https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status`

Future Stripe webhook:

- `https://app.missedcallsdental.com/api/webhooks/stripe`

Twilio webhooks are configured through the Twilio API.

Do not change Twilio settings without explicit owner approval.

Do not send outbound SMS without explicit owner approval.

---

## 13. Database Direction

Use Supabase/Postgres.

Foundation tables:

- `clinics`
- `clinic_phone_numbers`
- `webhook_events`
- `call_events`
- `patient_conversations`
- `messages`
- `opt_outs`

Design principles:

- use UUID primary keys
- include `created_at` and `updated_at` where appropriate
- add idempotency constraints for webhooks
- avoid unnecessary PHI
- do not store patient names until needed
- store phone numbers and event metadata carefully
- prepare for future clinic dashboard
- respect opt-out status before any outbound SMS

Do not apply future migrations to production without explicit approval.

---

## 14. SMS and Compliance Rules

SMS must be professional, clear, and dental-office appropriate.

Avoid spammy wording, fake urgency, discounts as pressure, diagnosis or medical advice, aggressive sales copy, and fake guarantees.

Respect STOP, START, HELP, opt-out state, clear sender identity, and patient trust.

Default safe SMS style:

> Hi, this is {{clinic_name}}. We missed your call. Would you like us to help schedule an appointment?

Do not send real outbound SMS without explicit user approval.

---

## 15. Safety Boundaries

Always follow these rules:

- Do not commit secrets.
- Do not print `.env.local` values.
- Do not commit `.env.local`.
- Do not commit `.local-agent/`.
- Do not modify `docs/` unless explicitly requested.
- Do not send SMS without explicit approval.
- Do not change Twilio Console/API webhooks without explicit approval.
- Do not deploy without explicit approval.
- Do not create Vercel/Supabase/Stripe/Twilio cloud resources without explicit approval.
- Do not run destructive SQL.
- Do not create live Stripe resources without approval.
- Do not make DNS changes without approval.
- Do not make fake medical claims.

---

## 16. Current Immediate Next Step

The immediate next product/technical step is to align onboarding around the current source-of-truth flow:

`Create office profile (clinic name, main office phone, ZIP code) -> Business Profile (Business Information + A2P Approval Information) -> local number prepared/reserved -> SMS approval readiness -> billing starts only after SMS recovery is active`

Current blockers/notes:

- Inbound SMS webhook has been verified.
- Inbound voice webhook is configured but real calls from unverified caller IDs are blocked by Twilio Trial account restrictions.
- To fully test inbound voice, upgrade Twilio to a paid account or test from a verified caller ID.
- Local phone numbers are the default MVP path; the system should prepare/reserve the best local number automatically.
- Do not require a customer-facing manual number catalog as a default onboarding step.
