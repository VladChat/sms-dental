# Operations Runbook — Missed Calls Dental

Status: Active  
Audience: AI coding agents, technical founder, future operators  
Last updated: 2026-06-01 (password reset email routing + branded SMTP)

This runbook explains how to operate and verify the Missed Calls Dental backend/app infrastructure.

It must not contain passwords, auth tokens, service role key values, full database URLs with passwords, or private patient data.

---

## 0. Maintenance Rule

Update this runbook when a task changes how the project is operated, verified, deployed, debugged, or safely repeated.

Good updates:

- new health check procedure
- new Vercel/DNS/Supabase/Twilio/Stripe operational step
- confirmed production-like issue and confirmed fix
- new required env variable name
- new public URL or webhook URL
- provider behavior that matters later

Do not add secrets, raw long logs, temporary failed commands, duplicate facts, or speculation.

## 0A. Env and Config Ownership (2026-05-29)

Use this ownership rule before adding any new variable:

1. secret/credential -> `.env.local` and Vercel env
2. non-secret runtime config -> committed `config/runtime.config.ts`
3. dead/test placeholder -> do not add

`.env.local` and `.env.local.example` now keep secret/credential names only:

- `SUPABASE_DB_URL`
- `SUPABASE_DB_DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VERCEL_TOKEN`
- `RESEND_API_KEY`

Removed placeholder variable:

- `JOB_RUNNER_SECRET`

Also intentionally removed from MVP:

- `INTERNAL_ADMIN_SECRET` (protected internal health endpoint removed)

---

## 1. Current Architecture

### Public marketing site

- Folder: `docs/`
- Hosting: GitHub Pages
- Production URL: `https://missedcallsdental.com`
- Local preview: `http://localhost:8080/`
- Rule: Do not modify `docs/` unless explicitly requested.

### SaaS app / backend

- Folder direction: `app/`
- Hosting: Vercel
- Vercel project: `sms-dental`
- Vercel team slug: `vladchat-1500s-projects`
- Vercel team ID: `team_1F2PWbZbJldYTbtZ8HlEVMCm`
- Production app/backend URL: `https://app.missedcallsdental.com`
- Vercel fallback URL: `https://sms-dental.vercel.app`

### Product phone event strategy

The backend does not automatically know about calls to a clinic's unrelated phone number.

A call event reaches the system by one of these supported MVP paths:

1. Conditional forwarding mode
   - Clinic keeps its main number.
   - Clinic/provider forwards no-answer, busy, unavailable, or after-hours calls to the assigned Twilio recovery number.
   - The forwarded call should preserve original caller ID.

2. System-prepared local-number path
   - The system prepares/reserves the best local number automatically from the clinic context.
   - The customer is not required to manually choose from a number catalog during default onboarding.
   - The prepared local number can later be used for direct routing or campaign needs where appropriate.

Tracking-number usage may remain an alternate operational use case, but it is not the default customer onboarding path.

Future versions may add direct integrations with phone providers or dental communication platforms.

Operational test requirement:

- When testing forwarding, confirm Twilio receives the patient's number as `From`.
- If `From` becomes the clinic number, SMS recovery cannot reliably message the patient.

### Database

- Provider: Supabase / Postgres
- Project ref: `qfjpvbvfvhbtebwivcdc`
- Runtime DB connection: Supabase transaction pooler on port `6543`
- Direct/admin DB connection: Supabase direct host on port `5432`
- Important rule: never store full database URLs with passwords in documentation.

### DNS

- Registrar/DNS provider: Namecheap
- App subdomain record:
  - Type: `A`
  - Host: `app`
  - Value: `76.76.21.21`
  - TTL: Automatic or 300
- Rule: Do not change nameservers. Do not change root `missedcallsdental.com` or `www` without explicit approval.

### Twilio

- Twilio account: Active / Full (upgraded from Trial on 2026-05-26).
- Twilio number: `+1 844 723 4944`
- Twilio webhooks have been configured through API.
- Inbound SMS webhook: verified and recorded in Supabase.
- Inbound voice webhook: verified end-to-end (Twilio → Vercel → Supabase).
- Voice call behavior: callers hear a polite announcement ("Thanks for calling. We missed your call and will be in touch shortly.") then the call ends cleanly.
- Outbound SMS has not been enabled.

---

## 2. Health Checks

Public backend health:

```txt
https://app.missedcallsdental.com/api/health
```

Expected result:

- `ok: true`
- `service: missed-calls-dental`
- `version: foundation-v1`

Local checks:

```powershell
npm run typecheck
npm run build
```

---

## 3. Database Operations

Migration applied:

```txt
supabase/migrations/20260525000100_backend_foundation.sql
```

Created tables:

- `clinics`
- `clinic_phone_numbers`
- `webhook_events`
- `call_events`
- `patient_conversations`
- `messages`
- `opt_outs`

RLS is enabled on all seven foundation tables.

Use two different env variables:

- `SUPABASE_DB_URL` — runtime/app/serverless URL using transaction pooler, port `6543`
- `SUPABASE_DB_DIRECT_URL` — direct local/admin/migration URL, port `5432`

The backend DB client must use `prepare: false` for Supabase transaction pooler compatibility.

Safe DB checks:

```sql
select 1;
select current_user;
select to_regclass('public.clinics');
select to_regclass('public.webhook_events');
```

Do not run destructive SQL unless explicitly approved.

---

## 4. Vercel Operations

Current Vercel state:

- Project: `sms-dental`
- Team slug: `vladchat-1500s-projects`
- Domain verified: `app.missedcallsdental.com`
- SSL issued: yes
- `PUBLIC_WEBHOOK_BASE_URL` set to `https://app.missedcallsdental.com`
- Deployed backend DB health: `db.ok: true`

Latest known custom-domain redeploy:

```txt
dpl_89HfxNTrc4KtgzTJJM1Pyk2W8kp2
```

Required Vercel env names:

- `SUPABASE_DB_URL`
- `SUPABASE_DB_DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VERCEL_TOKEN`
- `RESEND_API_KEY`
- `PUBLIC_WEBHOOK_BASE_URL`

Non-secret runtime settings do not belong in `.env.local` and are owned by committed config:

- `config/runtime.config.ts` for app/public URLs
- `config/runtime.config.ts` for Twilio resource IDs (`TWILIO_PHONE_NUMBER`, `TWILIO_PHONE_NUMBER_SID`, `TWILIO_MESSAGING_SERVICE_SID`)
- `config/runtime.config.ts` for Stripe account ID (`STRIPE_ACCOUNT_ID`)
- `config/runtime.config.ts` for setup sender + onboarding safety flags

After env changes, redeploy before testing.

---

## 5. Namecheap DNS Operations

Current DNS change made:

```txt
Type: A
Host: app
Value: 76.76.21.21
TTL: Automatic
```

Do not change nameservers. Do not change root apex or `www` records without explicit approval.

---

## 6. Twilio Operations

Current live webhook URLs:

```txt
Voice incoming:      https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming
Voice status (new):  https://app.missedcallsdental.com/api/webhooks/twilio/voice/status
Inbound SMS:         https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming
SMS status:          https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status
```

Current Twilio IncomingPhoneNumber webhook fields:

- `voiceUrl` → `/api/webhooks/twilio/voice/incoming`
- `voiceMethod` → `POST`
- `statusCallback` → `/api/webhooks/twilio/voice/status` (updated 2026-05-26; was previously pointing to messaging/status by mistake)
- `statusCallbackMethod` → `POST`
- `smsUrl` → `/api/webhooks/twilio/messaging/incoming`
- `smsMethod` → `POST`

Current behavior:

