# Repeatable Setup Checklist — Missed Calls Dental Pattern

Status: Active  
Purpose: Repeatable setup checklist for this project and future similar SaaS projects  
Last updated: 2026-06-10

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

MVP note (2026-05-29): do not add a separate header-secret internal health endpoint. Keep `/api/health` as the only MVP health endpoint unless a real admin/internal auth design is explicitly requested and documented.

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

- [ ] A2P/carrier compliance approved (see Phase 8E — must be done before enabling live SMS).
- [ ] Start with Create office profile (clinic name, main office phone, ZIP code) only.
- [ ] Confirm Business Profile flow is used for later required fields (Business Information + A2P Approval Information).
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

## Phase 8E — A2P/Carrier compliance readiness

See `A2P-10DLC-COMPLIANCE-READINESS.md` for full detail, wording, and checklists.
Use `TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md` as the copy-ready submission packet before opening Twilio Console.

- [ ] Add Terms of Service page to `missedcallsdental.com`.
- [ ] Add Privacy Policy page to `missedcallsdental.com`.
- [ ] Add SMS opt-out disclosure to website.
- [ ] Prepare and review all Twilio form wording from `TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md`.
- [ ] Submit required carrier/A2P approval package for the assigned local number path.
- [ ] Wait for Twilio approval (typically 3–7 business days).
- [ ] Confirm approved status before proceeding to Phase 8D SMS enablement.

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
- Apply the project-wide form scope rule from `AGENTS.md`: collect only
  what is needed for the next step, defer non-essential fields, and add
  short "why this is needed" helper text for required fields.

Required env names for this pattern:

```
APP_BASE_URL
PUBLIC_SITE_URL
RESEND_API_KEY
SETUP_EMAIL_FROM
TWILIO_NUMBER_PURCHASE_ENABLED
OWNER_TEST_SETUP_LINK_FALLBACK  # local/owner test only, never in prod
```

### Production setup email — status (configured 2026-05-28)

- [x] **Resend configured.** `RESEND_API_KEY` is set on Vercel Production as an
      encrypted secret (a restricted, send-only key). It is the **only** Resend
      secret required. Sending domain `mail.missedcallsdental.com` is verified.
- [x] **Default sender centralized in code** — `config/runtime.config.ts`
      `email.defaultSetupFrom` = `Missed Calls Dental <no-reply@mail.missedcallsdental.com>`.
      `SETUP_EMAIL_FROM` is an optional, non-secret override and is **not** set
      on Vercel.
- [x] **Fallback disabled** for public launch:
      `OWNER_TEST_SETUP_LINK_FALLBACK=false`. (Only set it `true` for a short
      owner-only API test when Resend is intentionally bypassed — with it off
      and no Resend key, the endpoint returns `502 email_delivery_failed`.)
- [x] **Owner-only setup email dry run passed.** `POST /api/setup-requests`
      returned `ok:true` with **no** `setup_url`; the `setup_requests` row shows
      `email_status='sent'`. Raw token only reaches the recipient inbox — never
      logged. (Send-only key cannot fetch bodies; click-through is owner-verified.)
- [x] **Business Profile onboarding from the emailed link** (Create office
      profile → Business Profile → Business Information → A2P → `/business/{slug}`
      + `/privacy` + `/sms-terms`) verified end-to-end 2026-05-28; unchanged by
      the email-config commit.
- [x] No SMS sent, no Twilio number purchased/reserved, no Stripe action,
      billing stays Not started.

---

## U.S.-only onboarding, 3-field Step 1 (updated 2026-05-27)

- [ ] Confirm the clinic is in the **United States**. Automated
      onboarding is U.S.-only; the UI does not show a country
      selector, and the backend rejects any non-US payload with
      "Automated setup is currently available for U.S. clinics only."
- [ ] On Step 1 of the clinic setup form, the owner fills only
      **clinic name**, **main office phone** (any common U.S. format
      — normalized to E.164 internally), and **ZIP code**.
      No legal name, owner phone, timezone, test patient phone, or
      setup mode is asked here. See `AGENTS.md` →
      "Form and Onboarding Scope Rule".
- [ ] For Missed Calls Dental, use owner self-service number search/purchase through
      the shared provisioning service as the current account flow. A request/review
      pattern is only for products that intentionally require operator-controlled
      provisioning.
