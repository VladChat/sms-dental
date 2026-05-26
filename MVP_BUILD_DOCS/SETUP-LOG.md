# Setup Log — Missed Calls Dental

Status: Active  
Purpose: Chronological record of infrastructure and backend setup  
Last updated: 2026-05-26

This log records what was done, in order, without storing secrets.

---

## Maintenance Rule

Update this file after every durable backend, infrastructure, deployment, DNS, Supabase, Vercel, Twilio, Stripe, or production-like change.

Each new entry should include date, what changed, why it mattered, result, commit/deploy ID if relevant, verification result, and what was intentionally not done.

Do not record secrets, raw long logs, temporary failed commands, or duplicate facts.

---

## 0. Pre-existing state

- Repository path: `C:\Users\vladi\Documents\vcoding\projects\sms-dental`
- GitHub repository: `https://github.com/VladChat/sms-dental.git`
- Branch: `main`
- Public marketing site folder: `docs/`
- Public site: `https://missedcallsdental.com`
- Local static preview: `http://localhost:8080/`
- Root site hosting: GitHub Pages
- Future app/backend direction: existing `app/` folder
- Decision: do not create `backend/` unless architecture changes later.

---

## 2026-05-25 — Vercel tooling prepared

- Installed Vercel Plugin for Claude Code.
- Installed official Vercel MCP.
- Authorized Vercel MCP.
- Verified Vercel team `vladchat-1500s-projects`, ID `team_1F2PWbZbJldYTbtZ8HlEVMCm`.
- Verified no existing Vercel project for `sms-dental` before backend deployment work.

Result: Vercel MCP connected. No files changed. No Vercel project created at this stage.

---

## 2026-05-25 — Repository preparation before backend

- Added `.local-agent/` to `.gitignore`.
- Updated `.env.local.example` to match local env variable names without secret values.
- Created `MVP_BUILD_DOCS/backend-foundation-handoff.md`.
- Confirmed `docs/` was untouched.
- Confirmed `.env.local` and `.local-agent/` were not committed.

Commit:

```txt
36b5aab chore: prepare backend foundation handoff
```

---

## 2026-05-25 — Master project context added

- Created `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`.
- Updated `AGENTS.md` to read project context first.
- Updated `MVP_BUILD_DOCS/MANIFEST.md`.

Commit:

```txt
464dcf6 docs: add master project context
```

---

## 2026-05-25 — MVP build docs refreshed

- Refreshed key MVP docs to clarify current source of truth and active milestone.
- Marked `PROJECT-CONTEXT.md` as master context.
- Clarified that numbered docs are reference/roadmap material.
- Clarified active milestone: Backend Foundation v1.
- Clarified future app/backend domain: `https://app.missedcallsdental.com`.

Commit:

```txt
427471c docs: refresh MVP build docs for backend foundation
```

---

## 2026-05-25 — Backend Foundation v1 created

- Created root Next.js project foundation.
- Created App Router routes under `app/api/`.
- Created env validation helpers.
- Created DB helper using `postgres`.
- Created Twilio webhook skeletons with signature validation.
- Created Stripe webhook placeholder.
- Created structured logging/HTTP response helpers.
- Created Supabase migration SQL.
- Created `MVP_BUILD_DOCS/backend-foundation-v1.md`.
- Confirmed `npm run typecheck` pass.
- Confirmed `npm run build` pass.
- Confirmed `docs/` untouched.
- No SMS sent.
- No cloud resources created.

Commit:

```txt
882b745 feat: add backend foundation v1
```

---

## 2026-05-25 — Supabase migration applied

- Database connection: pass.
- Database user: `postgres`.
- Can create in public schema: yes.
- Can create in database: yes.
- Foundation tables absent before migration.
- Safe to apply migration: yes.
- Applied `supabase/migrations/20260525000100_backend_foundation.sql`.

Result:

- Migration applied: yes.
- Tables verified: yes.
- RLS enabled: yes.
- DB health check: pass.
- Typecheck: pass.
- Build: pass.
- Files modified: no.
- Secrets printed: no.

Tables created: `clinics`, `clinic_phone_numbers`, `webhook_events`, `call_events`, `patient_conversations`, `messages`, `opt_outs`.

---

## 2026-05-25 — Vercel project created and first deployment tested

- Created/linked Vercel project: `sms-dental`.
- Team: `vladchat-1500s-projects`.
- Added env vars from `.env.local`.
- Deployed backend once.
- Verified `https://sms-dental.vercel.app/api/health`.

Initial issue:

