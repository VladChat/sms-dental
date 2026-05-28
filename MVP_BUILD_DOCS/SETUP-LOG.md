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

## 2026-05-26 — Inbound SMS opt-out enforcement

Goal: handle STOP/START/HELP inbound SMS and enforce opt-out in future recovery sends.

### Findings before coding

- `opt_outs` table: already existed with `(clinic_id, phone_number)` unique key, `opted_out_at`, `opted_back_in_at`.
- `messages` table: already had `direction='inbound'` check and `detected_keyword` column.
- `sendRecoverySms`: already checked `opt_outs` via `isPhoneOptedOut()`. No change needed to the outbound guard.
- No migration needed.

### New source files

- `lib/db/opt-outs.ts` — `upsertOptOut` (STOP), `clearOptOut` (START)

### Modified files

- `lib/db/messages.ts` — added `recordInboundMessage` (idempotent inbound message storage)
- `app/api/webhooks/twilio/messaging/incoming/route.ts` — full rewrite with:
  - clinic lookup by `To` number
  - `getOrCreateConversation` + `recordInboundMessage` for all inbound messages
  - STOP → `upsertOptOut` (DB write only)
  - START → `clearOptOut` (DB write only)
  - HELP → no DB change
  - ordinary replies → stored, no auto-reply
  - all cases return empty `<Response/>`

### Behavior (as of double-reply fix — see entry below)

| Keyword | DB write | TwiML reply |
|---|---|---|
| STOP | `opt_outs` upsert (opted_back_in_at cleared) | empty `<Response/>` |
| START | `opt_outs` update (opted_back_in_at set to now()) | empty `<Response/>` |
| HELP | none | empty `<Response/>` |
| *(other)* | none | empty `<Response/>` |

Twilio's Messaging Service sends STOP/START/HELP compliance replies at the platform level. Our webhook returns empty `<Response/>` to avoid duplicate replies. See double-reply fix entry below.

All inbound messages stored in `messages` table regardless of keyword.

### Verification

- `npm run typecheck`: pass.
- `npm run build`: pass.

Commit: see below.

---

## 2026-05-26 — Clinic onboarding safety gate + double-reply fix

### Double-reply fix (commit a8d1451)

Twilio Messaging Service sends STOP/START/HELP compliance replies at the platform level.
Our webhook was also returning a `<Message>` TwiML reply, causing callers to receive two messages.

Fix: `messaging/incoming` now always returns empty `<Response/>`.
All DB writes (opt-out, inbound message, webhook_event) are unchanged.

Live verified: STOP and START each produced exactly one reply.

### Clinic onboarding safety gate

Goal: ensure new real clinics cannot accidentally trigger recovery SMS before explicit approval.

**Gap found**: no per-clinic SMS enable flag. In `live` mode, all active clinics with `is_active=true`
would send SMS — no per-clinic gate existed.

**Fix:**
- Added `sms_recovery_enabled boolean not null default false` to `clinics` table.
- `sendRecoverySms`: updated guards to allow `live` mode; added clinic-level guard (live mode only);
  allowlist guard is now `owner_test`-only.
- `predictGreeting` in `voice/incoming`: updated to pass full `ClinicRow`; respects
  `sms_recovery_enabled` for `live` mode; mirrors `sendRecoverySms` guard sequence.

**Migration applied** (`supabase/migrations/20260526000200_clinic_sms_gate.sql`):
- Column added with `default false`.
- Owner Test Dental Office: `sms_recovery_enabled` set to `true` (existing behavior preserved).

### Verification

- `npm run typecheck`: pass.
- `npm run build`: pass.

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
- Opt-out enforcement: STOP/START verified live (2026-05-26).
- Clinic onboarding safety gate: `sms_recovery_enabled` field in DB, default false for new clinics.
- Broad/live SMS: disabled.
- Twilio `statusCallback`: `/api/webhooks/twilio/voice/status` (updated 2026-05-26).