- [ ] Number purchase remains gated by `TWILIO_NUMBER_PURCHASE_ENABLED`.
      Keep it `false` for dry runs; flip to `true` only when the owner
      explicitly approves a real purchase.
- [ ] Onboarding never enables live SMS automatically. Live SMS still
      requires the standard go-live gate (compliance approval, QA pass,
      explicit `sms_recovery_enabled=true` for that clinic only).

## Business Profile onboarding (added 2026-05-28)

- [ ] Apply `supabase/migrations/20260528000100_business_profile_onboarding.sql`
      to Supabase (owner approval required) before the live flow works.
- [ ] Screen 1 **Create office profile** shows only clinic name, main office
      phone, ZIP code; button reads **Create office profile**.
- [ ] After save, the Business Profile page opens (no Review & Submit step) with
      a status strip (Local number / SMS / Billing) and cards: Business
      Information, A2P Approval Information, Public Business Page, Billing,
      Billing History, Login & Security, Support.
- [ ] Business Information prefills clinic name / main office phone / ZIP from
      Create office profile (no duplicate entry).
- [ ] A2P Approval Information prefills representative email (setup/login email)
      and representative phone (main office phone). Saving stores data locally
      only and shows SMS status **Waiting for approval** — it never enables live
      SMS or submits to Twilio.
- [ ] Public pages render at `/business/{slug}`, `/business/{slug}/privacy`,
      `/business/{slug}/sms-terms` and name Missed Calls Dental / Dental SMS as
      the technology/service provider.
- [ ] Billing details live in `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`. Current
      Missed Calls Dental backend starts the 21-day trial after first successful
      number assignment; SMS recovery activation remains separately gated.

---

## Auth UX polish (reusable lessons)

- [ ] One canonical login on the app domain; the marketing sign-in page is a
      redirect to it, and every marketing nav Sign in link points to the app login.
      Avoid two separate login experiences.
- [ ] Match the app login visually to the marketing design by reusing shared design
      tokens (same CSS variables) rather than duplicating provider CSS.
- [ ] Password reset form: include a read-only email field with
      `autocomplete="username"` (value from the authenticated recovery session) so
      the browser saves credential = email + new password. Use
      `autocomplete="new-password"` on the password fields.
- [ ] Show/Hide a password by toggling `-webkit-text-security` (keep
      `type="password"` constant) — toggling `type` makes Chrome re-offer the
      strong-password generator on a field that already has text. Don't remount it.
- [ ] Reset email Gmail row: don't repeat the brand in the subject (the sender name
      already shows it), and don't start the body/snippet with the subject text.

---

## Workspace / operational tables (reusable lessons)

- [ ] If the UI shows a Save control on real data, it must really persist. Demo
      sample data must be clearly labeled and must never write to the database.
- [ ] Keep operational write endpoints clinic-scoped in SQL (`where id = $id and
      clinic_id = $clinic`) so a session can only mutate its own clinic's rows;
      reject demo/sample IDs explicitly.
- [ ] Enforce field limits both client-side (counter + inline error) and
      server-side; trim text and store empty optional text as NULL.
- [ ] Prefer additive nullable columns + check constraints over a new table when an
      existing row is the right home for the new state; map domain outcomes onto the
      existing lifecycle status enum instead of inventing new statuses.
- [ ] Separate real vs sample UI into distinct sections with a local Hide/Show that
      only affects the sample layer; never let hiding samples hide real data.

---

## Setup-link idempotency (reusable lessons)

- [ ] Bearer "magic" links (setup/invite/reset) must be idempotent: determine the
      completed state server-side BEFORE rendering or processing a create form.
- [ ] Use a reliable completion marker (e.g. the linked auth account exists) over
      an intermediate status value that keeps advancing after creation.
- [ ] Enforce the same completed-state check in the submit handler, not just the
      page, so a stale tab/re-POST cannot duplicate accounts or overwrite passwords.
- [ ] Completed-state UI shows no password fields (so password managers do not see
      a new-password form) and offers a single Sign in action.

---

## Stripe payment-method collection (sandbox-first, reusable lessons)

- [ ] Collect "save card for later" with a **Checkout Session in `mode:"setup"`**, not a
      custom card form and not a PaymentIntent. No charge/subscription/invoice is created.
