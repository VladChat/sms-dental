# Repeatable Setup Checklist — Missed Calls Dental Pattern

Status: Active  
Purpose: Repeatable setup checklist for this project and future similar SaaS projects  
Last updated: 2026-05-26

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
- [x] Fix SMS timing: move SMS send to voice/status callback after call ends (Phase 8A below).
- [ ] Confirm Twilio/TCR/toll-free compliance status before enabling live mode.

SMS copy:

```txt
Hi, this is {{clinic_name}}. We missed your call. Would you like us to help schedule an appointment?
```

Current project status: owner-test mode complete and verified (2026-05-26). SMS timing fix applied.

Known commits:

```txt
4033903 feat: add owner-only missed call SMS flow
ccab9d6 feat: improve missed-call voice greeting copy
```

---

## Phase 8A — SMS timing fix and voice/status callback

- [x] Add `app/api/webhooks/twilio/voice/status/route.ts`.
  - [x] Validates Twilio signature.
  - [x] Only processes `CallStatus=completed`; other statuses return 200 silently.
  - [x] Uses `externalId = "voice:status:${callSid}"` (distinct from ringing event).
  - [x] Calls `getOrCreateConversation` + `sendRecoverySms` with all guards unchanged.
  - [x] Returns empty `<Response/>` TwiML.
- [x] Remove SMS sending from `voice/incoming`.
- [x] Add read-only greeting prediction to `voice/incoming`.
  - [x] Prediction mirrors guard logic (mode, allowlist, opt-out, 24h window).
  - [x] Prediction is read-only — never writes or sends.
- [x] Update Twilio `IncomingPhoneNumber.statusCallback` via API to point to voice/status URL.
- [x] Confirm voice/status callback fires after call completion.
- [x] Confirm SMS arrives after, not during, the voice greeting.
- [x] Document reusable test caller reset procedure.

Reusable resettable test caller:

```txt
+12245329236
```

Reset procedure: see OPERATIONS-RUNBOOK.md Section 11.

Current project status: complete.

Known commit:

```txt
a947323 feat: send missed-call SMS after voice completion
```

---

## Phase 8B — Inbound SMS opt-out enforcement

- [x] Confirm `opt_outs` table exists with `(clinic_id, phone_number)` unique key.
- [x] Confirm `messages` table supports `direction='inbound'` and `detected_keyword` column.
- [x] No migration needed — foundation schema is complete.
- [x] Add `lib/db/opt-outs.ts` — `upsertOptOut` (STOP) and `clearOptOut` (START).
- [x] Add `recordInboundMessage` to `lib/db/messages.ts`.
- [x] Rewrite `app/api/webhooks/twilio/messaging/incoming/route.ts`:
  - [x] Validates Twilio signature.
  - [x] Records `webhook_events` idempotently.
  - [x] Looks up clinic by `To` number.
  - [x] Gets or creates patient conversation.
  - [x] Records inbound message (`direction='inbound'`, `detected_keyword`).
  - [x] STOP: calls `upsertOptOut` — future `sendRecoverySms` will be blocked.
  - [x] START: calls `clearOptOut` — future sends permitted again.
  - [x] HELP: returns empty `<Response/>` (Twilio platform sends compliance reply).
  - [x] Ordinary replies: stored, no auto-reply (future milestone).
- [x] Verify `sendRecoverySms` already checks `opt_outs` (it does — no change needed).
- [x] Run `npm run typecheck`: pass.
- [x] Run `npm run build`: pass.
- [x] Deploy and verify `/api/health`.
- [x] Live test: send STOP from owner test phone, confirm opt-out row created.
- [x] Live test: send START from same phone, confirm opt-out cleared.
- [x] Live test: verify next call does not trigger recovery SMS after STOP.
- [x] Live test: verify next call resumes recovery SMS after START.

Note: STOP/START/HELP originally returned TwiML `<Message>` replies causing duplicate messages (Twilio platform also sends compliance replies). Fixed in commit `a8d1451` — all keywords now return empty `<Response/>`. DB writes are unchanged.

Current project status: complete (2026-05-26).

---

## Phase 8C — Clinic onboarding safety gate

- [x] Add `sms_recovery_enabled boolean not null default false` to `clinics` table.
- [x] Update `lookupClinicByPhone` to select and return `sms_recovery_enabled`.
- [x] Update `sendRecoverySms` guards: allow `live` mode; add Guard 2 (live only) checking `clinic.sms_recovery_enabled`; make allowlist guard `owner_test`-only.
- [x] Update `predictGreeting` in `voice/incoming` to pass full `ClinicRow` and respect `sms_recovery_enabled` for `live` mode.
- [x] Apply migration — set `sms_recovery_enabled = true` for Owner Test Dental Office only.
- [x] Verify all existing owner-test behavior unchanged.
- [x] Run typecheck: pass.
- [x] Run build: pass.
- [x] Deploy and verify health.

Known commit: see Phase 8C entry in SETUP-LOG.md.