- Unsigned manual POST returns `403`, which is correct.
- Twilio-signed requests pass validation.
- Inbound SMS: verified.
- Inbound voice: verified. Returns dynamic `<Say>` + `<Hangup/>` TwiML. Callers hear a first-call or repeat-call greeting then the call ends cleanly.
- `voice/incoming` handler: validates signature, records `webhook_events`, upserts `call_events`, performs read-only greeting prediction, returns TwiML. Does NOT send SMS.
- `voice/status` handler: receives `CallStatus=completed` after the call ends, validates signature, records `webhook_events` (keyed `voice:status:<CallSid>`), looks up clinic, calls `sendRecoverySms()`. SMS is sent here, not in voice/incoming.
- Duplicate Twilio retries of either endpoint are deduplicated by `webhook_events` unique constraint.

Voice greeting logic (read-only prediction in voice/incoming):

- `will_send` (first call, SMS eligible): "Thanks for calling {{clinic_name}}. Sorry we missed you. We'll text you now so you can request an appointment or a call back."
- `duplicate` (24h window, SMS suppressed): "Thanks for calling {{clinic_name}}. Sorry we missed you. We already sent a text, and our team will follow up shortly."
- `none` (no clinic / gated / error): "Thanks for calling us. Sorry we missed you. Our team will follow up shortly."

Current phone number and Messaging Service webhook fields were updated through Twilio API and verified by API read-back.

Configured fields:

- IncomingPhoneNumber `voiceUrl`
- IncomingPhoneNumber `voiceMethod`
- IncomingPhoneNumber `smsUrl`
- IncomingPhoneNumber `smsMethod`
- IncomingPhoneNumber `statusCallback`
- IncomingPhoneNumber `statusCallbackMethod`
- Messaging Service `inboundRequestUrl`
- Messaging Service `inboundMethod`
- Messaging Service `statusCallback`

### Voice webhook verification (updated 2026-05-26)

Current end-to-end flow for each inbound call:

1. Inbound call hits `+1 844 723 4944` → Twilio fires POST to `voiceUrl` (`voice/incoming`).
2. `voice/incoming`: validates signature, records `voice.ringing` in `webhook_events`, upserts `call_events`, performs read-only greeting prediction, returns `<Say>+<Hangup/>` TwiML. No SMS sent.
3. Caller hears the appropriate greeting (first-call or repeat-call) then the call ends.
4. Twilio fires POST to `statusCallback` (`voice/status`) with `CallStatus=completed`.
5. `voice/status`: validates signature, records `voice.completed` (keyed `voice:status:<CallSid>`), looks up clinic, calls `sendRecoverySms()`. SMS fires here, after the call ends.

To re-verify after any change:

1. Make one inbound call to the Twilio number.
2. Check Vercel logs for `POST /api/webhooks/twilio/voice/incoming` → expect HTTP 200.
3. Check Vercel logs for `POST /api/webhooks/twilio/voice/status` → expect HTTP 200.
4. Query `webhook_events` for `event_type = 'voice.ringing'` and `event_type = 'voice.completed'` for the same call.
5. If `SMS_RECOVERY_MODE=owner_test` and caller is allowlisted: confirm one `messages` row created and SMS delivered.
6. Confirm no outbound SMS was sent during the `voice/incoming` request (only during `voice/status`).

---

## 7. Clinic Onboarding Phone Questions

Customer-facing onboarding starts with only:

- Clinic name
- Main office phone
- ZIP code

Later Business Profile cards collect Business Information and A2P Approval Information only when needed.

Operator/admin questions may be used when configuring forwarding or troubleshooting:

- What phone provider/system do you use?
- Do you want to keep your main number and forward missed/no-answer calls?
- Can your phone system forward no-answer, busy, unavailable, or after-hours calls?
- Can it preserve the original caller ID when forwarding?
- How many rings or seconds before voicemail answers?
- Does voicemail answer before forwarding?
- Do you already use Weave, RevenueWell, Mango Voice, Adit, RingCentral, Nextiva, Dialpad, or another missed-call/SMS product?

Compatibility test:

1. Configure forwarding or use the prepared local number path.
2. Make a real inbound test call.
3. Verify Twilio receives the event.
4. Verify `From` is the patient caller ID when forwarding is used.
5. Verify no outbound SMS is sent until approved/configured.

---

## 8. Git and Commit Safety

Never commit `.env.local`, `.env`, `.local-agent/`, real API keys, DB URLs with passwords, Twilio auth token, Stripe secret key, or Supabase service role key value.

Known unrelated local untracked items that should not be accidentally committed:

- `MVP_BUILD_DOCS/env/`
- `design/`
- `docs/images/marketing/hero-workflow-visual-1.webp`
- `docs/images/marketing/hero-workflow-visual-dark.png`
- `docs/images/marketing/hero-workflow-visual-dark.webp`
- `public/brand/logo-source-notes.md`
- `skills-lock.json`

Before every commit:

```powershell
git status --short
git diff --check
git diff --cached --name-only
```

---

## 9. Outbound SMS Recovery — Owner Test Mode

### When SMS is sent

SMS is now sent AFTER the voice call ends, not during the incoming webhook.

Flow:
1. `voice/incoming` fires when the call starts — returns TwiML, no SMS.
2. Caller hears the greeting, call ends.
3. `voice/status` fires when Twilio sends `CallStatus=completed`.
4. `sendRecoverySms()` is called from `voice/status`.

This ensures the caller hears the full greeting before any SMS arrives on their phone.

### Safety model

Outbound SMS is controlled by two env variables:

| Variable | Values | Default |
|---|---|---|
| `SMS_RECOVERY_MODE` | `disabled` \| `owner_test` \| `live` | `disabled` |
| `SMS_TEST_ALLOWED_TO` | Comma-separated E.164 numbers | (empty) |

Default behavior (`SMS_RECOVERY_MODE` unset or `disabled`): **no SMS is ever sent.**

`owner_test` mode: SMS is sent only when ALL of the following are true:
- `SMS_RECOVERY_MODE=owner_test`
- Caller `From` number is in `SMS_TEST_ALLOWED_TO`
- Clinic mapping exists for the dialed `To` number
- Caller is not opted out (`opt_outs` table)
- No outbound SMS was sent to this (clinic, caller) pair in the past 24 hours

`live` mode: implemented — requires `SMS_RECOVERY_MODE=live` in Vercel AND `clinics.sms_recovery_enabled=true` per clinic. Carrier/A2P approval must be complete before enabling. See `A2P-10DLC-COMPLIANCE-READINESS.md`.

### SMS message template

```
Hi, this is {{clinic_name}}. We missed your call. Would you like us to help schedule an appointment?
```

No AI mention. No urgency. No medical advice. No appointment promise.

### Owner test setup

1. Set `SMS_RECOVERY_MODE=owner_test` in Vercel env.
2. Set `SMS_TEST_ALLOWED_TO=<your E.164 number>` in Vercel env (not committed to source).
3. Redeploy after env changes.
4. Call the Twilio number from the allowlisted number.
5. Verify SMS received.
6. Verify `messages` table has a new outbound row.
7. Call again within 24h — verify second SMS is suppressed (duplicate check).

Never set `SMS_TEST_ALLOWED_TO` to a number belonging to a real patient.

### Clinic mapping requirement

Outbound SMS requires a clinic row in `clinics` and a matching row in `clinic_phone_numbers` for the Twilio `To` number. Without a clinic mapping, no SMS is attempted.

Current test mapping:

- Clinic: `Owner Test Dental Office` (slug: `owner-test`)
- Twilio number: `+1 844 723 4944`
- Applied via: `supabase/migrations/20260526000100_owner_test_clinic.sql`

---

## 10. Inbound SMS Opt-Out Handling

### Behavior

The `messaging/incoming` webhook now fully processes inbound SMS replies:

| Keyword | Trigger words | DB action | TwiML reply |
|---|---|---|---|
| `stop` | STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT | `upsertOptOut(clinic, caller)` | empty `<Response/>` |
| `start` | START, UNSTOP, YES | `clearOptOut(clinic, caller)` | empty `<Response/>` |
| `help` | HELP, INFO | none | empty `<Response/>` |
| *(ordinary)* | anything else | none | empty `<Response/>` |

All inbound messages (including ordinary replies) are stored in the `messages` table with `direction='inbound'` and `detected_keyword` set when applicable.

### Opt-out storage

Table: `public.opt_outs`

- `upsertOptOut(clinicId, phone)` — inserts or refreshes opt-out row; sets `opted_out_at = now()` and clears `opted_back_in_at = null`.
- `clearOptOut(clinicId, phone)` — sets `opted_back_in_at = now()` on an existing row; no-op if caller was never opted out.

`sendRecoverySms` already checks `opted_back_in_at IS NULL` to determine opt-out status. No change to that guard was needed — it was already wired to the `opt_outs` table.

### Compliance replies

Twilio's Messaging Service sends STOP/START/HELP compliance replies at the platform level before the webhook reaches our code. Our webhook always returns an empty `<Response/>` to avoid duplicate replies. All DB state changes (opt-out writes, inbound message recording) happen regardless.

### Ordinary replies

Stored in `messages` (direction=inbound), conversation `last_message_at` updated. No auto-reply is sent. Full reply handling is a future milestone.

### Verification queries

```sql
-- Check opt-out state for a phone number
SELECT phone_number, opted_out_at, opted_back_in_at
FROM public.opt_outs
WHERE clinic_id = 'e9f21de4-3a35-4216-bb16-66ea3aeb2e47';

-- Check inbound messages
SELECT id, from_number, body, detected_keyword, status, created_at
FROM public.messages
WHERE clinic_id = 'e9f21de4-3a35-4216-bb16-66ea3aeb2e47'
  AND direction = 'inbound'
ORDER BY created_at DESC LIMIT 10;
```

---

## 11. First Clinic Onboarding Procedure

Use this procedure to safely add a real clinic to the system.  
**Do not skip the SMS enable step — new clinics default to SMS off.**

### Prerequisites

- Clinic has a phone event strategy (conditional forwarding or system-prepared local-number path — see Section 1).
- Twilio number for the clinic is provisioned and webhook URLs are set.
- `SMS_RECOVERY_MODE` is still `owner_test` or `disabled` until live mode is approved.

### Step 1 — Insert clinic row

```sql
INSERT INTO public.clinics (name, slug, timezone, is_active, sms_recovery_enabled)
VALUES (
  'Acme Dental',           -- clinic display name, used in recovery SMS body
  'acme-dental',           -- internal slug, lowercase-hyphenated, used in logs
  'America/Chicago',       -- IANA timezone
  true,                    -- is_active: false = full kill switch
  false                    -- sms_recovery_enabled: always false on insert
);
```

`sms_recovery_enabled = false` is the safe default. No SMS will be sent until Step 5.

### Step 2 — Map Twilio number

```sql
INSERT INTO public.clinic_phone_numbers (clinic_id, phone_number, twilio_phone_number_sid, role, is_active)
VALUES (
  (SELECT id FROM public.clinics WHERE slug = 'acme-dental'),
  '+1XXXXXXXXXX',          -- E.164 Twilio number assigned to this clinic
  'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',  -- Twilio Phone Number SID (optional)
  'recovery',              -- role hint
  true
);
```

### Step 3 — Verify SMS is off by default

```sql
SELECT slug, is_active, sms_recovery_enabled
FROM public.clinics
WHERE slug = 'acme-dental';
-- Expected: is_active=true, sms_recovery_enabled=false
```

`lookupClinicByPhone` will find the clinic for call recording but `sendRecoverySms` Guard 2
will block SMS because `sms_recovery_enabled=false`.

### Step 4 — Verify inbound call recording (no SMS)

1. Make a test call to the clinic Twilio number.
2. Confirm `voice.ringing` + `voice.completed` events appear in `webhook_events`.
3. Confirm no outbound row appears in `messages` (SMS guard blocked it).

### Step 5 — Enable SMS for the clinic (requires A2P approval + owner approval)

**Carrier/A2P compliance prerequisite:** before enabling live SMS for any real clinic, the required carrier/A2P approval for the assigned local-number path must be complete. Do not set `SMS_RECOVERY_MODE=live` until carrier compliance is confirmed. See `A2P-10DLC-COMPLIANCE-READINESS.md`.

Only after carrier/A2P approval is complete, live testing confirms call recording works, and owner approves:

```sql
UPDATE public.clinics
SET sms_recovery_enabled = true
WHERE slug = 'acme-dental';
```

Also requires `SMS_RECOVERY_MODE=live` in Vercel env vars and redeployment before SMS fires.

### Step 6 — Verify STOP/START opt-out

1. Send STOP from a test phone to the clinic Twilio number.
2. Confirm `opt_outs` row is written with `opted_back_in_at = null`.
3. Make a missed call — confirm no recovery SMS arrives.
4. Send START — confirm `opted_back_in_at` is set.
5. Make another missed call — confirm recovery SMS arrives.

### Step 7 — Disable or roll back a clinic

**Disable SMS only** (keep call recording):
```sql
UPDATE public.clinics SET sms_recovery_enabled = false WHERE slug = 'acme-dental';
```
Takes effect immediately — no redeploy needed.

**Disable clinic entirely** (stops all lookups, no call recording):
```sql
UPDATE public.clinics SET is_active = false WHERE slug = 'acme-dental';
```

**Remove phone mapping** (stops routing without deleting clinic):
```sql
UPDATE public.clinic_phone_numbers SET is_active = false
WHERE phone_number = '+1XXXXXXXXXX';
```

All three are instant and reversible. No code change or redeploy required.

---

## 12. Current Next Step

Owner-only SMS recovery: **complete and verified (2026-05-26).**

- SMS timing fix deployed: SMS now sends after call completion via `voice/status` callback.
- First-call and repeat-call greetings verified end-to-end.
- Duplicate suppression: confirmed.
- Inbound SMS opt-out enforcement: complete (2026-05-26).
- Clinic onboarding safety gate: complete (2026-05-26).

Current next step:

```txt
1. Prepare and submit the required carrier/A2P approval package for the assigned local-number path.
   Use toll-free verification documents only when the toll-free alternate path is intentionally selected.
2. Complete carrier/A2P approval before enabling live SMS.
   See MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md for required steps.
3. Once registration is approved, onboard first real clinic using Section 11 procedure.
   SMS_RECOVERY_MODE must be changed to live and sms_recovery_enabled set true
   per clinic before any real patient SMS fires.
   Do not enable live SMS mode until clinic phone strategy is tested,
   carrier/A2P approval is complete, and owner explicitly approves.
```

---

## 13. Reusable Test Caller Reset Procedure

### Purpose

Before first-call live tests, reset the designated test caller so the next call behaves like a brand-new missed caller (clears duplicate suppression window and prior conversation state).

### Designated resettable test caller

```txt
+12245329236  (masked in reports as +122•••••36)
```

This number must be in `SMS_TEST_ALLOWED_TO` before testing.

### Scope constraints

- Reset affects ONLY `+12245329236` at Owner Test Dental Office (slug: `owner-test`, clinic id: `e9f21de4-3a35-4216-bb16-66ea3aeb2e47`).
- Never reset real clinic callers.
- Never reset all callers at once.
- Never run with `live` SMS mode.
- Run SQL directly via Supabase admin SQL editor or local admin DB connection (`SUPABASE_DB_DIRECT_URL`). Never expose as a public API endpoint.

### Reset SQL