- [ ] **Never pass `payment_method_types`** — omit it so dynamic payment methods (managed
      in the Dashboard) apply.
- [ ] Gate the server Stripe client to **test/sandbox keys** for pre-billing milestones:
      refuse to initialize unless the secret key starts with `sk_test_`/`rk_test_`. This
      makes accidental live charges impossible from that code path.
- [ ] Keep webhook **signature verification** separate from the API-call client (two
      helpers), and keep the secret key server-only; never expose it to the browser or put
      it in committed runtime config.
- [ ] Derive `hasPaymentMethod` from a **saved payment-method id**, not the customer id or
      billing status (a customer can exist with no method).
- [ ] Store only **safe metadata** (payment method id, brand, last4, exp month/year,
      timestamps) — never raw card number/CVC. Add CHECK constraints (month 1..12, year
      range, last4 length).
- [ ] Process setup completion from BOTH `checkout.session.completed` (mode=setup) and
      `setup_intent.succeeded` for resilience; key idempotency off the webhook event id and
      make the DB write an idempotent UPDATE.
- [ ] Carry `clinic_id` (or tenant id) only in Stripe **metadata / client_reference_id**;
      the setup route must take no tenant id from the client and derive it from the session.
- [ ] UI return states: open the Billing section via `?section=…`, show success only when
      the method is actually present (never infer from the query param), and provide a
      Refresh affordance for the brief webhook-processing delay.
- [ ] Locally, forward the webhook (`stripe listen --forward-to …/api/webhooks/stripe`) or
      the saved method never appears; verify the test Dashboard shows only a Customer +
      PaymentMethod (no Subscription/Invoice/charge).
- [ ] Vercel injects env vars at **deploy-create time** — after adding/changing a secret you
      MUST redeploy (redeploy the existing commit via API `POST /v13/deployments` with
      `deploymentId`; no code change needed). The old running deployment keeps the old snapshot.