- Vercel backend could not reach direct Supabase DB URL.
- Direct host caused Vercel runtime DB issue due serverless/direct connection incompatibility.

Result:

- `/api/health`: pass.
- `/api/internal/health`: failed before pooler fix.

---

## 2026-05-25 — Supabase pooler fix

- Added `SUPABASE_DB_DIRECT_URL` locally to preserve the old direct/admin DB connection.
- Updated `SUPABASE_DB_URL` locally to transaction pooler URL.
- Confirmed pooler URL format: host contains `pooler.supabase.com`, port `6543`.
- Fixed `.env.local` UTF-8 BOM issue that prevented Node env parsing.
- Updated DB client to use `prepare: false` for Supabase transaction pooler.

Commit:

```txt
aa4eeb9 fix: support Supabase transaction pooler
```

Validation: local pooler DB connection pass, foundation tables visible, typecheck pass, build pass, secrets printed no.

---

## 2026-05-25 — Vercel env updated and deployed DB health verified

- Updated Vercel `SUPABASE_DB_URL` to working transaction pooler URL.
- Redeployed Vercel project.
- Verified `https://sms-dental.vercel.app/api/health`.
- Verified internal health with `x-internal-admin-secret`.

Result: `/api/health` pass, `/api/internal/health` pass, deployed `db.ok: true`, secrets printed no.

---

## 2026-05-25 — Custom app domain added

- Added custom Vercel domain: `app.missedcallsdental.com`.
- Vercel provided DNS record: `A app 76.76.21.21`.
- Added DNS record at Namecheap.
- Domain verified.
- SSL certificate issued.
- Updated Vercel `PUBLIC_WEBHOOK_BASE_URL` to `https://app.missedcallsdental.com`.
- Redeployed.

Known redeploy ID:

```txt
dpl_89HfxNTrc4KtgzTJJM1Pyk2W8kp2
```

Validation: custom domain health pass, internal health pass, `db.ok: true`, Twilio changed no, SMS sent no.

---

## 2026-05-25 — Twilio webhook plan prepared

- Confirmed Twilio env variable names exist locally.
- Confirmed live webhook endpoints exist.
- Confirmed unsigned POST returns `403`, which is expected and correct.
- Prepared Twilio Console/API configuration plan.

Live webhook URLs:

- Voice: `https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming`
- Inbound SMS: `https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming`
- SMS status: `https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status`

---

## 2026-05-25 — Twilio webhooks configured by API

- Read current Twilio IncomingPhoneNumber and Messaging Service settings.
- Previous settings were Twilio demo URLs for voice and SMS.
- Updated IncomingPhoneNumber webhook fields: `voiceUrl`, `voiceMethod`, `smsUrl`, `smsMethod`, `statusCallback`, `statusCallbackMethod`.
- Updated Messaging Service webhook fields: `inboundRequestUrl`, `inboundMethod`, `statusCallback`.
- Verified all webhook URLs and methods by API read-back.

Result:

- Twilio settings changed: yes.
- SMS sent: no.
- Calls made by agent: no.
- Secrets printed: no.
- Source files modified: no.

---

## 2026-05-25 — Inbound SMS webhook verified

Test:

- Owner sent one inbound SMS to the Twilio number `+1 844 723 4944`.

Result:

- Inbound SMS recorded: yes.
- `webhook_events` row created with provider `twilio` and event type `sms.inbound`.
- Outbound SMS sent: no.
- Twilio settings changed after setup: no.
- Secrets printed: no.

Notes:

- The foundation handler currently records inbound SMS in `webhook_events`.
- The `messages` table will be populated in a later messaging milestone when clinic-specific message handling is implemented.

---

## 2026-05-25 — Inbound voice diagnosis: Twilio Trial limitation

Test:

- Owner made multiple inbound calls to the Twilio number.
- At least one test call was longer than 30 seconds.
- Voice configuration in Console showed webhook URL and POST method correctly.

Findings:

- Calls reached Twilio.
- Twilio did not attempt the voice webhook URL.
- Vercel logs showed only call status callback requests.
- Supabase had no `voice.%` webhook events.
- Twilio Debugger showed no relevant external voice webhook error.
- Account type was Trial.
- Trial account voice restrictions prevented normal inbound voice webhook testing from unverified caller IDs.

Result:

- Voice route code and Twilio URL configuration appear correct.
- Real inbound voice webhook testing requires a paid Twilio account or a verified caller ID.
- Outbound SMS sent: no.
- Twilio settings changed during diagnosis: no.