```sql
-- Reset reusable owner-test caller before first-call live tests.
-- Target: +12245329236 at Owner Test Dental Office (slug: owner-test)
-- SAFETY: only deletes rows for this exact caller and this exact test clinic.
-- NEVER run against real clinic callers or with live SMS mode enabled.

DO $$
DECLARE
  v_clinic_id uuid;
  v_phone     text := '+12245329236';
  v_slug      text := 'owner-test';
BEGIN
  SELECT id INTO v_clinic_id FROM public.clinics WHERE slug = v_slug;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clinic slug % not found — aborting reset', v_slug;
  END IF;

  -- 1. Delete outbound messages — clears 24h duplicate suppression window.
  DELETE FROM public.messages
  WHERE clinic_id  = v_clinic_id
    AND to_number  = v_phone
    AND direction  = 'outbound';

  -- 2. Delete patient conversation — allows fresh conversation on next call.
  DELETE FROM public.patient_conversations
  WHERE clinic_id    = v_clinic_id
    AND patient_phone = v_phone;

  -- 3. Delete call events for this test caller at this clinic.
  DELETE FROM public.call_events
  WHERE clinic_id   = v_clinic_id
    AND from_number = v_phone;

  RAISE NOTICE 'Reset complete for % at clinic % (%)',
    v_phone, v_slug, v_clinic_id;
END $$;
```

`webhook_events` are keyed by `CallSid` (not phone number) and do not need to be deleted. Each new call has a new `CallSid`.

### Verify reset

```sql
SELECT COUNT(*) FROM public.messages
WHERE to_number = '+12245329236' AND direction = 'outbound';
-- Expected: 0

SELECT COUNT(*) FROM public.patient_conversations
WHERE patient_phone = '+12245329236';
-- Expected: 0
```

After reset passes, proceed with the first-call live test.

---

## Automated Clinic Onboarding

The automated onboarding flow lives entirely on the app domain:

```
https://app.missedcallsdental.com
```

The public marketing site (`docs/`) is the entry form only. The setup
link sent by email always uses the app base URL.

Form scope standard: follow `AGENTS.md` ("Form and Onboarding Scope Rule (Project-Wide)") for every onboarding/setup/settings input. Ask only for fields required for the next immediate step, defer non-essential fields to later stages, and explain why required fields are needed.

### Required environment variables

```
APP_BASE_URL=https://app.missedcallsdental.com
PUBLIC_SITE_URL=https://missedcallsdental.com
RESEND_API_KEY=<resend api key>            # required secret for email sending
# SETUP_EMAIL_FROM is OPTIONAL — default sender comes from
# config/runtime.config.ts (Missed Calls Dental <no-reply@mail.missedcallsdental.com>).
# Set it only to override the default; it is not a secret.
TWILIO_NUMBER_PURCHASE_ENABLED=true        # only when ready to spend money
OWNER_TEST_SETUP_LINK_FALLBACK=false       # never true in public production
```

Verify liveness via `GET /api/health`. For environment-variable presence,
use Vercel Project Settings (do not expose secret presence in a public endpoint).

### Setup email delivery — configured (2026-05-28)

Production setup email is **live via Resend**.

- **`RESEND_API_KEY` is the only required secret.** It is set on Vercel
  Production as an encrypted env var. The key in use is a Resend
  *restricted, send-only* key (it cannot read/list emails).
- **`SETUP_EMAIL_FROM` is NOT required and is not set as a secret.** The
  default sender lives in code: `runtimeConfig.email.defaultSetupFrom` in
  `config/runtime.config.ts` =
  `Missed Calls Dental <no-reply@mail.missedcallsdental.com>`
  (single source of truth). `SETUP_EMAIL_FROM` is an optional, non-secret
  override only — set it on Vercel only if you want a different sender.
- Sending domain `mail.missedcallsdental.com` is verified in Resend.
- **`OWNER_TEST_SETUP_LINK_FALLBACK=false`** in production: real emails are
  sent and the setup link is no longer returned in the API response.

How it behaves: `POST /api/setup-requests` validates the work email, creates
the request + token (hash stored), and emails the setup link
`https://app.missedcallsdental.com/setup/<token>` via Resend. On Resend
failure the route returns `502 email_delivery_failed` and the request stays
recoverable (`email_status=failed:*`).

Verify safely (owner-only): `POST /api/setup-requests` with an owner test
email, confirm the response does **not** include `setup_url`, and confirm the
`setup_requests` row has `email_status='sent'`. The raw token only reaches the
recipient's inbox — never paste it into shared logs. (The send-only key cannot
retrieve message bodies, so the click-through is verified by the owner opening
the email.)

> Keep `OWNER_TEST_SETUP_LINK_FALLBACK=false` in public production. Only set it
> `true` for a short owner-only API test when Resend is intentionally bypassed.

### Onboarding URL surface

- Public form target: `POST /api/setup-requests`
- Setup page (token-scoped): `GET /setup/[token]`
- Clinic form save:        `POST /api/onboarding/[token]/clinic`
- Number preparation:      `GET  /api/onboarding/[token]/numbers?area_code=XXX` (internal/system use; not a customer-facing catalog requirement)
- Number purchase:         `POST /api/onboarding/[token]/numbers/purchase`
- Status deep link:        `GET  /setup/[token]/status`

### Safety checks

Before flipping `TWILIO_NUMBER_PURCHASE_ENABLED=true`:

1. Confirm the Twilio account billing plan covers the expected number
   cost.
2. Confirm webhook URLs (`/api/webhooks/twilio/...`) are reachable in
   production.
3. Confirm `RESEND_API_KEY` and `SETUP_EMAIL_FROM` are set and verified
   in Resend.
4. Confirm `OWNER_TEST_SETUP_LINK_FALLBACK` is not set or is `false`.

The purchase route is idempotent at the clinic level. If a clinic
already has an active `office_texting` number in `clinic_phone_numbers`,
no second number is purchased.

### Token security

- Raw setup tokens are 32 random bytes hex-encoded (64 characters).
- The database stores only the SHA-256 hash (`setup_token_hash`).
- Tokens expire 72 hours after issue.
- The setup URL is composed from `APP_BASE_URL` only — never from the
  request `Host` header.
- Raw tokens are never logged.

### SMS remains off after onboarding

Successful number assignment does NOT enable live SMS:

```
clinic.is_active             = true
clinic.sms_recovery_enabled  = false
clinic.setup_status          = 'number_assigned'
```

Live SMS still requires all four conditions:

1. Carrier/A2P compliance approval.
2. QA passes (see Section 12 of the build guide).
3. Owner approval.
4. Explicit `SMS_RECOVERY_MODE=live` and per-clinic
   `sms_recovery_enabled=true` toggle.

---

## SMS Messaging Status Callback Wiring

The `/api/webhooks/twilio/messaging/status` route exists and is fully
implemented (signature-validated, idempotent, no SMS, returns 200 JSON
ack). Twilio's `IncomingPhoneNumber.create()` API does not expose a
per-number SMS status callback field, so this route is not configured
on individual numbers. To make Twilio actually call it, one of these
must be in place:

### Option A — Messaging Service status callback (recommended, one-time)

Set the Messaging Service `statusCallback` to:

```
https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status
```

Twilio Console path: **Messaging → Services → (your service) → Sender
Pool / Integration → Status Callback URL**. Save. From that point all
outbound SMS sent via the Messaging Service triggers a delivery status
callback to this URL.

### Option B — Per-message statusCallback (code path)

Add `statusCallback` to `client.messages.create(...)` in
`lib/twilio/outbound-sms.ts`. This is a small, contained future
improvement — it does not enable any new SMS, it only adds status
visibility per send. Not required for onboarding to function.

The current onboarding flow does not depend on inbound status
callbacks. It only requires:

- `voice/incoming` and `voice/status` (configured automatically on each
  purchased Twilio number by `purchaseNumberAndConfigure`).
