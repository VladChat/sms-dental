# Repeatable Setup Checklist — Missed Calls Dental Pattern

Status: Active  
Purpose: Repeatable setup checklist for this project and future similar SaaS projects  
Last updated: 2026-05-25

Use this checklist when repeating the same pattern for another client/project.

Do not store secrets in this file.

---

## Maintenance Rule

Update this checklist only when a task teaches a reusable step, best practice, safety rule, or ordering lesson that should carry into future similar projects.

Good updates:

- new repeatable provider setup step
- safer ordering discovered through real setup
- reusable verification check
- recurring provider-specific pitfall and fix
- better prompt/task pattern for future agents

Do not add project-only noise, logs, secrets, or one-time debugging details.

---

## Phase 0 — Project and repo baseline

- [ ] Create or confirm GitHub repository.
- [ ] Confirm local repo path.
- [ ] Confirm main branch.
- [ ] Confirm `.gitignore` protects `.env`, `.env.*`, `.env.local`, `.local-agent/`, `.vercel/`, `node_modules/`.
- [ ] Confirm public marketing site folder.
- [ ] Confirm future app/backend folder direction.
- [ ] Create or update `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`.
- [ ] Create or update agent instructions.
- [ ] Add operational documentation update rule to agent instructions.
- [ ] Document the phone event strategy early so agents do not assume the app can magically detect calls to unrelated clinic numbers.

Current project status: complete.

---

## Phase 1 — Backend foundation

- [ ] Build Next.js App Router foundation from repo root.
- [ ] Keep existing marketing site untouched.
- [ ] Add `/api/health`.
- [ ] Add `/api/internal/health`.
- [ ] Add lazy env validation.
- [ ] Add DB helper.
- [ ] Add Twilio signature validation helper.
- [ ] Add Twilio webhook skeletons.
- [ ] Add Stripe webhook placeholder.
- [ ] Add Supabase migration SQL.
- [ ] Add backend foundation documentation.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Commit and push safe source files only.

Current project status: complete.

Known commit:

```txt
882b745 feat: add backend foundation v1
```

---

## Phase 2 — Supabase database

- [ ] Confirm database access without printing connection string.
- [ ] Confirm DB user.
- [ ] Confirm permission to create in `public`.
- [ ] Confirm foundation tables are absent before first apply.
- [ ] Apply initial migration.
- [ ] Verify tables exist.
- [ ] Verify RLS is enabled.
- [ ] Run DB health check.
- [ ] Do not run destructive SQL.

Current project status: complete.

Migration applied:

```txt
supabase/migrations/20260525000100_backend_foundation.sql
```

---

## Phase 3 — Vercel backend deployment

- [ ] Connect Vercel account/team.
- [ ] Create Vercel project.
- [ ] Link GitHub repo.
- [ ] Root directory: repo root.
- [ ] Framework: Next.js.
- [ ] Add env vars from local `.env.local`.
- [ ] Use transaction pooler for `SUPABASE_DB_URL`.
- [ ] Deploy.
- [ ] Test `/api/health`.
- [ ] Test `/api/internal/health`.
- [ ] Confirm deployed `db.ok: true`.

Current project status: complete.

Current project:

```txt
sms-dental
```

Current live fallback URL:

```txt
https://sms-dental.vercel.app
```

---

## Phase 4 — Supabase pooler/serverless compatibility

- [ ] Use `SUPABASE_DB_URL` for runtime/serverless pooler URL.
- [ ] Use `SUPABASE_DB_DIRECT_URL` for local direct/admin URL.
- [ ] Confirm pooler host contains `pooler.supabase.com`.
- [ ] Confirm pooler port is `6543`.
- [ ] Ensure DB client uses `prepare: false`.
- [ ] Test pooler locally.
- [ ] Update Vercel env var.
- [ ] Redeploy.
- [ ] Confirm deployed DB health.

Current project status: complete.

Known commit:

```txt
aa4eeb9 fix: support Supabase transaction pooler
```

---

## Phase 5 — Custom app/backend domain

- [ ] Add custom domain in Vercel.
- [ ] Wait for Vercel DNS instruction.
- [ ] Add DNS record at registrar.
- [ ] Do not change nameservers.
- [ ] Do not change root marketing site DNS.
- [ ] Wait for domain verification.
- [ ] Confirm SSL issued.
- [ ] Set `PUBLIC_WEBHOOK_BASE_URL` to custom backend domain.
- [ ] Redeploy.
- [ ] Test `/api/health` on custom domain.
- [ ] Test `/api/internal/health` on custom domain.
- [ ] Confirm `db.ok: true`.

Current project status: complete.

Current DNS record:

```txt
Type: A
Host: app
Value: 76.76.21.21
TTL: Automatic
```

Current domain:

```txt
https://app.missedcallsdental.com
```

---

## Phase 5A — Define clinic phone event strategy