Current next action:

```txt
Complete A2P/10DLC or toll-free registration before enabling live patient SMS.
See MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md for required steps.
Once registration is approved, onboard first real clinic using OPERATIONS-RUNBOOK.md Section 11.
```

---

## 2026-05-26 — First clinic onboarding package and A2P compliance readiness

### First clinic onboarding package

Created `MVP_BUILD_DOCS/FIRST-CLINIC-ONBOARDING.md` — practical step-by-step guide for safely onboarding the first real clinic under the current MVP backend.

Sections: clinic information intake, two onboarding modes (conditional forwarding vs tracking number), 9-step technical checklist with SQL verification queries, go-live safety checklist, rollback SQL commands, clinic-facing setup instructions draft, internal operator checklist.

### A2P compliance readiness package

Created `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` — covers what must be done before live patient SMS, recommended registration path (toll-free verification vs 10DLC), campaign wording templates, sample messages, website checklist, go/no-go checklist, and internal risk notes.

Key finding: current Twilio number (`+1 844 723 4944`) is toll-free. Toll-Free Verification is the fastest path to live patient SMS compliance.

Action required before first real clinic SMS:
1. Add Terms of Service and Privacy Policy to `missedcallsdental.com`.
2. Submit Toll-Free Verification in Twilio Console.
3. Wait for approval (3–7 business days).

No source files changed. No live SMS sent. No Twilio settings changed. No secrets printed.

---

## 2026-05-26 — Toll-free verification submission packet prepared

- Created `MVP_BUILD_DOCS/TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md`.
- Added copy-ready Twilio Toll-Free Verification form wording:
  - business/product description
  - transactional/customer-care use-case category
  - campaign/use-case description
  - opt-in and message-flow explanation
  - sample messages
  - website evidence checklist
  - owner submission checklist
  - after-submission tracking table template
- Updated cross-references in:
  - `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md`
  - `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
  - `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md`
  - `MVP_BUILD_DOCS/MANIFEST.md`

Result:

- New submission packet prepared: yes.
- Live SMS enabled: no.
- Twilio settings changed: no.
- Source/backend code changed: no.
- Public site files changed: no.

---

## 2026-05-26 — Automated clinic onboarding workflow

Implemented the automated onboarding flow per
`MVP_BUILD_DOCS/ONBOARDING-WORKFLOW-BUILD-GUIDE.md`.

Changes:

- New migration `supabase/migrations/20260526000300_onboarding_setup_requests.sql`:
  - adds `setup_requests` table (stores `setup_token_hash`, never raw tokens)
  - extends `clinics` with `legal_business_name`, `main_phone`,
    `owner_contact_name`, `owner_contact_email`, `owner_contact_phone`,
    `test_patient_phone`, `setup_status`
  - marks the existing owner-test clinic `setup_status='active'`
- New libraries:
  - `lib/onboarding/tokens.ts` — 32-byte hex setup tokens, SHA-256 hash,
    72-hour expiry, constant-time comparison, `buildSetupUrl` using the
    trusted `APP_BASE_URL`.
  - `lib/onboarding/verify.ts` — token lookup + expiry/state checks.
  - `lib/db/setup-requests.ts` — insert/find/update setup request rows.
  - `lib/db/clinic-phone-numbers.ts` — find/upsert active office texting
    number for a clinic.
  - `lib/db/clinics.ts` — extended with `findClinicById`,
    `upsertClinicForOnboarding`, `setClinicSetupStatus`.
  - `lib/email/setup-link-email.ts` — Resend-based delivery, fails loud.
  - `lib/twilio/numbers.ts` — search + purchase + webhook auto-config
    (`voice/incoming`, `voice/status`, `messaging/incoming`,
    `messaging/status`), attaches the purchased number to the Messaging
    Service best-effort.
- New `lib/env.ts` helpers:
  - `getAppDomains()` / `getAppDomainsSafe()`
  - `getSetupEmailEnv()`
  - `isTwilioNumberPurchaseEnabled()`
  - `isOwnerTestSetupLinkFallbackEnabled()`
- New API routes (all server-only, never expose secrets):
  - `POST /api/setup-requests` — public marketing form target; creates
    request row, issues token, sends email, supports owner-test fallback.
    CORS allows `PUBLIC_SITE_URL` only.
  - `POST /api/onboarding/[token]/clinic` — validates token, persists
    clinic onboarding details.
  - `GET /api/onboarding/[token]/numbers?area_code=XXX` — searches Twilio
    available local US numbers (Voice + SMS).
  - `POST /api/onboarding/[token]/numbers/purchase` — purchases the
    selected number iff `TWILIO_NUMBER_PURCHASE_ENABLED=true`, idempotent
    at clinic level. Stores `clinic_phone_numbers` with
    `role='office_texting'`.
- New pages:
  - `app/setup/[token]/page.tsx` — branches by request status (form,
    search, status).
  - `app/setup/[token]/status/page.tsx` — direct status deep link.
- Public marketing site:
  - `docs/index.html` form `action` updated to
    `https://app.missedcallsdental.com/api/setup-requests`, method `post`.
  - `docs/script.js` submit handler swapped from mailto to a real `fetch`
    POST. On success, redirects to `confirm.html` (or the URL returned by
    the API).
  - `docs/confirm.html` copy updated to match the build guide:
    “Check your email for your secure setup link. Your office texting
    number will be selected during setup. Your existing office phone
    number will not be replaced.”
