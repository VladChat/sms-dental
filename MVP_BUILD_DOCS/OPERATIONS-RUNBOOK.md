# Operations Runbook — Missed Calls Dental

Status: Active  
Audience: AI coding agents, technical founder, future operators  
Last updated: 2026-05-25

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
Voice incoming: https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming
Inbound SMS:    https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming
SMS status:     https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status
```

Current behavior:

- Unsigned manual POST returns `403`, which is correct.
- Twilio-signed requests pass validation.
- Inbound SMS: verified.
- Inbound voice: verified. Returns polite `<Say>` + `<Hangup/>` TwiML. Callers hear an acknowledgement then the call ends cleanly.
- Handlers record idempotent `webhook_events` rows.
- Handlers do not send outbound SMS.

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

### Voice webhook verification (completed 2026-05-26)

Verified end-to-end after Twilio account upgrade from Trial to Active:

1. Inbound call hits `+1 844 723 4944` → Twilio fires POST to voice webhook URL.
2. Vercel processes request: validates Twilio signature, records `voice.ringing` in `webhook_events`, returns TwiML.
3. Supabase `webhook_events` receives a row keyed as `voice:<CallSid>`.
4. Caller hears: "Thanks for calling. We missed your call and will be in touch shortly. Goodbye." then call ends.

To re-verify after any change:

1. Make one inbound call to the Twilio number.
2. Check Vercel logs for `POST /api/webhooks/twilio/voice/incoming` → expect HTTP 200.
3. Query `webhook_events` where `provider = 'twilio'` and `event_type like 'voice.%'`.
4. Confirm no outbound SMS was sent.

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

`live` mode: not yet implemented.

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

## 10. Current Next Step

Current next step:

```txt
Set SMS_RECOVERY_MODE=owner_test and SMS_TEST_ALLOWED_TO=<owner phone> in Vercel env,
redeploy, and make a test call to verify end-to-end SMS recovery.
```

After owner test succeeds:

```txt
Wire inbound SMS STOP/START opt-out enforcement and then plan real clinic onboarding.
```

Do not enable `live` mode until clinic onboarding, opt-out enforcement, and explicit owner approval are complete.