- `messaging/incoming` (configured automatically on each purchased
  Twilio number).

---

## Apply the Onboarding Migration

Migration file:

```
supabase/migrations/20260526000300_onboarding_setup_requests.sql
```

This adds the `setup_requests` table and extends `clinics` with
onboarding fields. Apply via Supabase SQL editor (or `psql` connected
to `SUPABASE_DB_URL`) after owner approval.

### Apply steps

1. Open Supabase SQL editor for the production project.
2. Paste the contents of
   `supabase/migrations/20260526000300_onboarding_setup_requests.sql`.
3. Run as the service role.

### Verification queries (read-only)

Run these after applying. Each should return the expected row counts.

```sql
-- 1) setup_requests table exists.
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'setup_requests';
-- expect: 1 row

-- 2) setup_requests has token-hash column and unique index.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'setup_requests'
  and column_name = 'setup_token_hash';
-- expect: 1 row

select indexname from pg_indexes
where schemaname = 'public'
  and tablename = 'setup_requests'
  and indexname = 'setup_requests_setup_token_hash_key';
-- expect: 1 row

-- 3) clinics has the new onboarding fields.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'clinics'
  and column_name in (
    'legal_business_name', 'main_phone', 'owner_contact_name',
    'owner_contact_email', 'owner_contact_phone',
    'test_patient_phone', 'setup_status'
  )
order by column_name;
-- expect: 7 rows

-- 4) Owner-test clinic is marked active.
select slug, setup_status from public.clinics
where slug = 'owner-test';
-- expect: setup_status = 'active'

-- 5) RLS is enabled on setup_requests.
select relname, relrowsecurity from pg_class
where relname = 'setup_requests';
-- expect: relrowsecurity = true
```

If any of these returns an unexpected result, do not proceed with
onboarding traffic. Re-run the migration or contact the operator.

---

## Required Environment Variables Before Owner-Only Testing

The onboarding code works in three modes depending on env state.
Production setup-email vars are now configured (2026-05-28); the table
below is the authoritative reference.

| Env var                          | Required for production? | Owner-only testing default       |
|----------------------------------|--------------------------|----------------------------------|
| APP_BASE_URL                     | yes                      | `http://localhost:3000` (local)  |
| PUBLIC_SITE_URL                  | yes                      | `https://missedcallsdental.com`  |
| RESEND_API_KEY                   | yes (secret)             | unset (use fallback below)       |
| SETUP_EMAIL_FROM                 | no (optional override)   | unset → uses config default      |
| TWILIO_NUMBER_PURCHASE_ENABLED   | yes (set to `true`)      | `false` (never purchase yet)     |
| OWNER_TEST_SETUP_LINK_FALLBACK   | no (must stay `false`)   | `true` only during local testing |
| TWILIO_ACCOUNT_SID               | yes (already configured) | already configured               |
| TWILIO_AUTH_TOKEN                | yes (already configured) | already configured               |
| TWILIO_MESSAGING_SERVICE_SID     | yes (already configured) | already configured               |
| SUPABASE_DB_URL                  | yes (already configured) | already configured               |
| PUBLIC_WEBHOOK_BASE_URL          | yes (already configured) | already configured               |

Production Vercel env (set 2026-05-28):

```
APP_BASE_URL=https://app.missedcallsdental.com
PUBLIC_SITE_URL=https://missedcallsdental.com
RESEND_API_KEY=<encrypted secret — set>     # the only required Resend secret
# SETUP_EMAIL_FROM intentionally NOT set — default sender from
# config/runtime.config.ts (Missed Calls Dental <no-reply@mail.missedcallsdental.com>)
TWILIO_NUMBER_PURCHASE_ENABLED=false        # flip to true ONLY when ready to spend
OWNER_TEST_SETUP_LINK_FALLBACK=false        # MUST stay false in production
```

For owner-only local testing without configuring Resend:

```
OWNER_TEST_SETUP_LINK_FALLBACK=true
TWILIO_NUMBER_PURCHASE_ENABLED=false
```

In that mode, `POST /api/setup-requests` returns the setup link in the
JSON response instead of sending email, and the number-purchase route
returns 503 instead of contacting Twilio.

### Safe next step for owner-only testing

1. Apply the migration in Supabase (see Apply Steps above) and run the
   verification queries.
2. Set local env in `.env.local`:
   - `APP_BASE_URL=http://localhost:3000`
   - `PUBLIC_SITE_URL=https://missedcallsdental.com`
   - `OWNER_TEST_SETUP_LINK_FALLBACK=true`
   - `TWILIO_NUMBER_PURCHASE_ENABLED=false`
3. Start the dev server: `npm run dev`.
4. POST a test request:
   ```
   curl -s -X POST http://localhost:3000/api/setup-requests \
     -H 'content-type: application/json' \
     -d '{"work_email":"owner@example.com"}'
   ```
   Expect a JSON response containing a `setup_url`.
5. Open the returned setup URL in a browser. Fill out the 3-field
   Step 1 form (clinic name, main office phone, ZIP code), then verify
   the system prepares a local number for reservation.
6. Click **Use this number**. Expect a 503 `purchase_disabled` response
   — this is the safe expected outcome with
   `TWILIO_NUMBER_PURCHASE_ENABLED=false`. No Twilio number is
   purchased. No SMS is sent.

Only after that dry run is clean should the owner consider flipping
`TWILIO_NUMBER_PURCHASE_ENABLED=true` and rerunning the same flow with
a real number purchase.

---

## Onboarding source of truth (current)

Current onboarding source of truth:

`Create office profile (clinic name, main office phone, ZIP code) -> Business Profile (Business Information + A2P Approval Information) -> local number preparing/reserved -> SMS waiting for approval -> billing starts after SMS recovery is active`

No customer-facing Review & Submit step is required in this flow.

### Business Profile implementation (2026-05-28)

The flow above is implemented:

- Screen 1 `app/setup/[token]` → `ClinicForm` ("Create office profile").
- `POST /api/onboarding/[token]/clinic` saves the office profile, generates the
  public `slug`, and runs automatic local-number preparation (read-only Twilio
  candidate search; status **Preparing**). No purchase/reservation occurs unless
  `TWILIO_NUMBER_PURCHASE_ENABLED=true` and the owner approves via the existing
  purchase route.
- Screen 2 `BusinessProfile` component: a customer **account/settings dashboard**
  (left section nav + right active panel; one section at a time; wrapping tabs on
  mobile). Sections: Business profile → SMS approval → Billing → Phone number →
  Documents. See "The implemented account setup flow (2026-05-30)" below for the
  authoritative current description. (This block predates the 2026-05-30 redesign;
  the dated block below supersedes it.)
- Business Type enum (exact values): `PRIVATE_PROFIT`, `PUBLIC_PROFIT`,
  `NON_PROFIT`, `SOLE_PROPRIETOR`, `GOVERNMENT` — stored/submitted
  letter-for-letter, never `LLC`/`Corporation`/etc. An unsaved record shows a
  neutral "Select business type…" placeholder (no silent default).
- `POST /api/onboarding/[token]/business-info` (Business profile) and
  `POST /api/onboarding/[token]/a2p` (SMS approval) store data locally only and
  return the persisted values. A2P save sets displayed SMS status to **Waiting
  for approval**; `sms_recovery_enabled` stays false and nothing is submitted to
  Twilio.
- Documents section shows `/business/{slug}`, `/business/{slug}/privacy`,
  `/business/{slug}/sms-terms` (View / Copy link). All three render from one
  source of truth (the `clinics` row) with shared header/footer nav; the single
  public service name is "Missed Calls Dental".
- Billing requires a payment method before a phone number is prepared/assigned;
  the 21-day trial starts only after SMS recovery activation and does not count
  down while approval is pending. No raw card data is collected or stored.