- `.env.local.example`:
  - Added `APP_BASE_URL`, `PUBLIC_SITE_URL`, `RESEND_API_KEY`,
    `SETUP_EMAIL_FROM`, `TWILIO_NUMBER_PURCHASE_ENABLED=false`,
    `OWNER_TEST_SETUP_LINK_FALLBACK=false`.

Customer-facing UI strings used verbatim:

- Title: “Choose your office texting number”
- Subtitle: “This is an additional number for missed-call text follow-ups.
  It will not replace your existing office phone number.”
- Button: “Use this number”
- Success title: “Your office texting number is ready”
- Status explanation: “Use this number for missed-call forwarding or
  tracking. Your existing office phone number does not change.”

Safety rules followed:

- No live SMS enabled. `sms_recovery_enabled` stays `false`.
- `SMS_RECOVERY_MODE` not changed.
- `TWILIO_NUMBER_PURCHASE_ENABLED` defaults to `false` in env example.
  Production must explicitly set it to `true` before any real purchase.
- Setup tokens never logged. Only SHA-256 hashes stored in DB.
- Setup links built only from the trusted `APP_BASE_URL`.
- Existing Twilio numbers not deleted or released.
- Twilio Toll-Free verification not modified.
- Stripe not touched.
- `.env.local` not committed.

Migration applied: no (apply manually via Supabase SQL editor with owner
approval).

Result: automated onboarding code path in place. Verified locally with
`npm run typecheck` and `npm run build`. Public site form now targets the
app domain. SMS remains disabled by default. Live SMS still requires
compliance approval, QA pass, and explicit owner action.

---

## 2026-05-26 — Onboarding workflow verification pass

Verification-only pass against commit `d9d3402` (`feat: add automated
clinic onboarding workflow`).

Verified consistent and correct:

- Setup request creation: `POST /api/setup-requests` validates work_email
  (required) and optionally full_name (not required — public form is email-only;
  `"Clinic owner"` is used as the fallback owner name when omitted), inserts a
  row in `setup_requests`, then either sends the Resend email or (if
  `OWNER_TEST_SETUP_LINK_FALLBACK=true`) returns the setup link inline.
- Token generation: `lib/onboarding/tokens.ts` issues 32 random bytes
  hex-encoded (64-char), persists SHA-256 hash only, expires 72 h after
  issue, compares constant-time via `timingSafeEqual`.