---

## 2026-05-25 — MVP phone event strategy clarified

Product decision:

Missed Calls Dental cannot automatically detect calls to an unrelated clinic phone number. A call event must reach the system through one of the MVP connection modes.

MVP connection modes:

1. Conditional forwarding mode — clinic keeps existing number and forwards no-answer/busy/unavailable/after-hours calls to assigned Twilio number.
2. Tracking number mode — clinic uses assigned Twilio number as a dedicated number for website, ads, landing pages, print, or campaigns.
3. Hybrid mode — clinic uses forwarding for main number and tracking number usage for selected channels.

Future direction:

- Direct integrations with phone providers or dental communication platforms may be added later.
- Not required for first MVP.

Why it matters:

- Agents and future developers must not assume the backend can see calls to any clinic number automatically.
- The onboarding flow must ask which connection mode the clinic wants and verify caller ID preservation.

---

## 2026-05-26 — Twilio account upgraded and voice webhook verified

Trigger: Twilio account was upgraded from Trial to Active (Full).

Verification steps run:

- Queried Twilio account via API. Status: `active`. Type: `Full`.
- Queried inbound call logs for `+1 844 723 4944`. 16 inbound calls logged, all from same caller, all timestamped around 14:33–14:34 UTC.
- Confirmed Twilio call events for most recent call show POST fired to `https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming`.
- Confirmed Vercel production logs: 16 POST requests to `/api/webhooks/twilio/voice/incoming` all returned HTTP 200.
- Confirmed Supabase `webhook_events`: 16 rows with `event_type = voice.ringing`, `provider = twilio`, keyed as `voice:<CallSid>`.
- Twilio Monitor API returned zero errors or alerts.

Diagnosis: calls returned `busy` / `duration: 0` because the foundation handler returned empty TwiML `<Response/>`. Twilio treated the empty response as a failed handler and ended the call as busy. The webhook pipeline itself was fully functional.

Fix applied:

- Updated `app/api/webhooks/twilio/voice/incoming/route.ts`.
- Changed final `twimlResponse()` call to pass polite `<Say voice="alice">` + `<Hangup/>` TwiML.
- TwiML message: "Thanks for calling. We missed your call and will be in touch shortly. Goodbye."
- Signature validation, idempotent `webhook_events` recording, no outbound SMS — all preserved.
- `npm run typecheck`: pass.
- `npm run build`: pass.

Result:

- Twilio account: Active / Full (no longer Trial).
- Voice webhook end-to-end pipeline: verified.
- Voice call behavior: polite announcement + clean hangup (no busy/failed).
- Outbound SMS sent: no.
- Twilio settings changed: no.
- Secrets printed: no.

Commit:

```txt
fix: return polite Twilio voice response
```

---

## 2026-05-26 — Clinic/phone mapping + owner-only SMS recovery milestone

Goal: map the Twilio number to a clinic and send a polite recovery SMS — owner-test mode only.

### New source files

- `lib/phone/normalize.ts` — E.164 normalization helper
- `lib/db/clinics.ts` — `lookupClinicByPhone` by Twilio `To` number
- `lib/db/call-events.ts` — idempotent `upsertCallEvent` keyed by CallSid
- `lib/db/conversations.ts` — `getOrCreateConversation` + `touchConversation`
- `lib/db/messages.ts` — `recordOutboundMessage` + `hasSentRecoverySmsSince` duplicate check
- `lib/twilio/client.ts` — lazy Twilio REST client singleton
- `lib/twilio/outbound-sms.ts` — `sendRecoverySms` with all safety guards
- `lib/env.ts` — added `getSmsRecoveryConfig()` and `SmsRecoveryMode` type

### Updated files

- `app/api/webhooks/twilio/voice/incoming/route.ts` — wired all new helpers
- `.env.local.example` — added `SMS_RECOVERY_MODE` and `SMS_TEST_ALLOWED_TO` placeholder entries

### New migration

`supabase/migrations/20260526000100_owner_test_clinic.sql` — seeds owner-test clinic and `+18447234944` phone mapping.

Migration applied 2026-05-26:

- Clinic: `Owner Test Dental Office` (slug: `owner-test`, id: `e9f21de4-3a35-4216-bb16-66ea3aeb2e47`)
- Phone mapping: `+18447234944` → `owner-test` clinic (role: `recovery`)

### Safety model