- Schema: `supabase/migrations/20260528000100_business_profile_onboarding.sql`
  + `20260528000200_clinic_address_line2.sql` (adds `address_line2`). Both are
  applied. Field mapping: `SMS-APPROVAL-FIELD-MAPPING.md`.

## Onboarding scope (MVP — U.S.-only, 3-field Step 1)

Automated onboarding is **United States only**. Step 1 of the clinic
setup form asks for only the three fields needed to advance to number
search:

- **Clinic name** — shown to patients in follow-up messages.
- **Main office phone** — the number patients currently call. Accepts
  any common U.S. format (`(224) 555-1234`, `224-555-1234`, `2245551234`,
  `+12245551234`) and is normalized to E.164 internally.
- **ZIP code** — used to find local numbers near the office.

Everything else (legal business name, owner contact phone, timezone,
test patient phone, setup mode, etc.) is collected later only when it
is actually required for the next step. See `AGENTS.md` →
"Form and Onboarding Scope Rule".

There is no country selector in the UI. The server forces
`country = 'US'` and rejects any non-US payload with:

```
Automated setup is currently available for U.S. clinics only.
```

Expanding internationally later is a separate module decision, not a
one-line config flip.

### Local number default (no customer number catalog)

Use local numbers as the default MVP path.

The system should prepare/reserve the best local number automatically from the clinic's main phone + ZIP context.

Do not require customers to manually choose from a list of numbers during default onboarding.

### Toll-free reference note

Toll-free can remain an alternate/reference path for specific cases. It is not the main current onboarding path.

### Apply the country migration

Migration file:

```
supabase/migrations/20260527000100_clinic_location.sql
```

Apply via Supabase SQL editor as the service role. Then run the
verification queries in `SETUP-LOG.md` under the
`2026-05-27 — Country-aware onboarding` entry.

The migration is idempotent and safe to re-run.

---

## Account dashboard — current state (2026-05-31)

Authoritative note; supersedes older inline descriptions above that still
mention a "Documents section" or the pre-2026-05-30 layout.

- The owner dashboard renders at `/account` (clean URL; `/setup/{token}` is the
  magic-entry link that hands off to `/account` via an httpOnly cookie).
- Left nav order: **Phone number → Business profile → SMS approval → Billing**.
  Phone number opens by default. No Documents nav item; the public-page links are
  a compact text row inside SMS approval.
- **Unified status vocabulary** (nav, headers, status rows, phone statuses,
  billing): `Needs setup` (amber dot) is the default for unfinished setup;
  `Needs action` (amber alert) is reserved for act-now states (e.g.
  `Trial ended`); plus `Complete`, `Active`, `Waiting for approval`, `Pending`,
  `Not started`, `Not active`, `Error`. Calm tones; red is real errors only.
- **SMS approval** shows the section `Complete` after save, but a separate
  **Texting** row shows the real texting state
  (`Not active`/`Waiting for approval`/`Active`) — "Complete" never means texting
  is live.
- **Billing** shows one payment-method status (`Needs setup` until added), a
  secure payment-method visual, plan, and a live trial countdown. "Add payment
  method" opens a Stripe-ready modal with **no card fields, no card storage, no
  Stripe network call**. `hasPaymentMethod` is derived server-side from
  `stripe_customer_id` / `billing_status`.
- **Phone number** shows the assigned number (or "Not assigned yet") + Voice /
  Calls and SMS / Texting sub-statuses; with no payment method a gentle callout
  points to Billing. No "Add payment method" button in this section.
- Provisioning note: the billing→phone gate is presentational; server-side
  enforcement must be added before any real number purchase/reservation.
- **Future (not built):** an owner-only `SMS & conversation settings` section
  belongs in `/account` (templates, follow-up questions, reply-handling, handoff
  rules, what is passed to the front desk). The **front-desk workspace** is a
  separate future product (conversations, replies, callback/booked/handled,
  notes) and must not expose EIN, legal/billing details, SMS approval controls,
  or owner setup settings.

---

## Front desk workspace `/workspace` (read-only) — 2026-05-31

Operational view for clinic staff to review missed-call SMS replies and patient
requests. Separate from the owner/admin `/account` area. Full spec:
`FRONT-DESK-WORKSPACE.md`.

- **Route:** `app/workspace/page.tsx` (server, `force-dynamic`, nodejs). Read-only
  — no writes, no SMS, no call actions, no status mutations.
- **Access:** gated by the same `mcd_account` httpOnly cookie as `/account`
  (owner-accessible preview until staff auth exists). No valid context → safe
  "open your account link" message. Not public. Tokens never in URL / logs;
  patient message contents not logged.
- **Data:** `lib/db/front-desk.ts` `listClinicConversations(clinicId)` reads only
  front-desk-safe columns from `patient_conversations` + `messages` (no
  raw_payload, Twilio SIDs, errors, owner/billing/compliance fields). No new
  table (the read-only view works from existing data; a proposed
  `patient_requests` table is documented for later).
- **Privacy:** minimum-necessary display. The workspace never shows EIN, legal
  business details, billing/payment, SMS approval controls, approval documents,
  owner setup settings, Twilio details, or internal IDs (conversation UUIDs are
  used only as React keys). Unknown fields render `Not provided yet`.
- **Status vocabulary (derived):** New / Needs reply / Waiting for patient /
  Ready to call / Booked / Closed. Conservative derivation from conversation
  lifecycle + latest message direction; `Ready to call` not auto-assigned yet.

`/account` cleanup (same pass): removed the duplicate Billing `Needs setup`
badge (status only on the Payment method row); one no-charge note;
`Free trial ends in X days` casing; reserved the scrollbar gutter so the panel
doesn't shift horizontally between sections; removed the redundant Phone-number
panel-header badge (emphasis stays in the Voice / SMS service rows).

Future (owner/admin, not built): owner-only `SMS & conversation settings`
(message templates, follow-up questions, reply-handling, handoff rules,
notification routing, what is passed to the front desk).

---

## Owner auth foundation (Phase 1) — 2026-05-31

Real owner authentication is now implemented while keeping setup-token fallback
for rollout safety.

What changed:

- Added `/login` for normal returning owner sign-in (email + password).
- Updated `/setup/{token}` first-entry form to include password creation
  (read-only login email + clinic name + main phone + ZIP + password/confirm).
- `POST /api/onboarding/[token]/clinic` now:
  - creates/updates clinic
  - creates owner auth user when needed
  - upserts `profiles` + `clinic_memberships` (`owner` role)
  - establishes authenticated session
  - redirects to `/account`
- `/account` and `/workspace` now use authenticated session + membership as
  primary guard path.
- Legacy `mcd_account` setup-token cookie remains a temporary fallback to avoid
  locking out existing setup-link users.

Operational notes:

- Existing setup-link users can reopen their setup links and create a password.
- If setup email already has an auth user, onboarding does not create a
  duplicate; user is directed to `/login` safely.
- Staff invite flow is intentionally not in this phase.
- Google/Apple auth is intentionally not in this phase.

Migration:

- `supabase/migrations/20260531000100_auth_profiles_memberships.sql`
  - adds `public.profiles`
  - adds `public.clinic_memberships`
  - enables RLS + minimal policies on these new tables only

Full auth/access model:

- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`

---

## Account access and team/workspace guidance follow-up — 2026-05-31

Scope of this follow-up:

- no Twilio/SMS changes
- no Stripe changes
- no invite email backend
- no invite acceptance flow
- no new migrations

Implemented runtime behavior:

- `/setup/{token}` now presents **Account setup** with two blocks:
  - `Account details`: clinic name, main office phone, ZIP code
  - `Account access`: read-only login email + password/confirm
- `/account` left nav split into:
  - `Setup`: Phone number, Business profile, SMS approval, Billing
  - `Account`: Account access, Team access
- `Account access` replaces old `Security` naming and includes:
  - read-only login email
  - password status
  - sign-out action
  - safe `Change password` placeholder modal (non-mutating)
- `Team access` owner-only shell includes:
  - workspace link + open/copy actions
  - invite-form placeholder (`Front desk` only; no real send)
  - owner member row from real data
  - sample member rows when real staff memberships are not present

Workspace sample behavior:

- if no real conversation cards exist, `/workspace` renders a clearly-labeled
  `Sample requests` set
- sample cards are UI-only and not persisted
- result controls are a non-mutating preview in sample mode only

Operational constraints:

- do not treat sample team rows/cards as real access or production data
- do not wire sample rows/cards into analytics
- do not expose backend auth/provider internals in placeholder messages

Sample-domain policy:

- fake/demo addresses must use `example.com` only
- approved sample emails:
  - `owner@example.com`
  - `frontdesk@example.com`
  - `reception@example.com`
  - `staff@example.com`

---

## Remaining copy/UI cleanup follow-up — 2026-05-31

Scope:

- copy/UI refinement only
- no migrations
- no invite backend
- no result persistence backend

What changed:

- setup flow copy trimmed (removed extra subtitle under `Account setup`)
- setup fallback error standardized to account wording
- shared setup shell label updated from `Office setup` to `Account setup`
- account header subtitle reduced to one line:
  `Texting starts after approval.`
- component rename for clarity:
  `SecurityCard.tsx` -> `AccountAccessCard.tsx`
- team access sample rows moved to a dedicated sample block with local hide/show
  state (`localStorage`)
- team action labels simplified (`Remove`, `Restore`, `—`)
- workspace conversation collapsed by default (`View conversation`)
- workspace sample result UI simplified to `Appointment booked?` yes/no + note +
  `Save result`

Operational constraints preserved:

- no invite sends
- no membership mutations from sample actions
- no workspace result writes
- no Twilio/Stripe/SMS side effects

---

## Troubleshooting: setup submit fails with generic network message (2026-06-01)

Symptom:

- User submits `/setup/{token}` and sees:
  `We couldn't reach the server.`

Production signature:

- Vercel log error on `POST /api/onboarding/[token]/clinic`:
  `relation "public.profiles" does not exist` (`42P01`).

Cause:

- Auth foundation migration missing in the target DB.

Fix:

1. Apply migration:
   `supabase/migrations/20260531000100_auth_profiles_memberships.sql`
2. Verify tables exist:
   - `public.profiles`
   - `public.clinic_memberships`
3. Re-test setup submit.

Hardening in app code:

- setup route now returns structured JSON error if profile/membership linking
  fails (`account_link_failed`) instead of unhandled 500.
- setup form submit now safely handles non-JSON server responses.

---

## Owner password reset flow operations — 2026-06-01

Scope:

- auth/reset only
- no Twilio/SMS/Stripe/workspace/team-access changes
- no schema migrations

Routes added:

- `/forgot-password`
- `POST /api/auth/forgot-password`
- `/auth/callback`
- `/reset-password`
- `POST /api/auth/update-password`

Behavior:

- `/login` now has a live `Forgot password?` link to `/forgot-password`.
- Forgot-password submit always returns generic success for normal requests:
  `If an account exists for this email, we'll send a password reset link.`
- Recovery links return to `/auth/callback?next=/reset-password`.
- Callback route exchanges Supabase PKCE code for session, allows only internal
  relative `next` paths, defaults to `/account` when `next` is missing/unsafe,
  and redirects to `/login?error=invalid_or_expired_link` on failure.
- `/reset-password` requires a valid session from recovery flow.
- Password update uses the same rule as setup:
  minimum 8 characters, at least one letter, at least one number.

Supabase Auth redirect URL allow list (required):

- `https://app.missedcallsdental.com/auth/callback`
- `http://localhost:3000/auth/callback`

If either callback URL is missing from Supabase Auth redirect settings,
password-recovery links can fail or return expired/invalid-link behavior.

---

## Password reset email: production routing + branded SMTP (Resend) — 2026-06-01

Authoritative operations reference for owner password reset email behavior.
Full auth-config reference: `AUTH-AND-ACCESS-CONTROL.md` section 10.

### Symptom and root cause

- Symptom: reset email delivered but link pointed to `http://localhost:3000`,
  and sender was the default `noreply@mail.app.supabase.io`.
- Root cause is **Supabase Auth configuration**, not app code:
  - The app sends the correct production `redirectTo`
    (`https://app.missedcallsdental.com/auth/callback?next=/reset-password`),
    built from committed `runtimeConfig.app.appBaseUrl`.
  - Supabase GoTrue ignores an emailed `redirect_to` that is not in the Auth
    Redirect URLs allow list and substitutes the project **Site URL**. Site URL
    was still `http://localhost:3000`.
  - Branded sender requires Custom SMTP, which was not configured.

### Required Supabase Auth settings (operator, one-time)

Authentication → URL Configuration:

```
Site URL:       https://app.missedcallsdental.com
Redirect URLs:  https://app.missedcallsdental.com/auth/callback
                http://localhost:3000/auth/callback   (local dev only)
```

After saving, send a **fresh** reset email. Previously sent emails keep the old
localhost link and cannot be retro-fixed.

Authentication → Emails → Custom SMTP (Resend):

```
Host:      smtp.resend.com
Port:      465
Username:  resend
Password:  leave the existing provider value unchanged; never write SMTP passwords in docs.
Sender:    no-reply@missedcallsdental.com
Name:      Missed Calls Dental
```

Domain verification: the setup-email path already sends from the Resend-verified
subdomain `mail.missedcallsdental.com`. Sending Auth email from the root domain
`no-reply@missedcallsdental.com` requires the **root domain** verified in Resend
(SPF/DKIM DNS at Namecheap). If only the subdomain is verified, use the safe
interim branded sender `Missed Calls Dental <no-reply@mail.missedcallsdental.com>`
until the root domain passes verification.

Email Templates → Reset Password: keep the default `{{ .ConfirmationURL }}`
placeholder. Do not hardcode localhost, tokens, or reset links.

### Live E2E (operator; never expose the link or token)

1. `https://app.missedcallsdental.com/login` → Forgot password?
2. Submit the owner email.
3. Confirm email arrives from `Missed Calls Dental <no-reply@…missedcallsdental.com>`.
4. Confirm the link host is `app.missedcallsdental.com` (not localhost).
5. Open link → passes through `/auth/callback` → lands on `/reset-password`.
6. Set a new password → confirm login works → `/account` opens.

### Notes

- No app code change is required; the reset flow code is correct and deployed.
- No Vercel env change is required for this fix.

---

## Auth email config APPLIED via Management API — 2026-06-01

The password-reset email config (see the reset section above) was applied
programmatically to project `qfjpvbvfvhbtebwivcdc`:

- `PATCH /v1/projects/{ref}/config/auth` with a `SUPABASE_ACCESS_TOKEN` from local
  `.env.local` (never printed/committed).
- Set + independently re-verified: `site_url=https://app.missedcallsdental.com`,
  `uri_allow_list` = both callback URLs, Resend Custom SMTP
  (`smtp.resend.com:465`, user `resend`, sender
  `Missed Calls Dental <no-reply@mail.missedcallsdental.com>`, SMTP password
  value retained in provider config; never stored in docs).
- BEFORE state had `site_url=http://localhost:3000` and an **empty**
  `uri_allow_list` — the empty allow list is why recovery links were localhost.

**Cloudflare gotcha:** the Management API sits behind Cloudflare. `python-urllib`
write requests get blocked with HTTP 403 + `error code: 1010` (client-signature
block). Use **curl** for Management API writes (GET works from either).