- Setup link generation: `buildSetupUrl` uses the trusted `APP_BASE_URL`
  only; no request-host fallback.
- Resend email sending: `lib/email/setup-link-email.ts` POSTs the
  Resend REST API; on non-2xx it throws `SetupEmailDeliveryError` which
  the route catches, sets `email_status='failed:<status>'`, leaves the
  request in `requested`, and returns 502 to the caller.
- Clinic onboarding form: `POST /api/onboarding/[token]/clinic`
  validates all fields, normalizes phones to E.164, upserts the clinic,
  sets `setup_status='clinic_details_completed'`, and attaches the
  clinic to the setup request.
- Number search: `GET /api/onboarding/[token]/numbers` reads the clinic
  main-phone area code (or `?area_code=` query) and lists Twilio US
  local numbers with Voice + SMS capability. Search never purchases.
- Number purchase safety: route returns 503 when
  `TWILIO_NUMBER_PURCHASE_ENABLED` is not exactly `"true"`. Idempotent
  at clinic level: if an active `role='office_texting'` row already
  exists, returns it without contacting Twilio.
- Clinic creation/update: `upsertClinicForOnboarding` sets defaults
  `is_active=true`, `sms_recovery_enabled=false`,
  `setup_status='clinic_details_completed'` on insert.
- `clinic_phone_numbers` mapping: `upsertOfficeTextingNumber` writes
  `role='office_texting'`, `is_active=true`, with the Twilio Phone
  Number SID. Upsert keyed by unique `phone_number`.
- SMS off by default: grep across `lib/` and `app/` confirms no code
  path sets `sms_recovery_enabled = true`. The purchase route only
  sets `setup_status='number_assigned'`.

False-positive correction from the prior commit's "Blockers" section:

- The earlier report claimed the SMS messaging status webhook route did
  not yet exist. It does:
  `app/api/webhooks/twilio/messaging/status/route.ts`. The handler is
  signature-validated, idempotent on `(MessageSid, MessageStatus)` via
  `webhook_events.external_id = 'sms_status:<sid>:<status>'`, sends no
  SMS, and returns a 200 JSON ack. No code change was needed.

Wiring nuance documented in OPERATIONS-RUNBOOK.md:

- Twilio's `incomingPhoneNumbers.create()` does not expose a
  per-number SMS status callback URL field. The
  `/api/webhooks/twilio/messaging/status` route receives data when one
  of the following is true:
  1. The Messaging Service is configured with that URL as its
     `statusCallback` (one-time operator action in the Twilio Console
     or via the Messaging Service API).
  2. Outbound `messages.create()` is called with a per-message
     `statusCallback` parameter pointing at the route. The current
     outbound sender in `lib/twilio/outbound-sms.ts` does not do this
     today; that's a small future improvement, not a blocker.

Migration applied: no (still pending). The new migration
`20260526000300_onboarding_setup_requests.sql` has not been applied.
Apply instructions and verification queries are in OPERATIONS-RUNBOOK.md.

Result:

- `npm run typecheck` passes.
- `npm run build` passes; all expected routes are emitted (see route
  table in OPERATIONS-RUNBOOK.md).
- No live SMS sent. No Twilio settings changed. No Stripe changes.
- No secrets printed. `.env.local` not committed.

---

## 2026-05-27 — Country-aware onboarding (US + Canada) + toll-free option

Scope: improve the clinic onboarding number-search flow so it works for
real clinics in the United States and Canada, and offer toll-free as a
separate, clearly labeled option.

Changes:

- New migration
  `supabase/migrations/20260527000100_clinic_location.sql` adds
  `country` (default `'US'`, checked against `('US','CA')`), `city`,
  `state_region`, `postal_code`, and `preferred_area_code` to
  `public.clinics`. Existing rows backfill to `'US'`. The migration
  is idempotent (uses `add column if not exists` and a `do $$` block
  to add the check constraint).