- `SMS_RECOVERY_MODE` defaults to `disabled` — no SMS sent unless explicitly configured.
- `owner_test` mode sends SMS only to numbers listed in `SMS_TEST_ALLOWED_TO`.
- Opt-out check: consults `opt_outs` table before every send.
- Duplicate suppression: no repeat SMS to the same (clinic, caller) pair within 24 hours.
- `live` mode not implemented.
- Broad/live SMS remains disabled.

### Verification

- `npm run typecheck`: pass.
- `npm run build`: pass.
- DB migration applied and verified: clinic + phone mapping rows present and joined correctly.
- SMS send: not triggered in this step (env vars not yet set in Vercel). Requires `SMS_RECOVERY_MODE=owner_test` + `SMS_TEST_ALLOWED_TO` set in Vercel and a redeployment before owner test.

Result:

- Schema changed: no (existing tables used).
- Migration added/applied: yes (seed data).
- Outbound SMS sent: no.
- Twilio settings changed: no.
- `docs/` touched: no.

Commit:

```txt
feat: add owner-only missed call SMS flow
```

---

## 2026-05-26 — Owner-only SMS recovery end-to-end test

### Environment changes

- Set `SMS_RECOVERY_MODE=owner_test` in Vercel Production env.
- Set `SMS_TEST_ALLOWED_TO=<owner phone, not recorded>` in Vercel Production env (encrypted).
- Redeployed Production: `dpl_6xG4L9qtRDgVAnds2vLuBtAyLoWE`.
- Deployed commit: `4033903`.
- No source files modified.
- No Twilio settings changed.
- No secrets printed.

### First call test — result: PASS

- Inbound call from allowlisted owner phone (+122•••••36) to Twilio number (+184•••••44).
- Twilio call SID: `CAf819a9…` — `completed`, 6 seconds.
- Voice webhook hit: `POST /api/webhooks/twilio/voice/incoming` → HTTP 200.
- Caller heard polite greeting; call ended cleanly.
- `call_events` row created: `is_missed=true`, clinic mapped to Owner Test Dental Office.
- `patient_conversations` row created: `status=open`, `last_message_at` updated.
- Outbound SMS sent via Twilio Messaging Service to owner phone (+122•••••36).
- SMS `status=accepted` → `queued` → `sent` → **`delivered`** (all confirmed in `webhook_events`).
- SMS body: "Hi, this is Owner Test Dental Office. We missed your call. Would you like us to help schedule an appointment?"
- SMS sent only to the allowlisted owner number: confirmed.
- Owner replied "Yes, please" — recorded in `webhook_events` as `sms.inbound`. No auto-reply sent (not yet implemented — expected behavior).
- Broad/live SMS: disabled.

### Second call test — duplicate suppression: PASS

- Second inbound call from same allowlisted phone within 24 hours.
- Twilio call SID: `CAe29530b…` — `completed`, 6 seconds.
- Voice webhook hit: `POST /api/webhooks/twilio/voice/incoming` → HTTP 200.
- `call_events` row created for second call: `is_missed=true`.
- `messages` table: still only 1 outbound row (no second SMS created).
- `webhook_events`: only `voice.ringing` for second call — no `sms.status.*` events confirming zero SMS fired.
- 24-hour duplicate suppression guard worked correctly.
- Broad/live SMS: disabled.

Result:

- Vercel env vars set: yes.
- SMS sent to owner: yes, delivered.
- SMS sent only to allowlisted number: yes.
- Duplicate suppression: pass.
- Twilio settings changed: no.
- Secrets printed: no.
- `docs/` touched: no.

Commit (docs only):

```txt
docs: record owner-only SMS recovery test
```

---

## 2026-05-26 — Improved voice greeting copy (first-call vs repeat-call)

Goal: play a more informative greeting that tells first-time callers a text is coming.

Fix applied:

- Added `buildVoiceTwiml(clinicName, smsDecision)` to `app/api/webhooks/twilio/voice/incoming/route.ts`.
- First-call greeting (SMS will send): "Thanks for calling {{clinic_name}}. Sorry we missed you. We'll text you now so you can request an appointment or a call back."
- Repeat-call greeting (duplicate suppressed): "Thanks for calling {{clinic_name}}. Sorry we missed you. We already sent a text, and our team will follow up shortly."
- Fallback: "Thanks for calling us. Sorry we missed you. Our team will follow up shortly."
- XML-escaped clinic name.
- `npm run typecheck`: pass. `npm run build`: pass.

Commit:

```txt
ccab9d6 feat: improve missed-call voice greeting copy
```

Second test phone added to allowlist (`+1847957****`). First live test confirmed first-call greeting played and SMS arrived.