- [ ] Add secrets without exposing values: read from local `.env.local` in-process, POST to
      `…/v10/projects/{id}/env?upsert=true` with `type:"sensitive"` (can't be read back), and
      print only key/target/type from the response. Confirm prefixes (`sk_test_`, `whsec_`)
      locally, never echo the value.
- [ ] Verify a webhook signing secret is wired WITHOUT a real event: POST a bogus
      `stripe-signature` to the endpoint. "Invalid Stripe signature" = secret present & used;
      a generic "Unauthorized" = secret missing. Safe (rejected before any side effect).
- [ ] Confirm a Stripe key is genuinely test-mode with a read-only `GET /v1/balance` →
      `livemode:false` (creates nothing); don't rely on the prefix alone.

---

## Separating "owner request" from "operator provisioning" (conditional reusable lessons)

- [ ] Use this pattern only when the product intentionally keeps provider provisioning
      operator-controlled. Current Missed Calls Dental does **not** use this as the main
      account flow; it uses self-service purchase through the shared provisioning service.
- [ ] When a customer selects a provider resource (phone number, etc.) but provisioning must
      stay operator-controlled, store the choice as a **request row** in its own table
      (`*_requests`, status enum `pending|reviewed|fulfilled|rejected|cancelled`) — never write
      the live provisioning table or flip lifecycle/status columns from the customer path.
- [ ] The customer write route must: require auth, reject lower roles, derive tenant id from
      the session (never from the client), validate the payload (E.164, required capabilities)
      with zod, and make **zero** provider API calls.
- [ ] When the product supports additive resources (e.g. multiple business numbers), allow
      multiple *different* open requests to coexist. De-duplicate only the **same tenant +
      same resource** open request (return the existing row; a partial unique index on open
      statuses enforces it). **Never** silently cancel an older *different* open request unless
      the product explicitly defines replacement behavior — additive ≠ replace.
- [ ] Make new-table reads **defensive** (`.catch(() => null/[])`) in page/console loaders so
      the app still renders before the hand-applied migration lands (avoids a repeat of the
      "missing column/table → 500" outage).
- [ ] Keep the operator's existing gated provisioning flow unchanged; surface the request as a
      review hint only (no auto-approve, no bypass of the purchase gate).

---

## Plan pricing + per-unit consent (reusable lessons)

- [ ] Put plan price, included usage, per-unit add-on prices, and consent text/version in ONE
      client+server-safe config (no secrets/env) and render everything from it. Never re-type
      `$99`/`$20`/`1000`/`0.07` in UI/API code; provide `formatUsdFromCents`/`formatInteger`.
- [ ] Classify paid vs included on the SERVER from live DB state inside a per-tenant locked
      transaction (`select ... for update`); never accept price/billing-class/quantity from the
      client. Re-validate at activation time before any real charge.
- [ ] For a recurring add-on, require an explicit unchecked-by-default consent checkbox, enforce
      it server-side, and persist a durable consent snapshot (text + version + who + when). Reset
      the checkbox on selection change / new search / collapse.
- [ ] CHECK-constrain the snapshot so `included` rows have amount 0 and `additional` rows have
      amount > 0 + full consent — and confirm existing rows satisfy the `included` branch so the
      additive migration never makes legacy rows billable or demands retroactive consent.
- [ ] Add a partial unique index for OPEN statuses only after a production preflight confirms no
      conflicting duplicate open rows; stop and report if duplicates exist (don't mutate silently).
- [ ] Accessible info tooltip: a real `<button>` with `aria-label` + `aria-expanded` +
      `aria-describedby`, popup `role="tooltip"`, works on hover/focus/tap, closes on Escape +
      outside click, constrained width so it never causes mobile horizontal overflow.

---

## Self-service provider purchasing + paid-plan conversion (reusable lessons)

- [ ] Put real provider-purchase logic in ONE shared service used by every caller (owner + admin);
      no route duplicates it. Recompute entitlement from live DB inside a per-tenant row lock.
- [ ] Serialize concurrent purchases with a durable attempt row + a partial unique index
      (one in-flight per tenant and per resource). Insert `started` BEFORE the external call;
      do NOT hold the DB transaction open across the provider/Stripe call.
- [ ] Persist the provider SID immediately after purchase; on an uncertain provider outcome mark
      `reconciliation_required` (never claim "nothing was purchased", never hide the SID, never
      auto-release).
- [ ] For a metered add-on: purchase the resource, then sync the Stripe subscription-item
      **quantity** (idempotency key from the attempt id; `proration_behavior:create_prorations`
      so there's no immediate charge), and activate the resource ONLY after the sync succeeds.
      Suspension keeps quantity (don't auto-decrement); never auto-release.
- [ ] Grant paid entitlement ONLY from a webhook-confirmed active subscription — never from a
      `?success` query param. Billing-critical webhook handlers must be idempotent, run on every
      delivery (even "duplicate"), and FAIL CLOSED (return 5xx so Stripe retries) on a DB write
      failure.
- [ ] When starting a paid plan from a saved payment method instead of Checkout, create the
      subscription server-side with `collection_method:'charge_automatically'`,
      `default_payment_method`, and `payment_behavior:'error_if_incomplete'`; return an in-app
      payment error if the saved card fails or needs action, and still wait for webhook-confirmed
      active status before unlocking paid entitlement.
- [ ] Trial source of truth = the tenant's own trial columns set at first activation, not a
      registration/setup date.
- [ ] For a paid provider resource with required one-time fees, create/sync Stripe billing BEFORE
      the provider purchase. If Stripe fails, do not call the provider. If Stripe succeeds but the
      provider purchase/configuration or DB activation fails, preserve the billing and provider
      state in a reconciliation record instead of retrying silently or hiding the charge.

---

## Delayed provider-resource removal + next-cycle billing (reusable lessons)

- [ ] Model customer removal as lifecycle state first (`active -> scheduled ->
      permanently_removed`), not immediate deletion, so the user can restore and
      operators retain audit history.
- [ ] Stop routing/access immediately on scheduled removal, but delay destructive
      provider release until a scheduled job processes rows due for permanent
      removal.
- [ ] For recurring billing removals/restores, compute desired quantities
      server-side from live DB rows and sync Stripe before changing the DB state.
      If Stripe fails, leave the provider resource unchanged.
- [ ] Use no-proration lifecycle updates when the product promise is "updates
      next cycle"; document that no immediate credit/refund/charge is issued.
- [ ] Hide permanently removed rows from normal customer lists but keep them in
      the database for audit and reconciliation.
- [ ] Secure cron/job routes with a bearer secret; for Vercel Cron, use
      `CRON_SECRET` so Vercel automatically supplies the Authorization header.

---

## Per-resource capability status vs lifecycle (reusable lessons)

- [ ] Model lifecycle/routing state separately from provider approval/capability
      state. A resource can be assigned and routable for calls while its texting,
      compliance, or provider approval capability is still pending.
- [ ] If approval is per resource, store the customer-facing capability status on
      that resource row. Do not paint a tenant-wide workflow status onto every
      resource card unless the provider model truly works that way.
- [ ] Backfill conservatively: derive from tenant-level status only when it is a
      safe approximation for that resource type; leave unknown or separately
      verified resource types pending until confirmed.
- [ ] Default newly assigned or reassigned resources to pending unless a reliable
      provider signal proves they are already approved. Reassignment should clear
      stale active capability state.
- [ ] Customer display should combine lifecycle and capability: inactive or
      scheduled-removal resources render as not active even if a stored capability
      status says active.
- [ ] Keep provider capability sync read-only unless the task explicitly requires
      mutation. A status sync should read provider state and write only local
      capability/diagnostic fields.
- [ ] Use one shared sync service for manual refresh, event-triggered refresh, and
      scheduled reconciliation. Manual clicking should be a fallback, not the
      normal path to correct customer status.
- [ ] Put schedule, batch sizes, stale windows, provider read limits, source
      labels, and reconciliation toggles in config. Do not scatter those literals
      through routes/services.
- [ ] Reconcile in bounded batches using stale-row selection. Pending/failed
      resources can be checked more often; active resources should be checked less
      often for drift.
- [ ] Store provider diagnostics separately from the customer-facing capability
      status. Provider/API errors should never mark a resource active by
      inference.
- [ ] Live use of a provider capability must gate on the same per-resource status
      the customer/admin UI shows, plus any provider-specific readiness checks for
      that resource type.

---

## Mock vs live provider test modes (reusable lessons)

- [ ] If a workflow needs both mock/test and live/provider-billable attempts,
      store them separately by an explicit mode key (for example
      `(tenant_id, submission_mode)`), not in one shared row that can overwrite
      a failed live attempt.
- [ ] Make `mock` a first-class server-side mode, not a hidden checkbox under
      live mode, and validate the requested mode on the server.
- [ ] For Twilio Mock A2P, require `mock: true` on Brand creation and add a
      test that fails if mock mode can call Brand Registration without it.
- [ ] Use a separate empty Messaging Service for mock Campaigns. Never reuse
      the live Messaging Service and never attach real senders to the mock one.
- [ ] Split live Brand submission from live Campaign creation when Campaign
      creation has separate recurring fees or hidden consequences. Require a
      second explicit operator confirmation for the fee-bearing step.
- [ ] If a new mode-aware schema migration is required, fail closed in the UI
      and routes until that migration is applied instead of silently falling
      back to an unsafe single-row overwrite path.

---

## Deterministic SMS/voice conversation templates (reusable lessons)

- [ ] Keep customer/admin-editable copy as text templates only. Provider XML,
      TwiML verbs, sender selection, send gates, and lifecycle behavior stay
      system-controlled.
- [ ] When reusing a template table for a new role, widen role/sequence
      constraints with a small additive migration and keep no-row defaults safe.
- [ ] Test the real send-path body builder, not only the pure renderer, so saved
      templates cannot drift back to fixed defaults.
- [ ] Classify ordinary inbound replies before automation. Thanks,
      acknowledgements, negative replies, and unclear short replies should be
      saved without auto-replying or consuming a follow-up slot.
- [ ] Treat patient-name extraction as fail-closed. Never overwrite an existing
      name; when a safe name is already known, skip the name-question slot and
      atomically claim the actual sequence sent.
- [ ] When expanding deterministic follow-up slots, define one shared slot
      constant and one shared max. Make default-backed slots explicit, and fail
      closed for later custom-only slots with no body.
- [ ] Keep courtesy/acknowledgement replies out of numbered follow-up counters.
      If a courtesy response is needed, give it its own per-cycle idempotency
      marker and reset that marker only after a new recovery outbound is
      successfully recorded.
- [ ] For voice greetings, escape XML at the final TwiML boundary and validate
      scenario-specific copy (for example, no "we'll send a text now" promise in
      duplicate/no-text scenarios).