Before onboarding a clinic, choose one or more connection modes.

### Conditional forwarding mode

- [ ] Clinic keeps its existing main number.
- [ ] Clinic/provider configures no-answer, busy, unavailable, or after-hours forwarding to the assigned Twilio number.
- [ ] Test that forwarded calls reach Twilio.
- [ ] Test that forwarded calls preserve original patient caller ID.
- [ ] Confirm voicemail does not answer before forwarding.

### Tracking number mode

- [ ] Clinic uses assigned Twilio number as dedicated tracking number.
- [ ] Decide where it will be published:
  - website CTA
  - landing page
  - Google Ads
  - print/mailers
  - campaign-specific material
- [ ] Test one direct inbound call to the tracking number.

### Hybrid mode

- [ ] Use conditional forwarding for missed/no-answer main-number calls.
- [ ] Use tracking number for selected campaigns.

Current project status: product strategy clarified, implementation testing pending.

---

## Phase 6 — Twilio webhook setup

- [x] Confirm Twilio env variables exist locally without printing values.
- [x] Confirm backend webhook endpoints are live.
- [x] Confirm unsigned manual POST returns 403.
- [x] Fetch current Twilio phone number webhook settings.
- [x] Fetch current Twilio Messaging Service settings.
- [x] Update IncomingPhoneNumber webhooks.
- [x] Update Messaging Service webhooks.
- [x] Verify Twilio settings after update.
- [x] Do not send outbound SMS.

Current project status: webhook setup complete by API.

Expected webhook URLs:

```txt
https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming
https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming
https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status
```

---

## Phase 7 — Inbound Twilio verification

- [x] Send one inbound SMS from owner phone to Twilio number.
- [x] Query recent `webhook_events`.
- [x] Confirm inbound SMS event recorded.
- [x] Confirm voice event recorded.
- [x] Confirm no outbound SMS was sent (foundation phase).
- [x] Document results in `SETUP-LOG.md`.
- [x] Upgrade Twilio account to paid (completed 2026-05-26).
- [x] Make one inbound voice call to Twilio number.
- [x] Confirm Vercel received `/api/webhooks/twilio/voice/incoming`.
- [x] Confirm Supabase recorded `voice.%` webhook event.

Current project status: complete.

---

## Phase 8 — Outbound messaging milestone

- [x] Create/confirm clinic row (`Owner Test Dental Office`, slug `owner-test`).
- [x] Create/confirm clinic phone number mapping (`+18447234944` → `owner-test`).
- [x] Implement clinic lookup by Twilio `To` number.
- [x] Implement opt-out check (`opt_outs` table).
- [x] Implement 24-hour duplicate suppression.
- [x] Implement safe outbound SMS helper with mode/allowlist guards.
- [x] Default mode is `disabled` — no SMS without explicit env config.
- [x] Test with controlled owner-owned number only (`owner_test` mode).
- [x] Confirmed SMS delivered to owner phone.
- [x] Confirmed duplicate suppression (second call within 24h → no second SMS).
- [x] Document exact SMS copy.
- [ ] Confirm Twilio/TCR/toll-free compliance status before enabling live mode.

SMS copy:

```txt
Hi, this is {{clinic_name}}. We missed your call. Would you like us to help schedule an appointment?
```

Current project status: owner-test mode complete and verified (2026-05-26).

Known commits:

```txt
4033903 feat: add owner-only missed call SMS flow
```

Next: wire inbound SMS STOP/START opt-out enforcement, then plan real clinic onboarding.

---

## Phase 9 — Billing milestone

Do not start until owner approves.

- [ ] Confirm pricing model.
- [ ] Create Stripe product/price.
- [ ] Implement Checkout.
- [ ] Implement Stripe webhook event handling.
- [ ] Map Stripe customer/subscription to clinic.
- [ ] Gate outbound SMS by subscription status.
- [ ] Test in Stripe test mode first.

Current project status: not started.

---

## Phase 10 — Dashboard milestone

Do not start until owner approves.

Recommended note:

- Use Claude Design for dashboard/UI mockups before implementation if design quality matters.

Possible screens:

- missed call inbox
- conversation view
- clinic settings
- Twilio number settings
- billing status
- opt-out view
- audit/logs

Current project status: not started.

---

## Standard safety checklist before any agent task

Before giving an agent a task, confirm:

- [ ] Does this task change source files?
- [ ] Does this task change production?
- [ ] Does this task send SMS?
- [ ] Does this task modify DNS?
- [ ] Does this task modify Twilio Console?
- [ ] Does this task apply SQL?
- [ ] Does this task create Stripe resources?
- [ ] Does this task expose secrets?
- [ ] Is a commit/push required?
- [ ] Which files are allowed?
- [ ] Which files are forbidden?
- [ ] Does this task create durable operational knowledge that should update operations docs?

If any production system changes, ask for explicit approval first.