- `lib/twilio/numbers.ts`
  - `searchAvailableLocalNumbers` is now country-aware
    (`SupportedCountry = "US" | "CA"`) and accepts optional `inRegion`
    and `inPostalCode` filters.
  - New `searchAvailableTollFreeNumbers` calls Twilio's toll-free
    available-numbers endpoint with the same country scope.
  - `AvailableNumber.type` (`"local" | "toll_free"`) and `.country`
    flow through to the UI so cards can be labeled correctly.
- `lib/db/clinics.ts`
  - `ClinicOnboardingInput` and `ClinicOnboardingRow` extended with
    `country`, `city`, `state_region` (column name), `postal_code`,
    and `preferred_area_code`.
  - `upsertClinicForOnboarding` persists the new fields on both insert
    and update paths.
- `app/api/onboarding/[token]/clinic/route.ts`
  - Zod schema now requires `country in ("US","CA")` and accepts
    optional `city`, `state_region`, `postal_code`, and
    `preferred_area_code`. Country mismatch returns `400
    country_not_supported` with the approved copy.
- `app/api/onboarding/[token]/numbers/route.ts`
  - Accepts `?type=local|toll_free` and `?country=US|CA`. Defaults to
    the clinic's stored country. Local search uses the clinic's
    `state_region` and `postal_code` to narrow Twilio search when set.
    Returns `type` and `country` alongside `numbers`.
- `app/setup/[token]/_components/ClinicForm.tsx`
  - Adds a country picker with **United States**, **Canada**, and
    **Other (contact us)**. Choosing **Other** disables submit and
    shows the approved unsupported-country notice. Adds
    optional city, state/province, ZIP/postal, and preferred area code
    fields. Adjusts state and postal labels by country.
- `app/setup/[token]/_components/NumberSearch.tsx`
  - Adds a **Local** / **Toll-free** tab pair with the approved
    per-tab helper copy. Toll-free tab includes a short non-alarming
    note that toll-free SMS requires Twilio toll-free verification
    before live patient messaging. Result cards show a `Local` or
    `Toll-free` chip in addition to the `Recommended` badge.
- `app/setup/[token]/page.tsx` passes `clinic.country` and
  `clinic.preferred_area_code` into `NumberSearch`.

Safety invariants preserved:

- Number purchase is still gated by
  `TWILIO_NUMBER_PURCHASE_ENABLED=true`. The purchase route was not
  modified in this pass; the existing 503 `purchase_disabled` path
  works for toll-free purchase attempts too.
- Onboarding never sets `clinic.sms_recovery_enabled = true`. The
  toll-free SMS verification gate is enforced operationally by the
  existing live-SMS go-live procedure.
- No existing Twilio numbers deleted/released. No Stripe changes. No
  secrets printed or committed.

Migration applied: no. Apply via Supabase SQL editor. Verification
queries:

```sql
-- New columns exist on clinics
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'clinics'
  and column_name in (
    'country', 'city', 'state_region', 'postal_code', 'preferred_area_code'
  )
order by column_name;
-- expect: 5 rows

-- Country check constraint exists
select conname from pg_constraint
where conname = 'clinics_country_check';
-- expect: 1 row

-- Existing rows backfilled to 'US'
select slug, country from public.clinics where country is null;
-- expect: 0 rows
```

Verification result:

- `npm run typecheck` passes.
- `npm run build` passes. Build emits all expected routes including
  the country-aware `/api/onboarding/[token]/numbers`.
- No code path enables live SMS automatically.
- Owner-only test data lives in this runbook only — production UI uses
  the clinic's own location.

Safe next step for owner-only dry run:

1. Apply migration `20260527000100_clinic_location.sql` via Supabase
   SQL editor and run the verification queries above.
