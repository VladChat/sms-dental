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
- `/api/internal/health`: removed intentionally for MVP (2026-05-29).
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
- Historical button: use-number action
- Success title: “Your office texting number is ready”
- Historical status explanation: use the selected number for missed-call forwarding or
  tracking. Your existing office phone number does not change.

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
6. Click the historical use-number action on either list. Expect a `503
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
  - Historical trial/billing wording set the trial baseline to 21 days and tied billing to SMS recovery activation.
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

---

## 2026-05-28 — Production setup email flow enabled (Resend)

Resend production setup email is now **configured and live**.

Config / code:

- `RESEND_API_KEY` is the only required secret for setup email sending. Set on
  Vercel Production as an **encrypted** env var (value never printed/committed).
  The key is a Resend **restricted, send-only** key.
- Default sender centralized in `config/runtime.config.ts`
  (`email.defaultSetupFrom = "Missed Calls Dental <no-reply@mail.missedcallsdental.com>"`)
  — single source of truth, sent from the Resend-verified subdomain
  `mail.missedcallsdental.com`.
- `lib/env.ts` `getSetupEmailEnv()` now returns `{ resendApiKey, setupEmailFrom }`;
  `SETUP_EMAIL_FROM` is an optional, non-secret override and is **not** set on
  Vercel. `lib/email/setup-link-email.ts` uses the resolved sender.

Vercel Production env (no values shown):

- `RESEND_API_KEY`: set (encrypted).
- `OWNER_TEST_SETUP_LINK_FALLBACK`: **false**.
- `SETUP_EMAIL_FROM`: not set (default from config).
- `APP_BASE_URL=https://app.missedcallsdental.com`, `PUBLIC_SITE_URL=https://missedcallsdental.com`: confirmed present.

Deploy: pushed `4c56f6a`; Vercel production auto-deployed and reached READY on
that commit. `GET /api/health` → 200.

Owner-only real-email dry run (recipient `livedealsmart@gmail.com`, used only
for verification — not hardcoded, no allowlist added):

- `POST /api/setup-requests` → `ok:true`, `confirm_url` returned, **no
  `setup_url`** (fallback off, real email path).
- `setup_requests` row: `status='email_sent'`, `email_status='sent'`
  (Resend accepted the send), token hash stored, raw token not stored.
- Setup link is built from `APP_BASE_URL` →
  `https://app.missedcallsdental.com/setup/<token>` (token not logged).
- Create office profile → Business Profile → Business Information → A2P →
  `/business/{slug}` + `/privacy` + `/sms-terms`: verified end-to-end on
  2026-05-28 (migration task) and unchanged by this email-only change. The
  send-only Resend key cannot fetch the email body, so inbox receipt + From
  display are confirmed by the owner opening the email.

Safety confirmations:

- No email allowlist or hardcoded test recipient added to production logic.
- SMS sent: no (0 messages in window). `sms_recovery_enabled`: unchanged
  (only pre-existing `owner-test` is true). Billing: not started; trial dates null.
- Twilio settings/webhooks: unchanged. No number purchased/reserved.
- Stripe: unchanged. Supabase migration: none applied. DNS: unchanged.
- Secrets printed: no. `.env.local` / `.local-agent/` committed: no.

Checks: `npm run typecheck` pass; `npm run build` pass; no `lint` script.

Remaining blockers for full public launch: none for the setup email flow.
Live patient SMS remains gated (compliance/A2P + QA + explicit go-live), and
billing/trial start only after SMS recovery activation — both intentionally off.

---

## 2026-05-28 — Setup email copy updated (short, no number-selection wording)

Updated the production setup email body. It no longer mentions choosing or
preparing a texting number and no longer uses a per-name greeting.

New copy (subject unchanged: "Complete your Missed Calls Dental setup"):

```
Hello,

Use this secure link to continue your Missed Calls Dental setup:

<setup link>

You’ll add your office details on the next step.

If you did not request this setup link, you can ignore this email.

Missed Calls Dental
support@missedcallsdental.com
```

Code: `lib/email/setup-link-email.ts` rewrites `buildPlainBody`/`buildHtmlBody`
(no `ownerName` param); `app/api/setup-requests/route.ts` no longer passes
`ownerName` to the email (still stored as `owner_full_name` for the DB). Sender
unchanged — centralized config default
`Missed Calls Dental <no-reply@mail.missedcallsdental.com>`.

Deploy: pushed `effe543`; Vercel production auto-deployed to READY. Health 200.

Owner-only real-email dry run (recipient `livedealsmart@gmail.com`, verification
only — not hardcoded, no allowlist):

- `POST /api/setup-requests` → `ok:true`, `confirm_url` returned, **no
  `setup_url`** (fallback off).
- `setup_requests` row: `status=email_sent`, `email_status='sent'` (Resend
  accepted/dispatched the new-copy email). Raw token not stored/logged.
- Source confirms new copy deployed: greeting "Hello," present; old "choose an
  office texting number" wording absent; no "Clinic owner"; no A2P/carrier/
  billing/trial mentions. (Send-only Resend key cannot fetch the body; owner
  confirms the rendered email/From visually in the inbox.)

Safety: SMS sent 0; no clinic `sms_recovery_enabled` flipped (only pre-existing
owner-test); no Stripe ids; billing not started; no Twilio number purchase; no
Twilio/Stripe/Supabase/DNS change; no env change; no secrets printed.

---

## 2026-05-29 — Secret-only local env cleanup and config ownership

Purpose: enforce `.env.local` as secrets-only and move non-secret runtime settings to committed config.

What changed:

- Updated `.env.local.example` to a secret-only template with variable names only.
- Updated local `.env.local` to keep only secret/credential variables; removed non-secret settings and removed `JOB_RUNNER_SECRET`.
- Centralized non-secret runtime settings in `config/runtime.config.ts`:
  - app/public URLs
  - Twilio phone number + Twilio resource SIDs
  - Stripe account ID
  - setup email sender
  - onboarding safety flags
- Updated `lib/env.ts` to read those non-secret settings from committed runtime config instead of direct `process.env`.
- Removed internal health endpoint auth exception (`INTERNAL_ADMIN_SECRET`) for MVP.
- Updated agent-facing docs (`AGENTS.md`, `MVP_BUILD_DOCS/backend-foundation-handoff.md`, `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`, `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`) with explicit secret-vs-config ownership and fake-placeholder prohibition.

Validation:

- `.env.local` remained untracked and unstaged.
- `npm run typecheck`: pass.
- `npm run build`: pass.
- No secret values printed.

---

## 2026-05-29 — Remove unused internal admin secret and internal health endpoint

Purpose: remove dead internal-secret exception and keep only the public health endpoint for MVP.

What changed:

- Removed `app/api/internal/health/route.ts`.
- Removed `INTERNAL_ADMIN_SECRET` schema/helper/presence reporting from `lib/env.ts`.
- Kept `/api/health` as the only active MVP health endpoint.
- Removed active docs/setup requirements that instructed operators to configure or use `INTERNAL_ADMIN_SECRET` and `/api/internal/health`.
- Updated agent-facing rules to explicitly forbid reintroducing internal header-secret health endpoints unless a real admin/internal auth design is explicitly requested and documented.

Validation:

- Repository search confirms no active code references to:
  - `INTERNAL_ADMIN_SECRET`
  - `getInternalAdminEnv`
  - `InternalAdminSchema`
  - `internalAdminSecret`
  - `x-internal-admin-secret`
  - `api/internal/health`
- `npm run typecheck`: pass.
- `npm run build`: pass.
- `.env.local` was not committed and no secret values were printed.

---

## 2026-05-30 — Setup email regression: owner-test fallback shipped as `true`

Symptom: setup links were still being created and the old links still
worked, but no setup email arrived after the env refactor.

Root cause: commit `02bf03a` ("chore: keep local env secret-only") moved
the owner-test setup-link fallback flag from the env var
`OWNER_TEST_SETUP_LINK_FALLBACK` into committed runtime config under
`runtimeConfig.onboarding.ownerTestSetupLinkFallback`. The new committed
default was **`true`**. The `/api/setup-requests` handler short-circuits
to the fallback branch when that helper returns `true`, which skips
`sendSetupLinkEmail` entirely, marks `email_status='owner_test_fallback'`,
and returns success (with `setup_url` in the JSON body). The browser
script doesn't display `setup_url` — it just redirects to `confirm.html`
on `ok:true`, so the form appeared to succeed and no email was sent.

Evidence:

- Controlled production POST to `/api/setup-requests` returned
  `{ ok:true, confirm_url, setup_url }`. The presence of `setup_url`
  proves the fallback branch fired.
- `setup_requests` rows for the owner test email confirm the timeline:
  the last `email_status='sent'` row is at 2026-05-28 22:32 (before the
  refactor); every row after 2026-05-29 21:33 (when commit `02bf03a`
  auto-deployed) is `email_status='owner_test_fallback'`.
- `RESEND_API_KEY` is present on Vercel production (encrypted), so the
  email path would have worked if the route reached it.

Fix:

- `config/runtime.config.ts`:
  `onboarding.ownerTestSetupLinkFallback: true` -> `false`, with a comment
  documenting that production must keep this `false`.
- `app/api/setup-requests/route.ts`: added `console.error` of the Resend
  delivery failure (HTTP status + first 200 chars of upstream body
  excerpt; no secrets, no recipient email, no setup token) so future
  Resend regressions surface in Vercel runtime logs instead of being
  hidden behind the DB `email_status` column.

Validation:

- `npm run typecheck`: pass.
- `npm run build`: pass.
- Owner-only controlled POST after the auto-deploy: response no longer
  includes `setup_url`; latest `setup_requests` row for the owner test
  email shows `email_status='sent'`. (Owner verifies receipt visually in
  inbox.)

Side note: the legacy `OWNER_TEST_SETUP_LINK_FALLBACK` env var is still
present on Vercel but is ignored by the new code path; it can be deleted
at the owner's leisure (no behavior depends on it).

---

## 2026-05-30 — Account setup converted to a settings dashboard + billing gate

UX correction pass on top of the same-day 4-section redesign. The stacked page
became a real **account/settings dashboard**: left section nav + a right panel
showing one active section. Mobile collapses the nav to wrapping tabs (no
horizontal overflow). Persistence behavior from the prior commit is preserved.

Changes:

- `app/setup/[token]/_components/BusinessProfile.tsx` — now a dashboard
  orchestrator (left nav + active panel + status dots; opens the first
  unfinished section).
- New `DocumentsCard.tsx` — the compliance links (business profile / privacy /
  SMS terms) are now their own **Documents** section, removed from SMS approval.