Current project status: complete (2026-05-26).

---

## Phase 8D — First real clinic onboarding

Use OPERATIONS-RUNBOOK.md Section 11 for the step-by-step procedure.

**A2P/toll-free registration is a hard prerequisite before enabling live SMS.** Complete Phase 8E before setting `SMS_RECOVERY_MODE=live`.

- [ ] A2P/toll-free compliance approved (see Phase 8E — must be done before enabling live SMS).
- [ ] Choose phone event strategy (conditional forwarding or tracking number).
- [ ] Insert clinic row (`sms_recovery_enabled = false` by default).
- [ ] Map Twilio number.
- [ ] Verify inbound call recording works with SMS off.
- [ ] Test STOP/START opt-out flow.
- [ ] Get owner approval to enable SMS for clinic.
- [ ] Set `sms_recovery_enabled = true` for clinic.
- [ ] Change `SMS_RECOVERY_MODE` to `live` in Vercel env vars.
- [ ] Redeploy.
- [ ] Verify recovery SMS fires after first missed call.
- [ ] Verify duplicate suppression.
- [ ] Document clinic slug and phone mapping.

Current project status: not started.

---

## Phase 8E — A2P/10DLC compliance readiness

See `A2P-10DLC-COMPLIANCE-READINESS.md` for full detail, wording, and checklists.
Use `TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md` as the copy-ready submission packet before opening Twilio Console.

- [ ] Add Terms of Service page to `missedcallsdental.com`.
- [ ] Add Privacy Policy page to `missedcallsdental.com`.
- [ ] Add SMS opt-out disclosure to website.
- [ ] Prepare and review all Twilio form wording from `TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md`.
- [ ] Submit Toll-Free Verification in Twilio Console for `+1 844 723 4944`.
- [ ] Wait for Twilio approval (typically 3–7 business days).
- [ ] Confirm approved status before proceeding to Phase 8D SMS enablement.

If using local 10DLC number instead of toll-free:
- [ ] Register Brand with TCR (EIN, business name, website, vertical).
- [ ] Register Campaign with TCR (use case, message flow, sample messages, opt-in method).
- [ ] Link approved Campaign to Twilio number.

Current project status: not started.

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

---

## Phase — Automated clinic onboarding

Reusable pattern for any future SaaS that onboards business customers
through an email-first link, with a server-side third-party number
purchase as part of setup.

Lessons applied here:

- Public marketing form on apex domain (`docs/`) does a CORS `POST` to
  the app domain (`app.*`). Never let the static site try to call
  third-party APIs directly.
- Setup links are composed from a single trusted env var
  (`APP_BASE_URL`). Never use the request `Host` header.
- Setup tokens are 32 random bytes hex-encoded, SHA-256 hashed in DB,
  with a fixed 72-hour expiry and constant-time comparison.
- Database column is named `setup_token_hash`, never `setup_token`.
- Third-party purchases (Twilio numbers) are gated by a boolean env
  flag (`TWILIO_NUMBER_PURCHASE_ENABLED=true`). Search is always
  allowed; purchase requires the flag.
- Purchase routes are idempotent at the tenant level: if the tenant
  already has an active assignment, return it without contacting the
  provider.
- Public-facing wording for the assigned number is "office texting
  number" — never the internal billing/role term.
- Confirmation page tells the user the existing office phone number is
  not replaced.
- Live customer SMS stays disabled after onboarding. Production go-live
  requires compliance approval, QA pass, owner approval, and an
  explicit mode flag.

Required env names for this pattern:

```
APP_BASE_URL
PUBLIC_SITE_URL
RESEND_API_KEY
SETUP_EMAIL_FROM
TWILIO_NUMBER_PURCHASE_ENABLED
OWNER_TEST_SETUP_LINK_FALLBACK  # local/owner test only, never in prod
```

---

## Country-aware onboarding (added 2026-05-27)

- [ ] Confirm the clinic's country is **United States** or **Canada**.
      Other countries are not supported by automated onboarding yet and
      will hit a "Not available yet. Contact us…" notice.
- [ ] On the clinic setup form, fill country + city + state/province +
      ZIP/postal code (state/province and postal code are optional but
      improve number-search quality).
- [ ] On the number-search step, decide between **Local** and **Toll-free**:
  - Local: looks local to patients near the office. Use when the clinic
    has a strong local identity or you want caller ID to match the
    region.
  - Toll-free: business-style number. **Voice works immediately. SMS
    requires Twilio toll-free verification before live patient
    messaging.** See `TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md`.
- [ ] Number purchase remains gated by `TWILIO_NUMBER_PURCHASE_ENABLED`.
      Keep it `false` for dry runs; flip to `true` only when the owner
      explicitly approves a real purchase.
- [ ] Onboarding never enables live SMS automatically. Live SMS still
      requires the standard go-live gate (compliance approval, QA pass,
      explicit `sms_recovery_enabled=true` for that clinic only).
