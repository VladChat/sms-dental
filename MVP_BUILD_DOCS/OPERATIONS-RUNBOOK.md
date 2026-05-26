# Operations Runbook — Missed Calls Dental

Status: Active  
Audience: AI coding agents, technical founder, future operators  
Last updated: 2026-05-26 (opt-out enforcement)

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

2. Tracking number mode
   - Clinic publishes the assigned Twilio number directly as a campaign/tracking number.
   - Common uses: website CTA, Google Ads, landing pages, print mailers, promotions.

3. Hybrid mode
   - Clinic uses conditional forwarding for the main number and tracking numbers for selected channels.

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

Internal backend health:

```txt
https://app.missedcallsdental.com/api/internal/health
```

Requires header:

```txt
x-internal-admin-secret: value from local .env.local
```

Expected result:

- `ok: true`
- env presence confirmed
- `db.configured: true`
- `db.ok: true`

Never print `INTERNAL_ADMIN_SECRET`.

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
- `TWILIO_PHONE_NUMBER`
- `TWILIO_PHONE_NUMBER_SID`
- `TWILIO_MESSAGING_SERVICE_SID`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ACCOUNT_ID`
- `JOB_RUNNER_SECRET`
- `INTERNAL_ADMIN_SECRET`
- `PUBLIC_WEBHOOK_BASE_URL`

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

Before promising setup to a clinic, ask:

- What phone provider/system do you use?
- Do you want to keep your main number and forward missed/no-answer calls?
- Do you want a dedicated tracking number for website/ads/campaigns?
- Can your phone system forward no-answer, busy, unavailable, or after-hours calls?
- Can it preserve the original caller ID when forwarding?
- How many rings or seconds before voicemail answers?
- Does voicemail answer before forwarding?
- Do you already use Weave, RevenueWell, Mango Voice, Adit, RingCentral, Nextiva, Dialpad, or another missed-call/SMS product?

Compatibility test:

1. Configure forwarding or publish the tracking number.
2. Make a real inbound test call.
3. Verify Twilio receives the event.
4. Verify `From` is the patient caller ID.
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

`live` mode: implemented — requires `SMS_RECOVERY_MODE=live` in Vercel AND `clinics.sms_recovery_enabled=true` per clinic. A2P/toll-free registration must be approved before enabling. See `A2P-10DLC-COMPLIANCE-READINESS.md`.

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

- Clinic has chosen a phone event strategy (conditional forwarding or tracking number — see Section 1).
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

**A2P/toll-free compliance prerequisite:** before enabling live SMS for any real clinic, Twilio Toll-Free Verification (for `+1 844 723 4944`) or 10DLC campaign registration must be approved. Do not set `SMS_RECOVERY_MODE=live` until carrier compliance is confirmed. See `A2P-10DLC-COMPLIANCE-READINESS.md`.

Only after A2P/toll-free is approved, live testing confirms call recording works, and owner approves:

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
1. Submit Twilio Toll-Free Verification using
   MVP_BUILD_DOCS/TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md.
2. Complete A2P/toll-free registration approval before enabling live SMS.
   See MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md for required steps.
3. Once registration is approved, onboard first real clinic using Section 11 procedure.
   SMS_RECOVERY_MODE must be changed to live and sms_recovery_enabled set true
   per clinic before any real patient SMS fires.
   Do not enable live SMS mode until clinic phone strategy is tested,
   A2P/toll-free is approved, and owner explicitly approves.
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

### Required environment variables

```
APP_BASE_URL=https://app.missedcallsdental.com
PUBLIC_SITE_URL=https://missedcallsdental.com
RESEND_API_KEY=<resend api key>
SETUP_EMAIL_FROM=Missed Calls Dental <support@missedcallsdental.com>
TWILIO_NUMBER_PURCHASE_ENABLED=true   # only when ready to spend money
OWNER_TEST_SETUP_LINK_FALLBACK=false  # never true in production
```

Verify presence (no values) via `GET /api/internal/health` with the
internal admin secret.

### Onboarding URL surface

- Public form target: `POST /api/setup-requests`
- Setup page (token-scoped): `GET /setup/[token]`
- Clinic form save:        `POST /api/onboarding/[token]/clinic`
- Number search:           `GET  /api/onboarding/[token]/numbers?area_code=XXX`
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

1. Twilio Toll-Free / A2P compliance approval.
2. QA passes (see Section 12 of the build guide).
3. Owner approval.
4. Explicit `SMS_RECOVERY_MODE=live` and per-clinic
   `sms_recovery_enabled=true` toggle.