- `SmsApprovalForm.tsx` — removed the "What we'll submit" review block; neutral
  business-type helper ("Select the legal business structure that matches your
  registration."); shorter checkbox copy + "Texting will start after approval."
- `BillingCard.tsx` — real payment-method area: "Payment method needed"/"Added",
  plan, 21-day trial, disabled "Add payment method" CTA (Stripe-ready, no raw
  card storage, no Stripe network call), "You will not be charged until SMS
  recovery is active and your trial period ends."
- `AssignedNumberCard.tsx` — **billing gate:** with no payment method, shows
  "Payment method needed" + "Add a payment method to receive your phone number."
  + CTA (jumps to Billing). No "locked"/"blocked"/"you cannot" wording. With a
  payment method, shows number status + Voice/Calls + SMS/Texting sub-statuses.
- `account-types.ts` + `page.tsx` — added `billing.hasPaymentMethod`, derived
  server-side from `stripe_customer_id` / `billing_status`. No raw card data is
  collected or stored anywhere.
- `AccountUI.tsx` — removed the now-unused `ReviewRow` primitive.
- `app/globals.css` — replaced stacked `.acct-sections` styles with dashboard
  styles (`.acct-layout`, `.acct-nav`, `.acct-panel`, `.acct-callout`).

Payment/card safety: no card number/expiry/CVC field exists anywhere; nothing is
written to the DB for cards; the CTA makes no Stripe call. Real card capture is
deferred to a Stripe-hosted/tokenized flow (SetupIntent/Checkout/Payment Element).

Validation: `npm run typecheck` pass; `npm run build` pass (no `lint` script).
Live click-through not run from this environment (prod DB pooler + needs a real
setup token); persistence unchanged from the prior commit.

Side effects: no SMS sent; `sms_recovery_enabled` unchanged (false); no Stripe
calls/resources; no raw card data stored; Twilio settings/webhooks unchanged; no
number purchased/reserved; no DNS/env/Vercel changes; no migration applied.

Commit: `ef8c29a` (code + most docs), plus a docs follow-up for
`ONBOARDING-WORKFLOW-BUILD-GUIDE.md` and this entry.

Operations docs update needed: yes — updated `OPERATIONS-RUNBOOK.md`,
`ONBOARDING-WORKFLOW-BUILD-GUIDE.md`, and `SMS-APPROVAL-FIELD-MAPPING.md`.

---

## 2026-05-31 — Owner account dashboard clarity polish

Polish pass from live-QA screenshots (no structural change to the dashboard).
Commit `f52100b` (code + .gitignore + field-mapping) plus this docs follow-up.

- **Status system:** added a calmer `needs_setup` status (amber **dot**,
  "Needs setup") in `AccountUI.tsx` and switched all normal incomplete states
  (Business profile, SMS approval, Billing, phone-before-payment) to it. `Needs
  action` (amber **alert**) is now reserved for act-now states (e.g. `Trial
  ended`). No red/danger styling for normal setup; red stays errors-only.
- **Billing:** removed the duplicate status (header badge + competing
  "Payment method needed" row). The payment-method row shows a single
  `Needs setup`; added a secure payment-method visual (card glyph + "No payment
  method on file"). Button/modal stay active and safe; copy flips to "Update
  payment method"/"Payment method on file" when one exists. Still no card fields,
  no storage, no Stripe call.
- **Phone number:** "Not assigned yet" is now muted body text (not a heading);
  the payment-method note is a gentle info callout, not an error block. No "Add
  payment method" button here (only in Billing).
- **SMS approval:** section still marks `Complete` on save, but a new **Texting**
  row shows the real texting state (`Not active`/`Waiting for approval`/`Active`,
  "Starts after approval") so Complete ≠ live texting. Public-page links unchanged.
- **Docs:** appended authoritative current-state sections to
  `ONBOARDING-WORKFLOW-BUILD-GUIDE.md` and `OPERATIONS-RUNBOOK.md` (the prior
  "2026-05-30" inline descriptions were stale — still listed a Documents nav item
  and first-incomplete default). Recorded a roadmap note for a future owner-only
  `SMS & conversation settings` section and the front-desk-workspace separation
  (front desk must not see EIN/legal/billing/SMS-approval/owner settings).
  Neither is built now.
- **Cleanup:** added `*.bak` to `.gitignore` (editor auto-backups were leaking
  into commits); 0 `.bak` files tracked.

Files: `AccountUI.tsx`, `BusinessProfile.tsx`, `BillingCard.tsx`,
`AssignedNumberCard.tsx`, `SmsApprovalForm.tsx`, `app/globals.css`, `.gitignore`,
`ONBOARDING-WORKFLOW-BUILD-GUIDE.md`, `OPERATIONS-RUNBOOK.md`,
`SMS-APPROVAL-FIELD-MAPPING.md`, this entry.

Validation: `npm run typecheck` pass; `npm run build` pass (no `lint`/test
scripts). Live click-through not run from this env (prod DB pooler + needs a real
setup token); status/persistence logic unchanged.

Side effects: no SMS sent; `sms_recovery_enabled` unchanged (false); no Stripe
calls/resources; no raw card data; Twilio settings/webhooks unchanged; no number
purchased/reserved; no DNS/env/Vercel changes; no migration.

Remaining: real Stripe wiring; server-side billing→phone provisioning gate;
future owner-only SMS & conversation settings; separate front-desk workspace.

Operations docs update needed: yes — done (guide + runbook + field-mapping +
this entry).

---

## 2026-05-31 — Read-only front-desk workspace + /account cleanup

Added the first front-desk workspace surface and a focused `/account` cleanup.
No SMS/Twilio/Stripe side effects; no DB migration; read-only.

`/account` cleanup:

- `BillingCard.tsx` — `Free Trial` → `Free trial` casing.
- `BusinessProfile.tsx` — removed the panel-header status badge on **Billing**
  (was duplicated by the Payment-method row) and on **Phone number** (was
  duplicated by the Voice / SMS service rows); Billing subtitle trimmed to
  "Add a payment method to finish setup." (the no-charge note appears once, at
  the bottom). Business profile and SMS approval keep their header badges.
- `app/globals.css` — `html { scrollbar-gutter: stable; }` so the centered
  dashboard panel no longer shifts horizontally between sections.

Front-desk workspace (`/workspace`, read-only):

- New `app/workspace/page.tsx` — server route; gated by the `mcd_account`
  cookie (owner-accessible preview); safe gate message with no context; maps
  conversations → patient request cards.
- New `app/workspace/_components/workspace-types.ts` — `PatientRequestCard`
  shape, conservative `deriveWorkspaceStatus`, status meta, formatting.
- New `app/workspace/_components/Workspace.tsx` — client list + detail +
  empty/selection states; calm status badges; conversation timeline.
- New `lib/db/front-desk.ts` — read-only `listClinicConversations`; selects only
  front-desk-safe columns from `patient_conversations` + `messages` (no
  raw_payload, Twilio SIDs, errors, owner/billing/compliance). No writes.
- New `app/globals.css` `.ws-*` styles.
- New doc `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md`; appended notes to
  `ONBOARDING-WORKFLOW-BUILD-GUIDE.md` and `OPERATIONS-RUNBOOK.md`.

Data-model finding: there is no patient-name / request-type / preferred-time /
summary column anywhere (PHI is intentionally minimized), so those card fields
render `Not provided yet`. Usable today: `patient_conversations` (phone, status,
timestamps) and `messages` (direction, body, timestamps).

Validation: `npm run typecheck` pass; `npm run build` pass (`/workspace` present
as a dynamic route; no `lint`/test scripts). Live click-through not run from this
env (prod DB pooler + needs a real account cookie).

Side effects: no SMS sent; `sms_recovery_enabled` unchanged (false); no Stripe;
no Twilio settings change; no number purchased/reserved; no production mutations
from `/workspace`; no env/DNS/Vercel changes; no migration; `docs/` untouched.

Remaining / next steps: staff authentication + front-desk role; write actions
(reply, call, mark booked/handled, internal notes); proposed `patient_requests`
table if conversation+messages become insufficient; owner-only SMS & conversation
settings in `/account`.

Operations docs update needed: yes — done (`FRONT-DESK-WORKSPACE.md` new;
`ONBOARDING-WORKFLOW-BUILD-GUIDE.md`, `OPERATIONS-RUNBOOK.md`, this entry).

---

## 2026-05-31 — Owner auth foundation (Phase 1)

Implemented the first real authentication foundation for owner accounts while
preserving setup-token fallback to avoid lockouts during rollout.

What changed:

- Added Supabase Auth dependencies:
  - `@supabase/supabase-js`
  - `@supabase/ssr`
- Added Supabase auth helpers:
  - `lib/supabase/config.ts`
  - `lib/supabase/server.ts`
  - `lib/supabase/admin.ts`
- Added membership/auth DB helpers:
  - `lib/db/auth-users.ts`
  - `lib/db/profiles.ts`
  - `lib/db/clinic-memberships.ts`
  - `lib/auth/access.ts`
  - `lib/auth/password.ts`
- Added migration:
  - `supabase/migrations/20260531000100_auth_profiles_memberships.sql`
  - creates `public.profiles` and `public.clinic_memberships`
  - enables RLS + minimal policies for those two new tables only
- Updated onboarding entry screen:
  - `app/setup/[token]/page.tsx`
  - `app/setup/[token]/_components/ClinicForm.tsx`
  - now shows read-only login email + password/confirm fields
  - submit button now `Continue setup`
- Updated setup submit route:
  - `app/api/onboarding/[token]/clinic/route.ts`
  - validates password
  - creates owner auth account when missing
  - upserts `profiles` + `clinic_memberships` owner role
  - establishes authenticated session
  - keeps legacy `mcd_account` fallback cookie
  - handles existing-user case safely with `/login` path
- Added authenticated account save routes:
  - `app/api/account/business-info/route.ts`
  - `app/api/account/a2p/route.ts`
- Added auth routes:
  - `app/api/auth/login/route.ts`
  - `app/api/auth/logout/route.ts`
- Added login UI:
  - `app/login/page.tsx`
  - `app/login/_components/LoginForm.tsx`
- Updated `/account` + `/workspace` guards:
  - auth session + membership is primary path
  - legacy token cookie is temporary fallback
- Added minimal Security section in `/account`:
  - login email
  - password sign-in status
  - sign out button

Files changed (primary):

- `package.json`, `package-lock.json`
- `app/setup/[token]/page.tsx`
- `app/setup/[token]/_components/ClinicForm.tsx`
- `app/setup/[token]/_components/BusinessProfile.tsx`
- `app/setup/[token]/_components/BusinessProfileForm.tsx`
- `app/setup/[token]/_components/SmsApprovalForm.tsx`
- `app/setup/[token]/_components/account-types.ts`
- `app/setup/[token]/_components/SecurityCard.tsx` (new)
- `app/account/page.tsx`
- `app/workspace/page.tsx`
- `app/login/page.tsx` (new)
- `app/login/_components/LoginForm.tsx` (new)
- `app/api/onboarding/[token]/clinic/route.ts`
- `app/api/account/business-info/route.ts` (new)
- `app/api/account/a2p/route.ts` (new)
- `app/api/auth/login/route.ts` (new)
- `app/api/auth/logout/route.ts` (new)
- `lib/db/setup-requests.ts`
- `lib/supabase/config.ts` (new)
- `lib/supabase/server.ts` (new)
- `lib/supabase/admin.ts` (new)
- `lib/db/auth-users.ts` (new)
- `lib/db/profiles.ts` (new)
- `lib/db/clinic-memberships.ts` (new)
- `lib/auth/access.ts` (new)
- `lib/auth/password.ts` (new)
- `supabase/migrations/20260531000100_auth_profiles_memberships.sql` (new)
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` (new)
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
- `MVP_BUILD_DOCS/ONBOARDING-WORKFLOW-BUILD-GUIDE.md`
- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

---

## 2026-06-01 — Admin clinic detail product correction: read-only report deprecated

The prior "owner-dashboard superset (read-only)" direction made
`/admin/clinics/[clinicId]` look too much like a passive technical report.

Vlad clarified the canonical product direction:

- Platform admin must manage the clinic directly from `/admin/clinics/[clinicId]`.
- The target is an editable super-admin clinic management console.
- Owner-level controls must exist directly in admin, scoped by `clinicId`.
- Admin-only tools remain in the same console: diagnostics, audit, internal
  notes, launch controls, and compact technical details.
- Twilio number purchase, A2P carrier submission, and Stripe billing remain
  gated until their real backends exist.
- The next code task is rebuilding the admin clinic page around editable
  management workflows, not expanding read-only data display.

Manual QA status:

- Local static/type/build validation complete.
- Full browser E2E + real Supabase Auth session walkthrough not executed from
  this terminal-only run (requires live token/session click-through).

Side effects avoided:

- no SMS sent
- no Twilio webhook changes
- no Twilio number purchase/reservation
- no Stripe billing/payment behavior changes
- no live SMS activation
- no `docs/` marketing site edits
- no secret values logged/committed

Commit hash: pending (record in final delivery report for this run)  
Push status: pending (record in final delivery report for this run)

Remaining risks / next steps:

- Verify end-to-end setup-link -> password create -> `/account` on live environment.
- Verify returning `/login` flow on fresh browser session.
- Implement phase 2 staff invite flow (`front_desk` membership onboarding).
- Add password reset UI flow (currently support handoff is manual).

Operations docs update needed: yes — done (`AUTH-AND-ACCESS-CONTROL.md` added;
runbook/workflow/workspace/log updated in this pass).

---

## 2026-05-31 — Account access and team/workspace guidance follow-up

What changed:

- Setup first-entry UI (`/setup/{token}`) now uses **Account setup** framing with
  two clear blocks:
  - `Account details`: Clinic name, Main office phone, ZIP code
  - `Account access`: Login email (read-only), Create password, Confirm password
- `/account` navigation now separates setup progress from account settings:
  - `Setup`: Phone number, Business profile, SMS approval, Billing
  - `Account`: Account access, Team access
- Security naming replaced by **Account access** section:
  - read-only login email
  - password status (`Password is set`)
  - `Change password` safe placeholder modal (non-mutating)
  - `Sign out`
- Added owner-only **Team access** UI shell:
  - workspace link model + Open/Copy actions
  - invite form shell (`Front desk` only) with safe placeholder response
  - owner member row from real membership/profile data
  - sample rows when no real staff memberships are present
- Added `/workspace` sample requests when real data is empty:
  - clearly labeled sample cards
  - sample states: needs follow-up, waiting, booked, no appointment booked,
    could not reach patient
  - added minimal result controls preview (non-mutating, sample mode only)
- Added/expanded read-only query helpers for team-member display:
  - list active memberships by clinic
  - list profiles by IDs

Why it changed:

- Improve onboarding clarity by grouping login identity and password together.
- Keep setup progress separate from permanent account settings.
- Provide owner-facing team/workspace guidance safely before invite backend is
  implemented.
- Make empty workspace states understandable without creating fake production
  data.

Files changed:

- `app/setup/[token]/page.tsx`
- `app/setup/[token]/_components/ClinicForm.tsx`
- `app/setup/[token]/_components/account-types.ts`
- `app/setup/[token]/_components/BusinessProfile.tsx`
- `app/setup/[token]/_components/SecurityCard.tsx`
- `app/setup/[token]/_components/TeamAccessCard.tsx` (new)
- `app/account/page.tsx`
- `app/workspace/_components/workspace-types.ts`
- `app/workspace/_components/Workspace.tsx`
- `lib/db/clinic-memberships.ts`
- `lib/db/profiles.ts`
- `app/globals.css`
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`
- `MVP_BUILD_DOCS/ONBOARDING-WORKFLOW-BUILD-GUIDE.md`
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

Side effects avoided:

- no SMS sent
- no outbound reply actions
- no call actions
- no Twilio settings changes
- no number purchase/reservation
- no Stripe billing changes
- no new migrations
- no invite emails sent
- no invite/membership writes from Team access UI
- no sample data persisted
- no secrets/tokens/passwords logged
- public `docs/` marketing pages untouched

Commit hash: `aafd69d`  
Push status: pushed to `main`

Remaining risks:

- Team invite backend/accept lifecycle still missing (intended next phase).
- Full route/API RBAC matrix enforcement remains partial.
- Change-password flow is still placeholder-only in UI.

Next steps:

1. Implement invite token lifecycle + acceptance flow for `front_desk`.
2. Enforce complete route/API role matrix from shared guard utilities.
3. Replace password-change placeholder with secure authenticated update flow.
4. Add server-backed outcome mutation model/routes for workspace results.

Operations docs update needed: yes

---

## 2026-06-01 — Owner login password reset flow

What changed:

- Added real password-reset entry points and routes:
  - `/login` now includes `Forgot password?` link to `/forgot-password`
  - `/forgot-password` page + form
  - `POST /api/auth/forgot-password`
  - `/auth/callback` PKCE exchange route
  - `/reset-password` page + form
  - `POST /api/auth/update-password`
- Added show/hide controls on reset-password form fields.
- Kept login invalid-credential behavior unchanged:
  `Invalid email or password.`

Why it changed:

- remove dead password-reset copy
- provide a real owner self-service recovery flow from login
- keep password management fully in Supabase Auth with safe redirects

Files changed:

- `app/login/_components/LoginForm.tsx`
- `app/forgot-password/page.tsx`
- `app/forgot-password/_components/ForgotPasswordForm.tsx`
- `app/api/auth/forgot-password/route.ts`
- `app/auth/callback/route.ts`
- `app/reset-password/page.tsx`
- `app/reset-password/_components/ResetPasswordForm.tsx`
- `app/api/auth/update-password/route.ts`
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
- `MVP_BUILD_DOCS/ONBOARDING-WORKFLOW-BUILD-GUIDE.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`

Supabase Auth redirect URL settings recorded:

- `https://app.missedcallsdental.com/auth/callback`
- `http://localhost:3000/auth/callback`

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

Manual QA:

- `/login` forgot-password link wiring: implemented
- `/forgot-password` generic success UX: implemented
- reset redirect target: `/auth/callback?next=/reset-password` implemented
- callback safe-redirect guard: implemented (internal relative paths only)
- `/reset-password` session gate: implemented
- password mismatch + weak-password errors: implemented
- full live email-delivery/recovery-link verification in production: pending

Side effects avoided:

- no Team access or invite flow changes
- no workspace behavior changes
- no Twilio/SMS changes
- no Stripe changes
- no migrations
- no marketing `docs/` changes
- no password/token/reset-link logging

Commit hash: `6325424`  
Push status: pushed to `main`

Remaining risks:

- Supabase Auth redirect allow list must include both callback URLs or recovery
  links may fail.
- End-to-end live verification depends on mailbox access for a real owner
  account.

Next steps:

1. Verify recovery email + callback end-to-end in production with a real owner account.
2. Replace `/account` password placeholder with an in-session change-password flow when scoped.

Operations docs update needed: yes

---

## 2026-06-01 — Production setup submit error fix (`/setup/{token}`)

What changed:

- Investigated production setup submit failure after `Continue setup`.
- Verified Vercel production logs for
  `POST /api/onboarding/[token]/clinic` and found:
  `relation "public.profiles" does not exist` (Postgres `42P01`).
- Applied missing auth/membership migration directly to production DB:
  `supabase/migrations/20260531000100_auth_profiles_memberships.sql`.
- Added minimal route hardening in
  `app/api/onboarding/[token]/clinic/route.ts`:
  - wraps `upsertProfile` + `upsertClinicMembership` with guarded error
    handling
  - returns structured JSON error code `account_link_failed` on failure
    instead of unhandled 500.
- Added minimal client hardening in
  `app/setup/[token]/_components/ClinicForm.tsx`:
  - safe JSON parsing for submit response (`res.json().catch(...)`) so non-JSON
    500 responses do not trigger misleading generic network error handling.

Why it changed:

- Root cause was a production migration mismatch, not Twilio/Stripe/design.
- The missing `public.profiles` table caused server 500 and bubbled to the
  setup form as `We couldn't reach the server.`.

Files changed:

- `app/api/onboarding/[token]/clinic/route.ts`
- `app/setup/[token]/_components/ClinicForm.tsx`
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`

Production verification performed:

- Vercel logs query:
  `vercel logs app.missedcallsdental.com --since 2h --json`
  confirmed prior 500 root cause.
- DB verification query confirmed table existence after migration:
  `to_regclass('public.profiles')`, `to_regclass('public.clinic_memberships')`.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

Side effects avoided:

- no Team access/workspace feature work
- no Stripe changes
- no Twilio/SMS changes
- no new schema beyond applying already-committed auth migration
- no secret/token/password logging

Commit hash: `3333a5e`  
Push status: pushed to `main`

Remaining risks:

- Existing setup-link flows still depend on correct DB migration state across
  environments.
- Invite lifecycle/result persistence remain separate future phases (unchanged).

Next steps:

1. Add preflight environment/migration verification checklist before promoting
   onboarding/auth changes.
2. Keep route-level structured error responses for setup/auth mutations.

Operations docs update needed: yes

---

## 2026-06-01 — Setup form wording simplification (first-entry only)

What changed:

- Updated first setup form copy/layout in
  `app/setup/[token]/_components/ClinicForm.tsx`:
  - `Clinic information` -> `Business information`
  - `Business name` label with placeholder `Example: Smile Dental`
  - `Business phone` label with placeholder `(555) 123-1234`
  - added read-only `Country` field with value `United States`
  - kept `Sign-in` section with read-only `Login email`,
    `Create password`, `Confirm password`
  - kept primary action `Continue setup`
- Removed duplicate in-card heading so `Account setup` appears once on page
  (shell heading only).
- Removed extra customer-facing setup helper copy to keep the form minimal.
- Added phone formatting while typing to `(555) 123-1234`.
- Added standard show/hide controls for both password fields (default hidden).

Why it changed:

- simplify first-entry setup copy
- reduce repeated account wording
- align visible form structure with current product wording

Files changed:

- `app/setup/[token]/_components/ClinicForm.tsx`
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`
- `MVP_BUILD_DOCS/ONBOARDING-WORKFLOW-BUILD-GUIDE.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

Side effects avoided:

- no backend behavior changes
- no migrations
- no Twilio/Stripe/SMS changes
- no workspace/team/login flow changes
- no marketing `docs/` changes

Commit hash: `45c32cc`  
Push status: pushed to `main`

Remaining risks:

- none identified for this scoped UI/copy-only pass

Next steps:

1. Implement real team invite lifecycle in dedicated backend phase.
2. Implement workspace result persistence in dedicated backend phase.

Operations docs update needed: yes

---

## 2026-06-01 — Setup page copy/layout simplification

What changed:

- Simplified setup form copy and structure to exactly:
  - `Account setup` (single page heading in shell only)
  - `Clinic information` section
  - `Sign-in` section
  - `Continue setup`
- Removed duplicate `Account setup` heading from inside the setup card/form.
- Renamed setup section labels:
  - `Account details` -> `Clinic information`
  - `Account access` -> `Sign-in`
- Kept login email read-only in the sign-in section.
- Simplified form layout to a single clean card using section spacing + divider
  (removed nested inset subsection boxes in this form only).

Why it changed:

- reduce repeated “Account” wording
- keep first-entry setup scan-friendly and minimal
- align visible structure with explicit product copy requirements

Files changed:

- `app/setup/[token]/_components/ClinicForm.tsx`

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

Side effects avoided:

- no backend/auth/session behavior changes
- no Twilio/SMS/Stripe changes
- no DB changes/migrations
- no token/password logging changes

Commit hash: `5b6dfaf`  
Push status: pushed to `main`

Remaining risks:

- none identified for this narrow copy/layout-only change

Next steps:

1. Continue with team invite backend phase (separately scoped).
2. Continue with workspace result persistence phase (separately scoped).

Operations docs update needed: yes

---

## 2026-05-31 — Remaining copy/UI cleanup (account + workspace)

What changed:

- Setup page copy cleanup:
  - removed extra subtitle under `Account setup`
  - kept `Account details` and `Account access`
  - updated fallback error copy to:
    `Could not save your account setup. Please check your entries.`
  - updated shared setup shell heading from `Office setup` to `Account setup`
- Account header cleanup:
  - reduced subtitle to `Texting starts after approval.`
- Component naming cleanup:
  - renamed `app/setup/[token]/_components/SecurityCard.tsx`
  - to `app/setup/[token]/_components/AccountAccessCard.tsx`
  - updated imports accordingly
- Login cleanup:
  - removed unfinished `Need password reset help?` link
- Team access sample block cleanup:
  - real members remain in primary team table
  - sample rows moved into separate `Sample staff examples` block
  - sample block can be hidden/shown using browser-only `localStorage`
  - sample action labels simplified to `Remove` / `Restore`
  - owner action remains `—`
- Workspace cleanup:
  - conversation collapsed by default behind `View conversation`
  - sample request copy made neutral (no medical complaint examples)
  - result preview replaced with `Appointment booked?` -> `Yes` / `No`
  - note field + `Save result` button retained as non-mutating UI
  - removed customer-facing developer preview/future notes
- Status label cleanup:
  - `Needs reply` no longer surfaced as active derived label
  - simplified visible labels toward: Needs follow-up, Waiting for patient,
    Appointment booked, No appointment booked, Closed

Why it changed:

- simplify customer-facing copy
- keep setup and account language consistent
- separate real access rows from demo rows for safer interpretation
- make workspace detail scanning faster and less noisy

Files changed:

- `app/setup/[token]/_components/ClinicForm.tsx`
- `app/setup/[token]/_components/PageShell.tsx`
- `app/page.tsx`
- `app/setup/[token]/_components/BusinessProfile.tsx`
- `app/setup/[token]/_components/AccountAccessCard.tsx` (renamed)
- `app/setup/[token]/_components/TeamAccessCard.tsx`
- `app/login/_components/LoginForm.tsx`
- `app/workspace/_components/workspace-types.ts`
- `app/workspace/_components/Workspace.tsx`
- `app/globals.css`
- `MVP_BUILD_DOCS/SETUP-LOG.md`
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
- `MVP_BUILD_DOCS/ONBOARDING-WORKFLOW-BUILD-GUIDE.md`
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`
- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md`

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

Side effects avoided:

- no SMS sent
- no outbound replies
- no patient calls
- no Twilio changes
- no Stripe changes
- no phone number purchase/reservation
- no invite backend or invite email sending
- no result persistence routes
- no DB migrations
- no sample data persisted
- no secret/token/password logging
- no public `docs/` marketing edits

Commit hash: `23df3e7`  
Push status: pushed to `main`

Remaining risks:

- Team invite lifecycle remains next-phase work
- Workspace results remain non-persistent UI
- Full RBAC completion remains next-phase work

Next steps:

1. Implement real team invite lifecycle (create/send/accept) with role-aware membership writes.
2. Add server-backed workspace result persistence with guarded mutation endpoints.
3. Complete route/API RBAC matrix enforcement for owner/front-desk/admin boundaries.

Operations docs update needed: yes

---

## 2026-06-01 — Password reset email: production routing + branded Supabase Auth SMTP (Resend)

**What changed (this task):** documentation + operator configuration handoff.
No application code changed — the reset flow code was already correct.

**Reported symptom:** production password reset email delivered, but the reset
link pointed to `http://localhost:3000`, and the email came from the default
Supabase sender `noreply@mail.app.supabase.io` (not acceptable for production
branding).

**Root cause (verified in code):**

- App code is correct. `POST /api/auth/forgot-password` builds
  `redirectTo = https://app.missedcallsdental.com/auth/callback?next=/reset-password`
  from `getAppDomains()` → `runtimeConfig.app.appBaseUrl`
  (`config/runtime.config.ts`). It never reads a localhost value.
  `APP_BASE_URL` (env) is not read by any code path (grep-confirmed; only a stale
  comment in `lib/onboarding/tokens.ts`), so Vercel env cannot inject localhost
  into the reset link.
- The localhost link is produced by **Supabase Auth**: GoTrue ignores an emailed
  `redirect_to` that is not in the Auth **Redirect URLs** allow list and falls
  back to the project **Site URL** for `{{ .ConfirmationURL }}`. The Site URL was
  still the dev default `http://localhost:3000`.
- The unbranded sender is because Supabase Auth **Custom SMTP was not configured**
  (using the shared default sender).

**Files changed (docs only):**

- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` — section 10 rewritten as the
  canonical Supabase Auth URL + Custom SMTP (Resend) configuration reference.
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — added the password-reset email routing
  + branded SMTP operations section and bumped the header date.
- `MVP_BUILD_DOCS/SETUP-LOG.md` — this entry.

**Dashboard settings to change (operator action — NOT performable from the repo
CLI; no MCP tool exists for Supabase Auth URL/SMTP config):**

- Supabase → Authentication → URL Configuration:
  - Site URL → `https://app.missedcallsdental.com` (was `http://localhost:3000`)
  - Redirect URLs allow list → add
    `https://app.missedcallsdental.com/auth/callback` and keep
    `http://localhost:3000/auth/callback` (local dev only).
  - Then send a FRESH reset email (old emails keep the localhost link).
- Supabase → Authentication → Emails (Custom SMTP), Resend:
  - Host `smtp.resend.com`, Port `465`, Username `resend`, Password = Resend
    SMTP credential / API key (never printed/committed).
  - Sender `no-reply@missedcallsdental.com`, Name `Missed Calls Dental`.
  - Requires the sending domain verified in Resend. The setup-email path already
    uses the verified subdomain `mail.missedcallsdental.com`; the root domain
    `missedcallsdental.com` may need separate Resend/DNS verification. Safe
    interim branded sender if only the subdomain is verified:
    `Missed Calls Dental <no-reply@mail.missedcallsdental.com>`.
- Supabase → Authentication → Email Templates → Reset Password: keep the default
  `{{ .ConfirmationURL }}` placeholder; no hardcoded localhost/tokens/links.

**Vercel:** no change needed for this fix. App base URL for the reset link is
committed runtime config, not a Vercel env var. Production does not use localhost
for the reset redirect. (`APP_BASE_URL` listed in older env docs is unused by
current code; left as-is to avoid unrelated churn.)

**Validation commands/results:**

- `npm run typecheck`: pass.
- `npm run build`: pass.
- No `lint` script; no test script.

**Live reset E2E result:** NOT run from the repo CLI (requires the Supabase
dashboard changes above, a real inbox, and a browser). Pending operator run:
`/login` → Forgot password? → submit owner email → confirm branded sender →
confirm link is `https://app.missedcallsdental.com/...` (not localhost) →
through `/auth/callback` → `/reset-password` → set new password → login → `/account`.
Per security rule, the full reset link and recovery token must not be pasted into
logs/reports.

**Side effects avoided:** no Twilio/Stripe/SMS changes; no DB migration; no
workspace/result-persistence changes; `sms_recovery_enabled` unchanged (false);
no `.env.local` commit; no secrets printed; `docs/` marketing untouched.

**Commit hash:** `b163ecd` (`fix: configure password reset email routing`);
metadata recorded by follow-up `docs: record password reset email routing commit metadata`.
**Push status:** pushed to `origin/main`.

---

## 2026-06-01 — Supabase Auth URL + Resend SMTP APPLIED via Management API

Applied the password-reset email configuration programmatically using the
Supabase Management API with a temporary `SUPABASE_ACCESS_TOKEN` read from local
`.env.local` (value never printed, logged, or committed).

Endpoint: `PATCH https://api.supabase.com/v1/projects/qfjpvbvfvhbtebwivcdc/config/auth`

**BEFORE (GET):** `site_url = http://localhost:3000`, `uri_allow_list = ''`
(empty), SMTP unset. This confirms the root cause: an empty redirect allow list
made GoTrue fall back to the localhost Site URL for `{{ .ConfirmationURL }}`,
producing localhost reset links. App code was never the cause.

**APPLIED + independently re-verified (second GET, HTTP 200):**

- `site_url = https://app.missedcallsdental.com`
- `uri_allow_list = https://app.missedcallsdental.com/auth/callback,http://localhost:3000/auth/callback`
- `smtp_host = smtp.resend.com`
- `smtp_port = 465`
- `smtp_user = resend`
- `smtp_pass` = set (Resend API key from local env; value not stored anywhere in docs)
- `smtp_admin_email = no-reply@mail.missedcallsdental.com`
- `smtp_sender_name = Missed Calls Dental`
- `external_email_enabled = true`

**Sender used:** `Missed Calls Dental <no-reply@mail.missedcallsdental.com>` —
the Resend subdomain already verified for setup emails. Root sender
`no-reply@missedcallsdental.com` deferred (root-domain Resend verification is a
later improvement, not a blocker).

**Ops gotcha (recorded):** the Supabase Management API is behind Cloudflare. A
`python-urllib` PATCH was blocked with HTTP 403 + Cloudflare `error code: 1010`
(client-signature block); the same write via **curl** succeeded (GET worked from
either client). Use curl for Management API writes.

**Fresh reset email:** `POST /api/auth/forgot-password` (production) for the
owner email returned `200` generic success, so Supabase was asked to send a fresh
recovery email via the new Resend SMTP sender.

**Live E2E (browser + inbox): NOT performed from the repo CLI** (no browser/inbox
in this environment — not fabricated). Remaining operator verification:

- email From shows `Missed Calls Dental <no-reply@mail.missedcallsdental.com>`;
- reset link host is `app.missedcallsdental.com` (not localhost);
- link → `/auth/callback` → `/reset-password` → set new password → login →
  `/account`. Never paste the reset link or token anywhere.

**Files changed:** docs only (this entry; `AUTH-AND-ACCESS-CONTROL.md` §10
applied-status note; `OPERATIONS-RUNBOOK.md` reset section). `.env.local.example`
adds the `SUPABASE_ACCESS_TOKEN` name (no value). No app code changed.

**Validation:** `npm run typecheck` pass; `npm run build` pass.

**Side effects avoided:** no Twilio/Stripe/SMS; no DB migration; no team/workspace
changes; `sms_recovery_enabled` unchanged (false); `docs/` untouched;
`.env.local` not committed; no secrets printed.

**Security follow-up — REVOKE/ROTATE the token:** the temporary
`SUPABASE_ACCESS_TOKEN` should be revoked or rotated now that this task is done
(Supabase Dashboard → Account → Access Tokens). It was used only for this
auth-config change. Remove it from local `.env.local` afterward.

**Commit hash / push:** `0b05e18` (`fix: apply auth email configuration`),
pushed to `origin/main`. Metadata recorded by follow-up
`docs: record auth email configuration commit metadata`.

---

## 2026-06-01 — Docs cleanup: SMTP password wording (secret-scan false positives)

- Updated `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` Custom SMTP (Resend) guidance
  to remove credential-like password wording.
- Replaced SMTP password lines with non-secret operator instructions:
  leave provider value unchanged and never store SMTP passwords in docs.
- No source code changes. No secrets added.

---

## 2026-06-01 — Reset email phishing-target fix (app-domain token_hash link)

**Problem:** Gmail flagged the password reset email as phishing. The sender brand
is Missed Calls Dental, but the reset button's first-hop target was a raw Supabase
project-ref URL — `https://qfjpvbvfvhbtebwivcdc.supabase.co/auth/v1/verify...` —
generated by the default `{{ .ConfirmationURL }}` placeholder. Brand/target
mismatch trips Gmail's heuristic.

**Fix (two parts):**

1. **Recovery email template** (Supabase Management API,
   `mailer_templates_recovery_content`) changed from `{{ .ConfirmationURL }}` to:

   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
   ```

   Subject branded: `Reset your Missed Calls Dental password`. Independently
   re-verified by GET: recovery content no longer contains `ConfirmationURL` and
   contains the new SiteURL/token_hash pattern. `site_url` unchanged =
   `https://app.missedcallsdental.com`, so the rendered first hop is the app
   domain.

2. **`app/auth/callback/route.ts`** now supports BOTH flows:
   - existing PKCE `?code` → `exchangeCodeForSession(code)` (unchanged);
   - new `?token_hash=...&type=recovery` → `verifyOtp({ token_hash, type })`,
     which establishes the session cookies, then redirects to the safe `next`
     (`/reset-password`). `type` is validated against the EmailOtpType set;
     unknown/missing params fall through to `/login?error=invalid_or_expired_link`.

**Result:** the reset link visible/clicked in Gmail now starts with
`https://app.missedcallsdental.com/auth/callback?...` (app domain), not
`https://qfjpvbvfvhbtebwivcdc.supabase.co/...`.

**Deployment ordering (important):** the template change is live on Supabase
immediately. The callback code change goes live via this push → Vercel deploy.
The `token_hash` link only *completes* the reset once the new deployment is READY.
A fresh reset email was triggered after deploy so the operator can both confirm
the branded Gmail target and complete the click-through.

**Files changed:** `app/auth/callback/route.ts` (code);
`MVP_BUILD_DOCS/{SETUP-LOG,AUTH-AND-ACCESS-CONTROL,OPERATIONS-RUNBOOK}.md` (docs).

**Validation:** `npm run typecheck` pass; `npm run build` pass; fresh reset email
generated (`POST /api/auth/forgot-password` → HTTP 200 generic success).

**Live E2E (browser + inbox):** operator confirms (a) Gmail link target starts
with `app.missedcallsdental.com`, and (b) after the new deploy is READY: link →
`/auth/callback` → `/reset-password` → set password → login → `/account`. Reset
link/token never exposed.

**Side effects avoided:** no Twilio/Stripe/SMS; no DB migration; no team/workspace
changes; `sms_recovery_enabled` unchanged (false); `docs/` untouched; `.env.local`
not committed; no secrets/tokens/links/keys printed.

**Token hygiene:** the temporary `SUPABASE_ACCESS_TOKEN` (used for the template
PATCH) should still be revoked/rotated after this task.

**Deploy:** commit `13eeddb` deployed to production
(`dpl_CsNiPpo82RtDFbRjvK9RBAEt8q8M`, state READY, aliased to
`app.missedcallsdental.com`); the `token_hash` callback flow is live. A fresh
reset email was triggered post-deploy so the link works end-to-end.

**Commit hash / push:** `13eeddb` (`fix: route reset email link through app
domain`), pushed to `origin/main`. Metadata recorded by the follow-up
`docs: record reset email phishing fix commit metadata`.

---

## 2026-06-01 — Auth login + reset UX polish (4 fixes)

Scope: reset-password UX, login page design + consolidation, reset email Gmail
copy. No schema/migration; no Twilio/Stripe/SMS; no secrets exposed.

**Fix 1 — reset strong-password popup:** Show/Hide on `/reset-password` no longer
toggles the input `type`. The input stays `type="password"` and visibility flips
via `-webkit-text-security` (`ResetPasswordForm` `REVEAL_STYLE`). Chrome no longer
re-offers "Use strong password" on a field that already has text; the input is not
remounted and key/value/name/id/autocomplete are unchanged. (Firefox lacks
`-webkit-text-security`, so "Show" leaves the field masked there — acceptable; the
stated target is Chrome/Google Password Manager.)

**Fix 2 — reset Save Password username:** `/reset-password` now renders a read-only
account email field (`autocomplete="username"`, value from the recovery session
`getUser().email`) ahead of the two `autocomplete="new-password"` fields, so Chrome
saves the credential as email + new password. The email is read-only (reset cannot
change the account email). No tokens in UI/logs/URLs.

**Fix 3 — one canonical sign-in:** the real login stays at
`https://app.missedcallsdental.com/login`, redesigned to match the marketing
sign-in (brand header, centered card, footer legal links) using shared design
tokens + new `.auth-*` classes in `app/globals.css`. `docs/sign-in.html` is now a
safe redirect/handoff to the app login (meta refresh + JS replace + fallback link,
noindex, canonical to app login). The Sign in nav link on all marketing pages
(contact, how-it-works, index, pricing, privacy, sms-consent, terms) now points to
the app login. Real auth behavior unchanged.

**Fix 4 — reset email Gmail row:** subject is now exactly `Reset your password`
(brand removed from the subject; the sender already shows Missed Calls Dental). The
body no longer starts with another "Reset your password"; the snippet begins
"We received a request to reset the password for your account." The app-domain
token_hash reset link is preserved. Applied via the Management API
(mailer_subjects_recovery, mailer_templates_recovery_content); re-verified by GET.
Supersedes the earlier subject "Reset your Missed Calls Dental password".

**Files changed:** app/login/page.tsx, app/reset-password/page.tsx,
app/reset-password/_components/ResetPasswordForm.tsx, app/globals.css,
docs/sign-in.html, the seven marketing pages above, plus docs (this entry, runbook,
checklist, auth doc).

**Validation:** npm run typecheck pass; npm run build pass.

**Manual QA remaining (browser/inbox — operator):** (1) type partial password, blur,
Show/Hide, refocus then confirm no strong-password popup when the field has text;
(2) complete a reset then confirm Chrome "Save password?" shows the account email as
username, login works, lands on /account; (3) sign-in.html redirects to the app
login, marketing Sign in opens the app login, forgot-password works; (4) fresh reset
email shows From Missed Calls Dental, subject "Reset your password", snippet
"We received...".

**Side effects avoided:** no Twilio/Stripe/SMS; no migration; sms_recovery_enabled
unchanged (false); no secrets/tokens/links printed or committed; .env.local not
committed; no marketing image changes.

**Commit hash / push:** `a83c99d` (`fix: polish auth login and reset flows`),
pushed to `origin/main`. Metadata recorded by the follow-up
`docs: record auth polish commit metadata`.

---

## 2026-06-01 — Workspace outcomes are saveable (real cards) + sample layer

Made `/workspace` a real front-desk workspace: real patient request cards can save
an outcome + note to Supabase; sample cards are a clearly separated, non-persistent
training layer.

**Migration:** `supabase/migrations/20260601000100_front_desk_outcome.sql` — adds to
`public.patient_conversations`: `front_desk_outcome text`, `front_desk_note text`,
`front_desk_outcome_at timestamptz` (all nullable). Check constraints:
`front_desk_outcome` in (`appointment_booked`, `no_appointment_booked`,
`could_not_reach_patient`) or null; `char_length(front_desk_note) <= 300` or null.
Additive + idempotent; **applied to production via the Supabase Management API**
(`POST /v1/projects/qfjpvbvfvhbtebwivcdc/database/query`, curl; token from local
`.env.local`, never printed). Verified: 3 columns + 2 constraints present. No data
reset/deleted/rewritten/backfilled.

**Outcome → status mapping** (conversation status check is open|closed|booked|lost):
`appointment_booked → booked`, `no_appointment_booked → lost`,
`could_not_reach_patient → closed`. A saved outcome is the primary source of a real
card's status; with no saved outcome we keep the conservative timeline/lifecycle
derivation.

**Server/API:** new `POST /api/workspace/outcome` (`{conversationId, outcome, note}`).
Auth via `resolveAuthClinicAccess` (owner/admin/front_desk allowed). Update is
clinic-scoped (`where id = $conversationId and clinic_id = $clinic`) so only the
session's clinic conversations can change. Rejects sample IDs and non-UUIDs.
Validates outcome enum + 300-char note server-side; trims note; empty note stored
as NULL. Clear JSON errors, no internals leaked.

**Data access:** `lib/db/front-desk.ts` reads the three outcome fields (still
minimum-necessary; no owner/billing/compliance/Twilio/raw-payload exposure) and
adds the clinic-scoped `saveFrontDeskOutcome` write helper. Shared outcome
constants in `lib/workspace/outcome.ts`.

**UI:** `Workspace.tsx` — real cards first; a separate, clearly labeled `Sample
requests` section below with a stronger info banner and a `Hide` button. Hiding
collapses the entire sample section to a compact strip `Sample requests hidden ·
Show samples`; `Show samples` restores it (local state only; never affects real
cards). Empty state `No real patient requests yet.` when no real cards and samples
hidden. Real cards have a working outcome form (3 radios + `Note` with
`Optional short note.` helper, `0/300` counter, `Note must be 300 characters or
less.` validation, `Result saved.` success, loading state, inline recoverable
error). Saved outcome/note prefill and persist across refresh. Sample cards show a
**disabled, non-persistent** outcome preview labeled `Sample preview · not saved` —
no active Save, no support modal. **The old `Please contact support to save
workspace results.` modal is removed.**

**Validation:** `npm run typecheck` pass; `npm run build` pass (`/api/workspace/outcome`
emitted; `/workspace` builds).

**Manual QA remaining (browser — operator):** load `/workspace` (samples by default);
Hide → only compact strip; Show samples restores; real cards (when present) above
samples and unaffected by Hide; save outcome+note on a real card; refresh and confirm
it persists; note >300 rejected client + server; samples never write; old modal gone.

**Side effects avoided:** no Twilio/Stripe/SMS; no auth/Vercel/env changes; only the
additive migration touched the DB (no customer data altered); `.env.local` not
committed; no secrets printed.

**Commit hash / push:** `575a975` (`fix: make workspace outcomes saveable`),
pushed to `origin/main`. Metadata recorded by the follow-up
`docs: record workspace outcomes commit metadata`.

---

## 2026-06-01 — Setup links are idempotent (no password form after account exists)

**Bug:** reopening a used `Complete your setup` link
(`/setup/{token}`) re-rendered the account/password form even though the account
and password were already created. Root cause: `lookupSetupRequestByRawToken`
only treats `setup_requests.status = 'active'` as completed, but the completion
path sets `clinic_details_completed` after creating the clinic + owner auth user,
so the lookup returned `ok` and the form rendered again.

**Canonical completed marker (no migration):** an **owner auth account exists**
for the setup request's `owner_email` (`findAuthUserByEmail`). The form's only job
is to create that account + password, so once it exists setup is complete. This is
reliable for old links too (no backfill needed) and cannot be bypassed by
reopening a stale email link. New helper: `isSetupAlreadyCompleted(ownerEmail)` in
`lib/onboarding/verify.ts`.

**Behavior now:**

- Invalid/expired/cancelled token → unchanged invalid-link card.
- Completed setup + signed in → **server-side redirect to `/account`** (via
  `supabase.auth.getUser()`, not client-only).
- Completed setup + signed out → no-password completed-state card:
  title `Account setup is already complete`, body `Sign in to continue to your
  account.`, primary button `Sign in` → `/login`.
- First-time, not-yet-created → the existing onboarding form (office + password)
  is unchanged.
- The `status = 'active'` terminal case (lookup reason `completed`) is routed to
  the same completed-state flow.

**Server-side enforcement:** `POST /api/onboarding/[token]/clinic` now returns the
completed state (`{ ok:true, completed:true, redirect }`) when the owner account
already exists — before any writes — so a re-submitted/stale token cannot create a
duplicate auth user, overwrite the password, duplicate clinic data, or rerun
setup. The client form routes to the returned redirect.

**Files changed:** `lib/onboarding/verify.ts`,
`app/setup/[token]/page.tsx`, `app/setup/[token]/_components/SetupComplete.tsx`
(new), `app/api/onboarding/[token]/clinic/route.ts`, plus docs.

**Migration:** none (existing auth-account marker used).

**Validation:** `npm run typecheck` pass; `npm run build` pass.

**Manual QA remaining (browser — operator):** fresh link → normal setup works;
complete once; reopen while signed in → `/account`; sign out; reopen → completed
card + `Sign in` (no password fields); `Sign in` → `/login`; repeated POST cannot
duplicate account/clinic/password; invalid/expired token still handled.

**Security:** setup token never logged/printed; the completion check uses only
`owner_email` (token is not passed to it); no new account/admin data exposed.

**Side effects avoided:** no Twilio/Stripe/SMS; no Supabase auth/Vercel/env
changes; no DB migration; `.env.local` not committed; no secrets printed.

**Commit hash / push:** `70635a2` (`fix: make setup links idempotent`), pushed to
`origin/main`. Metadata recorded by the follow-up
`docs: record setup idempotency commit metadata`.

---

## 2026-06-01 — Production-readiness placeholder audit

Audit-only pass (no feature behavior changed). Inventoried every UI action,
route, sample block, and doc statement that implies the product works when it is
a placeholder, sample, blocked, partially wired, or not implemented. Full
inventory + priority sequence + next-5 tasks:
`MVP_BUILD_DOCS/PRODUCTION-READINESS-PLACEHOLDER-AUDIT.md` (canonical current
real-vs-placeholder reference).

Headline placeholders/gaps (do not treat as working):

- Billing `Add/Update payment method` → inert modal; no Stripe collect/charge;
  `hasPaymentMethod` effectively always false (`stripe_customer_id` never set).
- Team access `Send invite` and sample Remove/Restore → "contact support" modals;
  no invite backend.
- Account access `Change password` → placeholder modal (forgot-password works).
- Phone number assignment blocked: purchase gated off (`503 purchase_disabled`),
  "prepare" is search-only; billing→phone gate is presentational (no server
  enforcement).
- A2P/carrier registration not submitted (status "Waiting for approval" is local
  only); live SMS recovery gated off by config + per-clinic flag (intentional).

Working (verified real): auth (login/logout/forgot/reset/callback), setup-link
idempotency, onboarding capture + owner account creation, business-profile /
SMS-approval saves, account dashboard display, workspace outcome saving, public
business pages, Twilio voice/SMS webhooks + opt-out, marketing handoff, Stripe
webhook ingress (signature verify + idempotent record, no billing logic yet).

Doc fixes this pass (materially misleading only): `PROJECT-CONTEXT.md` §11 (voice
now verified, Twilio Full) and §16 (point to this audit); `MANIFEST.md` now
references this audit + the auth/front-desk docs. No source behavior changed.

Validation: `npm run typecheck` pass; `npm run build` pass. `package.json` has no
`lint`/`test` script (only dev/build/start/typecheck).

Commit hash / push: `ce401ea` (`docs: audit production readiness placeholders`),
pushed to `origin/main`. Metadata recorded by the follow-up
`docs: record placeholder audit commit metadata`.

---

## 2026-06-01 — Trust fix: remove misleading account placeholders

Removed active UI actions that implied working SaaS features but opened fake
"contact support" / "will open here" modals. Scope-limited: no Stripe, staff
invite backend, phone purchase, or A2P built this pass.

- **Change password — now REAL.** New `POST /api/account/change-password`
  (auth + verify current password on a throwaway client + `updateUser`). New real
  modal in `AccountAccessCard.tsx` (current/new/confirm, Show/Hide, inline errors,
  `Password updated.`). Reuses `lib/auth/password.ts`. Reset/login/logout
  untouched. See `AUTH-AND-ACCESS-CONTROL.md` §16.
- **Billing — honest, still not connected.** Removed the fake payment modal;
  `BillingCard.tsx` now shows a disabled `Payment setup not connected yet` button
  + helper (no Stripe call). Plan/trial/status display kept.
- **Team invite — honest, still not connected.** Removed the
  `Please contact support to add staff access.` modal; `TeamAccessCard.tsx` shows
  a disabled email preview + disabled `Staff invitations not connected yet` +
  helper. No email/invite/user/membership created.
- **Sample/real team actions — no fake modals.** Removed the
  `Please contact support to update staff access.` modal. Sample staff actions
  render as plain text (labeled `Sample`); real member actions render `—`.
- **Marketing.** Removed the dead, unreachable sign-in demo handler from
  `docs/script.js` (`sign-in.html` already redirects to app `/login`). Trial form
  + redirect handoff unchanged.

Validation: `npm run typecheck` pass; `npm run build` pass (no `lint`/`test`
script). No secrets touched; no Stripe/Twilio/email/SMS calls; `.env.local`
unchanged.

Still intentionally not connected (future tasks): Stripe billing/payment method,
staff invitation backend, phone number reservation/purchase, A2P/carrier
submission. See `PRODUCTION-READINESS-PLACEHOLDER-AUDIT.md`.

Commit hash / push: `97d416b` (`fix: remove misleading account placeholders`),
pushed to `origin/main`. Metadata recorded by the follow-up
`docs: record account placeholder trust-fix metadata`.

---

## 2026-06-01 — Platform admin console: architecture/spec (docs only)

Planning-only pass (no code, no migration, no behavior change). Wrote
`MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` — the spec for a future internal
platform-owner console at `/admin` (cross-tenant; distinct from clinic `/account`
and front-desk `/workspace`).

Key recommendations:

- **Access model:** hybrid bootstrap — env/config allowlist `PLATFORM_ADMIN_EMAILS`
  + the existing (currently unused) `profiles.is_internal_admin` flag. New
  server guard `resolvePlatformAdmin` (separate from `resolveAuthClinicAccess`,
  which requires a clinic membership). Clinic `owner`/`front_desk` never grant
  platform access. **No migration needed to start.**
- **Data model:** existing tables already support a useful **read-only** admin v1
  with no migration (clinics has all status/lifecycle/billing/A2P fields; messages
  /call_events/webhook_events/opt_outs/memberships/profiles cover diagnostics). The
  only new schema (Phase 2, for writes) is `admin_audit_events` + a small
  `clinics.admin_internal_note`.
- **v1 scope:** real read-only console (overview, clinics list, clinic detail,
  events) — no migration. Phase 2 adds audit log + safe writes (note,
  deactivate/reactivate, disable SMS recovery, resend setup link, assign owned
  number). Billing/number-purchase/enable-live-SMS stay blocked behind Stripe /
  Twilio purchase / A2P — never faked.
- **Safety:** service-role reads only behind the admin guard; redact raw
  payloads/tokens/secrets; audit + confirm + idempotency + rollback for writes;
  `/admin` is purely additive and must not touch `/account`, `/workspace`,
  onboarding, webhooks, or SMS gates.

Index updates: `MANIFEST.md` references the plan; `PRODUCTION-READINESS-PLACEHOLDER-AUDIT.md`
gets a one-line pointer. Recommended next implementation prompt:
"feat: read-only platform admin console (access guard + clinics overview/detail/events)".

Validation: docs-only (`git diff --check` clean; no source files changed, so no
typecheck/build needed). Commit hash / push: `214b70f`
(`docs: plan platform admin console`), pushed to `origin/main`. Metadata recorded
by the follow-up `docs: record platform admin plan metadata`.

---

## 2026-06-01 — Auth decision: role-specific login entry points (docs only)

Recorded a mandatory production auth/navigation rule (no code, no behavior
change): **one underlying Supabase Auth system, separate role-specific login
entry points + redirects**.

- Platform admin: `/admin/login` → `/admin` (requires platform-admin auth via
  `PLATFORM_ADMIN_EMAILS` or `profiles.is_internal_admin`). First admin
  `allyexporter@gmail.com` — value in local/Vercel env only, never hardcoded;
  `.env.local.example` may carry the name only.
- Clinic owner: `/login` → `/account` (plan permits a later `/account/login`
  rename). Requires owner/admin membership.
- Front desk: `/workspace/login` → `/workspace`. Requires `front_desk` membership.
- No separate admin password store; reset stays tied to the Supabase Auth email;
  forms use correct `autocomplete`. Server-side protection required on `/admin`,
  `/workspace`, `/account` and their `/api/*`.

To-Do recorded in `AUTH-AND-ACCESS-CONTROL.md` §17 and
`PLATFORM-ADMIN-CONSOLE-PLAN.md` §3: implement `/admin/login`, `/workspace/login`,
and the clinic-owner login entry for `/account`, backed by one Supabase Auth
system with strict server-side role redirects.

Docs updated: `PLATFORM-ADMIN-CONSOLE-PLAN.md` (§3 login entry points + bootstrap
email + `/admin/login` route/roadmap/next-prompt), `AUTH-AND-ACCESS-CONTROL.md`
(§1 + new §17), `PRODUCTION-READINESS-PLACEHOLDER-AUDIT.md` (§15 pointer),
`MANIFEST.md` (note). Validation: docs-only (`git diff --check` clean; no source
files changed). Commit hash / push: `20fcbc9`
(`docs: require role-specific login entry points`), pushed to `origin/main`.
Metadata recorded by the follow-up `docs: record role-specific login decision metadata`.

---

## 2026-06-01 — Platform admin console v1 (implemented)

Built a real, guarded `/admin` console for the platform operator (separate from
clinic `/account` and front-desk `/workspace`). Not a demo: every visible action
works, and anything depending on missing infra is shown disabled with its
prerequisite reason.

**Migration** `supabase/migrations/20260601000200_admin_console.sql` — `admin_audit_events`
table + `clinics.admin_internal_note / admin_provisioning_status / admin_provisioning_note`
(additive, idempotent, check-constrained). **Applied to production via the
Management API** (curl; token from local env, never printed) and verified (table +
3 columns present). No data reset/backfilled.

**Access:** `lib/auth/platform-admin.ts` `resolvePlatformAdmin()` — authorized iff
authenticated email ∈ `PLATFORM_ADMIN_EMAILS` (env) OR `profiles.is_internal_admin`.
Independent of clinic membership; clinic `owner`/`admin`/`front_desk` never grant
platform access. Guarded route group `app/admin/(console)/*`; `/admin/login` is
outside the group (no guard loop). `PLATFORM_ADMIN_EMAILS` parsing added to
`lib/env.ts` (`getPlatformAdminEmails`, trimmed/lowercased, never logged);
`.env.local.example` carries the name only.

**Pages:** `/admin/login`, `/admin` (live KPIs), `/admin/clinics` (server-side
search + active/SMS/phone filters), `/admin/clinics/[clinicId]` (detail + action
panel), `/admin/clinics/[clinicId]/events` (redacted call/message diagnostics),
`/admin/audit`. Read helpers: `lib/db/admin/{overview,clinics,events,audit}.ts`.

**Real actions (audited via `admin_audit_events`):** deactivate / reactivate
clinic; disable / enable SMS recovery (enable gated server-side on `is_active` +
assigned number + `a2p_info_completed`, with a clear blocked reason otherwise);
update internal note (≤1000); set provisioning status/note. Route:
`POST /api/admin/clinics/[clinicId]/action` (`lib/db/admin/actions.ts`). Confirmations
on destructive actions; idempotent; clinic-scoped.

**Blocked (disabled with reason — never fake):** Stripe billing collect/start/pause;
Twilio number purchase/release/reassign; A2P/carrier submission; live SMS mode.

**Redaction:** phones masked to last 4; Twilio SIDs shown as a short tail; EIN +
A2P rep shown as presence only; no raw payloads/tokens/secrets.

**Validation:** `npm run typecheck` pass; `npm run build` pass (`/admin*` +
`/api/admin/*` routes emitted). No lint/test scripts.

**Operator action required (outside Git):** set
`PLATFORM_ADMIN_EMAILS=allyexporter@gmail.com` in Vercel Production env and
redeploy. Until set, `/admin` denies all access (by design). The owner must sign
in at `/admin/login` with their Supabase Auth account for that email.

**Side effects avoided:** no SMS, no emails, no Stripe calls, no Twilio
number purchase/reservation/release, no users created; existing `/login`,
`/account`, `/workspace`, setup, reset-password, webhooks unaffected;
`.env.local` not committed; the real admin email is not hardcoded in source.

**Commit hash / push:** `8967f93` (`feat: add platform admin console`), pushed to
`origin/main`. Metadata recorded by the follow-up
`docs: record platform admin console metadata`.

---

## 2026-06-01 — First platform admin bootstrap (allyexporter@gmail.com)

Checked Supabase Auth (`auth.users` via Management API): the user
`allyexporter@gmail.com` **did not exist**.

Created a safe bootstrap with **no invented password**:

1. Created the Supabase Auth user via the GoTrue admin API
   (`POST /auth/v1/admin/users`, service-role key from local env — never printed)
   with `email_confirm: true` and **no password**. (GoTrue populates the
   `encrypted_password` column on create, but there is no known plaintext — the
   account cannot be logged into until a password is set via recovery.)
2. Triggered the existing branded recovery email via
   `POST /api/auth/forgot-password` (production). Supabase sends the recovery link
   (Resend SMTP, app-domain `token_hash` link) to the owner's inbox.

Owner completes setup (no agent action): open the email → `/auth/callback`
(type=recovery) → `/reset-password` → set a password. After that, the owner signs
in at `/admin/login`.

Still required for `/admin` access (separate, already-documented operator step):
set `PLATFORM_ADMIN_EMAILS=allyexporter@gmail.com` in Vercel Production env and
redeploy. Password setup alone does not grant platform-admin authorization.

Manual Supabase Dashboard fallback (if the email does not arrive):
- Authentication → Users → the user exists (or Add user → Create new user →
  email, leave password blank / "Auto-confirm user").
- Authentication → Users → (user) → "Send password recovery" (or "Send magic
  link"), which emails a link to set the password.
- Or Authentication → Users → (user) → reset password.

Constraints honored: no password invented/printed/stored/committed;
`PLATFORM_ADMIN_EMAILS` not changed; no separate admin password system; one
Supabase Auth system. No repo source changed (docs only this entry).

Commit hash / push: `bb4d80e` (`docs: bootstrap first platform admin user`),
pushed to `origin/main`. Metadata recorded by the follow-up
`docs: record admin bootstrap metadata`.

---

## 2026-06-01 — Complete platform admin login setup (production)

Root causes:

- Production Vercel env did not include `PLATFORM_ADMIN_EMAILS`, so
  `/admin/login` could pass password auth but still deny authorization.
- Post-reset redirect logic used clinic-owner defaults (`/account`) and sent
  platform-admin users into the wrong flow.
- `/reset-password` used separate per-field Show/Hide controls; required UX is a
  shared toggle.

What changed:

- Added `PLATFORM_ADMIN_EMAILS` to Vercel Production env and confirmed presence
  via `vercel env ls production`.
- Implemented robust platform-admin auth check for first login:
  `/api/admin/login` now authorizes directly from the signed-in user object
  (allowlist/profile flag), rather than relying on an immediate cookie
  roundtrip.
- Added role-aware post-auth redirect resolver (`/admin`, `/account`,
  `/workspace`, `/auth/no-access`) and wired it into:
  - `POST /api/auth/update-password`
  - `/auth/callback` fallback redirect path
- Added neutral no-role landing page: `/auth/no-access`.
- Updated clinic `/login` to return a role-mismatch message for platform-admin
  accounts:
  `This account uses platform admin sign in. Please use /admin/login.`
- Replaced reset-password per-field toggles with one shared toggle:
  `Show passwords` / `Hide passwords`, controlling both password fields together.

Supabase bootstrap status (`allyexporter@gmail.com`):

- Auth user exists.
- Email confirmed.
- No clinic membership (expected for platform admin).
- `profiles` row absent (platform access is currently env allowlist-based).

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

Deployment:

- Vercel Production env updated: `PLATFORM_ADMIN_EMAILS` present.
- Production redeploy completed and READY:
  `dpl_DqSiCmdNYu9pH4vRDowHpY6j3kmv`

Side effects avoided:

- no SMS sent
- no patient/marketing email sent
- no Stripe sessions/customers/subscriptions/charges
- no Twilio number purchase/reservation/release
- no migrations created
- no secrets printed or committed

---

## 2026-06-01 — Fix `/admin` vs `/api/admin/clinics/*/action` auth mismatch

Observed production behavior:

- `allyexporter@gmail.com` could open `/admin` pages.
- `POST /api/admin/clinics/[clinicId]/action` returned:
  `You are not authorized for platform admin access.`

Root cause:

- Admin page/layout and admin action API both used `resolvePlatformAdmin()`, but
  API authorization was resolved from the generic `next/headers` cookie context.
  In production, this could diverge from the exact incoming request cookie set
  used by client-triggered `/api/admin/*` calls.

Fix applied (minimal + safe):

- `resolvePlatformAdmin()` now accepts an optional request cookie source and uses
  the same helper path for both page guards and API routes.
- `createSupabaseServerClient()` now supports route-handler request cookie input,
  so API auth checks use the incoming request cookie jar directly.
- `POST /api/admin/clinics/[clinicId]/action` now calls
  `resolvePlatformAdmin(req)`.
- Admin clinic action client fetch now sends `credentials: "include"` explicitly
  to guarantee cookie/session forwarding on all supported browsers.

Security posture:

- No auth bypass introduced.
- No hardcoded admin email.
- No separate admin password system.
- Platform-admin authorization still requires allowlist
  (`PLATFORM_ADMIN_EMAILS`) or `profiles.is_internal_admin=true`.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

---

## 2026-06-01 — Simplify platform admin clinic detail page

Rebuilt `/admin/clinics/[clinicId]` into a practical operator screen (plan §16,
audit §17, runbook entry, auth §20). No schema change, no integration started.

What changed:

- **One clinic on/off control**: Clinic status (Active/Paused) → `clinics.is_active`
  (`Pause clinic` / `Reactivate clinic`). The separate primary SMS-recovery toggle was
  removed; `clinics.sms_recovery_enabled` now appears only as the single **Service
  launch** control (`Launch service` when the gate clears / `Pause SMS sending` when
  launched).
- **Removed Provisioning review/note + Save provisioning** from the UI; removed the
  `set_provisioning` action from `/api/admin/clinics/[clinicId]/action` and its body
  fields. Columns `admin_provisioning_status`/`admin_provisioning_note` are kept
  (additive, untouched). `setAdminProvisioning` helper retained but no longer wired.
- **Page reorganized** into A Clinic summary, B Launch readiness (Business / Billing /
  Phone / A2P / Service launch from real data), C Phone numbers (`clinic_phone_numbers`,
  masked), D Billing, E A2P / SMS approval, F Admin controls, G Diagnostics, H Recent
  admin activity (`admin_audit_events`, clinic-scoped last 5, human-readable).
- **Audit removed from top nav**; `/admin/audit` route kept.
- **Single internal note** retained → `clinics.admin_internal_note` (≤1000).
- **Honest disabled placeholders only**: `Add phone number` → "Twilio purchase flow
  required"; `Manage billing` → "Stripe billing backend required"; `Submit SMS
  approval` → "A2P submission backend required".

Files changed: `app/admin/(console)/clinics/[clinicId]/page.tsx`,
`.../[clinicId]/_components/AdminClinicActions.tsx`,
`app/admin/(console)/_components/AdminUI.tsx`, `app/admin/(console)/layout.tsx`,
`app/admin/(console)/page.tsx`, `app/api/admin/clinics/[clinicId]/action/route.ts`,
`lib/db/admin/clinics.ts`, `lib/db/admin/types.ts`, `app/globals.css`, plus docs.

Auth/action bug: the earlier "page opens but action says not authorized" symptom was
already fixed (page guard + API share `resolvePlatformAdmin`); this refactor preserves
it. No auth weakened, no admin email hardcoded.

Side effects avoided: no SMS sent, no email sent, no Stripe call, no Twilio number
purchase/reserve/release, no A2P submission, no migration, no secrets printed/committed.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

---

## 2026-06-01 — Polish admin clinic status + confirmations (live-QA fixes)

Follow-up to commit `878ce59` after live QA on `/admin/clinics/[clinicId]`.

Finding 1 — duplicated/contradictory status. The page showed clinic and launch
status in three places (top badges, summary rows, controls), so a clinic could read
as both "Active" and "Blocked" at once. Fixed by keeping exactly two separate axes,
each shown once:

- **Clinic status** (`clinics.is_active`) → Active / Paused, shown once in Clinic
  summary; action stays Pause / Reactivate.
- **Launch status** (derived) → Launched / Ready to launch / Blocked, shown once as
  the **Launch readiness** headline with a one-line reason. The duplicate "Service
  state" summary row, the two top-of-page badges, and the readiness "Service launch"
  row were removed. The admin controls now carry only the action buttons (no repeated
  status badge); the disabled Launch button points to "launch readiness above" instead
  of re-printing the blocker text.

Finding 2 — native browser confirm looked unprofessional
(`app.missedcallsdental.com says … OK/Cancel`). Removed the single `window.confirm`
in `AdminClinicActions` and added a reusable in-app dialog
`app/admin/(console)/clinics/[clinicId]/_components/AdminConfirmDialog.tsx`:

- `role="dialog"` + `aria-modal`, labelled/described by title/body ids.
- Focus moves to the confirm button on open and is restored to the trigger on close.
- Escape / Cancel / backdrop click close it; Tab is trapped between Cancel and Confirm.
- Confirm calls the existing `POST /api/admin/clinics/[clinicId]/action` path (audit
  logging unchanged); errors render inside the dialog, which stays open on failure.
- Confirmation is required for state-changing actions only: Pause clinic, Reactivate
  clinic, Launch service, Pause SMS sending. Save note saves directly (low impact).

Actions verified unchanged: deactivate → `is_active=false`, reactivate →
`is_active=true`, enable_sms (launch, gated) / disable_sms, update_note. Every
state-changing action still writes `admin_audit_events`. No API/auth/schema change.

Files: `app/admin/(console)/clinics/[clinicId]/page.tsx`,
`.../_components/AdminClinicActions.tsx`, `.../_components/AdminConfirmDialog.tsx` (new),
`app/globals.css` (`.adm-modal*`, `.adm-launch-head`), plus docs.

Side effects avoided: no SMS, no email, no Stripe call, no Twilio number
purchase/reserve/release, no A2P submission, no migration, no secrets.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

---

## 2026-06-01 — Admin clinic detail = owner-dashboard superset (read-only)

Expanded `/admin/clinics/[clinicId]` so the platform admin sees everything the clinic
owner sees in `/account`, plus admin-only internal detail/diagnostics/audit. Read-only
+ information-architecture change. See `PLATFORM-ADMIN-CONSOLE-PLAN.md` §18 for the full
owner→admin mapping.

Data layer (existing columns only — no migration, no new fields invented):

- `getAdminClinicDetail` / `AdminClinicDetail` extended with full business-identity and
  billing values the owner already sees: `mainPhone`, `einTaxId`, `ownerContactPhone`,
  `testPatientPhone`, `timezone`, `preferredAreaCode`, A2P rep first/last/title/phone,
  `stripeCustomerId`, `stripeSubscriptionId`. Phone-number rows now include full E.164,
  full Twilio SID, and assigned/updated timestamps.
- New human-label helpers in `AdminUI` (`smsStatusLabel`, `localNumberStatusLabel`,
  `billingStatusLabel`, `setupStatusLabel`, `humanizeToken`) so no raw snake_case shows
  in primary UI.

Page sections (in order): header + compact metadata (Clinic ID, Owner, Setup, Created,
Updated) · Status overview (Clinic status + Launch status, each once) · Launch readiness
(4 rows) · Phone numbers (detailed) · Business profile · A2P / SMS approval (detailed +
carrier-submission block) · Billing · Public pages & compliance · SMS behavior · Admin
controls · Diagnostics · Recent admin activity.

Data-exposure decision: the operator reviews/submits the A2P packet, so the clinic's own
business contacts the owner already sees (office/owner/rep phones, EIN, Stripe object
IDs) are shown in full to admins; third-party caller/patient numbers in Diagnostics stay
masked. Admin console remains gated to `PLATFORM_ADMIN_EMAILS` /
`profiles.is_internal_admin`. No secrets surfaced.

Honest gaps (no invented data): no `a2p_brand_sid`/`campaign_sid`/`submitted_at`/
`rejection_reason`/per-clinic `messaging_service_sid` columns exist → carrier-submission
fields render "Not submitted / Not available"; no `sms-consent` route → shown as covered
within SMS terms. Disabled placeholders unchanged (Twilio purchase, Stripe billing, A2P
submission), each with a precise blocker.

Files: `app/admin/(console)/clinics/[clinicId]/page.tsx`,
`app/admin/(console)/_components/AdminUI.tsx`, `lib/db/admin/clinics.ts`,
`lib/db/admin/types.ts`, `app/globals.css`, plus docs.

Side effects avoided: no SMS, no email, no Stripe call, no Twilio number
purchase/reserve/release, no A2P submission, no migration, no auth/schema change, no
secrets printed/committed.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

---

## 2026-06-01 — Admin clinic page rebuilt as editable management console

Implemented the product correction in `PLATFORM-ADMIN-CONSOLE-PLAN.md` §18/§19:
`/admin/clinics/[clinicId]` is now an **editable super-admin management console**, not a
read-only report. No impersonation / "manage as owner". No migration, no auth/schema
change, no new external side effects.

Editable owner-level sections added (existing columns only):

- **Business profile** form (`AdminBusinessProfileForm`) →
  `POST /api/admin/clinics/[clinicId]/business-profile`.
- **A2P / SMS approval** form (`AdminA2pForm`) →
  `POST /api/admin/clinics/[clinicId]/a2p`. Stores data only; no carrier submission.

Both routes: platform-admin guard (`resolvePlatformAdmin(req)`), same Zod validation +
phone/website normalizers as the owner endpoints, reuse `updateBusinessInformation` /
`updateA2pInformation` (target clinic only), and write `admin_audit_events`
(`clinic.business_profile.update` / `clinic.a2p.update`). No-op saves skip the DB write
and audit. Audit metadata = changed field NAMES + completion flags only; never raw
EIN/phone/email. Forms reuse the owner `Field`/`SelectField`/`SaveBar` primitives
(loading/success/error, accessible labels) and `router.refresh()` after save.

Page now leads with a **Launch checklist** (Business profile / Phone number / A2P /
Billing / SMS launch — status + reason + jump-to-section action), then the two editable
sections, then action-oriented Phone/Billing, read-only SMS behavior, and admin-only
tools (controls, diagnostics with masked caller numbers, recent admin activity) with
**Technical details** moved into a collapsible `<details>`.

Still blocked with exact reasons (never simulated): `Purchase and assign number`
("Twilio purchase/assign backend required"), `Manage billing` ("Stripe billing backend
required"), `Submit SMS approval` ("A2P submission backend required").

Files: `app/api/admin/clinics/[clinicId]/business-profile/route.ts` (new),
`app/api/admin/clinics/[clinicId]/a2p/route.ts` (new),
`app/admin/(console)/clinics/[clinicId]/_components/AdminBusinessProfileForm.tsx` (new),
`.../_components/AdminA2pForm.tsx` (new),
`app/admin/(console)/clinics/[clinicId]/page.tsx`,
`app/admin/(console)/_components/AdminUI.tsx`, `app/globals.css`, plus docs.

Side effects avoided: no SMS, no email, no Stripe call, no Twilio number
purchase/reserve/release, no A2P submission, no migration, no auth/schema change, no
secrets printed/committed.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass (`/api/admin/clinics/[clinicId]/business-profile` + `/a2p` compiled)

---

## 2026-06-01 — Admin clinic console restructured to owner-dashboard layout

UI/IA only (no backend change). `/admin/clinics/[clinicId]` was a long linear page; it is
now an owner-`/account`-style dashboard: compact header, one launch banner, left section
nav, single focused panel. See `PLATFORM-ADMIN-CONSOLE-PLAN.md` §20.

- New client component
  `app/admin/(console)/clinics/[clinicId]/_components/AdminClinicConsole.tsx` renders the
  tabbed dashboard. `page.tsx` is now a thin server data-loader (fetches detail/audit/
  events/SMS-mode/app-base-url and passes serializable props).
- Sections: Phone number (default — current blocker) · Business profile · SMS approval ·
  Billing · SMS behavior · Admin tools. Left nav reuses `.acct-layout`/`.acct-nav` with a
  small per-section status word. Accessible tabs (`role=tablist/tab/tabpanel`, roving
  tabindex, Arrow/Home/End, `aria-selected`); panels stay mounted via the `hidden`
  attribute so the editable forms keep unsaved input.
- Removed the header `Active`/`Blocked` pills (redundant); launch state shown once by the
  banner.
- Diagnostics, Recent admin activity, and Technical details moved into collapsible
  `<details>` blocks inside Admin tools (Technical details collapsed by default).
- Preserved unchanged: `AdminBusinessProfileForm`, `AdminA2pForm`, the
  `/business-profile` + `/a2p` admin save routes, validation, audit, and the accessible
  confirmation dialog in `AdminClinicActions`.

Files: `app/admin/(console)/clinics/[clinicId]/page.tsx`,
`.../_components/AdminClinicConsole.tsx` (new), `app/globals.css`, plus docs.

Side effects avoided: no SMS, no email, no Stripe call, no Twilio number
purchase/reserve/release, no A2P submission, no migration, no auth/schema change, no
secrets printed/committed.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

---

## 2026-06-01 — Admin Twilio number purchase + assignment (first gated action)

Wired the first real gated Twilio admin action into `/admin/clinics/[clinicId]` (Phone
number panel). Search → select → confirm → purchase/assign. Reuses the onboarding Twilio
architecture (`purchaseNumberAndConfigure` + `upsertOfficeTextingNumber` + Messaging
Service); no second architecture. **No migration** — `clinic_phone_numbers` already
stores E.164 + IncomingPhoneNumber SID + role + active. Runbook has the operator
procedure + rollback; plan §21 has the design.

New routes (platform-admin guarded):
- `GET /api/admin/clinics/[clinicId]/phone-numbers/search` — read-only available-number
  lookup; Voice+SMS-capable only; hint = query area_code → preferred_area_code → area
  code from main_phone → none (no hardcoded codes); region/postal from clinic.
- `POST /api/admin/clinics/[clinicId]/phone-numbers/purchase` `{ phone_number }`.

Purchase gate: `TWILIO_NUMBER_PURCHASE_ENABLED`
(`runtimeConfig.onboarding.twilioNumberPurchaseEnabled`, committed **false**). Disabled →
HTTP 503 `purchase_disabled` "Twilio number purchase is disabled by environment flag." —
no Twilio call, no DB write, no bypass. Preconditions: auth → clinic exists → not already
assigned (409 `already_assigned`) → flag on → app base URL present → purchase.

On success: sets the number's Voice/SMS incoming + status webhooks
(`/api/webhooks/twilio/{voice,messaging}/{incoming,status}` from `appBaseUrl`),
best-effort attaches the Messaging Service, upserts `clinic_phone_numbers`
(role `office_texting`, active), writes `admin_audit_events`
`clinic.phone_number.purchase_assign` (after `{ phone_number, twilio_sid, area_code }`,
no secrets). SMS recovery NOT enabled; `setup_status` unchanged. Console refreshes →
Phone number flips Missing → Assigned.

UI: `AdminPhoneNumberManager` client component (candidate radio list, capability badges,
existing accessible confirm dialog — no `window.confirm`, loading/success/error). Submit
SMS approval and Manage billing remain disabled with their exact blockers.

Safe test with purchase disabled (current state): searched candidates render; attempting
purchase returns the 503 flag blocker in the confirm dialog; no number purchased, no DB
row created, no Twilio purchase/reserve/release.

Files: `app/api/admin/clinics/[clinicId]/phone-numbers/search/route.ts` (new),
`.../phone-numbers/purchase/route.ts` (new),
`app/admin/(console)/clinics/[clinicId]/_components/AdminPhoneNumberManager.tsx` (new),
`.../_components/AdminClinicConsole.tsx`, `app/admin/(console)/clinics/[clinicId]/page.tsx`,
`app/globals.css`, plus docs.

Side effects avoided: no SMS, no email, no Stripe call, no Twilio number
purchase/reserve/release (flag off), no A2P submission, no migration, no auth/schema
change, no secrets printed/committed.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass (`/phone-numbers/search` + `/phone-numbers/purchase` compiled)

---

## 2026-06-01 — Manual Twilio number search filters (admin)

Replaced the admin Phone number panel's single search button with a manual filter form
(Twilio-Console-style). Purchase gate, confirm dialog, assignment, webhooks, and audit are
unchanged. No migration, no auth change, no purchase performed (`TWILIO_NUMBER_PURCHASE_ENABLED`
still committed `false`).

- `lib/twilio/numbers.ts`: local + toll-free search now accept `contains`, `inLocality`,
  `inRegion`, `inPostalCode`, `nearNumber`+`distance`, capability requireds (default
  Voice+SMS), and limit (cap raised to 50). `AvailableNumber` gains `selectable`
  (= Voice && SMS). Onboarding callers keep the historical Voice+SMS-required behavior.
- `GET /api/admin/clinics/[clinicId]/phone-numbers/search`: parses + validates all filter
  params server-side (country US/CA, area code 3-digit, region 2-letter, contains
  digits/`*`, distance 1–500, limit ∈{10,20,50}, capability booleans), echoes the params
  actually used + `count` + `empty_reason`. Geo radius applies only when area code / city /
  state / ZIP are all empty and the clinic has a valid US main phone (near-number anchor).
- `AdminPhoneNumberManager`: filter form (type, country, area code, city, state, ZIP,
  contains, radius, capabilities, results) prefilled from clinic defaults, Search + Reset,
  results summary, candidate radio list (selectable only when Voice+SMS), actionable empty
  state, existing confirm-dialog purchase. Clinic defaults passed from `page.tsx`.

Safe test with purchase disabled: search by area code / city+state / ZIP / toll-free works;
empty state shows guidance and keeps the form; attempting purchase returns
`Twilio number purchase is disabled by environment flag.`; no number purchased, no DB row.

Files: `lib/twilio/numbers.ts`,
`app/api/admin/clinics/[clinicId]/phone-numbers/search/route.ts`,
`app/admin/(console)/clinics/[clinicId]/_components/AdminPhoneNumberManager.tsx`,
`.../_components/AdminClinicConsole.tsx`, `app/admin/(console)/clinics/[clinicId]/page.tsx`,
`app/globals.css`, plus docs.

Side effects avoided: no SMS, no email, no Stripe call, no Twilio purchase/reserve/release
(flag off; search is read-only), no A2P submission, no migration, no auth/schema change, no
secrets printed/committed.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

---

## 2026-06-02 — Improve onboarding Twilio local-number search fallback

Goal: make automatic onboarding local-number preparation more reliable without asking
customers for extra Step 1 fields.

What changed:

- `lib/twilio/numbers.ts` now supports `nearLatLong` for local-number search and applies
  radius `distance` with either `nearNumber` or `nearLatLong`.
- Twilio local searches now pass `beta=false`, `excludeAllAddressRequired=true`,
  `excludeLocalAddressRequired=true`, and `excludeForeignAddressRequired=true` using the
  installed SDK's typed local-number parameter surface.
- `lib/onboarding/local-number.ts` now builds a named deterministic fallback plan:
  `area_code_and_zip` → `zip_only` → `area_code_only` → optional ZIP radius attempts
  (`25`, `50`, `100` miles) → optional `state_region`.
- The onboarding plan never uses city/locality as an automatic search filter.
- Radius fallback is structured but inactive until a committed ZIP-to-coordinate source is
  added; onboarding does not call external geocoding services.

Safety:

- Search remains read-only. No Twilio number was purchased, reserved, released, or assigned.
- Onboarding account creation remains non-blocking if Twilio search fails or returns zero
  results.
- Step 1 still asks only for clinic name, main office phone, ZIP code, and existing login
  fields.

Files changed:

- `lib/twilio/numbers.ts`
- `lib/onboarding/local-number.ts`
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

Commit:

```txt
65b2a6baa46281e9e6e051b413e6d5f2d58de70a
```

Remaining risk:

- ZIP-radius fallback requires a committed ZIP coordinate lookup source before it can run.

---

## 2026-06-02 — Use smart fallback for admin Twilio local-number search

Problem: Admin → Clinic → Phone number → Search numbers still sent strict combined Twilio
filters (`areaCode` + `inLocality` + `inRegion` + `inPostalCode`). In production this
returned 0 results for area code 224 / IL / Buffalo Grove / ZIP 60089 even though broader
fallback inventory could exist.

What changed:

- Extracted shared smart local-number search planning to
  `lib/twilio/local-number-search-plan.ts`.
- `lib/onboarding/local-number.ts` now uses that shared planner instead of owning a
  duplicate fallback implementation.
- `app/api/admin/clinics/[clinicId]/phone-numbers/search/route.ts` now uses the shared
  plan for U.S. local search: `area_code_and_zip` → `zip_only` → `area_code_only` →
  optional ZIP radius attempts → `state_region` fallback.
- Admin local smart search no longer sends `inLocality` to Twilio. City/locality remains
  result metadata only.
- `AdminPhoneNumberManager` no longer sends the city field on default Search, labels it as
  metadata-only, removes the misleading manual radius input, and shows fallback summary
  copy when a broader attempt is used.

Safety:

- Search remains read-only. No Twilio number was purchased, reserved, released, or assigned.
- Purchase behavior remains behind the existing `TWILIO_NUMBER_PURCHASE_ENABLED` gate.
- Default local search remains Voice + SMS required, MMS not required, and uses the shared
  Twilio local-number safety filters (`beta=false`, address-required exclusions where
  supported).

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

Commit:

```txt
9bf0565add098e4e85739d3b90ab4d0c7b3f3140
```

Remaining risk:

- ZIP-radius fallback still requires a committed ZIP coordinate lookup source before it can
  run.

---

## 2026-06-02 — Simplify phone-number search UI

Goal: stop showing Twilio Console-style controls to platform admins and clinic owners now
that smart fallback search is implemented server-side.

What changed:

- Admin → Clinic → Phone number → Assign a number now shows only:
  - Number type (Local / Toll-free)
  - Area code (prefilled from clinic main office phone, editable by admin)
  - ZIP code (prefilled from clinic profile, editable by admin)
- Removed visible admin controls for country, city/locality, state/region, contains/pattern,
  result count, radius, and Voice/SMS/MMS capability checkboxes.
- Admin search API now fixes MVP defaults internally: `country=US`, Voice+SMS required, MMS
  not required, limit 10.
- Owner `/account` Phone number card now shows the saved local-number search context only:
  "We'll look for a local number near your office", area code, and ZIP code. It does not
  show number type or Twilio-style filters.
- Twilio result ranking now prefers local numbers with locality + region metadata, then
  region-only metadata, then no locality metadata.
- A number without locality metadata is not marked Recommended unless it is the only usable
  result. The admin result list displays "Location not specified by Twilio" when locality is
  missing, and hides no-locality local results when at least three returned results have
  locality metadata.

Files changed:

- `lib/twilio/numbers.ts`
- `app/api/admin/clinics/[clinicId]/phone-numbers/search/route.ts`
- `app/admin/(console)/clinics/[clinicId]/_components/AdminPhoneNumberManager.tsx`
- `app/admin/(console)/clinics/[clinicId]/_components/AdminClinicConsole.tsx`
- `app/admin/(console)/clinics/[clinicId]/page.tsx`
- `app/account/page.tsx`
- `app/setup/[token]/_components/account-types.ts`
- `app/setup/[token]/_components/BusinessProfile.tsx`
- `app/setup/[token]/_components/AssignedNumberCard.tsx`
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`

Safety:

- Search remains read-only.
- No Twilio number was purchased, reserved, released, or assigned.
- Purchase behavior remains behind the existing `TWILIO_NUMBER_PURCHASE_ENABLED` gate.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass

Commit:

```txt
efc1c83fd2c9316a6d342281c30998a066df506f (fix: add owner local number search)
```

Push:

```txt
pushed to origin/main
```

Remaining risk:

- ZIP-radius fallback still requires a committed ZIP coordinate lookup source before it can
  run.

---

## 2026-06-01 — Admin add-number flow moved to a dedicated page + provider-neutral UI copy

What changed:
- `AdminPhoneNumberManager` no longer returns `null` when a clinic already has a number
  and no longer takes `hasAssignedNumber`. The clinic detail Phone number panel no longer
  embeds the search form inline; it shows current numbers + status + an always-visible
  **Add number** button linking to a new dedicated screen.
- New page `app/admin/(console)/clinics/[clinicId]/phone-numbers/new/page.tsx` (server
  loader under the guarded `(console)` group) renders the search/assignment UI with a back
  link to the Phone number panel. Visible controls stay simplified (Number type, Area
  code, ZIP); the smart-fallback search runs underneath. Successful purchase routes back
  to the clinic detail.
- Removed external provider brand names from user-visible admin/owner copy:
  `Twilio SID`→`Provider reference`, `Twilio Brand SID`→`Messaging brand reference`,
  `Twilio Campaign SID`→`Messaging campaign reference`, the purchase-disabled banner →
  `Number purchase is disabled by environment flag.`, `Location not specified by Twilio`→
  `Location not specified`, confirm-dialog body → "…from the phone provider…", admin
  diagnostics intro → "provider references", owner NumberSearch toll-free note → drop
  "Twilio". Provider names kept only in comments/env names/integration code.

Why: the inline form hid add-number when a number already existed (couldn't add a second
number) and embedded a full form in the detail panel; moving it to a dedicated screen
matches Twilio-Console-style "Buy a number" UX and keeps the panel clean. Brand-name
removal keeps user-facing copy provider-neutral.

Files: `app/admin/(console)/clinics/[clinicId]/_components/AdminPhoneNumberManager.tsx`,
`.../_components/AdminClinicConsole.tsx`, `.../[clinicId]/page.tsx`,
`.../[clinicId]/phone-numbers/new/page.tsx` (new), `.../[clinicId]/events/page.tsx`,
`app/setup/[token]/_components/NumberSearch.tsx`, plus docs.

Safety: no purchase/reserve/release performed; `TWILIO_NUMBER_PURCHASE_ENABLED` gate,
confirm dialog, idempotency, webhook config, and audit unchanged. No migration, no auth
change, no secrets exposed.

Validation:
- `npm run typecheck` -> pass
- `npm run build` -> pass (`/admin/clinics/[clinicId]/phone-numbers/new` compiled)

Commit: `14f9962` (`fix: move admin add number flow to dedicated page`). Pushed to
`origin/main`.

Remaining risks: search result quality depends on the live phone-provider catalog;
purchase stays intentionally blocked until `TWILIO_NUMBER_PURCHASE_ENABLED` is enabled
with provider creds + Messaging Service + app base URL (human-approved). Adding a second
number is now possible, but the launch gate still keys off "has an active number" and
there is no per-number role-management UI yet.

---

## 2026-06-02 — Admin add-number flow made inline (expandable panel)

What changed:
- The add-number search/assignment flow is now an **inline expandable panel inside the
  clinic detail Phone number section**, instead of a separate page. The operator stays on
  the clinic page.
- `AdminClinicConsole` gained `isAddingNumber` local state. The Phone number panel shows
  an always-visible **Add number** button (whether or not a number is assigned). Clicking
  it expands an inline sub-panel (title "Add a number", helper "Search for an available
  tracking number for this clinic.") that renders `AdminPhoneNumberManager` in place. The
  button no longer navigates to `/phone-numbers/new`.
- `AdminPhoneNumberManager` gained optional `onCancel` and `onAssigned` props. Inline:
  Cancel collapses the panel (unmount clears transient search state); a successful purchase
  calls `onAssigned`, which collapses the panel and `router.refresh()`es the clinic data so
  the new assignment shows in the same section. The "Reset to clinic defaults" button was
  replaced by **Cancel** (buttons are now Search numbers + Cancel).
- The detail page loader (`[clinicId]/page.tsx`) again computes `phoneDefaults` (preferred
  area code, else derived from the US main phone; no hardcoded codes) and passes it to the
  console so the inline manager can prefill the form.
- The dedicated page `app/admin/(console)/clinics/[clinicId]/phone-numbers/new/page.tsx` is
  **kept as a deep-link fallback only** (renders the same component with no `onCancel`/
  `onAssigned`, so it falls back to routing back to the clinic detail). It is no longer the
  primary path; nothing links to it from the main UI.

Why: leaving the clinic detail context for a separate page weakened the operator UX. The
operator should see current assigned numbers/statuses and expand the Add number form
in place. Keeping the route as a deep-link fallback avoids breaking bookmarks/build routes.

Files: `app/admin/(console)/clinics/[clinicId]/_components/AdminClinicConsole.tsx`,
`.../_components/AdminPhoneNumberManager.tsx`, `.../[clinicId]/page.tsx`, plus docs
(`OPERATIONS-RUNBOOK.md`, this log). The dedicated `phone-numbers/new/page.tsx` is
unchanged (still compiles via the now-optional props).

Safety: no purchase/reserve/release performed; `TWILIO_NUMBER_PURCHASE_ENABLED` gate,
confirm dialog, idempotency, webhook config, and audit unchanged. No migration, no auth
change, no schema change, no secrets exposed. Provider brand names not reintroduced in
visible admin/owner UI.

Validation:
- `npm run typecheck` -> pass
- `npm run build` -> pass (`/admin/clinics/[clinicId]` 8.35 kB; deep-link fallback
  `/admin/clinics/[clinicId]/phone-numbers/new` still compiled; both phone-number API
  routes intact)

Commit: `67011c5` (`fix: make admin add number flow inline`). Pushed to `origin/main`.

Remaining risks: search result quality still depends on the live phone-provider catalog;
purchase stays blocked until `TWILIO_NUMBER_PURCHASE_ENABLED` is enabled (human-approved).
The inline panel lives in the (kept-mounted, hidden-when-inactive) Phone tab, so switching
sections preserves its open state; that is intentional. Adding a second number remains
possible without a per-number role-management UI.

---

## 2026-06-02 — Owner account local-number search and selection

What changed:

- Added owner-facing local phone-number search inside `/account` -> Phone number.
- The owner Phone number section still shows assigned phone number, Voice / Calls
  and SMS / Texting status, and saved local search context (Area code + ZIP code).
- Added `Search local numbers` using the saved clinic main-phone area code and
  saved `postal_code`; the owner UI does not expose number type, country, city,
  state, radius, result count, capabilities, or pattern fields.
- Added selectable radio-style result cards showing friendly number, E.164 value,
  location, and Voice/SMS badges. Missing locality displays
  `Location not specified`; no-location results are hidden when enough better
  locality results exist.
- Owners can choose a preferred number before a payment method is on file.
- Removed the old pre-search payment-method callout from the Phone number card
  so payment is presented only at the final selected-number action.
- When no payment method exists, the selected-number action area shows
  `Add a payment method to use this number`, the selected number, the required
  billing explanation, and an `Add payment method` button that switches to the
  Billing section.

Why:

- The owner Account -> Phone number card had only static search context. Owners
  needed to be able to search and choose a preferred local number without
  creating an unsafe assignment path before payment setup.

Files changed:

- `app/api/account/phone-numbers/search/route.ts`
- `app/setup/[token]/_components/OwnerLocalNumberSearch.tsx`
- `app/setup/[token]/_components/AssignedNumberCard.tsx`
- `app/setup/[token]/_components/BusinessProfile.tsx`
- `app/globals.css`
- `lib/auth/access.ts`
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`

Safety:

- Search is read-only.
- The owner search route accepts no clinic ID from the client.
- Authenticated owner/admin membership is required; `front_desk` is rejected.
- The legacy setup-token cookie fallback is supported using the same
  `readAccountSessionToken()` -> `lookupSetupRequestByRawToken()` ->
  `findClinicById()` path as `/account`.
- No number is purchased, reserved, assigned, released, or stored from the owner
  search route.
- With no payment method, the UI does not call an assignment or purchase
  endpoint.
- With a payment method, the visible historical use-number action remains neutral
  and does not call a provider endpoint until a safe owner assignment backend is
  implemented.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass
- Static wording check confirmed the new owner Account phone-number UI does not
  show "Buy", "Purchase", provider brand names, or extra search-filter fields.

Commit:

```txt
pending; final commit hash reported after commit
```

Push:

```txt
pending
```

Remaining risks:

- Owner final assignment is intentionally not wired in this change; staff can
  finish setup manually until payment setup and safe owner assignment backend
  behavior are connected.
- Search result quality depends on the live phone-provider catalog.

---

## 2026-06-02 — Stripe sandbox payment-method setup (real, test-mode only)

What changed:

- Added real end-to-end Stripe payment-method collection for the owner/admin
  account dashboard using **Stripe-hosted Checkout in `mode:"setup"`** (no card
  form in our UI). Collects + saves a payment method for FUTURE billing only.
- New migration `supabase/migrations/20260602000100_clinic_payment_method.sql`
  adds safe, non-secret columns to `public.clinics`: `stripe_payment_method_id`,
  `_brand`, `_last4`, `_exp_month`, `_exp_year`, `_added_at`, `_updated_at`, with
  CHECK constraints (month 1..12, year 2000..2100, last4 ≤ 4 chars). Existing
  `stripe_customer_id` / `stripe_subscription_id` preserved. **Apply with owner
  approval before the live flow works.**
- New `lib/stripe/server.ts`: lazy-cached Stripe API client that REFUSES to
  initialize unless `STRIPE_SECRET_KEY` is a test/sandbox key (`sk_test_`/
  `rk_test_`). Webhook signature verification stays separate in
  `lib/stripe/webhook.ts`.
- New `POST /api/account/billing/payment-method/setup`: auth-gated (owner/admin
  only; `front_desk` rejected), creates a sandbox Stripe Customer once, then a
  Checkout Session (`mode:"setup"`, no `payment_method_types`), returns the
  hosted URL. Clinic identity comes only from the session — no client-supplied
  clinic id. success/cancel URLs derive from runtime `appBaseUrl`.
- Extended `app/api/webhooks/stripe/route.ts`: preserves signature verification +
  idempotent `recordWebhookEvent`; now handles `checkout.session.completed`
  (mode==="setup") and `setup_intent.succeeded` (fallback), saving safe card
  metadata and setting the customer `invoice_settings.default_payment_method`.
  No invoice/subscription/charge created. Duplicate events skipped.
- Owner `/account`: `hasPaymentMethod` now derives strictly from
  `stripe_payment_method_id` (NOT `stripe_customer_id`/`billing_status`).
  `BillingCard` replaces the disabled placeholder with a real **Add / Update
  payment method** button + success/confirming/cancelled return states.
  `?section=billing` opens the Billing section after the Stripe redirect.
- Admin console Billing shows real payment-method presence + brand/last4/exp;
  payment method id shown in Technical details (object reference, not a secret).

Why:

- Payment-method collection is required before number activation/assignment UX
  can proceed, and billing should behave like a real SaaS setup step — but paid
  billing must not start yet. This wires the real Stripe surface in sandbox/test
  mode with no charge.

Files changed:

- `supabase/migrations/20260602000100_clinic_payment_method.sql` (new)
- `lib/stripe/server.ts` (new)
- `app/api/account/billing/payment-method/setup/route.ts` (new)
- `app/api/webhooks/stripe/route.ts`
- `lib/db/clinics.ts`, `lib/db/admin/types.ts`, `lib/db/admin/clinics.ts`
- `app/account/page.tsx`
- `app/setup/[token]/_components/account-types.ts`
- `app/setup/[token]/_components/BusinessProfile.tsx`
- `app/setup/[token]/_components/BillingCard.tsx`
- `app/admin/(console)/clinics/[clinicId]/_components/AdminClinicConsole.tsx`
- `.env.local.example`
- `MVP_BUILD_DOCS/{SETUP-LOG,OPERATIONS-RUNBOOK,REPEATABLE-SETUP-CHECKLIST,FIRST-CLINIC-ONBOARDING}.md`

Stripe mode + endpoint:

- **Sandbox/test only.** Webhook endpoint path: **`/api/webhooks/stripe`**.
- Required env (names only): `STRIPE_SECRET_KEY` (must be `sk_test_…`),
  `STRIPE_WEBHOOK_SECRET` (from the Stripe test/sandbox webhook endpoint).

Manual Stripe setup needed:

- Set `STRIPE_SECRET_KEY` to a Stripe **test** secret key (`sk_test_…`).
- Create a Stripe **test/sandbox** webhook endpoint -> `/api/webhooks/stripe`;
  set `STRIPE_WEBHOOK_SECRET` to its signing secret (`whsec_…`).
- Subscribe to at least `checkout.session.completed` and `setup_intent.succeeded`.

Safety:

- No charge, no subscription, no invoice, no PaymentIntent charge.
- No `payment_method_types` in Checkout. No card fields in our UI. No card data
  stored in Supabase (only ids/brand/last4/exp/timestamps).
- No Twilio number purchase, no SMS recovery enablement.
- Secrets never logged, returned, displayed, or committed.

Validation:

- `npm run typecheck` -> pass
- `npm run build` -> pass (`/api/account/billing/payment-method/setup` compiled;
  `/account` compiled)
- Static safety grep: no PaymentIntent/subscription/invoice creation, no
  `payment_method_types`, no raw card fields, no committed secrets.

Commit:

```txt
8edb897 (feat: add Stripe sandbox payment method setup)
```

Push:

```txt
Pushed to origin/main.
```

Remaining risks:

- Payment method appears only after the webhook is delivered + processed
  (BillingCard has a Refresh affordance for the brief delay). Locally the webhook
  needs `stripe listen` or a public tunnel to reach `/api/webhooks/stripe`.
- The migration must be applied before the new columns exist, or `/account`
  reads error.
- Subscription/invoice billing remains intentionally unbuilt (later milestone).

### 2026-06-02 — migration APPLIED to production (incident fix)

`/account` was returning a 500 server-side exception in production after the
`558e749` deploy because the migration columns did not exist yet. Confirmed from
Vercel runtime logs (deployment `dpl_2rscdrYGGaq3wK6ATsbejiSesS54`): three
`GET /account → 500` entries, message `column "stripe_payment_m… does not exist`.

Applied `supabase/migrations/20260602000100_clinic_payment_method.sql` to the
production Supabase project `qfjpvbvfvhbtebwivcdc` via the **Management API**
`POST /v1/projects/{ref}/database/query` (token from local `.env.local`, never
printed), using **curl** (Cloudflare blocks other clients — see 2026-06-01 note).
Response HTTP 201.

Verified (Management API queries against production):
- BEFORE: `information_schema` returned **0** `stripe_payment_method%` columns.
- AFTER: all **7** columns present with correct types; all **3** CHECK
  constraints present (`clinics_stripe_pm_exp_month_check`,
  `_exp_year_check`, `_last4_len_check`).
- `GET /api/health` → 200 `{"ok":true,...}`.
- `GET https://app.missedcallsdental.com/account` → 200, renders the
  sign-in gate (unauthenticated path); no "server-side exception" / digest in
  the HTML.
- Post-fix Vercel error logs for the production deployment: none in the window
  after apply (last 500 was 16:49:42, before the apply).

Note: `/api/internal/health` is NOT an implemented route (empty local dir, no
`route.ts`, not in git) — production correctly 404s; unrelated to this incident.
No code changed (migration was already committed; only applied). Idempotent
migration — safe to re-run.

### 2026-06-02 — Stripe sandbox secrets added to Vercel Production + verified

Cause of the "Billing is not available in this environment." error: Vercel
Production had **no** `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (only
`STRIPE_ACCOUNT_ID` existed). The setup route's sandbox gate threw on Stripe-client
init. Deployed code was correct (reads `process.env` via `getStripeServerEnv()`);
this was purely missing env config — no code change.

Env vars added to Vercel **Production** (names only; values from local `.env.local`,
never printed/committed; `type: sensitive` to match the project secret convention;
Production-only since the project has no strict all-env-match rule):
- `STRIPE_SECRET_KEY`  (verified locally as a **test** key `sk_test_…`/`rk_test_…`,
  not `sk_live_…`)
- `STRIPE_WEBHOOK_SECRET`  (verified locally as `whsec_…`)

Added via Vercel REST API `POST /v10/projects/{id}/env?upsert=true` with the local
`VERCEL_TOKEN` (HTTP 201 each). Redeployed the current production commit so the new
env is snapshotted (Vercel injects env at deploy-create time).

Redeploy: `POST /v13/deployments` with `deploymentId` of the prior prod deploy →
new deployment **`dpl_8M2uj8UWbj28NVecbNd5jyxch6mr`** (commit `558e749`, target
production), reached **READY**; alias `app.missedcallsdental.com`.

Verified:
- Vercel env listing (names only): Production now has `STRIPE_SECRET_KEY` +
  `STRIPE_WEBHOOK_SECRET` (+ existing `STRIPE_ACCOUNT_ID`).
- `GET /api/health` → 200.
- `GET /account` → 200 (sign-in gate; no server-side exception).
- `POST /api/account/billing/payment-method/setup` unauth → **401** "Please sign in"
  (route healthy; the prior 500 "environment" error is gone). The auth check runs
  before Stripe init, so the authenticated Checkout redirect still needs an owner
  session to fully exercise.
- Webhook secret wiring proven via a bogus-signature probe to
  `POST /api/webhooks/stripe` → **401 "Invalid Stripe signature"** (the
  `invalid_signature` path, i.e. secret present & used — a missing secret would
  return the generic "Unauthorized"). Confirmed in Vercel runtime logs for the new
  deployment. No side effects (rejected before any DB write).
- Stripe read-only `GET /v1/balance` with the key → `livemode: false` (valid
  **test-mode** key; no objects created).

Safety: no charge, subscription, invoice, or PaymentIntent created; key confirmed
test-mode (`livemode:false`); no live key; no secrets printed/committed; no Twilio
purchase; SMS recovery unchanged.

Remaining (operator, needs authenticated owner browser session — not doable from
the repo CLI): click `/account → Billing → Add payment method`, confirm redirect to
Stripe-hosted Checkout (setup mode), complete with test card `4242 4242 4242 4242`,
then confirm the Billing card shows the saved method, the `clinics` row has
`stripe_customer_id` + `stripe_payment_method_id`, and the Stripe **test** Dashboard
shows only a Customer + PaymentMethod (no Subscription/Invoice/charge). Ensure the
Stripe test webhook endpoint targets `/api/webhooks/stripe` with
`checkout.session.completed` + `setup_intent.succeeded` so the save completes.

### 2026-06-02 — fix: `currency` required for setup-mode Checkout (code defect)

After the env was correct (`sk_test_` key, verified `livemode:false`), the button
then failed with "Could not start payment setup." (`billing.setup.failed`). Root
cause was a **code defect**, not env: `checkout.sessions.create({ mode:"setup" })`
**omits `payment_method_types`** (intentional — dynamic payment methods), and Stripe
**requires `currency`** in that configuration. Reproduced with the same `sk_test_`
key (no Vercel logs needed):
- `customers.create` → ok (`livemode:false`).
- `checkout.sessions.create` (no currency) → `StripeInvalidRequestError`
  `parameter_missing` param=`currency`, 400 **"Missing required param: currency."**
- Same call **with `currency:"usd"`** → ok, `mode:"setup"`, returned a hosted URL.
  (Throwaway test Customer deleted after each repro; only a SetupIntent could be
  created — no charge/PaymentIntent/subscription/invoice.)

Fix: added `currency: "usd"` to the Checkout Session in
`app/api/account/billing/payment-method/setup/route.ts`. `currency` in setup mode
only scopes eligible dynamic payment methods — it does **not** create a charge.
Key prefix is `sk_test_` (Standard test key), so no key replacement was needed.

Validation: `npm run typecheck` pass; `npm run build` pass. Commit `4709cfa`;
pushed to `origin/main` (auto-deploys production). Post-deploy: `/api/health` 200;
`/account` 200; unauth `POST …/payment-method/setup` → 401 (auth before Stripe);
deployed Stripe call now matches the locally-verified working call. Final
authenticated Checkout redirect still needs an owner browser session to click.

---

## 2026-06-02 — feat: owner-requested phone number (preference for admin review)

What changed:

- Owners can now save a selected local number as a **pending request** for admin
  review. On `/account → Phone number`, with a saved payment method, the historical
  use-number action POSTs the selected candidate to a new owner route; the UI
  shows "Requested number saved. Our team will review it before assignment." plus
  "No number has been purchased or assigned yet." The Phone number card shows a
  compact **Requested number / (formatted) / Pending review** status that persists
  on reload (assigned number stays a separate line).
- The admin clinic console **Phone number** panel shows the latest **Owner
  requested number** (E.164, status, location, requested timestamp, requester
  email) with the note "This is an owner preference only. Purchase and assignment
  remain admin-controlled.", plus a hint near the existing **Add number** flow.
- **No purchase/reserve/assign/provision/activate.** Nothing writes
  `clinic_phone_numbers`, changes `local_number_status`, or enables SMS recovery.
  Real number purchase/assignment stays admin-only via the existing gated flow.
- Payment method remains a prerequisite: the owner UI gates the action, and the
  API also rejects the request (400 `payment_method_required`) when no saved
  `stripe_payment_method_id` exists.

Why: now that sandbox payment-method setup works, the historical owner use-number
action should capture the owner's preferred number for the operator to review and
finish manually — without granting owners any provisioning power.

Files: `supabase/migrations/20260602000200_clinic_number_requests.sql` (new),
`lib/db/clinic-number-requests.ts` (new),
`app/api/account/phone-numbers/request/route.ts` (new),
`app/setup/[token]/_components/{account-types.ts,OwnerLocalNumberSearch.tsx,AssignedNumberCard.tsx,BusinessProfile.tsx}`,
`app/account/page.tsx`, `lib/db/admin/{types.ts,clinics.ts}`,
`app/admin/(console)/clinics/[clinicId]/_components/AdminClinicConsole.tsx`, docs.

Schema: new table `public.clinic_number_requests` (clinic_id FK, requested
number + friendly_name/locality/region/postal/number_type/capabilities, status
enum `pending|reviewed|fulfilled|rejected|cancelled`, requester + review fields).
Helper supersedes prior pending requests and de-dupes identical repeat clicks.
**Apply migration with owner approval** — reads are defensive (`.catch`) so
`/account` and the admin console do not error before it is applied.

Safety: no Twilio purchase/reserve/assign; no `clinic_phone_numbers` write; no
`sms_recovery_enabled` change; no charge/subscription/invoice/PaymentIntent; no
secrets. Front-desk rejected; clinic derived from session (no client clinic id).

Validation: `npm run typecheck` pass; `npm run build` pass
(`/api/account/phone-numbers/request` compiled); safety grep clean (matches are
comments only). Commit `4969814`; pushed to `origin/main`.

Remaining: apply the migration to production (hand-applied) before the flow works
live; admin "Approve" remains the existing manual Add number flow (no auto-purchase).

### 2026-06-03 — migration APPLIED to production

The historical owner use-number action was failing with "Could not save your requested number"
because the table did not exist yet. Applied
`supabase/migrations/20260602000200_clinic_number_requests.sql` to the production
Supabase project `qfjpvbvfvhbtebwivcdc` via the **Management API**
`POST /v1/projects/{ref}/database/query` (token from local `.env.local`, never
printed), using **curl** (same pattern as the payment-method migration). HTTP 201.

Verified (Management API queries against production):
- BEFORE: `to_regclass('public.clinic_number_requests')` → `null` (root cause).
- AFTER: table exists; constraints present —
  `clinic_number_requests_status_check`, `clinic_number_requests_number_type_check`,
  `clinic_number_requests_phone_nonempty_check` (plus FK + PK); indexes present —
  `clinic_number_requests_clinic_created_idx`,
  `clinic_number_requests_clinic_pending_idx` (plus PK); 1 user trigger
  (updated_at); RLS enabled.
- `GET /api/health` → 200; `GET /account` → 200 (sign-in gate; no exception).
- Baseline rows: `clinic_number_requests` = 0 (empty, queryable);
  `clinic_phone_numbers` = 1 (untouched — the migration only creates the new
  table, so `local_number_status`, `sms_recovery_enabled`, and Twilio config are
  unaffected).

No app code changed (migration was already committed; only applied). Idempotent —
safe to re-run. Authenticated owner-click verification (request saved → pending row
→ admin console display) is the operator's final step (no owner browser session in
the repo CLI; no row fabricated).

---

## 2026-06-03 — fix: simplify owner phone number search UI

What changed:

- `/account → Phone number` owner UI was simplified.
- Requested number now replaces the empty assigned-number state when no number is
  assigned.
- Redundant "No number has been purchased or assigned yet." copy was removed from
  the owner Phone number UI.
- Search area now uses editable **Area code** + **ZIP code** fields, prefilled from
  the current clinic context.
- Search remains read-only and does not buy, reserve, assign, release, provision,
  or store a phone number.

Safety: owner search still derives the clinic from authenticated owner/admin access
or the legacy account session fallback, rejects front desk access, never accepts a
client `clinic_id`, and never writes `clinic_phone_numbers`.

---

## 2026-06-03 — fix: simplify owner phone numbers copy

What changed:

- Owner Phone number section renamed to **Phone numbers**.
- Description changed to "Your business numbers for calls and texting."
- Search copy shortened to "Search number."
- Owner search results limited to 5.
- Owner Voice/SMS service rows removed because capabilities belong on individual
  number cards.

Safety: no behavior, billing, Twilio, SMS, or database changes.

---

## 2026-06-03 — fix: move owner number action into selected result

What changed:

- Owner Phone numbers search is collapsed behind **Add number**.
- Expanded search has a small **Hide** action.
- Selected-number action now appears inside the selected result card.
- Duplicate bottom **Selected number** block was removed.

Safety: behavior remains admin-review-only. No purchase, reserve, assign,
release, provision, `clinic_phone_numbers` write, or SMS recovery change.

---

## 2026-06-03 — fix: standardize account setup action buttons

What changed:

- Owner account setup primary buttons were standardized to match the Billing
  panel style.
- Affected buttons: **Save business profile**, **Save approval information**,
  **Add number**, **Search number**, and the historical use-number action.
- Secondary actions such as **Hide** remain visually quiet.

Safety: no behavior, API, billing, Twilio, SMS, or database changes.

---

## 2026-06-03 — fix: sync requested number after owner save

What changed:

- Owner requested-number save now updates the top **Requested number** panel
  immediately from the save response.
- Search collapses after a successful save so **Add number** is visible again.
- This is UI state synchronization only.

Safety: no Twilio purchase, reserve, assign, release, or provision; no
`clinic_phone_numbers` write; no SMS recovery change; no Stripe billing change.

---

## 2026-06-03 — feat: multi-number pricing + additional-number consent foundation

What changed:
- **Pricing source of truth:** new `config/billing.config.ts` (client+server safe;
  no secrets/env/Stripe IDs) holds the $99 base plan, 1 included number / 1,000
  call minutes / 1,000 SMS segments, $20/mo additional numbers, $0.07 call-minute
  and $0.06 SMS-segment overage, plus `formatUsdFromCents` / `formatInteger` /
  `additionalNumberConsentText`. Removed the duplicate `monthlyPriceUsd` from
  `runtime.config.ts`. No plan price/limit is hard-coded elsewhere.
- **Billing panel** (`BillingCard`) now shows a concise, config-sourced plan
  breakdown (included usage, shared-usage statement, additional-number price,
  overage) + an accessible SMS-segment question-mark tooltip (`InfoTooltip` in
  `AccountUI`: hover/focus/click, Escape + outside-click close, no mobile
  overflow, semantic tokens). Payment-method status/card/trial/setup unchanged.
- **Owner Phone numbers** is now multi-number: data model went from single
  `assignedPhone`/`requestedNumber` to `assignedNumbers[]`/`requestedNumbers[]`.
  All assigned numbers + all open requests render with plan labels ("Included
  with plan" / "Additional business number · $20/month [after activation]").
  "Not assigned yet" only when there are no assigned numbers and no open requests.
  Adding a request never hides/replaces an existing number.
- **Additional-number consent:** the request flow classifies the next number on
  the server. For an additional number the selected-number card shows a $20/month
  block + an unchecked-by-default authorization checkbox; the button ("Request
  additional number") is disabled until checked. The checkbox resets on selection
  change / new search / hide. Included numbers use "Request this number" with no
  consent.
- **API** `POST /api/account/phone-numbers/request` accepts optional
  `additional_billing_authorized` only; it never trusts a client price/class/clinic
  id. `createClinicNumberRequest` now runs in a clinic-locked transaction:
  verifies the phone isn't already assigned, de-dupes identical open requests,
  counts active assigned + open requests, classifies included vs additional from
  `billingConfig`, requires consent for additional (`400
  additional_billing_authorization_required`), and stores the pricing/consent
  snapshot. It no longer supersedes other different open requests.
- **Admin console** Phone panel lists all assigned numbers + all open requests
  with billing class, monthly price snapshot, requester, timestamp, and (for
  additional) the consent status/timestamp, the note "Owner authorized $20/month
  when this number is activated.", and "Additional-number purchase remains blocked
  until Stripe subscription billing is implemented."
- **Purchase gate** unchanged behaviour, clearer message: a second-number purchase
  now returns `additional_number_billing_not_ready` explaining the clinic already
  has a number, additional-number Stripe billing isn't implemented, and no Twilio
  purchase was made. First-number path untouched.

Migration: `supabase/migrations/20260603000100_clinic_number_request_billing.sql`
adds billing-snapshot + consent columns to `clinic_number_requests` (defaults
`billing_class='included'`, `monthly_unit_amount_cents=0`, `currency='usd'`), CHECK
constraints (class/amount/currency + included-vs-additional consistency), and a
partial unique index on `(clinic_id, requested_phone_number)` for open statuses.
Additive + idempotent; existing/legacy rows stay `included` and non-billable and
need no retroactive consent. Does NOT touch `clinic_phone_numbers`,
`local_number_status`, `sms_recovery_enabled`, Stripe IDs, or Twilio config. Apply
after a clean duplicate-open-request preflight.

Safety: no Stripe subscription/invoice/charge/PaymentIntent/meter; payment-method
setup stays sandbox-mode; no Twilio purchase/reserve/assign/provision; no
`clinic_phone_numbers` write from the owner path (read-only counts only); no SMS
recovery change. New policy doc: `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`.

Validation: `npm run typecheck` pass; `npm run build` pass; `git diff --check`
clean; price-duplication grep clean. Commit `d894d2f`.

Migration APPLIED to production (`qfjpvbvfvhbtebwivcdc`, Management API
`database/query` via curl, HTTP 201):
- Preflight: duplicate open `(clinic_id, requested_phone_number)` rows = **none**
  (`[]`); 4 total requests (1 open) pre-existing.
- AFTER: all 8 billing/consent columns present; 4 CHECK constraints present
  (`billing_class`, `billing_consistency`, `currency_nonempty`, `monthly_amount`);
  partial unique index `clinic_number_requests_open_unique_idx` present.
- Legacy safety: `non_included_rows = 0` — all 4 existing rows are `included` /
  amount 0 (non-billable, no retroactive consent).

Remaining milestone: live Stripe subscription + usage billing (base item,
additional-number quantity item, usage-based overage items) and activation-time
revalidation — a separate milestone.

---

## 2026-06-03 — harden second-number purchase gate + tooltip hit target + doc fixes

Follow-up safety/accessibility/doc cleanup. No migration, no Stripe, no Twilio call.

- **Purchase gate hardening:** the admin number-purchase route's one-number safety
  gate used `findActiveOfficeTextingNumber()`, which only matches
  `role='office_texting'`. A clinic with a legacy/manually-provisioned active row
  of another role (e.g. `recovery`) could slip past the gate. Added a focused
  read-only helper `findAnyActiveClinicPhoneNumber(clinicId)` (any active row,
  role-agnostic, oldest first, null when none) in `lib/db/clinic-phone-numbers.ts`
  and switched the gate in
  `app/api/admin/clinics/[clinicId]/phone-numbers/purchase/route.ts` to use it.
  Now a clinic with **any** active assigned number is blocked from a second
  purchase (`409 additional_number_billing_not_ready`, same message).
  `findActiveOfficeTextingNumber()` is preserved unchanged for its existing
  callers (onboarding first-number purchase, setup status page); the first-number
  purchase path is unchanged.
- **Tooltip touch target:** the SMS-segment `InfoTooltip` button was ~24×24px.
  Added a transparent, absolutely-centered `::before` overlay (44×44px) on
  `.acct-tooltip-btn` in `app/globals.css` so the tap/click hit target is ≥44×44px
  while the visible icon (14px) and button (24px) stay compact — no layout shift,
  no horizontal overflow, semantic tokens only. No `AccountUI.tsx` change needed
  (hover/focus/click/Escape/outside-click/ARIA already correct).
- **Doc corrections (now match additive multi-number behavior):**
  OPERATIONS-RUNBOOK — replaced "a new request supersedes prior pending ones" with
  the correct rule (multiple different open requests coexist; only an exact
  duplicate is de-duped; requesting another number never cancels/replaces/hides an
  assigned number or a different open request). REPEATABLE-SETUP-CHECKLIST —
  replaced the "supersede prior pending rows" lesson with the additive-resource
  rule (allow multiple different open requests; de-dupe same tenant+resource;
  never silently cancel a different older request). FIRST-CLINIC-ONBOARDING —
  replaced the historical owner use-number button wording with "Request this number" /
  "Request additional number" and clarified it saves a request for admin review.

Safety preserved: second-number block kept (now stricter); first-number path
unchanged; no Twilio purchase/reserve/assign/release/config; no
`clinic_phone_numbers` write; no `sms_recovery_enabled` change; no Stripe
billing/subscription/invoice/charge/meter; no migration.

Validation: `npm run typecheck` pass; `npm run build` pass
(`/api/admin/clinics/[clinicId]/phone-numbers/purchase` compiled); `git diff --check`
clean. Static checks: gate is role-agnostic; `findActiveOfficeTextingNumber` intact
with 2 existing callers; tooltip hit target ≥44px with small visible icon; docs no
longer say different open requests are superseded and no longer use the historical use-number wording.

Commit `1c591a3`; pushed to `origin/main`. (Production auto-deploys; no
authenticated owner browser session in the repo CLI, so tooltip tap QA on a live
375px viewport is the operator's manual check — not fabricated.)

---

## 2026-06-03 — fail closed on the active-number purchase check

Follow-up to the gate hardening above. The active-number safety check in
`app/api/admin/clinics/[clinicId]/phone-numbers/purchase/route.ts` still used
`findAnyActiveClinicPhoneNumber(clinicId).catch(() => null)` — a **fail-open**
bug: a transient DB error would swallow to `null`, the gate would treat the clinic
as having no number, and a second purchase could proceed.

Fix: removed `.catch(() => null)` and wrapped the lookup in an explicit
`try/catch`. On any lookup error the route now **fails closed** — logs
`admin.phone_number.active_check_failed` (clinicId + message only, no secrets) via
the structured logger and returns a safe non-200 **before** the purchase flag
check, the Twilio purchase, and the DB write:
- code: `active_number_check_failed`
- message: "Could not safely verify whether this clinic already has an assigned
  number. No number was purchased."

The existing `additional_number_billing_not_ready` (409) behavior when an active
number IS found is preserved. No Twilio call, no Stripe change, no
`clinic_phone_numbers` write, no `sms_recovery_enabled` change, no migration.

Validation: `npm run typecheck` pass; `npm run build` pass (purchase route
compiled); `git diff --check` clean. Commit `7f17bc1`; pushed to `origin/main`.

---

## 2026-06-03 — Self-service number purchasing milestone built for rollout (historical pre-deploy entry)

Major billing + provisioning milestone built in validated phases on a feature
branch, off `main` @ `5940aec`. At the time of this historical entry, prod migration
apply, Vercel env vars, and push/deploy were held for explicit approval. Stripe
**sandbox/test only**; `TWILIO_NUMBER_PURCHASE_ENABLED` unchanged (false); no real
Twilio purchase or live charge performed.

What changed (by phase / commit):
- **P1 `cddd389`** — `config/billing.config.ts` `productPolicy.defaultSelfServiceBusinessNumberLimit=5`;
  `lib/env.ts` lazy `getStripeBillingEnv()` + presence; migration
  `20260603000200_self_service_number_purchasing.sql` (clinic purchase controls,
  per-number billing/audit snapshot cols, `clinic_phone_number_purchase_attempts`
  with in-flight unique partial indexes); `lib/billing/number-entitlements.ts`
  (single server-side eligibility authority).
- **P2 `e2987f4`** — `lib/phone-numbers/provisioning.ts` shared race-safe service
  (both owner + admin); owner `POST /api/account/phone-numbers/purchase` (first
  included number → assign + start trial, no charge); `…/request` retired → **410**;
  admin purchase route refactored onto the shared service.
- **P3 `649310a`** — `POST /api/account/billing/start-paid-plan` (subscription
  Checkout, server-side base Price ID); Stripe webhook expanded for subscription
  lifecycle, **fail-closed** (5xx on billing DB failure), idempotent.
- **P4 `727c85c`** — additional-number path + `lib/billing/stripe-number-quantity.ts`
  (quantity sync, proration, idempotency from attempt id, fail-closed; activate
  only after sync; never release).
- **P5 `b01531d`** — owner UI: entitlement-driven Phone numbers panel (purchase,
  trial/paid CTAs, $20/mo consent, suspended display, counts) + Billing panel
  (real trial/paid state, Start paid plan); trial countdown from `trial_ends_at`.
- **P6 `e48f3ec`** — admin controls: revoke/allow purchasing, set limit (1–100, not
  below held), suspend/reactivate (no Twilio release, no quantity change), purchase
  attempts + reconciliation visibility, legacy requests labeled + dismiss.
- **P7** — docs (this entry, `BILLING-AND-USAGE-POLICY.md` v2, RUNBOOK, CHECKLIST,
  FIRST-CLINIC).

Production preflight (read-only, clean): 0 clinics >5 numbers, 0 >1 active, 0 dup
mappings, **0 existing subscriptions**, 2 legacy open requests (kept), new
table/cols absent.

Stripe TEST catalog created (`livemode:false`, idempotent; non-secret IDs to set
in Vercel at deploy): `STRIPE_BASE_PLAN_PRICE_ID=price_1TegbY4ZSHLicmejTDngrrYT`
($99/mo), `STRIPE_ADDITIONAL_NUMBER_PRICE_ID=price_1TegbZ4ZSHLicmejnCGGpOEQ` ($20/mo).

Validation (branch): `npm run typecheck` pass; `npm run build` pass; `git diff
--check` clean; no Twilio release code (grep clean).

Historical apply/deploy order used for approval: (1) apply migration to prod Supabase
via Management API; (2) set the two `STRIPE_*_PRICE_ID` env vars in Vercel Production;
(3) merge branch -> push `main` (auto-deploys); (4) verify health + `/account`.
The migration had to be applied before the deploy because the code SELECTs the new
columns. Keep `TWILIO_NUMBER_PURCHASE_ENABLED` false until a deliberate go-live; a
real owner purchase requires it true.

---

## 2026-06-03 — Self-service number purchasing final production rollout

Final production rollout completed after approval.

- Supabase migration `20260603000200_self_service_number_purchasing.sql` was applied
  and verified in production.
- Vercel Production env vars were set:
  - `STRIPE_BASE_PLAN_PRICE_ID`
  - `STRIPE_ADDITIONAL_NUMBER_PRICE_ID`
- Non-secret Stripe test-mode Price IDs configured:
  - Base plan $99/month: `price_1TegbY4ZSHLicmejTDngrrYT`
  - Additional number $20/month: `price_1TegbZ4ZSHLicmejnCGGpOEQ`
- `main` was pushed to `627a560`.
- `main == origin/main == 627a560`.
- Production deployment reached READY.
- `GET https://app.missedcallsdental.com/api/health` returned 200.
- `GET https://app.missedcallsdental.com/account` returned 200 sign-in gate with no
  server-side exception.
- `TWILIO_NUMBER_PURCHASE_ENABLED` remains false.
- `STRIPE_SECRET_KEY` remains test-mode, not live.
- No real Twilio purchase occurred.
- No live Stripe charge occurred.
- SMS recovery is not automatically enabled.

Result: self-service number purchasing is merged and deployed for safe production
testing, with real Twilio purchasing and live Stripe charging still gated for a
separate explicit go-live decision.

---

## 2026-06-05 — Safe mock Twilio number-assignment mode

Implemented a committed runtime-config mode for owner/admin phone-number assignment
testing without buying real Twilio numbers.

What changed:
- Replaced the boolean-only runtime config gate with
  `runtimeConfig.onboarding.twilioNumberPurchaseMode`, defaulting to `"disabled"`.
- Added `getTwilioNumberPurchaseMode()` in `lib/env.ts`; kept
  `isTwilioNumberPurchaseEnabled()` live-only for older direct-purchase routes.
- Updated the shared provisioning service:
  - `"disabled"` marks the attempt `cancelled`, returns safe unavailable copy, and
    never calls Twilio.
  - `"mock"` generates `PN_mock_<attemptId_without_dashes>`, marks the attempt
    `twilio_purchased`, and continues through existing assignment, entitlement,
    trial-start, and additional-number billing logic without calling Twilio purchase
    APIs.
  - `"live"` preserves the existing `purchaseNumberAndConfigure()` behavior.
- Cleaned customer/operator-facing disabled copy so it no longer mentions
  environment flags.
- Updated current source-of-truth docs and runbook sections for disabled/mock/live
  behavior.

Validation:
- `npm run typecheck` — pass.
- `npm run build` — pass.

Manual testing:
- Browser/manual first-number and additional-number assignment tests were not
  completed in this turn because no local/staging mock config change and no
  authenticated test clinic/payment-method/subscription state were used.
- Committed default remained `"disabled"` after validation.

Commit hash:
- Not created. Working tree changes only; no commit was requested.

Push status:
- Not pushed. No production deploy or Vercel env/config change was performed.

Remaining risks:
- Mock-mode first-number and additional-number UX still need local/staging browser QA.
- Additional-number mock testing still exercises Stripe quantity sync when the test
  clinic has webhook-confirmed active paid-plan state; use Stripe test-mode only.
- Twilio available-number search remains a read-only Twilio API path and still needs
  configured Twilio credentials for search QA.

Next steps:
- For local/staging UX testing, temporarily set
  `runtimeConfig.onboarding.twilioNumberPurchaseMode = "mock"`, run owner first-number
  and additional-number tests, verify `PN_mock_*` SIDs in DB rows/attempts, then switch
  the mode back to `"disabled"`.

---

## 2026-06-05 — owner_test_live controlled real-purchase mode + Billing UI cleanup

Baseline: the disabled|mock|live refactor above was committed to local `main` as
**`6f52cea`** (validated: typecheck + build + diff-check clean), then this work was
done on branch **`feat/owner-test-live-purchase`** (NOT merged, NOT deployed).

Scope A — controlled Twilio purchase mode:
- Added a 4th mode **`owner_test_live`** to `twilioNumberPurchaseMode`
  (`disabled|mock|owner_test_live|live`) + non-secret allowlist
  `onboarding.twilioPurchaseTestClinicIds: readonly string[]` (clinic UUIDs — not
  secrets — so committed runtime config, matching project rules).
- `lib/env.ts`: `getTwilioPurchaseTestClinicIds()` + `isClinicAllowedForLivePurchase(clinicId)`
  (true for `live` always; for `owner_test_live` only if the clinic id is allowlisted).
  `isTwilioNumberPurchaseEnabled()` kept live-only.
- `lib/phone-numbers/provisioning.ts`: in the real-purchase branch, a clinic that is
  not allowed (`owner_test_live` + not allowlisted) is treated exactly like `disabled`
  (attempt `cancelled`, safe copy, no Twilio call). `live` unchanged.
- No fake DB columns added; uses existing `clinic_phone_numbers` + purchase-attempt
  fields. SMS recovery untouched.

Scope B — Billing UI cleanup (all prices/usage still from `billing.config.ts`):
- `billing.config.ts` plan displayName → **Standard Plan**.
- BillingCard Plan row: `21-day free trial, then $99/month` (trial/pre-trial) →
  `$99/month` once paid plan active (Free trial row hidden when active; "Ends in X
  days" while trialing; "Starts after your first phone number is assigned" pre-trial).
- Plan details reordered: Standard Plan → Included each month → Usage above the
  included monthly limits → Additional phone numbers. Renamed "Additional business
  numbers" → "Additional phone numbers"; copy → "Billing starts after an additional
  phone number is activated."

Scope C — documented FUTURE milestone "Monthly usage metering + billing breakdown"
in `BILLING-AND-USAGE-POLICY.md` (deferred; UI must not fake usage numbers; full
acceptance criteria recorded). No usage metering implemented.

Validation: `npm run typecheck` pass; `npm run build` pass; `git diff --check` clean.
Default mode remains `"disabled"`; allowlist empty. **No real Twilio purchase made by
these code changes; broad `live` mode not enabled; Stripe stays test-mode.** Branch
pushed for review; not merged/deployed.