UX issue found: SMS arrived before the caller finished hearing the greeting, because SMS was sent synchronously inside the voice/incoming webhook before TwiML was returned to Twilio. Documented for fix in next entry.

---

## 2026-05-26 — SMS timing fix: send SMS after voice call completes

Problem: SMS arrived on caller's phone while they were still listening to the voice greeting.

Root cause: `sendRecoverySms()` was called synchronously inside `voice/incoming` before TwiML was returned. Twilio does not begin playing `<Say>` until it receives the TwiML response, so any SMS sent during that request fires before the caller hears a word.

Additional finding: `IncomingPhoneNumber.statusCallback` was misconfigured — it pointed to the messaging status URL (`/api/webhooks/twilio/messaging/status`) rather than a voice-specific endpoint. Voice `completed` status callbacks were being sent to the messaging handler, which ignored them.

Fix applied:

- Added `app/api/webhooks/twilio/voice/status/route.ts` — dedicated voice status callback endpoint.
  - Validates Twilio signature.
  - Only processes `CallStatus=completed`; other statuses return 200 immediately.
  - Uses `externalId = "voice:status:${callSid}"` (distinct from ringing event) so Twilio retries are deduplicated without blocking SMS.
  - Calls `getOrCreateConversation` + `sendRecoverySms` with all guards unchanged.
  - Returns empty `<Response/>` TwiML.
- Modified `app/api/webhooks/twilio/voice/incoming/route.ts`:
  - Removed all SMS sending logic (`getOrCreateConversation`, `sendRecoverySms`).
  - Added `predictGreeting(from, clinicId)` — read-only mirror of send guards (mode, allowlist, opt-out, 24h window) for selecting which greeting to play. Never creates or sends SMS.
  - Greeting selection now uses read-only prediction; the authoritative send/skip decision still happens in `sendRecoverySms()` inside `voice/status`.
- Updated Twilio `IncomingPhoneNumber.statusCallback` via API (not Console) to point to new voice status endpoint.

Reusable test caller documented:

- `+12245329236` (masked: `+122•••••36`) is the designated reusable owner-test caller for first-call live tests.
- Reset procedure documented in OPERATIONS-RUNBOOK.md Section 11.
- Reset removes outbound messages, patient conversation, and call events for this caller+clinic pair only.
- Never resets real/live caller data.

New call timeline after fix:

```
t=0ms    Twilio POSTs to voice/incoming
t=~300ms TwiML returned — Twilio plays greeting to caller
t=~9s    Caller finishes hearing greeting, call ends
t=~9.5s  Twilio POSTs to voice/status (CallStatus=completed)
t=~9.8s  sendRecoverySms fires
t=~11s   SMS arrives on caller's phone
```

Twilio settings changed: yes — `IncomingPhoneNumber.statusCallback` updated from messaging URL to `/api/webhooks/twilio/voice/status`.

Verification:

- `npm run typecheck`: pass.
- `npm run build`: pass.
- Deployed to Production.
- `/api/health`: pass.

Commit: `a947323 feat: send missed-call SMS after voice completion`
Deployment: `dpl_3VXzmCsx9AHLuyNv6Buaoym5Xaqs` (READY).

---

## Current state summary

Current live backend:

```txt
https://app.missedcallsdental.com
```

Current safe health state:

- `/api/health`: pass.
- `/api/internal/health`: pass.
- `db.ok`: true.
- Inbound SMS webhook: verified.
- Inbound voice webhook: verified end-to-end.
  - Callers hear a contextual greeting (first-call or repeat-call) and the call ends cleanly.
  - SMS recovery is sent AFTER the call ends via voice/status callback.
  - First-call greeting: "Thanks for calling {{clinic_name}}. Sorry we missed you. We'll text you now…"
  - Repeat-call greeting: "Thanks for calling {{clinic_name}}. Sorry we missed you. We already sent a text…"
- Clinic mapping: `Owner Test Dental Office` mapped to `+18447234944` in DB.
- Outbound SMS: owner-test mode active. SMS now sent after call completion, not during incoming webhook.
- Duplicate suppression: confirmed working.
- Broad/live SMS: disabled.
- Twilio `statusCallback`: `/api/webhooks/twilio/voice/status` (updated 2026-05-26).

Current next action:

```txt
Wire inbound SMS STOP/START opt-out enforcement into the messaging/incoming webhook.
Then plan real clinic onboarding: conditional forwarding or tracking number mode.
Do not enable live SMS mode until opt-out enforcement and clinic onboarding are complete.
```