2. In `.env.local`, keep:
   - `APP_BASE_URL=http://localhost:3000`
   - `PUBLIC_SITE_URL=http://localhost:8080`
   - `OWNER_TEST_SETUP_LINK_FALLBACK=true`
   - `TWILIO_NUMBER_PURCHASE_ENABLED=false`
3. `npm run dev` and POST a test setup request with the documented
   owner-only credentials. Follow the returned setup link.
4. On the clinic form, pick **Canada** to verify the state/province
   and postal-code labels switch, then switch back to **United States**.
5. On the number search step, switch between the **Local** and
   **Toll-free** tabs to confirm both lists load and that each card
   shows its `Local` or `Toll-free` chip.
6. Click **Use this number** on either list. Expect a `503
   purchase_disabled` response — that is the correct safe outcome
   while `TWILIO_NUMBER_PURCHASE_ENABLED=false`. No Twilio number is
   purchased. No SMS is sent.

---

## 2026-05-27 — Project-wide form/onboarding scope rule documented

- Added a permanent project-wide Form and Onboarding Scope Rule in `AGENTS.md`.
- Rule applies to all forms, onboarding/setup flows, dashboard settings, and user-input screens.
- Rule standard:
  - Ask only for fields required for the next immediate step.
  - Defer non-essential fields to later profile/settings/admin/compliance/billing stages.
  - Add short customer-facing "why this is needed" explanations for required fields.
  - Align with Nielsen Norman Group EAS framing: eliminate unnecessary fields, automate where possible, simplify what remains.