**Token hygiene:** revoke/rotate the temporary `SUPABASE_ACCESS_TOKEN` after
config tasks (Supabase Dashboard → Account → Access Tokens) and remove it from
local `.env.local`.

**Still requires a human:** browser/inbox E2E (branded From, non-localhost link,
`/auth/callback` → `/reset-password` → set password → login → `/account`) and
optional root-domain (`no-reply@missedcallsdental.com`) Resend verification.

---

## Reset email phishing-target fix — 2026-06-01

Gmail flagged the reset email because the branded sender (Missed Calls Dental)
pointed its button at a raw Supabase project-ref URL
(`https://<ref>.supabase.co/auth/v1/verify...`) from `{{ .ConfirmationURL }}`.

Fix:

- Recovery template (`mailer_templates_recovery_content` via Management API) now
  links to the app domain:
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
  Subject: `Reset your Missed Calls Dental password`. Do not reintroduce
  `{{ .ConfirmationURL }}` in the recovery template.
- `app/auth/callback/route.ts` handles both the `token_hash`+`type` link
  (`verifyOtp`) and the legacy PKCE `code` link (`exchangeCodeForSession`).

Deployment ordering: the template change is live immediately; the callback code
change requires the Vercel deploy to be READY before a `token_hash` link can
complete. Generate a fresh reset email after deploy for a full click-through. Use
curl (not python-urllib) for the Management API PATCH (Cloudflare 1010).

Verify (operator): the Gmail link target starts with `app.missedcallsdental.com`,
then link → `/auth/callback` → `/reset-password` → set password → login →
`/account`. Never paste the reset link or token.

---

## Auth login + reset polish — 2026-06-01

- **Canonical login:** `https://app.missedcallsdental.com/login` is the only real
  sign-in. It mirrors the marketing sign-in design (brand header, centered card,
  footer legal links) via new `.auth-*` classes in `app/globals.css`; auth logic
  (`LoginForm`) is unchanged.
- **Marketing handoff:** `docs/sign-in.html` is a redirect to the app login (meta
  refresh + JS `location.replace` + fallback link, `noindex`). Every marketing
  page's Sign in nav link points to the app login. Do not re-add a separate
  marketing login form.
- **Reset password page:** read-only account email field
  (`autocomplete="username"`) so Chrome "Save password?" captures email + new
  password; both password fields use `autocomplete="new-password"`. Show/Hide flips
  `-webkit-text-security` (keeps `type="password"` constant) so Chrome's strong-
  password generator does not re-trigger on a non-empty field.
- **Reset email copy:** sender `Missed Calls Dental`; subject `Reset your password`
  (no brand in subject); snippet starts "We received a request to reset the password
  for your account." Set via Management API mailer_subjects_recovery /
  mailer_templates_recovery_content (curl; Cloudflare 1010 blocks python-urllib
  writes). Keep the app-domain token_hash link; do not reintroduce ConfirmationURL.

---

## Workspace outcome saving — 2026-06-01

`/workspace` real patient request cards now save an outcome + optional note.

- **API:** `POST /api/workspace/outcome` `{conversationId, outcome, note}`.
  Authenticated via `resolveAuthClinicAccess` (owner/admin/front_desk). Updates are
  clinic-scoped in SQL (`id = $conversationId and clinic_id = $clinic`); sample IDs
  and non-UUIDs are rejected. Note trimmed, empty → NULL, 300-char max enforced
  client + server.
- **DB:** `patient_conversations.front_desk_outcome` / `front_desk_note` /
  `front_desk_outcome_at` (migration `20260601000100_front_desk_outcome.sql`,
  additive nullable + check constraints, applied via Management API). A saved
  outcome drives the card status and advances the conversation lifecycle:
  `appointment_booked → booked`, `no_appointment_booked → lost`,
  `could_not_reach_patient → closed`.
- **Samples:** demo-only, never written. Shown in a separate, clearly labeled
  `Sample requests` section with a `Hide`/`Show samples` toggle (local state). Real
  cards always appear first and are never affected by hiding samples. Sample outcome
  UI is disabled and labeled `Sample preview · not saved`. The old
  `Please contact support to save workspace results.` modal is removed.
- **Re-verify after change:** save an outcome on a real card, refresh, confirm it
  persists; confirm a >300-char note is rejected; confirm samples never hit the DB.

---

## Setup link idempotency — 2026-06-01

Reopening a used `/setup/{token}` link is now safe and never restarts setup.

- **Completed marker:** an owner auth account exists for the setup request's
  `owner_email` (`isSetupAlreadyCompleted` in `lib/onboarding/verify.ts`). No
  migration — works for old links.
- **Page:** completed + signed in → server redirect to `/account`; completed +
  signed out → completed-state card (`Account setup is already complete` /
  `Sign in to continue to your account.` / `Sign in` → `/login`); no password
  fields render. First-time links are unchanged.
- **API:** `POST /api/onboarding/[token]/clinic` short-circuits to the completed
  state when the account already exists — no duplicate auth user / clinic, no
  password overwrite, no rerun.
- **Token safety:** unchanged — raw token never logged; the completion check uses
  only the email.

---

## In-session password change — 2026-06-01

`POST /api/account/change-password` lets a signed-in owner change their password
from `/account` → Account access. Requires an authenticated session; verifies the
current password (throwaway client, no cookie disturbance) before
`auth.updateUser`. No password logged. Independent of forgot/reset and
login/logout. Billing, staff invites, phone provisioning, and A2P remain not
connected (honest disabled states; see `PRODUCTION-READINESS-PLACEHOLDER-AUDIT.md`).

---

## Platform admin console `/admin` — 2026-06-01

Internal operator console (cross-tenant). Separate from clinic `/account` and
front-desk `/workspace`. Full spec: `PLATFORM-ADMIN-CONSOLE-PLAN.md`.

- **Enable access (required):** set `PLATFORM_ADMIN_EMAILS` in Vercel Production
  env to a comma-separated allowlist (e.g. `allyexporter@gmail.com`) and redeploy.
  Alternatively set `profiles.is_internal_admin = true` for the user via the
  Supabase SQL editor. With neither set, `/admin` denies everyone.
- **Sign in:** `/admin/login` (same Supabase Auth account). Non-admins who sign in
  are immediately signed back out with "not authorized".
- **Pages:** `/admin` (KPIs), `/admin/clinics` (search/filter), clinic detail +
  `/events` diagnostics, `/admin/audit` (action log).
- **Actions (audited):** deactivate/reactivate clinic, disable/enable SMS recovery
  (enable requires active + assigned number + completed SMS approval; live sending
  still also requires `SMS_RECOVERY_MODE=live` and respects opt-outs), internal
  note, provisioning status. Billing / number purchase / A2P submission are shown
  blocked until those integrations are built.
- **Migration:** `20260601000200_admin_console.sql` (applied). Audit rows store
  redacted snapshots only — no secrets/tokens/raw payloads.

---

## First platform admin bootstrap — 2026-06-01

`allyexporter@gmail.com` had no Supabase Auth account, so it was created (admin
API, email pre-confirmed, **no password**) and a recovery email was sent so the
owner sets their own password — no password is stored anywhere.

To finish enabling `/admin` for this owner:
1. Owner opens the recovery email → `/reset-password` → sets a password.
2. Operator sets `PLATFORM_ADMIN_EMAILS=allyexporter@gmail.com` in Vercel
   Production env and redeploys (this is what grants platform-admin access).
3. Owner signs in at `/admin/login`.

Re-send if needed: `POST https://app.missedcallsdental.com/api/auth/forgot-password`
with `{"email":"allyexporter@gmail.com"}`, or use Supabase Dashboard →
Authentication → Users → Send password recovery. Never paste the recovery
link/token anywhere.