- Added concise cross-references in:
  - `README.md`
  - `MVP_BUILD_DOCS/AGENT-RULES.md`
  - `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
  - `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md`
  - `MVP_BUILD_DOCS/FIRST-CLINIC-ONBOARDING.md`
  - `MVP_BUILD_DOCS/MANIFEST.md`
  - `Skills/page-cro-dental-saas.md`
  - `.claude/skills/landing-page-cro/SKILL.md`

Result:

- Source/backend code changed: no.
- Env files changed: no.
- Live SMS enabled: no.
- Twilio/Vercel/Stripe settings changed: no.

---

## 2026-05-27 — Onboarding docs/rules aligned to Business Profile flow

- Updated source-of-truth docs/rules to match the current onboarding decision:
  - Step 1 collects only clinic name, main office phone, ZIP code.
  - Business Profile is the next required stage (Business Information + A2P Approval Information).
  - Local number preparation/reservation is the default MVP path.
  - Customer-facing manual number catalogs are not required in default onboarding.
  - Trial baseline set to 21 days; billing starts only after SMS recovery is active.
- Updated `config/runtime.config.ts` billing baseline:
  - `trialDaysAfterActivation: 21`.
- Preserved SMS safety rules:
  - `sms_recovery_enabled=false` until carrier/A2P approval and number readiness.
  - owner-test mode remains separate from production live mode.

Result:

- Source/backend feature code changed: no.
- Env files changed: no.
- Live SMS enabled: no.
- Twilio/Vercel/Stripe settings changed: no.

---

## 2026-05-27 — Onboarding Step 1 simplified to U.S.-only 3-field form

- Applied the project-wide Form and Onboarding Scope Rule (`AGENTS.md`)
  to the clinic setup flow.
- Step 1 of `app/setup/[token]` now asks for only the three fields
  required to advance to number search:
  - Clinic name — helper: *Shown to patients in your follow-up messages.*
  - Main office phone — helper: *The number patients currently call.*
  - ZIP code — helper: *Used to find local numbers near your office.*
- Removed from Step 1 UI: legal/business name, country selector,
  city, state/province, preferred area code, timezone (IANA),
  owner/admin contact name/email/phone, test patient phone, setup mode.
- MVP automated onboarding is now **U.S.-only**. No country selector
  in the UI. Backend forces `country = 'US'` and rejects any non-US
  payload with `400 country_not_supported`:
  "Automated setup is currently available for U.S. clinics only."
- Owner email is now taken from the verified setup request, not from
  a separate Step 1 field.
- Main office phone accepts common U.S. formats
  (`(224) 555-1234`, `224-555-1234`, `2245551234`, `+12245551234`)
  via `lib/phone/normalize.ts` and is normalized to E.164 before storage.
- ZIP code validated `^\d{5}(-\d{4})?$`. Saved to `clinics.postal_code`
  and passed to Twilio local search as `inPostalCode`. Area code for
  local search is derived from the main office phone as fallback;
  `preferred_area_code` is no longer collected in Step 1.

Database schema: unchanged. Removed fields are still nullable columns
on `public.clinics`, kept for backward compatibility with existing rows
and future collection later in onboarding. The `upsertClinicForOnboarding`
update path now uses `coalesce()` so re-saving Step 1 does not blow away
values entered in later steps.

Docs updated:

- `MVP_BUILD_DOCS/MANIFEST.md` — onboarding scope summary.
- `MVP_BUILD_DOCS/FIRST-CLINIC-ONBOARDING.md` — Step 1 description, U.S.-only.
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — onboarding-scope section, dry-run wording.
- `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md` — U.S.-only 3-field Step 1 checklist.

Result:

- Files changed: `app/setup/[token]/page.tsx`,
  `app/setup/[token]/_components/ClinicForm.tsx`,
  `app/api/onboarding/[token]/clinic/route.ts`,
  `lib/db/clinics.ts`, `lib/phone/normalize.ts`, and the docs above.
- Typecheck: pass.
- Build: pass.
- Live SMS enabled: no.
- `TWILIO_NUMBER_PURCHASE_ENABLED`: unchanged (still false).
- `sms_recovery_enabled`: unchanged (still false).
- Twilio/Vercel/Stripe settings changed: no.
- Secrets printed: no.
- Env files committed: no.

---

## 2026-05-28 — Business Profile onboarding implemented

Rebuilt the customer onboarding around a simple Business Profile setup.

Flow:

- Screen 1 **Create office profile** — clinic name, main office phone, ZIP code.
  Button: **Create office profile**. After save the backend generates the public
  business `slug` and runs automatic local-number preparation (read-only Twilio
  candidate search; customer-facing status **Preparing**). No Review & Submit step.
- Screen 2 **Business Profile** page — top status strip (Local number / SMS /
  Billing) plus cards: Business Information, A2P Approval Information, Public
  Business Page, Billing, Billing History, Login & Security, Support.

Key behaviors:

- Business Information reuses the office-profile values (prefilled, no duplicate
  entry) and adds legal name, EIN/Tax ID, business type, address, optional website.
- A2P Approval Information prefills representative email from the setup/login email
  and representative phone from the main office phone. Saving stores data locally
  only, advances displayed SMS status to **Waiting for approval**, and never sets
  `sms_recovery_enabled=true` or submits to Twilio.
- Public pages render at `/business/{slug}`, `/business/{slug}/privacy`,
  `/business/{slug}/sms-terms`, stating Missed Calls Dental / Dental SMS is the
  technology/service provider.
- Billing stays **Not started**. The 21-day trial baseline starts only after SMS
  recovery activation; the trial countdown does not start while approval is pending.
- New status/lifecycle + business/A2P columns let a future super-admin list all
  business profiles, local number status, SMS/A2P status, billing status, slug,
  and provider identifiers — without building the admin UI now.

Files changed:

- `app/setup/[token]/page.tsx` — route to Create office profile, then Business Profile.
- `app/setup/[token]/_components/ClinicForm.tsx` — "Create office profile" screen.
- `app/setup/[token]/_components/BusinessProfile.tsx` — new Business Profile page (7 cards).
- `app/api/onboarding/[token]/clinic/route.ts` — slug + local-number prep on save.
- `app/api/onboarding/[token]/business-info/route.ts` — new.
- `app/api/onboarding/[token]/a2p/route.ts` — new.
- `app/business/[slug]/{page,privacy/page,sms-terms/page}.tsx` + `_components/Shell.tsx` — new public pages.
- `lib/db/clinics.ts` — business-info / A2P / slug / status helpers, full column list.
- `lib/onboarding/slug.ts`, `lib/onboarding/local-number.ts` — new helpers.
- `supabase/migrations/20260528000100_business_profile_onboarding.sql` — new (NOT yet applied).

Result:

- Typecheck: pass.
- Build: pass (new routes present).
- Live SMS enabled: no. `sms_recovery_enabled`: unchanged (false).
- `TWILIO_NUMBER_PURCHASE_ENABLED`: unchanged (false). No number purchased.
- Stripe: unchanged. Twilio A2P: not submitted. Webhooks/signature/idempotency: unchanged.
- Secrets printed: no. Env files committed: no.

Remaining manual step:

- Apply `20260528000100_business_profile_onboarding.sql` to Supabase (owner approval
  required) before the live Business Profile flow works end-to-end.

---

## 2026-05-28 — Production setup email flow: verification attempt (blocked on Resend)

Goal: make the production setup-link email flow ready for real use (configure
Resend, disable owner-test fallback, send a real setup email, confirm the
emailed link reaches the live Business Profile onboarding).

Resend production email status: **NOT configured (launch blocker).**

- `RESEND_API_KEY`: missing on Vercel production, empty in local `.env.local`.
- `SETUP_EMAIL_FROM`: missing on Vercel production, empty in local `.env.local`.
- A safe presence-only scan of local env files found no real Resend value
  anywhere. Per task rules, no value was invented and nothing was set on Vercel.
- Owner action required: create a Resend API key + verify a sending domain,
  then set `RESEND_API_KEY` and `SETUP_EMAIL_FROM` on Vercel Production.

OWNER_TEST_SETUP_LINK_FALLBACK status: **left `true`** in production
(unchanged). Intentionally NOT flipped to `false`: with the fallback off and no
Resend key, `POST /api/setup-requests` would return `502 email_delivery_failed`
and break onboarding. It must stay `true` until Resend is configured, then be
set to `false` for public launch.

Production setup email dry-run result: **could not run the real-email path**
(no Resend key). The fallback path was confirmed still working:
`POST /api/setup-requests` returns `ok:true`, `confirm_url`, and a `setup_url`
(fallback ON). No setup token was printed to shared logs. The full emailed-link
dry run (create office profile → Business Profile → Business Information → A2P →
`/business/{slug}` + `/privacy` + `/sms-terms`) was already verified end-to-end
on 2026-05-28 via the fallback link; only real email delivery remains unverified.

Health check result: `GET /api/health` → 200
`{"ok":true,"service":"missed-calls-dental","version":"foundation-v1"}`.
Production is on latest `origin/main` (`75529ab`); no redeploy needed.

Checks: `npm run typecheck` pass; `npm run build` pass; no `lint` script; no tests.

Safety confirmation:

- SMS sent: no. `sms_recovery_enabled`: unchanged (false).
- Twilio number purchased/reserved: no. Twilio settings/webhooks: unchanged.
- Stripe: unchanged. Billing: not started. No trial dates set.
- Supabase migration applied this task: none.
- Secrets printed: no. Env files committed: no. Vercel env values: unchanged.

Docs updated: this entry, `OPERATIONS-RUNBOOK.md` (setup email current status +
finish procedure), `REPEATABLE-SETUP-CHECKLIST.md` (pre-launch email checklist).

Remaining launch blockers:

1. Configure `RESEND_API_KEY` + `SETUP_EMAIL_FROM` on Vercel production (owner).
2. After Resend is configured, set `OWNER_TEST_SETUP_LINK_FALLBACK=false`,
   redeploy, and run the owner-only real-email dry run.
