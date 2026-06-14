# Setup Log — Missed Calls Dental

Status: Active  
Purpose: Chronological record of infrastructure and backend setup  
Last updated: 2026-06-14 (admin Clinics list SMS readiness column; delete clinic modal/blocker fix; AI runtime still not live)

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

---

## 2026-06-05 — owner_test_live ARMED in production for one test clinic

Approved by Vlad. `feat/owner-test-live-purchase` fast-forward-merged to `main`
(`0edf8bb`), then runtime config flipped and deployed to production.

- `runtimeConfig.onboarding.twilioNumberPurchaseMode`: `disabled` -> **`owner_test_live`**.
- `twilioPurchaseTestClinicIds`: **`["f37f24a1-070f-436b-b803-956f55466093"]`** =
  "Fairstone Dental Smile" (owner `livedealsmart@gmail.com`). ONLY this clinic may make
  a real Twilio purchase; every other clinic is treated like `disabled`.
- Broad `"live"` mode stays OFF. Stripe stays test-mode. SMS recovery unchanged
  (`sms_recovery_enabled` not touched; clinic value remains false).
- Validation: `npm run typecheck` pass; `npm run build` pass.
- Commit `cb1dd5d` on `main`; `main == origin/main == cb1dd5d`.
- Vercel production deploy `dpl_Hn6oes6a21MCWiGLM43P2uer3vna` reached READY;
  `app.missedcallsdental.com` aliased to it. `/api/health`, `/account`, `/login` all 200.
- **No real Twilio purchase has occurred** — the config only ARMS the capability; a real
  purchase happens only when that clinic's owner clicks purchase in the production app.

To stand down: set `twilioNumberPurchaseMode` back to `"disabled"` (optionally clear the
allowlist), commit, push `main`, redeploy.

---

## 2026-06-05 — Post-audit production purchase safety fix

Implemented the minimal follow-up fix after the first real Twilio purchase audit
for Fairstone Dental Smile (`clinic_id=f37f24a1-070f-436b-b803-956f55466093`,
number `+12244009986`, PN `PNcfa04ebbb3c99d346473979781eb8785`).

What changed:
- Added migration `20260605000100_twilio_number_address_status.sql` with additive
  `clinic_phone_numbers` metadata columns:
  `twilio_address_sid`, `twilio_emergency_address_sid`,
  `twilio_emergency_address_status`, `twilio_address_configured_at`.
- Added a shared real-purchase readiness check in
  `lib/phone-numbers/provisioning.ts` after durable attempt creation and before
  `getAppDomains()` or any Twilio API call. Required fields:
  `name`, `legal_business_name`, `main_phone`, `street_address`, `city`,
  `state_region`, `postal_code`, `country='US'`, and
  `business_info_completed=true`.
- Missing readiness fields now mark the purchase attempt `cancelled` with
  `error_code='missing_fields'` and return HTTP 400 from owner/admin purchase
  routes with `error.missing_fields`.
- `purchaseNumberAndConfigure()` now creates/reuses an emergency-enabled Twilio
  Address from the clinic business address, attaches it to the purchased
  IncomingPhoneNumber, and then attaches the number to the configured Messaging
  Service.
- Address setup or Messaging Service attach failure after purchase now throws a
  typed configuration error carrying the purchased PN SID; provisioning marks the
  attempt `reconciliation_required` and preserves the SID.
- Legacy token-scoped number purchase route now delegates to the shared
  provisioning service instead of calling Twilio directly.
- Admin SMS launch now requires `sms_status='active'`; saved local A2P fields
  alone are not enough to enable `sms_recovery_enabled`.

Validation:
- `npm run typecheck` — pass.
- `npm run build` — pass.
- `git diff --check` — pass.

Safety:
- No Twilio number was purchased during validation.
- No SMS was sent.
- `sms_recovery_enabled` was not changed.
- Existing `+12244009986` Twilio configuration was not modified.
- No secrets were printed.

Deploy notes:
- Apply `20260605000100_twilio_number_address_status.sql` before deploying code
  that writes the new columns.
- The already purchased Fairstone number still needs manual/approved remediation
  for emergency address and A2P/10DLC; this task only fixes future purchases.

---

## 2026-06-05 — Phone hardening deployed; existing-number remediation stopped

Production hardening sequence continued after commit `db334b0`.

Validation before deploy:
- `npm run typecheck` — pass.
- `npm run build` — pass.
- `git diff --check` — pass.

Migration:
- Applied `supabase/migrations/20260605000100_twilio_number_address_status.sql`
  to Supabase.
- Verified `clinic_phone_numbers` columns exist:
  `twilio_address_sid`, `twilio_emergency_address_sid`,
  `twilio_emergency_address_status`, `twilio_address_configured_at`.

Deploy:
- Commit `db334b0` pushed to `origin/main`.
- Vercel production deployment `dpl_AheUtkcWDkXgGdMWPbSVfqyD9bK2` reached READY.
- Alias includes `app.missedcallsdental.com`.
- Smoke checks passed:
  - `GET https://app.missedcallsdental.com/api/health` — 200.
  - `GET https://app.missedcallsdental.com/account` — 200.
  - `GET https://app.missedcallsdental.com/login` — 200.

Existing number remediation attempt:
- Target: Fairstone Dental Smile, `+12244009986`,
  PN `PNcfa04ebbb3c99d346473979781eb8785`.
- Created/reused Twilio Address `ADe303a7e8801efdff77e94b6bec887a59`
  with `emergencyEnabled=true` for the clinic business address.
- Twilio rejected the IncomingPhoneNumber update with:
  `Cannot modify both emergency address SID and emergency status in the same request.`
- Per safety rule, no second write attempt was made.

Post-rejection verification:
- IncomingPhoneNumber remains `in-use`.
- Voice webhook and voice status callback unchanged.
- SMS webhook unchanged.
- Messaging Service attachment remains present.
- IncomingPhoneNumber `addressSid` and `emergencyAddressSid` remain null.
- IncomingPhoneNumber emergency address status remains `unregistered`.
- Supabase `clinic_phone_numbers` row remains active, `billing_class='included'`,
  PN SID unchanged.
- New Twilio address/emergency metadata columns remain null because the PN update
  did not succeed.
- `clinics.sms_recovery_enabled=false`; `clinics.sms_status='waiting_for_approval'`.
- A2P/10DLC API check still returns no Brand registrations and no campaigns for
  the Messaging Service.

Result:
- Deployed safety fix is active for missing-field blocking.
- Existing-number emergency/address remediation is **not complete**.
- Do not run a second-number real purchase test until the Twilio update sequence
  is corrected and redeployed/approved; the observed API behavior requires
  address SID and emergency status changes to be handled without sending both in
  one request.
- No SMS sent, no new number purchased, broad live mode unchanged, no secrets
  printed.

---

## 2026-06-05 — Split Twilio emergency update deployed; Fairstone number remediated

Implemented and deployed the corrected Twilio emergency-address update sequence.

What changed:
- `lib/twilio/numbers.ts` now updates the IncomingPhoneNumber with
  `addressSid` / `emergencyAddressSid` first, then updates `emergencyStatus`
  separately only if Twilio still reports it is not `Active`, then fetches the
  number and persists returned status.

Validation:
- `npm run typecheck` — pass.
- `npm run build` — pass.
- `git diff --check` — pass.

Deploy:
- Commit `cc2321c8acedcde33095adfd428dfbf5a1391413` pushed to `main`.
- Vercel production deployment `dpl_DhEv4awAtLDGdiaL71PZtrgj5eWH` reached READY.
- Smoke checks passed:
  - `GET https://app.missedcallsdental.com/api/health` — 200.
  - `GET https://app.missedcallsdental.com/account` — 200.
  - `GET https://app.missedcallsdental.com/login` — 200.

Existing number remediation:
- Target: Fairstone Dental Smile, `+12244009986`,
  PN `PNcfa04ebbb3c99d346473979781eb8785`.
- Reused Twilio Address `ADe303a7e8801efdff77e94b6bec887a59`.
- Applied split sequence successfully.
- Twilio result:
  - number status: `in-use`
  - emergencyAddressSid: `ADe303a7e8801efdff77e94b6bec887a59`
  - emergencyAddressStatus: `registered`
  - emergencyStatus: `Active`
  - voice/SMS webhooks unchanged
  - Messaging Service attachment still present
- Supabase result:
  - `clinic_phone_numbers.is_active=true`
  - PN SID unchanged
  - `billing_class='included'`
  - `twilio_address_sid='ADe303a7e8801efdff77e94b6bec887a59'`
  - `twilio_emergency_address_sid='ADe303a7e8801efdff77e94b6bec887a59'`
  - `twilio_emergency_address_status='registered'`
  - `clinics.sms_recovery_enabled=false`
  - `clinics.sms_status='waiting_for_approval'`
- A2P check: no Brand registrations and no campaigns returned for the configured
  Messaging Service. Outbound SMS remains not production-safe.

Safety:
- No SMS sent.
- No new Twilio number purchased.
- `sms_recovery_enabled` unchanged.
- Broad live mode unchanged.
- No secrets printed.

## 2026-06-05 — In-app paid-plan start for add-phone-number flow

Implemented a focused billing UX/backend change for the owner add-phone-number path.

What changed:
- Phone numbers paid-plan blocker now shows **Add phone number** instead of
  "End trial and start paid plan".
- The add-phone-number action opens an in-app confirmation showing prices sourced
  from `config/billing.config.ts`:
  - Standard Plan: `$99/month`
  - Additional phone number: `$20/month`
  - Total: `$119/month`
  - Checkbox: "I understand my saved payment method will be charged $119/month."
- `POST /api/account/billing/start-paid-plan` no longer creates a subscription
  Checkout Session. It creates a Stripe test-mode subscription server-side using
  the saved Stripe Customer, saved PaymentMethod, and server-side base plan Price
  ID with `collection_method='charge_automatically'` and
  `payment_behavior='error_if_incomplete'`.
- The API returns structured JSON (`ok`, `status`) instead of a Stripe URL.
- Payment/card failure or required card action returns `payment_failed` with
  owner-safe copy directing the owner to update the payment method in Billing.
- Paid entitlement still remains webhook-confirmed only; the client refreshes
  while waiting for `billing_status='active'`.
- Billing policy/runbook/source docs were updated to remove current paid-plan
  Checkout wording and record the server-side subscription behavior.

Validation:
- `npm run typecheck` — pass.
- `npm run build` — pass.
- `git diff --check` — pass.

Safety:
- No SMS sent.
- No Twilio number purchased.
- `sms_recovery_enabled` unchanged.
- Broad Twilio live mode unchanged.
- No Stripe Checkout redirect for paid-plan start.
- Payment-method setup Checkout remains unchanged.
- No secrets printed.

Commit/deploy status:
- Pending final commit/push/deploy approval at the time this entry was written.

## 2026-06-05 — Paid-plan confirmation pending-state fix

Diagnosed and fixed the production stuck state after the owner clicked **Add phone number**
for Fairstone Dental Smile.

Root cause:
- Production `POST /api/account/billing/start-paid-plan` returned 200.
- Stripe test mode had created one active paid-plan subscription for the clinic's saved
  customer/payment method, with a paid latest invoice.
- Supabase still showed `billing_status='trialing'`, no stored subscription id, no base
  subscription item id, and `paid_plan_started_at=null`.
- Only an old setup Checkout webhook was present in `webhook_events`; no subscription or
  invoice webhook had updated the clinic row. The UI was waiting for DB entitlement that
  never changed and had no timeout error state.

What changed:
- Added shared Stripe subscription-state helpers in `lib/billing/stripe-subscription-state.ts`.
- `start-paid-plan` now looks for an existing active paid-plan subscription for the saved
  customer before creating another subscription, persists it if found, and avoids duplicate
  active subscriptions.
- After `stripe.subscriptions.create(...)` succeeds, `start-paid-plan` immediately persists
  the returned subscription state with the same conservative status mapping as the webhook.
- Stripe webhook subscription handlers now reuse the shared status/item mapping helpers and
  remain idempotent ongoing truth.
- Added a reusable account `ConfirmationDialog` component and moved the add-phone-number
  paid-plan confirmation to it.
- The modal now has explicit states: `Continue`, `Starting...`, `Confirming...`, and a clear
  timeout error if active billing cannot be confirmed after polling.
- Owner final number-purchase confirmation also uses the shared confirmation dialog.

Validation:
- `npm run typecheck` — pass.
- `npm run build` — pass.
- `git diff --check` — pass.

Safety:
- No SMS sent.
- No Twilio number purchased.
- `sms_recovery_enabled` unchanged.
- Broad Twilio live mode unchanged.
- No secrets printed.

Follow-up after deploy:
- Commit `f5926c726b394bf31bca483df6c226e7a6da71c4` pushed to `main`.
- Vercel production deployment `dpl_9eX11JV7nR6EvhMzTz4SnSgWYxvR` reached READY.
- Production smoke checks passed: `/api/health`, `/account`, and `/login` returned 200.
- Existing Fairstone Dental Smile Stripe test subscription was reconciled into Supabase without
  creating a new subscription: `billing_status='active'`, subscription id present, base subscription
  item id present, additional-number item absent, and `paid_plan_started_at` populated.
- Existing phone-number state after remediation: one active included number (`+12244009986`).
- `sms_recovery_enabled=false` and `sms_status='waiting_for_approval'` remained unchanged.
- No SMS sent, no Twilio number purchased, broad Twilio live mode unchanged.
## 2026-06-06 — Production readiness docs refresh after Fairstone billing/number audit

Scope:

- Refreshed the canonical real-vs-blocked readiness reference after read-only
  Supabase, Stripe test-mode, Twilio, and A2P checks for Fairstone Dental Smile
  (`f37f24a1-070f-436b-b803-956f55466093`).
- Documentation-only change; no source code behavior changed.

Confirmed current state:

- Billing/payment method is no longer a placeholder for the controlled test
  flow: Fairstone has a saved Stripe test-mode card, active test-mode
  subscription, base plan item, and one additional-number item.
- Phone number assignment is no longer `blocked_external` for the controlled
  allowlisted owner-test clinic: Fairstone has one included active Twilio number
  and one additional active Twilio number.
- Broad Twilio `"live"` mode remains off. Current purchase mode is
  `owner_test_live` for the single committed Fairstone allowlist entry only.
- SMS recovery remains off: `sms_recovery_enabled=false`,
  `sms_status=waiting_for_approval`, and audited `messages`/`call_events` counts
  were 0.
- Twilio reports both Fairstone numbers emergency registered, but the DB still
  stores `pending-registration` for the second number's emergency status and
  should be refreshed by a future reconciliation path.
- Twilio Messaging Service coverage is not ready: read-only audit did not show
  either Fairstone PN SID attached to the configured Messaging Service.
- A2P/10DLC is not ready: no Brand registrations or Messaging Service campaigns
  were found.

Docs changed:

- `MVP_BUILD_DOCS/PRODUCTION-READINESS-PLACEHOLDER-AUDIT.md`
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`

Validation:

- `npm run typecheck` — pending in this entry; see final report.
- `npm run build` — pending in this entry; see final report.
- `git diff --check` — pending in this entry; see final report.

Commit/push:

- Pending at time of log entry; see final report for the exact commit hash and
  push/deployment status.

Safety:

- No SMS sent.
- No Twilio number purchased, released, or configured.
- No Stripe state changed.
- No Vercel env changed.
- No `sms_recovery_enabled` change.
- No secrets printed or documented.

## 2026-06-06 — Fail-closed SMS readiness guards

Scope:

- Added additive readiness tracking for A2P/Messaging Service launch state:
  `clinic_sms_readiness` and `clinic_sms_number_readiness`.
- Added a platform-admin read-only readiness sync endpoint for clinic SMS launch
  checks. The sync reads Twilio Messaging Service, sender, Brand, and Campaign
  status and writes only local readiness tables.
- Hardened admin `enable_sms` so it fails closed unless every active number has
  fresh production-safe A2P/Messaging Service coverage.
- Hardened live `sendRecoverySms()` so no Twilio SMS send call happens unless
  `SMS_RECOVERY_MODE=live`, `sms_recovery_enabled=true`,
  `sms_status='active'`, and readiness data confirms the called number is
  covered.
- Preserved owner-test SMS behavior: still restricted to explicit
  `SMS_TEST_ALLOWED_TO` destinations.
- Updated admin SMS console copy/status display and owner-facing SMS approval
  copy so saved A2P information is not presented as a submitted/approved carrier
  launch.

Files changed:

- `supabase/migrations/20260606000100_sms_readiness_tracking.sql`
- `lib/db/sms-readiness.ts`
- `lib/twilio/sms-readiness-sync.ts`
- `app/api/admin/clinics/[clinicId]/sms-readiness/sync/route.ts`
- `app/api/admin/clinics/[clinicId]/action/route.ts`
- `app/api/webhooks/twilio/voice/incoming/route.ts`
- `lib/twilio/outbound-sms.ts`
- `lib/db/clinics.ts`
- `lib/db/admin/clinics.ts`
- `lib/db/admin/types.ts`
- `app/admin/(console)/clinics/[clinicId]/_components/AdminClinicConsole.tsx`
- `app/setup/[token]/_components/SmsApprovalForm.tsx`
- `MVP_BUILD_DOCS/PRODUCTION-READINESS-PLACEHOLDER-AUDIT.md`
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
- `MVP_BUILD_DOCS/SETUP-LOG.md`

Validation:

- `npm run typecheck` — pass.
- `npm run build` — pass.
- `git diff --check` — pass.

Operational notes:

- Migration is additive only. Apply it in the approved target database before
  using the admin readiness sync route.
- The readiness sync is read-only against Twilio. It does not submit A2P, attach
  senders, mutate webhooks, send SMS, buy/release numbers, or change provider
  configuration.
- Missing readiness rows, stale sync data, sync errors, missing Brand/Campaign,
  missing Messaging Service sender coverage, or unsafe status all block live SMS.
- Fairstone still needs provider-side Messaging Service/A2P readiness verified
  by fresh read-only sync before any SMS launch approval.

Commit/push:

- Code commit: `56abda3f963af9b69f0d0b8e5cc3f44f7e13a68e`
  (`feat: add fail-closed SMS readiness guards`), pushed to `origin/main`.
- Vercel production deployment:
  `dpl_7pZDMZxiEmF32CFaaZ7LPbY9D1Y1`, READY.
- Safe smoke checks after deployment: `/api/health` 200, `/login` 200,
  `/account` 200.

Safety:

- No SMS sent.
- No Twilio number purchased, released, attached, detached, or configured.
- No A2P submission.
- No Stripe state changed.
- No Vercel env changed.
- `sms_recovery_enabled` unchanged.
- No secrets printed or documented.

---

## 2026-06-07 — Platform-admin A2P/10DLC approval review workflow

Scope:

- Added a platform-admin-only A2P/10DLC approval review workflow. The system
  owner reviews the exact clinic/campaign/service-aware A2P package and records
  whether it is ready to submit. The clinic owner has no submit path.
- Review-only / dry-run. No real Twilio A2P submission, no provider mutation, no
  SMS, no `sms_recovery_enabled` change.

Baseline verified before coding (read-only):

- `main` includes `56abda3` (fail-closed SMS readiness guards) and `5e0ab96`
  (record sms readiness deployment).
- Readiness migration `20260606000100_sms_readiness_tracking.sql` exists locally
  but is NOT applied in production: a read-only check on the production Supabase
  (`qfjpvbvfvhbtebwivcdc`) showed `clinic_sms_readiness` and
  `clinic_sms_number_readiness` absent. `set_updated_at()` and
  `admin_audit_events` exist.
- Fairstone (`f37f24a1-070f-436b-b803-956f55466093`): both numbers active
  office-texting (`+12244009986`/`PNcfa04ebbb3c99d346473979781eb8785` included,
  `+12243442685`/`PN04b5bd6be9a95f26412c58bafea04512` additional). Clinic-side
  A2P packet complete (legal name, EIN, `PRIVATE_PROFIT`, rep email/phone, full
  address, website, `a2p_info_completed=true`, `a2p_authorized=true`).
  `sms_status=waiting_for_approval`, `sms_recovery_enabled=false`.

New files:

- `supabase/migrations/20260607000100_a2p_submission_tracking.sql` — additive,
  idempotent `clinic_a2p_submissions` table (one row per clinic, RLS on,
  service-role only). Stores review/submission status, submission mode, target
  Messaging Service SID, selected PN SIDs, future Twilio resource SIDs
  (Customer/Secondary Profile, Trust Product, Brand, Campaign, Messaging
  Service), submitted_at/by, status-sync bookkeeping, rejection reason, and a
  redacted `payload_snapshot` (never the full EIN).
- `lib/a2p/types.ts` — client-safe shared types (no server imports).
- `lib/a2p/review-package.ts` — server-side package builder (single source of
  truth for the page and the submit endpoint).
- `lib/db/a2p-submissions.ts` — tri-state read (`available`) + idempotent upsert.
- `lib/twilio/a2p-submission.ts` — future real-submission helper. Every function
  throws `A2pSubmissionDisabledError` by default; documents the real Customer
  Profile → Trust Product → Brand → Campaign → Messaging Service →
  sender-attachment order, fees, and risks. No live mutation.
- `app/api/admin/clinics/[clinicId]/a2p/submit/route.ts` — platform-admin-only
  submit endpoint (re-validates server-side, refuses duplicates, dry-run only).
- `app/admin/(console)/clinics/[clinicId]/_components/AdminA2pReviewPanel.tsx` —
  the review UI.

Changed files:

- `config/runtime.config.ts` — added `a2p.submissionMode` (default `"dry_run"`).
- `lib/env.ts` — `getA2pSubmissionMode()` + `isRealA2pSubmissionEnabled()`
  (hard `false`).
- `lib/db/sms-readiness.ts` — added `getSmsReadinessState()` (tri-state) +
  `isReadinessFresh()`.
- `app/admin/(console)/clinics/[clinicId]/page.tsx` — builds the package.
- `app/admin/(console)/clinics/[clinicId]/_components/AdminClinicConsole.tsx` —
  new "A2P review" tab + nav status.
- `app/admin/(console)/_components/AdminUI.tsx` — audit label for
  `clinic.a2p.submit_dry_run`.
- `MVP_BUILD_DOCS/PRODUCTION-READINESS-PLACEHOLDER-AUDIT.md`,
  `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`, `MVP_BUILD_DOCS/SETUP-LOG.md`.

Behavior:

- Submission mode default is `dry_run`: submit records a local
  `dry_run_reviewed` status (ready for manual submission in the Twilio console).
- Real A2P submission is disabled (`isRealA2pSubmissionEnabled()` = false; the
  endpoint refuses `live`).
- Graceful degradation: when the readiness/submission tables are absent the page
  shows "SMS readiness data unavailable", blocks submit, and blocks SMS
  enablement. Only `covered` numbers display as approved/covered; everything else
  is "Not approved yet" / "Not covered yet".

Migrations applied: NO. Both `20260606000100_sms_readiness_tracking.sql` and
`20260607000100_a2p_submission_tracking.sql` remain PENDING in production. Apply
them in order by hand in the approved Supabase project with owner approval. See
OPERATIONS-RUNBOOK.md (Platform-admin A2P review workflow) for the verify query.

Validation:

- `npm run typecheck` — pass.
- `npm run build` — pass.
- `git diff --check` — pass.

Commit/push/deploy:

- See final report for the exact commit hash, push status, and any Vercel
  deployment.

Safety:

- No SMS sent.
- No Twilio number purchased, released, attached, detached, or configured.
- No A2P submission; no Twilio provider mutation.
- No Messaging Service attach/detach.
- No Stripe state changed.
- No Vercel env changed.
- `sms_recovery_enabled` unchanged.
- No production DB migration applied.
- No secrets printed or documented.

---

## 2026-06-06 — Production readiness migrations applied + read-only readiness sync (Fairstone)

Records two operational steps performed after the A2P review workflow code
shipped (commit `24e318d`). No product behavior code was changed.

### Production migrations applied

Applied, in order, to the production Supabase project `qfjpvbvfvhbtebwivcdc`
(`sms_dental`) via the Supabase migration tooling. Both are additive/idempotent;
no existing data was rewritten.

1. `supabase/migrations/20260606000100_sms_readiness_tracking.sql`
   → `public.clinic_sms_readiness`, `public.clinic_sms_number_readiness`.
2. `supabase/migrations/20260607000100_a2p_submission_tracking.sql`
   → `public.clinic_a2p_submissions`.

Verified: all three tables exist, column structures match the migrations, and
RLS is enabled on all three.

### Read-only SMS readiness sync (Fairstone)

Ran the existing read-only `syncClinicSmsReadinessFromTwilio()` for Fairstone
Dental Smile (`f37f24a1-070f-436b-b803-956f55466093`) — the same read-only
Twilio reads (Messaging Service fetch, sender list, A2P brand/campaign list) plus
local readiness-row writes that the platform-admin route
`POST /api/admin/clinics/:clinicId/sms-readiness/sync` performs. No Twilio
mutation, no SMS, no `sms_recovery_enabled` change.

Result written to `clinic_sms_readiness` / `clinic_sms_number_readiness`
(`last_synced_at` 2026-06-06 ~04:10 UTC, `last_sync_error_code` null on every
row — the Twilio reads succeeded):

- Messaging Service `MG83239dc7dfdf8aa6c9b397e8258f7d93`: `messaging_service_status=verified`.
- A2P brand: none found (`unknown`); A2P campaign: none found (`unknown`);
  clinic `a2p_status=blocked`, `production_safe=false`,
  `launch_blocking_reason=a2p_brand_not_verified`.
- `+12244009986` / `PNcfa04ebbb3c99d346473979781eb8785` (included):
  `messaging_service_sender_status=missing`, `a2p_campaign_coverage_status=missing`,
  `production_safe=false`, reason `number_not_in_messaging_service`.
- `+12243442685` / `PN04b5bd6be9a95f26412c58bafea04512` (additional):
  same — `sender=missing`, `campaign=missing`, `production_safe=false`,
  reason `number_not_in_messaging_service`.

Admin A2P review package (the data the platform-admin tab renders) verified via
the server-side builder: `readinessAvailable=true` (the tab no longer shows
"SMS readiness data unavailable"); both numbers `coverageDisplay=not_in_messaging_service`
→ "Not covered yet" (neither shown as Approved); `submissionMode=dry_run`,
`realSubmissionEnabled=false`, `submitEligible=true` (dry-run review only).

Meaning: live patient SMS remains correctly blocked. Before launch, both numbers
must become Messaging Service senders AND an approved A2P Brand + Campaign must
cover them, then a fresh sync must report `production_safe=true` per number.

Optional dry-run submit (`clinic_a2p_submissions`) was not exercised: it needs an
authenticated platform-admin identity to record faithfully, and the package
already confirms the dry-run path is eligible and mutation-free.

Safety: no SMS sent; Twilio calls read-only only (no mutation); no Messaging
Service attach/detach; no A2P submitted; no Brand/Campaign created; no Stripe
change; no Vercel env change; `sms_recovery_enabled` unchanged; no secrets
printed.

---

## 2026-06-08 — Real one-click platform-admin A2P submission workflow (off by default)

Implemented the REAL Twilio A2P/10DLC submission flow behind the existing
review-first platform-admin workflow. Real submission is OFF by committed
default; no real submit was run during development.

Twilio API research (verified against installed SDK + official docs, not memory):

- Installed SDK is `twilio@5.13.1` (exposes `trusthub.v1` customerProfiles /
  endUsers / supportingDocuments / trustProducts + entity-assignment/evaluation
  subresources, and `messaging.v1` brandRegistrations + service usAppToPerson /
  phoneNumbers). Create-option shapes + status enums read from the `.d.ts` types.
- Fixed policy SIDs from the Twilio A2P ISV API onboarding docs: Secondary
  Customer Profile `RNdfbf3fae0e1107f8aded0e7cead80bf5`; A2P Trust Product
  `RNb0d4771c2c98518d916a3d4cd70a8f8b`. EndUser types
  `customer_profile_business_information`, `authorized_representative_1`,
  `us_a2p_messaging_profile_information` and the 19-step REST sequence confirmed.
- No API step is impossible for the standard ISV path; brand/campaign vetting is
  asynchronous, so the flow stops-and-persists at pending and resumes on re-click.

Design decision (Part C): real "live" mode is implemented but NOT armed by
committed default (`a2p.submissionMode="dry_run"`), mirroring the
`twilioNumberPurchaseMode` allowlist pattern. Rationale: real submission creates
billable, externally-vetted, hard-to-reverse resources, needs an
account-specific primary Customer Profile SID, and cannot be safely
execute-tested here. Arming requires mode=live + per-clinic allowlist +
configured `trustHub.primaryCustomerProfileSid` + an admin Submit click.
`isRealA2pSubmissionEnabled()` is now config-driven (no longer hard-false).

New files:

- `lib/twilio/a2p-submission.ts` — real, idempotent, resumable state machine
  (`runRealA2pSubmission`) + read-only `readA2pProviderStatus`. Persists each
  created SID; reuses on retry; full EIN sent to Twilio but never logged/stored.
- `lib/a2p/campaign-content.ts` — fixed missed-call-recovery campaign content
  (use case, description, opt-in/message-flow, sample messages, STOP/HELP).
- `app/api/admin/clinics/[clinicId]/a2p/status/route.ts` — read-only provider
  status refresh (platform-admin guarded, audited).
- `supabase/migrations/20260608000100_a2p_submission_state.sql` — additive
  `submission_step` + `provider_state` columns for resumable progress.

Changed files: `config/runtime.config.ts` (a2p block: live mode, allowlist,
Trust Hub policy SIDs, primary profile, brand/campaign constants), `lib/env.ts`
(config-driven gating helpers), `lib/a2p/types.ts` + `lib/a2p/review-package.ts`
(campaign content, planned resources, fees/risk, live-arming, richer submission
info), `lib/db/a2p-submissions.ts` (resumable progress upsert + degradation-safe
read), `app/api/admin/clinics/[clinicId]/a2p/submit/route.ts` (live vs dry_run,
before/after/failure audits), the admin A2P review panel (full package +
confirmation-gated submit + status refresh), and `AdminUI` audit labels.

Migration status: `20260608000100_a2p_submission_state.sql` is PENDING in
production (apply before arming live mode). The submissions read path falls back
to the base columns if the new columns are absent, so dry-run keeps working.

Live SMS unchanged: `sendRecoverySms()`, `SMS_RECOVERY_MODE`, the readiness
guards, and `sms_recovery_enabled` were not touched. Live SMS remains fail-closed
after A2P approval until coverage is verified and Vlad separately enables it.

Validation: `npm run typecheck` pass; `npm run build` pass; `git diff --check`
pass.

Safety: no SMS sent; NO real A2P submission run (live mode off; no real submit
during development); no Twilio mutation during validation; no Messaging Service
attach/detach; no Stripe change; no Vercel env change; no production DB migration
applied; `sms_recovery_enabled` unchanged; no secrets or full EIN printed.

---

## 2026-06-08 — A2P submission-state migration applied + Primary Profile SID configured (live NOT armed)

Prepared the deployed app toward a one-click Fairstone A2P submit. Live mode was
deliberately NOT armed (kept `dry_run`) pending operator verification — see the
account-state finding below.

Migration applied to production (`qfjpvbvfvhbtebwivcdc`):

- `supabase/migrations/20260608000100_a2p_submission_state.sql` (additive). Verified
  `clinic_a2p_submissions` now has `submission_step text` + `provider_state jsonb`.

Read-only Twilio Trust Hub discovery (no mutation, no submit):

- Primary Customer Profile found: `BUaeab21ee3b774f0293e17522e6a1337c`
  ("AllyExporter LLC", twilio-approved — the ISV/account profile that vouches for
  per-clinic secondary profiles). SIDs are object references, not secrets.
- Also present: a draft "missedcallsdental.com" Customer Profile
  (`BU668e1080d4cbf61beec1a8dac79c3353`), and an already-twilio-approved A2P Trust
  Product (`BUe3685e30463e9317a51a3b24726c050f`) on policy
  `RNa282dd7f3dbef8586501ca2e045e764c` — which DIFFERS from the configured
  `a2pTrustProductPolicySid` (`RNb0d4771c2c98518d916a3d4cd70a8f8b`).

Config change (committed):

- Set `runtimeConfig.a2p.trustHub.primaryCustomerProfileSid =
  "BUaeab21ee3b774f0293e17522e6a1337c"`.
- `submissionMode` LEFT at `"dry_run"` (NOT flipped to "live"). `liveSubmitClinicIds`
  unchanged (Fairstone only). No brand/campaign config values changed.

Decision (operator): set the SID only and stay `dry_run`. Rationale: the account's
Trust Hub is not a clean slate (existing approved A2P Trust Product on a different
policy + a draft platform profile). Before arming live, verify (a) the intended
brand model — per-clinic brand/campaign (what the helper builds) vs a shared
platform brand — and (b) that `a2pTrustProductPolicySid` matches the account, so a
real submit does not create duplicate/wrong billable resources.

Fairstone review package (read-only build, no submit): `found=true`,
`missingFields=[]`, both numbers present (`+12244009986`/`PNcfa…85`,
`+12243442685`/`PN04b…12`) showing "Not covered yet", `submissionMode=dry_run`,
`liveSubmitArmed=false` (mode is dry_run), `submitEligible=true` (dry-run review).

Remaining to ARM live (follow-up, after operator verification): set
`submissionMode="live"` and redeploy. The primary SID + migration are already in
place. Real mutation still requires a platform admin to review + tick the
authorization checkbox + click Submit.

Validation: `npm run typecheck` pass; `npm run build` pass; `git diff --check`
pass. Smoke: `/api/health` 200, `/login` 200, `/account` 200, `/admin/login` 200.

Safety: no real A2P submission run; no SMS sent; Twilio calls read-only only (no
mutation); no Messaging Service attach/detach; no Brand/Campaign created; no
Stripe change; no Vercel env change; `sms_recovery_enabled` unchanged; no secrets
or full EIN printed.

---

## 2026-06-08 — Minimum-information A2P payload + live armed for Fairstone (submit blocked by website)

Applied a project-wide minimum-information rule, audited the A2P provider
payload, cleaned up the admin review UI, and armed live mode for Fairstone. No
real submit was run.

Minimum-information rule: added to `AGENTS.md` — send/show/store only the minimum
required information; omit optional provider fields; never substitute unrelated
data; separate "submitted to provider" from "internal diagnostics"; protect full
EIN. Applied throughout the A2P workflow.

Payload audit result: the Twilio A2P calls already sent only required fields. The
optional campaign fields (opt-in/opt-out/help messages + keywords, subscriberOptIn,
ageGated, directLending, privacyPolicyUrl, termsAndConditionsUrl), brand
mock/skipAutomaticSecVet, profile statusCallback, and address emergency/auto-correct
flags are NOT sent. Privacy/SMS-terms/business-page URLs are internal context and
are NOT submitted. Both the submission helper and the review UI now derive the
EndUser/address payload from one shared module (`lib/a2p/provider-payload.ts`), so
"what is shown" exactly equals "what is submitted" (EIN masked in the view; raw EIN
sent to Twilio only, never logged/stored).

Website guard (important): Fairstone's stored `website` is `https://allyexp.com` —
the account-owner/ISV domain, NOT the clinic's own website. Per the rule, the
review package now BLOCKS submission when the website is a disallowed
platform/placeholder host (config `a2p.disallowedClinicWebsiteHosts = ["allyexp.com"]`)
instead of sending unrelated data. Verified read-only: `missingFields=[website]`,
`submitEligible=false`. Vlad must set Fairstone's real clinic website before the
Submit button activates.

Config armed: `a2p.submissionMode = "live"`; `liveSubmitClinicIds` = Fairstone only;
`trustHub.primaryCustomerProfileSid = BUaeab21ee3b774f0293e17522e6a1337c`. Verified
read-only: `liveSubmitArmed=true`, `realSubmissionEnabled=true`, both numbers present
(`+12244009986`/`PNcfa…85`, `+12243442685`/`PN04b…12`), both "Not covered yet".

UI: A2P review tab refactored — top summary (Can submit now / Mode / Main blocker /
Next action / Submit button), then "What will be submitted to Twilio" (minimal
payload grouped by resource), "Required information", "Numbers included", and a
collapsed "Internal diagnostics" section (readiness, SIDs, statuses, sync times,
planned resources, fees/risk, warnings, compliance URLs marked not-submitted).

Account-state caveat (unchanged from prior task): the Twilio account already has an
approved A2P Trust Product on a different policy SID and a draft
"missedcallsdental.com" profile. Confirm the per-clinic-vs-shared-brand model and
`a2pTrustProductPolicySid` before the first real submit.

Files: `AGENTS.md`, `config/runtime.config.ts`, `lib/env.ts`,
`lib/a2p/provider-payload.ts` (new), `lib/a2p/types.ts`, `lib/a2p/review-package.ts`,
`lib/twilio/a2p-submission.ts`, the admin A2P review panel, and the three MVP docs.

Validation: `npm run typecheck` pass; `npm run build` pass; `git diff --check` pass.

Safety: NO real A2P submission run; no SMS sent; no Twilio mutation during
development; no Messaging Service attach/detach; no Brand/Campaign created; no
Stripe change; no Vercel env change; `sms_recovery_enabled` and `SMS_RECOVERY_MODE`
unchanged; no full EIN/secrets printed.


---

## 2026-06-09 — Toll-free vs Local number model

Added a durable `number_type` (`toll_free` | `local`) to the number model and the
full selection flow.

Migration `supabase/migrations/20260609000100_phone_number_type.sql` (additive,
idempotent): adds `clinic_phone_numbers.number_type` (NOT NULL, default `local`,
check in (`toll_free`,`local`)) and `clinic_phone_number_purchase_attempts.requested_number_type`.
Backfill: Fairstone `+12244009986`/`PNcfa04ebbb3c99d346473979781eb8785` and
`+12243442685`/`PN04b5bd6be9a95f26412c58bafea04512` set to `local`; all other
unknown existing rows conservatively set to `local`. No billing_class change, no
rebilling, no destructive SQL.

Model: first toll-free number = included in plan; additional toll-free = $20/month;
local = always a paid add-on (even first / during trial). Local uses A2P 10DLC;
toll-free uses toll-free verification. A2P review package + submission now include
LOCAL numbers only (toll-free excluded from the local campaign senders).

Pricing source of truth: `config/billing.config.ts` breakdown builders
(`tollFreeNumberBreakdown`, `localNumberBreakdown`, `assignedNumberBillingLabel`).
No "free" wording. Search API requires `?type=local|toll_free` (400 otherwise);
toll-free search has no area/ZIP; local keeps area/ZIP + fallback.

Local purchase is FAIL-CLOSED: `lib/env.ts hasLocalNumberBillingConfigured()`
requires STRIPE_LOCAL_NUMBER_PRICE_ID, STRIPE_LOCAL_SMS_COMPLIANCE_PRICE_ID,
STRIPE_LOCAL_BRAND_REGISTRATION_PRICE_ID, STRIPE_LOCAL_CAMPAIGN_REGISTRATION_PRICE_ID,
STRIPE_LOCAL_SETUP_FEE_PRICE_ID. None set yet -> server returns
`local_billing_not_configured` (503) and never buys/assigns a local number; owners
can still search local availability.

Validation: `npm run typecheck` pass; `npm run build` pass; `git diff --check` pass.

Safety: no real Twilio purchase; no Stripe charge; no A2P submit; SMS remains
fail-closed; `sms_recovery_enabled` / `SMS_RECOVERY_MODE` unchanged.

---

## 2026-06-09 — Local number billing wired in Stripe test mode

Implemented production-ready local number billing in code and configured the
required Stripe test-mode Prices in Vercel Production.

Stripe test-mode Prices created:

- Local number $20/month:
  `price_1TfVza4ZSHLicmej2cXgpYIs`
- Monthly SMS compliance fee $15/month:
  `price_1TfVza4ZSHLicmejludIWYyF`
- Carrier brand registration $9 one-time:
  `price_1TfVzb4ZSHLicmejQQ06FrWw`
- Campaign registration / vetting $30 one-time:
  `price_1TfVzb4ZSHLicmej4B1C0Jmg`
- Local setup fee $20 one-time:
  `price_1TfVzb4ZSHLicmejOvsW01KQ`

Vercel Production env vars set as encrypted/sensitive values:

- `STRIPE_LOCAL_NUMBER_PRICE_ID`
- `STRIPE_LOCAL_SMS_COMPLIANCE_PRICE_ID`
- `STRIPE_LOCAL_BRAND_REGISTRATION_PRICE_ID`
- `STRIPE_LOCAL_CAMPAIGN_REGISTRATION_PRICE_ID`
- `STRIPE_LOCAL_SETUP_FEE_PRICE_ID`

Code changes:

- Added typed `getLocalNumberBillingEnv()` in `lib/env.ts`.
- Added `lib/billing/stripe-local-number-billing.ts`.
- Local provisioning now requires explicit local fee authorization, all five
  Price IDs, saved Stripe Customer + PaymentMethod, and active paid subscription.
- Stripe recurring local items and the paid one-time local invoice complete
  before Twilio purchase/configuration begins.
- Local DB activation writes `number_type='local'`, `billing_class='additional'`,
  and the local monthly amount only after Stripe and Twilio are both safe.
- If payment fails, no Twilio purchase is attempted and no number is assigned.
- If Stripe succeeds but Twilio/DB activation fails, the attempt is marked
  `reconciliation_required` with billing state preserved for operator action.
- Owner local UI shows the exact fee breakdown from `billing.config.ts`, uses
  the button label "Authorize and assign local number", and keeps the exact
  missing-config / payment-failed messages.

Validation before commit/deploy:

- `npm run typecheck` pass.
- `npm run build` pass.

2026-06-07 — A2P resume crash fix for Fairstone

- Confirmed the production Fairstone A2P retry on commit `9ab91ea` failed in
  `runRealA2pSubmission()` before any new Trust Product / Brand / Campaign
  creation.
- Root cause: the resume path read
  `cpCtx.customerProfilesEntityAssignments.list` into a standalone variable and
  then invoked it unbound. Twilio's SDK list helper expects its owning object as
  `this`, so the call crashed with `Cannot read properties of undefined (reading
  '_version')`.
- Fix committed in `lib/twilio/a2p-submission.ts`: bind Trust Hub list methods
  before calling them, record the current provider step before assignment and
  evaluation calls, and treat missing/malformed evaluation responses as
  controlled provider errors instead of runtime crashes.
- Added focused helper/tests in `lib/twilio/trusthub-helpers.ts` and
  `tests/a2p-trusthub-helpers.test.ts`.
- Read-only verification after Vlad's failed retry:
  existing secondary Customer Profile `BU205ad9d4372e304076d900db7af36c1e`
  remained in `draft`, still assigned to stale Starter bundle
  `BUaeab21ee3b774f0293e17522e6a1337c`; no Trust Product, Brand Registration, or
  A2P Campaign was created during that retry.
- Validation after the fix: `npm run typecheck`, `npm run test:a2p`, and
  `npm run build` all passed locally.

---

## 2026-06-07 — Corrected Twilio platform Primary Customer Profile + safe A2P retry guard

Fixed the Twilio A2P platform parent-profile wiring after confirming the prior
configured SID was a Starter Customer Profile, not the account Primary Customer
Profile required for per-clinic secondary profile assignment.

What changed:

- Corrected `config/runtime.config.ts`:
  `a2p.trustHub.primaryCustomerProfileSid = BU668e1080d4cbf61beec1a8dac79c3353`.
- Added a live-submit preflight that reads the configured Twilio Customer
  Profile + policy, blocks submission before any clinic Trust Hub mutation when
  the profile is missing, Starter, non-Primary, or not in an allowed ready
  status, and records safe diagnostics in local provider state.
- Added customer-profile recovery logic so stale `cpAssignmentsDone` state no
  longer blindly skips Fairstone retry work when the old secondary profile was
  assigned under the wrong platform bundle. Safe behavior:
  reuse valid assignment state, re-enter assignment when the current platform
  bundle is missing, rebuild only the stale secondary customer-profile step when
  downstream resources do not exist yet, and block for manual review if
  downstream Trust Product / Brand / Campaign resources already exist.
- Updated the admin review surface to open diagnostics/history more readily for
  blocked submissions and to show the platform-profile/recovery warnings saved in
  provider state.

Operational rule clarified:

- The platform Primary Customer Profile only supports the per-clinic secondary
  customer-profile flow.
- Do NOT manually register an AllyExporter LLC / Missed Calls Dental brand for
  this Dental SaaS flow. Each clinic/customer remains the Brand.

Validation before commit/deploy:

- `npm run typecheck` pass.
- `npm run test:a2p` pass.
- `npm run build` pass.

Commit/push/deploy:

- Implementation commit: `dc1b06b feat: add phone number removal lifecycle`.
- Pushed to `origin/main`: yes.
- Vercel Production deployment:
  `dpl_CAKA1W4rrxXvWQjMnrGqCrcgHpC2`.
- Deployment status: READY.
- Aliases include `https://app.missedcallsdental.com`.

Production smoke:

- `https://app.missedcallsdental.com/api/health` -> 200.
- `https://app.missedcallsdental.com/login` -> 200.
- `https://app.missedcallsdental.com/account` -> 200.
- `https://app.missedcallsdental.com/api/jobs/release-removed-phone-numbers`
  without auth -> 401.
- `git diff --check` pass.

Commit/push/deploy:

- Implementation commit: `b444991 feat: wire local number billing`.
- Pushed to `origin/main`: yes.
- Vercel Production deployment:
  `dpl_EJjpQEWjwZBA2UJkeDEDNG1bZQu1`.
- Deployment status: READY.
- Aliases include `https://app.missedcallsdental.com`.

Production smoke:

- `https://app.missedcallsdental.com/api/health` -> 200.
- `https://app.missedcallsdental.com/login` -> 200.
- `https://app.missedcallsdental.com/account` -> 200.
- `https://app.missedcallsdental.com/admin/login` -> 200.

Safety:

- No SMS sent.
- No A2P submitted.
- No SMS recovery enabled.
- No real Twilio purchase during validation.
- Stripe resources were test/sandbox mode only.
- No customer Stripe charge was made during validation.
- Toll-free behavior unchanged.

---

## 2026-06-07 — Phone-number removal lifecycle implemented

Implemented customer-facing Remove/Restore lifecycle for assigned business
numbers, plus type-aware account billing display and a secured delayed Twilio
release job.

Code changes:

- Added migration `20260610000100_phone_number_removal_lifecycle.sql`.
- Added lifecycle columns on `clinic_phone_numbers` and shared local recurring
  Stripe item-id columns on `clinics`.
- Added customer APIs:
  `/api/account/phone-numbers/{phoneNumberId}/remove` and
  `/api/account/phone-numbers/{phoneNumberId}/restore`.
- Added secured job route:
  `/api/jobs/release-removed-phone-numbers`.
- Added `vercel.json` daily cron schedule for the release job.
- Added type-aware billing summary from active/held phone-number rows:
  toll-free additional quantities, local-number quantities, and once-per-account
  local SMS compliance.
- Added Stripe recurring item sync for remove/restore using
  `proration_behavior:"none"` so the next invoice reflects the new quantity
  without immediate credits/charges.
- Added `releaseIncomingPhoneNumber()` Twilio helper used only by the delayed
  release job.
- Account UI now shows scheduled removals, permanent removal date, Restore
  action, and current vs next-cycle billing totals when different.

Operational notes:

- Production migration applied via local Node/postgres runner using the direct
  DB URL (secret not printed). Verified columns:
  `removal_status`, `permanent_removal_at`, `twilio_release_status`.
- Vercel Production env var `CRON_SECRET` was added as an encrypted value for
  Vercel Cron authentication. The route also accepts
  `PHONE_NUMBER_RELEASE_CRON_SECRET` for external/manual scheduling.
- The release job does not run without a bearer token matching one of those env
  values.
- No manual Twilio number release was performed during implementation.
- No SMS was sent and no SMS recovery/A2P state was changed.

Validation before commit/deploy:

- `npm run typecheck` pass.
- `npm run build` pass.

---

## 2026-06-07 — Mock A2P submission mode added (safe, fail-closed rollout)

Added a safe separated-mode A2P workflow for admin testing so Fairstone's
existing failed live Brand can remain visible while mock testing uses its own
state and its own Twilio resource path.

Code/design changes:

- Added first-class A2P modes: `dry_run`, `mock`, `live`.
- Added `runtimeConfig.a2p.mockMessagingServiceSid` and changed the committed
  default A2P mode to `mock`.
- Added `supabase/migrations/20260611000100_a2p_submission_modes.sql` to move
  `clinic_a2p_submissions` from one row per clinic to one row per
  `(clinic_id, submission_mode)`.
- Refactored A2P submit/state code so mock and live attempts are separate.
- Mock Brand creation now hard-requires `mock: true`.
- Mock Campaign creation uses the configured mock Messaging Service and skips
  Messaging Service sender attachment entirely.
- Live Campaign creation is now a separate explicit action after Brand approval
  with a dedicated recurring-fee confirmation step.
- Added fail-closed guards so the admin UI disables the new workflow until the
  mode-separation migration is applied.

Read-only production verification performed:

- DB: `clinic_a2p_submissions` already has `submission_step` and
  `provider_state`, but production still has the old
  `clinic_a2p_submissions_clinic_unique` constraint and does not yet have
  `clinic_a2p_submissions_clinic_mode_unique`.
- DB: Fairstone still has one live blocked row with Brand SID
  `BNe8c3a43091282b3c14f3182da6e69bce` and no Campaign SID. The failed live
  Brand was not deleted or overwritten.
- Twilio: the only Messaging Service found was
  `MG83239dc7dfdf8aa6c9b397e8258f7d93` (`Missed Call SMS - Dental MVP`) and it
  already has senders attached, so it is not safe for mock A2P use.

Validation after the implementation:

- `git diff --check` pass.
- `npm run typecheck` pass.
- `npm run test:a2p` pass.
- `npm run build` pass.

Intentionally not done in this task:

- no live A2P submit
- no live Brand creation
- no live Campaign creation
- no mock Brand/Campaign creation
- no Twilio delete/revoke action
- no phone-number attachment changes
- no SMS enablement change

---

## 2026-06-08 — A2P admin redesign rollback deployed

Rolled back commit `8d0c71d` (`fix: restructure A2P admin workflow sections`)
with `git revert`, preserving history.

Confirmed result:

- Revert commit: `88b5f8fde16831f3a70678dd293cb199fde8da47`.
- Pushed to `origin/main`.
- Vercel production deployment:
  `dpl_E7Lox6gBf2udR3JTaY3vSFdtqNiB`
  (`sms-dental-arr7o8vex-vladchat-1500s-projects.vercel.app`) reached
  `READY` and was aliased to `https://app.missedcallsdental.com`.
- GitHub/Vercel deployment status for the revert commit was `success`.
- `https://app.missedcallsdental.com/api/health` returned `200` with
  `{"ok":true,"service":"missed-calls-dental","version":"foundation-v1"}`.
- Production admin clinic page for Fairstone loaded and showed the prior
  tab-based clinic UI with `A2P review` as a clinic section, including the
  existing A2P review blocks.

Validation before push:

- `npm run typecheck` pass.
- `npm run test:a2p` pass.
- `npm run build` pass.

Safety confirmation:

- No live A2P submit was run.
- No live Brand was created.
- No live Campaign was created.
- No mock Brand was created.
- No mock Campaign was created.
- No phone numbers were attached.
- SMS recovery / patient SMS was not enabled.

---

## 2026-06-10 — Per-phone-number texting status source of truth

Implemented a per-number texting approval/capability model so owner Account →
Phone numbers can show different Texting statuses for different assigned numbers.

What changed:

- New migration `supabase/migrations/20260613000200_per_number_texting_status.sql`
  adds `clinic_phone_numbers.texting_status`, `texting_status_source`, and
  `texting_status_updated_at` with allowed statuses `preparing`,
  `waiting_for_approval`, `active`, and `failed`.
- Owner `/account?section=phone` summary mapping now reads each phone row's own
  texting status. Legacy fallback is local-only from `clinics.sms_status`; toll-free
  fallback stays `waiting_for_approval`.
- `AssignedNumberCard` no longer receives one global `smsStatus` for every row.
  It renders Texting from the number's own status, while scheduled or inactive
  numbers display **Not active** regardless of stored approval status.
- Future owner purchases, admin existing-number assignment, and detached-row
  reassignment default to `waiting_for_approval` with source
  `assignment_default`, preventing stale approval from following a number into a
  new assignment.
- Added `updatePhoneNumberTextingStatus(...)`, scoped to texting status fields only
  (no routing, billing, removal, Twilio release, or provider side effects).
- Updated operations docs and Knowledge System customer/support/admin articles for
  the per-number model.

Backfill behavior:

- Existing local rows may derive initial `texting_status` from `clinics.sms_status`
  where the row still has the default `waiting_for_approval` / `system` values.
- Existing toll-free rows are not automatically marked active. They remain
  `waiting_for_approval` until a reliable number-specific Twilio/operator
  verification source confirms approval.

Future behavior:

- Future local numbers default to waiting unless an existing reliable local/A2P
  success transition has already covered that number. No such reliable active
  transition was found in the current codebase, so none was invented.
- Future toll-free numbers default to waiting until toll-free verification is
  confirmed for that specific number.

Validation:

- `git diff --check` pass.
- `npm run typecheck` pass.
- `npm run test:phone-numbers` pass (21/21).
- `npm run test:a2p` pass (64 passing assertions).
- `npm run build` pass.
- `npm run lint` not run: no `lint` script exists in `package.json`.

Migration status: not applied to production in this task.

Side effects avoided: no SMS sent, no `sms_recovery_enabled` change, no
`SMS_RECOVERY_MODE` change, no call-routing change, no billing change, no
Twilio/Stripe/provider mutation, no secrets printed or committed.

Commit: this change set (`Fix per-number texting status display`).

---

## 2026-06-12 — Phone removal aligned to estimated Twilio billing window

Replaced the fixed 30-day phone-number removal grace period with an estimated
Twilio billing-window release deadline, preserving one-click restore while the
number is still held by our Twilio account.

What changed:

- New pure helper `lib/phone-numbers/twilio-release-deadline.ts`: computes the
  next estimated monthly Twilio renewal after `now` (UTC, month-end safe, time-of-
  day preserved) minus a 1-day safety buffer; clamps to `now` if already inside
  the final pre-renewal day. This is an ESTIMATE — Twilio's IncomingPhoneNumber
  resource exposes no per-number paid-through/renewal field (verified against the
  installed Twilio SDK v5.4.3 types; only `dateCreated` is available).
- `lib/phone-numbers/removal-lifecycle.ts`: removed `REMOVAL_GRACE_DAYS = 30`;
  `permanent_removal_at` is now computed from the billing anchor
  (`clinic_phone_numbers.twilio_purchased_at`, falling back to `created_at`).
- New billing anchor column `clinic_phone_numbers.twilio_purchased_at` populated
  on purchase: `lib/twilio/numbers.ts` `PurchaseResult.twilioPurchasedAt`
  (normalized from Twilio `dateCreated`); `lib/phone-numbers/provisioning.ts`
  persists it for included/local/additional numbers; mock mode uses `new Date()`;
  `upsertOfficeTextingNumber()` stamps a safe fallback.
- Scheduled-number webhooks: added
  `lookupClinicByPhoneIncludingScheduled()` in `lib/db/clinics.ts`
  (`lookupClinicByPhone()` active-only routing unchanged). Voice incoming plays an
  inactive-line greeting + hangup for scheduled numbers (no recovery SMS); voice
  status explicitly skips scheduled numbers; inbound SMS to a scheduled number no
  longer creates conversations/records ordinary replies but still honors
  STOP/START opt-out.
- UI `app/setup/[token]/_components/AssignedNumberCard.tsx`: removed all
  fixed-window copy; remove confirmation now says "Calls and texts will stop
  routing to your clinic immediately." + "Billing updates next cycle."; scheduled
  card shows "Restore available until {date}" while open and "Restore window has
  closed. Permanent release is pending." after; Restore button hidden once the
  window closes.
- Release job cron: initially changed to hourly (`0 * * * *`), but the Vercel
  Hobby plan **rejects** sub-daily cron schedules at build time, which failed the
  deploy. Reverted to daily (`0 9 * * *`) — see the 2026-06-12 revert entry below.
  The 1-day safety buffer is designed to tolerate a daily cron cadence.
- Tests: `tests/twilio-release-deadline.test.ts` (+ `tsconfig.unit-tests.json`,
  `npm run test:phone-numbers`).

Migration (additive + idempotent, NOT yet applied to production):

```txt
supabase/migrations/20260612000100_phone_number_twilio_purchased_at.sql
```

Backfill: `twilio_purchased_at = coalesce(activated_at, created_at)` for existing
rows. Column is nullable; lifecycle code falls back to `created_at`.

Validation:

- `npm run test:phone-numbers` pass (9/9).
- `npm run typecheck` pass.
- `npm run build` pass.
- `npm run test:a2p` pass (64/64, no regression).

Commit: `fix: align phone removal with Twilio billing window` (pushed to
`origin/main`).

Manual production DB migration required: apply
`20260612000100_phone_number_twilio_purchased_at.sql` via the Supabase SQL editor
as the service role (same workflow as prior migrations). Until applied,
`/account` and the release job continue to work (code falls back to `created_at`),
but the more accurate `twilio_purchased_at` anchor is unavailable.

Intentionally not done:

- No Twilio numbers released, purchased, or reconfigured.
- No Stripe proration/credit/charge added (remove/restore keep
  `proration_behavior:"none"`).
- No Vercel env vars, Supabase secrets, Twilio/Stripe credentials, domains, DNS,
  or `.env*` files changed.
- Migration not auto-applied to production.

---

## 2026-06-12 — Restore daily release cron (Vercel Hobby cron limit)

The previous change set the release-job cron to hourly (`0 * * * *`). The Vercel
deployment for commit `a1b2ae3` **failed**: the current Vercel plan is **Hobby**,
which rejects cron schedules more frequent than once per day at build time.

Fix:

- `vercel.json`: reverted the release-job cron back to daily (`0 9 * * *`).
- Docs corrected (OPERATIONS-RUNBOOK, BILLING-AND-USAGE-POLICY, this log): the
  release job runs **daily** on the current plan. The 1-day safety buffer in the
  release deadline is designed to tolerate a daily cron cadence — a number is
  released at most ~1 day after its deadline, still before the estimated Twilio
  renewal.
- No phone-removal lifecycle logic changed; only the cron schedule + docs.

Validation:

- `npm run typecheck` pass.
- `npm run build` pass.

Commit: `fix: restore daily release cron for Vercel Hobby` (pushed to
`origin/main`).

Note: confirms the Vercel project is on the **Hobby** plan. Sub-daily Vercel Cron
requires Pro or above.

---

## 2026-06-12 — Applied phone-number Twilio purchase anchor migration (production)

Applied the committed migration to the production Supabase project
`qfjpvbvfvhbtebwivcdc` (`sms_dental`) using the documented additive SQL (no schema
process invented; exact committed SQL only).

Migration:

```txt
supabase/migrations/20260612000100_phone_number_twilio_purchased_at.sql
```

Production applied status: **applied** (was not present beforehand — pre-check
returned 0 rows for the column).

Verification (production, counts only — no raw phone numbers):

- Column `clinic_phone_numbers.twilio_purchased_at`: `timestamp with time zone`,
  `is_nullable = YES` (1 row in `information_schema.columns`). Matches expected.
- Backfill: `total_rows = 3`, `rows_missing_twilio_purchased_at = 0`,
  `rows_with_twilio_purchased_at = 3`. Backfill complete; no null anchors.
- `https://app.missedcallsdental.com/api/health` → `{"ok":true,...}`.

This unblocks the live remove/restore endpoints and number-purchase write paths
that read/write `twilio_purchased_at` (deployed in `d46ed84`).

Intentionally not done:

- No code changed; the committed migration file matched production needs exactly.
- No phone numbers released, rebilled, deactivated, or reclassified.
- No `/account` Remove test on a real clinic (destructive; not approved).
- No secrets, connection strings, or raw phone numbers printed.

---

## 2026-06-12 — Admin: assign an existing (already-owned) Twilio number

New platform-admin-only workflow to assign an existing owned Twilio number to a
clinic. Additive; no existing behavior changed; no Twilio purchase/release.

What changed:

- New endpoint `GET`/`POST /api/admin/clinics/[clinicId]/phone-numbers/existing`
  (guarded by `resolvePlatformAdmin`).
- New pure helper `lib/phone-numbers/twilio-number-inventory.ts` (toll-free/local
  classification + unassigned-inventory builder) + tests
  `tests/twilio-number-inventory.test.ts` (run via `npm run test:phone-numbers`).
- New service `lib/phone-numbers/assign-existing-twilio.ts` (Twilio re-fetch,
  DB re-check inside clinic lock, billing classification, safe webhook configure,
  insert).
- `lib/twilio/numbers.ts`: read-only `listOwnedIncomingPhoneNumbers`,
  `fetchOwnedIncomingPhoneNumberBySid`, `configureIncomingPhoneNumberWebhooks`,
  `standardTwilioWebhookUrls`; exported `normalizeTwilioDate`.
- Admin UI `AdminAssignExistingNumber` wired into the clinic console Phone tab.

Scope/limits (first version):

- Toll-free only, assigned as the clinic's **included** number (`source='admin'`,
  `billing_class='included'`, `$0`). Local numbers and additional toll-free are
  blocked with clear errors. Already-assigned / `permanently_removed` / no-Voice+SMS
  / not-in-Twilio are blocked.
- Used the existing `clinic_phone_numbers.source` value `'admin'` (the
  `clinic_phone_numbers_source_check` constraint allows only
  `legacy/owner_self_service/admin`), so **no DB migration is required**.

Validation: `npm run test:phone-numbers` (17/17), `npm run typecheck`, `npm run build` — all pass.

Migration: none required (no schema change).

Commit: `feat: assign existing Twilio numbers from admin` (pushed to `origin/main`).

Intentionally not done: no Twilio purchase/release, no Messaging Service membership
changes, no Stripe quantity changes, no trial changes, no secrets printed.

---

## 2026-06-13 — Detach assigned Twilio numbers from admin (Suspend vs Detach)

Added a platform-admin **"Detach from clinic"** workflow and clarified **Suspend**
with inline confirmations. Suspend remains a same-clinic pause; Detach releases
only the clinic assignment while keeping the Twilio number owned by us.

New lifecycle state: `clinic_phone_numbers.removal_status='detached'` =
clinic assignment released, Twilio number kept (no release). Distinct from
`permanently_removed` (Twilio release completed / historical). Expected DB state
after detach: `is_active=false`, `removal_status='detached'`,
`permanent_removal_at=null`, `twilio_release_status='not_required'`,
`twilio_released_at=null`, SID + `twilio_purchased_at` preserved. Row is kept for
audit (never deleted). No Stripe/Twilio/Messaging-Service side effects.

Files changed:
- `supabase/migrations/20260613000100_phone_number_detached_status.sql` (additive,
  idempotent: widens `clinic_phone_numbers_removal_status_check` to allow
  `'detached'`).
- `lib/phone-numbers/detach-number.ts` (new `detachClinicPhoneNumber` service,
  clinic-locked tx, server-side ownership + eligibility re-check).
- `lib/phone-numbers/twilio-number-inventory.ts` (new pure `classifyDetachEligibility`).
- `lib/phone-numbers/assign-existing-twilio.ts` (assign now reassigns a `detached`
  row in place — preserves SID/`twilio_purchased_at`; still blocks active/scheduled
  and `permanently_removed`).
- `app/api/admin/clinics/[clinicId]/phone-numbers/[phoneNumberId]/action/route.ts`
  (adds `detach` action; audit `clinic.phone_number.detach`).
- `app/admin/(console)/.../AdminPhoneNumberList.tsx` (inline Suspend confirmation +
  Detach action with inline confirmation + consent checkbox).
- Detached rows excluded from old clinic everywhere: `lib/db/clinic-phone-numbers.ts`
  (owner list), `lib/db/admin/clinics.ts` (admin list + held/billed counts),
  `lib/billing/number-entitlements.ts` (held count), `lib/db/admin/actions.ts`
  (countHeldNumbers), `lib/phone-numbers/removal-lifecycle.ts` (billing snapshot).
  Type unions widened to include `'detached'`; owner-facing type intentionally
  excludes it (coerced defensively in `app/account/page.tsx`).
- Tests: `tests/twilio-number-inventory.test.ts` (+4 `classifyDetachEligibility`).

Detach allowed only for unpaid active toll-free (`legacy`/`included`, $0). Local,
paid/additional, and already detached/scheduled/permanently_removed are blocked
with clear copy. Suspend/reactivate/remove/restore behavior unchanged.

Validation: `npm run test:phone-numbers` (21/21), `npm run typecheck`,
`npm run build` — all pass.

Migration status: **APPLIED to production 2026-06-09** (with owner approval).
Applied `supabase/migrations/20260613000100_phone_number_detached_status.sql` over
the documented direct DB connection (`SUPABASE_DB_DIRECT_URL`, same credential the
app uses; psql not installed so the same postgres.js driver was used; credential
never printed). The migration is additive/idempotent — drops + re-adds only the
`clinic_phone_numbers_removal_status_check` constraint; no data rows changed.
Verification (read-only `pg_get_constraintdef`): constraint now =
`CHECK ((removal_status = ANY (ARRAY['active','scheduled','permanently_removed','detached'])))`.
Note: a first apply over the transaction pooler (`SUPABASE_DB_URL`, port 6543)
committed the DDL but mis-reported the post-change catalog on read-back; re-running
over the direct connection confirmed the committed state (safe because the
migration is idempotent). Test row `+18447234944` (clinic
`e9f21de4-3a35-4216-bb16-66ea3aeb2e47`) left unchanged: toll_free / legacy / $0 /
`removal_status='active'` — eligible for Detach.

Production deploy: `dpl_8GhAACx6Yb3vdXavxJHZrWexGPhj` READY (commit `5090fb1`).
Pre-migration prod logs confirmed the cause: two `POST …/phone-numbers/.../action`
calls at 21:31–21:32 returned 409 with an error message referencing
`removal_status` (the check-constraint violation). No Twilio release, Stripe, or
Messaging Service calls occurred (detach has no such side effects).

Commit: see `feat: detach assigned Twilio numbers from admin`.

---

## 2026-06-10 — Automatic phone-number texting-status sync from Twilio

Implemented production-safe automatic synchronization for
`clinic_phone_numbers.texting_status` so the owner Phone number screen reads the
database and the database is kept current from provider read-back.

What changed:

- Added shared sync service `lib/texting-status/sync.ts` and pure mapping helpers
  in `lib/texting-status/status-mapping.ts`.
- Added read-only Twilio Toll-Free Verification lookup in
  `lib/twilio/tollfree-verification.ts` using the installed Twilio SDK
  `client.messaging.v1.tollfreeVerifications.list({ tollfreePhoneNumberSid, ... })`.
- Added config `config/texting-status-sync.config.ts` for cron path/schedule,
  batch sizes, stale windows, Twilio list limits, source labels, and active
  reconciliation behavior.
- Added protected job `GET|POST /api/jobs/sync-phone-number-texting-status` and
  `vercel.json` cron `0 10 * * *` (daily; adjusted during production rollout for
  the current Vercel Hobby plan). The job processes only active, non-removed,
  stale/due rows in a bounded batch.
- Added additive diagnostics migration
  `supabase/migrations/20260613000300_texting_status_sync_diagnostics.sql`
  (`texting_provider_status`, error code/message, provider synced timestamp, and
  due-row indexes). No backfill marks toll-free numbers active.
- Manual admin **Run readiness sync** now runs the same per-number sync path.
- Event-triggered best-effort sync now runs after owner/admin number purchase,
  existing-number assignment, restore, live A2P status refresh, and successful
  live A2P submit.
- Local A2P readiness now lists local numbers only, so toll-free numbers are not
  treated as local A2P campaign senders/blockers.
- Live send gating now requires the called number row to be active, not scheduled
  for removal, and `texting_status='active'`; local numbers also keep the
  production-safe A2P/Messaging Service readiness checks.
- Admin phone-number diagnostics now show number type, texting status/source,
  provider status/synced time/error, and next action.

Status mapping:

- Toll-free: approved/verified provider status -> `active`; pending/in-review/no
  verification -> `waiting_for_approval`; rejected/failed -> `failed`; API error
  stores diagnostics and does not mark active.
- Local: verified A2P + Messaging Service sender coverage + Campaign coverage +
  production-safe + no sync error -> `active`; rejected/failed/blocked ->
  `failed`; otherwise `waiting_for_approval`.

Validation:

- `npm run typecheck` — passed.
- `npm run test:phone-numbers` — passed (32 tests).
- `npm run test:a2p` — passed (64 tests).
- `npm run build` — passed.
- No lint script exists in `package.json`.

Not done:

- Migration was **not** applied to production in this task.
- No production deploy was performed.
- No patient SMS sent.
- No Twilio resources mutated; Twilio access added here is read-only.
- No SMS recovery auto-enabled.
- No hardcoded phone-number-specific fix for `+18447234944`; that number remains
  only the real-world validation case after migration/deploy.

---

## 2026-06-10 — Production rollout for phone-number texting-status sync

Rolled out the automatic per-number texting-status sync to production for the
Supabase project ref `qfjpvbvfvhbtebwivcdc` and Vercel project `sms-dental`
(`prj_f5C6GmEFNwvBYq0EFJAX3UXKcepI`).

What changed:

- Applied additive production migrations
  `20260613000200_per_number_texting_status.sql` and
  `20260613000300_texting_status_sync_diagnostics.sql`.
- Recorded both versions in `supabase_migrations.schema_migrations` after direct
  SQL apply, so Supabase migration history matches the verified schema.
- Adjusted the texting-status cron to daily `0 10 * * *` because the current
  Vercel Hobby plan rejects more frequent cron schedules.
- Populated/rotated production `CRON_SECRET` in Vercel. The value was not printed
  or stored in the repo.
- Deployed commit `78ba2e93a1da97c1bcbebbeb67187f597a5adff0` to production:
  deployment `dpl_6b9W4byHsWafKxyA8YXKtkQ7dDCm`,
  `https://sms-dental-hjpoxtv4m-vladchat-1500s-projects.vercel.app`, READY and
  aliased to `https://app.missedcallsdental.com`.

Verification:

- `clinic_phone_numbers` has the per-number texting status columns, diagnostic
  provider fields, check constraints, and due-row indexes.
- Vercel deployment metadata registers cron
  `/api/jobs/sync-phone-number-texting-status` at `0 10 * * *`.
- Unauthenticated cron request returned 401; authenticated request returned 200
  with JSON summary counts.
- Immediate forced sync using the shared app sync service checked the production
  row for `+18447234944` against its actual Twilio Phone Number SID, read Twilio
  Toll-Free Verification status `TWILIO_APPROVED`, and updated the row from
  `waiting_for_approval` to `active` with source
  `twilio_tollfree_verification_sync`.
- Guardrail counts after sync: local numbers active for texting `0`;
  removed/scheduled numbers active for texting `0`; SMS recovery remained not
  globally enabled (`SMS_RECOVERY_MODE=owner_test`; 1 of 7 clinics had
  `sms_recovery_enabled=true` before/after).

Not done:

- No SMS sent.
- No Twilio resources created, updated, submitted, purchased, or deleted; Twilio
  access was read-only verification lookup.
- Owner account UI could not be browser-verified because the agent did not have
  an authenticated owner/admin browser session; production DB state backing the UI
  was verified directly.

---

## 2026-06-10 — Live SMS send hardening deployed (exact sender, toll-free coverage, status persistence)

Hardened the single guarded recovery-SMS path and deployed to production
(Vercel project `sms-dental`, Supabase ref `qfjpvbvfvhbtebwivcdc`). No SMS
behavior was enabled; everything is stricter/fail-closed plus new diagnostics.
Operating reference: OPERATIONS-RUNBOOK "Live SMS send hardening — operate &
verify (2026-06-10)".

What changed (code):

- Fixed SMS template centralized in `config/sms-recovery.config.ts` +
  `lib/sms-recovery/templates.ts`; new approved copy ends with
  "Reply STOP to opt out." Duplicate-suppression window now config-sourced.
- `sendRecoverySms()` sends with BOTH `from=<exact called number>` AND
  `messagingServiceSid`, so Twilio fails closed (21712) if the number is not in
  the sender pool; actual `msg.from` recorded; mismatch logged as error. Added
  per-message `statusCallback`.
- Toll-free live send and admin launch now require a fresh
  `clinic_sms_number_readiness` row with `messaging_service_sender_status='covered'`
  (toll-free verification alone is no longer enough). The texting-status sync
  writes that row via a read-only per-number sender-pool lookup.
- `/api/webhooks/twilio/messaging/status` updates the outbound `messages` row
  (status/error_code/error_message) idempotently, never regressing a more
  advanced status.
- New platform-admin audit `GET /api/admin/sms-readiness/audit` + per-number
  "Ready to send SMS" / "Messaging Service" rows in the admin clinic console.
- New test suite `npm run test:sms-recovery` (template, live-send evaluation,
  status transitions, single-send-path static check).

Confirmed production bug found and fixed:

- `lib/twilio/sms-readiness-sync.ts` matched Messaging Service sender-pool
  entries on `sender.phoneNumberSid`, but the Twilio API returns the PN SID as
  the resource `sid` (no `phoneNumberSid` property — verified against the live
  API). The sender set was therefore always empty and every number was
  permanently reported `not_in_messaging_service` even when covered. This is
  what the 2026-06-06 audit observed. Fixed to match on `sid` (fallback kept).

Commits / deployments (both READY, aliased to app.missedcallsdental.com):

- `7920add5797f0fe00b3040a89e3628b0fb2a19cd` → `dpl_Bud43XYTGdjaPVrBCdUtKY64jkUE`
- `3a0955619710f65ed8052e74a67092be5c451590` (sender-pool fix) →
  `dpl_BonwWQNmEmL8hCHna9TH2opUZXdu`

Migrations: none needed (messages.error_code/error_message and the readiness
tables already existed; verified `clinic_sms_readiness`,
`clinic_sms_number_readiness`, `clinic_a2p_submissions` present in production).

Validation before deploy: `npm run typecheck`, `npm run test:phone-numbers`
(32 pass), `npm run test:a2p` (64 pass), `npm run test:sms-recovery` (28 pass),
`npm run build`, `git diff --check` — all pass.

Production verification after deploy:

- `GET /api/health` → ok:true.
- Unsigned POSTs to voice/incoming, voice/status, messaging/incoming,
  messaging/status → all 403 (signature gate intact).
- Twilio read-only checks: Messaging Service `MG83239dc7dfdf8aa6c9b397e8258f7d93`
  has inbound URL + status callback pointed at the app; sender pool contains
  `+18447234944`, `+12244009986`, `+12243442685`; toll-free verification for
  `+18447234944` is `TWILIO_APPROVED`.
- Ran the same texting-status sync the admin button uses (forced, all clinics):
  checked=1, failed=0. The only active assigned number today is Fairstone''s
  toll-free `+18447234944`; both Fairstone local numbers are
  `removal_status='scheduled'`.
- After sync, the toll-free readiness row reads
  `messaging_service_sender_status='covered'`, `production_safe=true`, fresh
  `last_synced_at`, no error — the number is "Ready to send SMS" at the
  number level. Live send remains blocked by `sms_recovery_enabled=false`
  (Fairstone) and `SMS_RECOVERY_MODE=owner_test` (production env).
- Only `Owner Test Dental Office` has `sms_recovery_enabled=true` and it has 0
  active numbers, so no live send path exists anywhere.

Not done (intentionally):

- No SMS sent (no test call placed; controlled owner-test call remains the next
  manual validation step).
- No Twilio resources created/mutated; all Twilio access read-only.
- `SMS_RECOVERY_MODE` not changed; `sms_recovery_enabled` not changed; no broad
  activation; no AI voice runtime.

---

## 2026-06-10 — owner_test mode now enforces exact-number readiness

Follow-up safety hardening to the live SMS send hardening deployed earlier
today: `SMS_RECOVERY_MODE=owner_test` now runs the SAME exact-number readiness
gate as live mode (active row, texting_status active, fresh Messaging Service
sender coverage, local A2P when applicable) before any Twilio call. The
owner-test caller allowlist remains an additional guard, not a substitute for
number readiness.

What changed:

- New shared pure gate `evaluateRecoverySendGate()` in
  `lib/sms-recovery/live-send-evaluation.ts`; used by `sendRecoverySms()` and
  the voice-greeting prediction so both stay in lockstep. Guard order: mode →
  exact-number readiness (both modes) → live `sms_recovery_enabled` → live+local
  `sms_status` → owner_test allowlist → opt-out → duplicate suppression.
- New tests `tests/sms-recovery-send-gate.test.ts` (13 cases) added to
  `npm run test:sms-recovery`; single-send-path static check unchanged and
  passing.
- Live-mode behavior unchanged except reason precedence: when both apply,
  the readiness reason is now returned before `clinic_sms_disabled`.

Not done: no SMS sent, no call placed, no Twilio/env/Stripe/DNS changes, no
`sms_recovery_enabled` or `SMS_RECOVERY_MODE` change, no migrations.

---

## 2026-06-10 — voice greeting foundation added for missed-call TwiML

Added the durable voice-selection foundation for the current missed-call voice
greeting and future AI Call Assistant work.

What changed:

- Added `config/voice-greeting.config.ts` as the curated source for English US
  (`en-US`) Twilio `<Say>` voices. The list has 10 modern provider-prefixed
  voice options balanced by `genderPresentation` (5 female, 5 male); the default
  is `Google.en-US-Chirp3-HD-Leda`.
- Moved missed-call and inactive-number TwiML generation into
  `lib/sms-recovery/voice-twiml.ts`; the voice webhook now uses the configured
  `language` and `voice` instead of the old basic `alice` voice.
- Added unit coverage for the curated list, default voice, provider-prefixed
  Twilio voice IDs, `en-US` language, XML escaping, and the exclusion of
  `alice`, `man`, and `woman`.
- Updated project, owner-settings, operations, and Knowledge System docs so
  future clinic settings, future voice messages, and the AI Call Assistant reuse
  this curated voice foundation before any AI runtime work.

Validation before deploy: `npm run typecheck`, `npm run test:phone-numbers`
(32 pass), `npm run test:a2p` (64 pass), `npm run test:sms-recovery` (47 pass),
and `npm run build` all pass. No `lint` script exists in `package.json`.

Not done: no AI call runtime, no full owner/admin voice settings UI, no calls
placed, no SMS sent, no Twilio resources created or mutated, no Vercel
environment variables changed, and no migrations.

---

## 2026-06-10 — front-desk workspace reply follow-up polish

Verified the latest production inbound SMS test for Fairstone Dental Smile and
polished the existing `/workspace` follow-up view. No raw patient phone number or
private payload is recorded here.

Production verification:

- A real inbound ordinary patient reply to the clinic's toll-free test number was
  found in `messages` with `direction='inbound'`, `detected_keyword=null`, and a
  `conversation_id`.
- The matching `patient_conversations.last_message_at` was updated at the inbound
  message time, and the existing workspace query can read the conversation.
- No opt-out row exists for that patient/clinic pair, and no outbound message was
  created after the ordinary inbound reply.
- The conversation outcome fields were still empty before UI save.

What changed:

- The selected workspace detail panel now shows `Latest patient reply` without
  requiring staff to open the full conversation.
- Added a visible `Call patient` action as a normal `tel:` link only. It does not
  send SMS, place a Twilio call, or automate follow-up.
- Replaced the noisy repeated empty patient-detail rows with one minimum-necessary
  note when those fields have no source yet.
- Kept the existing `/workspace` route, real conversation list, full conversation
  toggle, outcome form, clinic-scoped access, and record-only ordinary inbound
  reply behavior.
- Added unit coverage for workspace status derivation, saved outcome status,
  latest inbound reply selection, and ordinary appointment replies remaining
  non-keyword while STOP/START still classify correctly.
- Updated `FRONT-DESK-WORKSPACE.md`, the operations runbook, and Knowledge System
  workspace articles/inventory.

Validation before deploy: `npm run typecheck`, `npm run test:phone-numbers`
(32 pass), `npm run test:a2p` (64 pass), `npm run test:sms-recovery` (52 pass),
and `npm run build` all pass. No `lint` script exists in `package.json`.

Not done: no new inbox, no AI, no auto-reply, no SMS sent, no calls placed, no
Twilio resources mutated, no Vercel env changes, no migrations, and no production
outcome was written during verification.

---

## 2026-06-10 — AI Front Desk Knowledge account foundation (non-live)

> **SUPERSEDED (2026-06-10):** this question-answer model (41-question catalog +
> `clinic_ai_knowledge_entries`) was replaced the same day by the structured
> clinic-facts model. The table held test-only rows and was dropped by
> `20260615000100_replace_ai_knowledge_with_structured_facts.sql`. Historical
> record only.

Built the first account-side foundation for the future AI Front Desk agent:
a clinic-approved answer library owners review before any AI can ever use it.
**No AI runtime, no AI provider calls, no website crawler, no Twilio/SMS
behavior changes, no patient-facing changes.**

What changed:

- New committed catalog `config/ai-front-desk-knowledge.config.ts` — 41 common
  patient questions in 6 categories (Hours & Location, Appointments, Insurance,
  Services, Payment & Policies, Safety & Handoff) with owner-friendly wording,
  recommended flags, default statuses, and short handoff defaults (medical and
  urgent defaults include 911 and never give diagnosis/treatment advice).
- New pure helpers `lib/ai-knowledge/entries.ts` (catalog merge + update
  validation) and DB helper `lib/db/ai-knowledge.ts`
  (`listClinicAiKnowledgeEntries`, `upsertClinicAiKnowledgeEntry`), both
  clinic-scoped. Unsaved catalog questions return as virtual `system_default`
  entries so new questions appear automatically.
- New API `GET|POST /api/account/ai-knowledge` using
  `resolveAuthClinicAccess()`; front-desk role rejected. POST validates against
  the committed catalog only (unknown keys, invalid statuses, >700-char
  answers, approved-with-empty-answer, sample/demo text, and non-`manual`
  client source types are rejected; safety entries cannot be "approved" and
  always keep the standard reply).
- New account section `/account?section=ai_knowledge` ("AI Front Desk
  Knowledge") under the Account nav group after Team access, rendered by
  `app/setup/[token]/_components/AiKnowledgeCard.tsx`. Shows an "AI replies are
  off" banner, a website source card that READS `clinics.website` from Business
  profile (no duplicate website input), approved/needs-review/handoff summary
  counts, and per-question cards with Save draft / Approve answer / Use handoff
  / Do not answer automatically. Not part of setup completion for SMS
  approval/billing.
- New migration `supabase/migrations/20260614000100_clinic_ai_knowledge.sql` —
  additive table `public.clinic_ai_knowledge_entries` with
  `unique (clinic_id, question_key)`, status + source_type check constraints,
  clinic/status/category indexes, `set_updated_at` trigger, RLS enabled (no
  policies; service-role only). No PHI, conversations, website HTML, or model
  prompts are stored.
- New tests `tests/ai-knowledge-catalog.test.ts` (24 tests) + npm script
  `test:ai-knowledge` (catalog integrity, safety copy, merge behavior, update
  validation).
- Docs: PROJECT-CONTEXT.md (built foundation + future phases), operations
  runbook section, Knowledge System article CH-21
  (`customer-help/ai-front-desk-knowledge/`) + content inventory.

Migration status: **APPLIED to production 2026-06-10** (owner-authorized in the
task prompt) on Supabase project `qfjpvbvfvhbtebwivcdc` via the Supabase
Management API (MCP `apply_migration`); history row recorded as version
`20260614000100` / `clinic_ai_knowledge` to match the repo file. Pre-check
confirmed the table did not exist; post-apply verification confirmed 3
constraints, 3 indexes, the `set_updated_at` trigger, RLS enabled, and 0 rows.

Validation: `npm run typecheck`, `npm run test:ai-knowledge` (24 pass),
`npm run test:phone-numbers` (32 pass), `npm run test:a2p` (64 pass),
`npm run test:sms-recovery` (52 pass), `npm run build`, and `git diff --check`
all pass. No `lint` script exists in `package.json`.

Not done / explicitly out of scope: no SMS sent, no calls placed, no Twilio
mutations, no AI provider calls or env vars, no website crawling, no Stripe
changes, no Vercel env changes, `docs/` untouched.

---

## 2026-06-10 — Production rollout: AI Front Desk Knowledge foundation

> **SUPERSEDED (2026-06-10):** see the structured clinic-facts replacement
> entry below. Historical record only.

Deployed and verified the AI Front Desk Knowledge foundation in production.

- Commit `201045ddec69535bed8a65abf2d8f6d342529310`
  ("account: add AI front desk knowledge foundation") pushed to `origin/main`.
- The GitHub-triggered Vercel deployment
  `dpl_6ffdGfjNoBxHjjiTTt6s2xSKHKLo` sat in INITIALIZING with no build events
  for ~25 minutes, so it was cancelled and the same commit was redeployed via
  the Vercel REST API (`POST /v13/deployments` with the git source). The fresh
  deployment `dpl_2LtnDqbLP75RP2jhG22Z3aUVw38Z` built normally, reached READY,
  and is aliased to `https://app.missedcallsdental.com`.

Production verification (all pass):

- `GET /api/health` -> 200 `ok: true`, `service: missed-calls-dental`.
- `GET /api/account/ai-knowledge` unauthenticated -> 401 JSON
  ("Please sign in to continue."), as designed.
- `/account?section=ai_knowledge` -> 200 (renders the sign-in gate when
  unauthenticated; section requires owner/admin session).
- `/account?section=business` -> 200 (existing Business profile unaffected).
- `/workspace` -> 200 with the expected auth gate.
- Migration `20260614000100_clinic_ai_knowledge.sql` was already applied and
  verified earlier the same day (see previous entry).

Operational note: a Vercel git-triggered deployment can rarely hang in
INITIALIZING with empty build logs; cancelling it
(`PATCH /v12/deployments/{id}/cancel`) and re-creating the deployment for the
same commit SHA over the REST API recovers cleanly.

No SMS sent, no calls placed, no Twilio/Stripe mutations, no env or DNS
changes, no AI provider calls.

---

## 2026-06-10 — AI Front Desk Knowledge replaced with structured clinic facts

Replaced the same-day question-answer AI Knowledge foundation (41-question
catalog + `clinic_ai_knowledge_entries`) with a structured clinic-facts model
and an owner-friendly accordion UI. **Old `clinic_ai_knowledge_entries` rows
were test-only and were dropped with the table** (2 rows, verified pre-drop).
Still foundation-only: no AI runtime, no AI provider calls, no Twilio/SMS
behavior changes, no patient-facing changes.

What changed:

- New migration `20260615000100_replace_ai_knowledge_with_structured_facts.sql`:
  drops `clinic_ai_knowledge_entries`; creates `clinic_ai_hours` (weekday 0–6,
  interval_index for future split hours, open<close + closed-day checks),
  `clinic_ai_services` + `clinic_ai_insurance_plans` (checkbox catalogs +
  custom rows, unique `(clinic_id, key)`), `clinic_ai_appointment_settings`,
  `clinic_ai_payment_settings`, `clinic_ai_office_policies` (one row per
  clinic), and `clinic_website_scan_runs` (run log). Shared statuses
  `not_found|needs_review|approved|do_not_use`, sources
  `manual|business_profile|website_draft|system_default`, `set_updated_at`
  triggers, RLS enabled (no policies; service-role only).
- New committed catalogs/limits `config/ai-front-desk-facts.config.ts`
  (18 default services, 15 default insurance plans, max 50 entries each
  including custom, text-length limits, US timezone list). Old
  `config/ai-front-desk-knowledge.config.ts` deleted.
- New pure helpers: `lib/ai-knowledge/facts.ts` (validation + server-side
  custom keys; replaces deleted `lib/ai-knowledge/entries.ts`),
  `lib/ai-knowledge/scan-url-safety.ts` (SSRF guard: http/https only, no
  credentials/odd ports, rejects localhost/private/internal hosts and all IP
  literals, same-origin link sanitizer), `lib/ai-knowledge/website-extract.ts`
  (deterministic JSON-LD + text extraction; short excerpts only, never raw
  HTML).
- New scan runner `lib/ai-knowledge/website-scan.ts`: reads
  `clinics.website` only, manual re-validated redirects (www/scheme tolerance
  on the homepage hop), max 8 pages, 1 MB/page, 8s timeout, no cookies/auth.
  Drafts are saved as `website_draft`/`needs_review`; never auto-approved;
  never overwrite approved rows or owner-saved hours; never edit Business
  profile (address/phone mismatch becomes a short review note).
- Rewrote `lib/db/ai-knowledge.ts` for the structured model (facts view, hours
  replace-save, selection saves, server-keyed custom adds with 50-cap, scan run
  log + conservative draft application).
- Replaced the API: `GET /api/account/ai-knowledge` plus POST `/hours`,
  `/services`, `/insurance`, `/appointments`, `/payment`, `/policies`,
  `/scan-website` — all owner/admin-only via new shared
  `lib/auth/owner-admin.ts` (front_desk rejected), clinic-scoped, validated
  server-side.
- Replaced the UI: `AiKnowledgeCard.tsx` is now an accordion (Business profile
  facts read-only from `clinics`, Hours & location, Appointments, Insurance,
  Services, Payment, Office policies, Website check) with the single top
  principle "Add what AI can safely say to patients. Questions without an
  approved answer go to your office. AI never gives medical advice." No
  technical/internal wording in owner UI; no owner-editable safety section
  (safety is a system rule). New `.aifacts-*` styles + `.sr-only` utility in
  `app/globals.css`.
- Replaced tests: `tests/ai-knowledge-facts.test.ts` +
  `tests/ai-knowledge-website-scan.test.ts` (32 tests; old
  `ai-knowledge-catalog.test.ts` deleted; `test:ai-knowledge` script now runs
  the new files).
- Docs: PROJECT-CONTEXT + operations runbook sections rewritten for the
  structured model; old same-day SETUP-LOG entries marked SUPERSEDED;
  Knowledge System CH-21 article/README/inventory updated.

Migration status: **APPLIED to production 2026-06-10** (owner-authorized in the
task prompt) on Supabase project `qfjpvbvfvhbtebwivcdc` via the Supabase
Management API; history row recorded as version `20260615000100`. Post-apply
verification: old table gone (`to_regclass` null), all 7 new tables present,
RLS enabled on all 7, `set_updated_at` triggers on the 6 updated_at tables.

Validation: `npm run typecheck`, `npm run test:ai-knowledge` (32 pass),
`npm run test:phone-numbers` (32 pass), `npm run test:a2p` (64 pass),
`npm run test:sms-recovery` (52 pass), `npm run build`, and `git diff --check`
all pass. No `lint` script exists in `package.json`.

Not done / explicitly out of scope: no SMS sent, no calls placed, no Twilio
mutations, no AI provider calls or env vars, no Stripe changes, no Vercel env
changes, no raw website HTML stored, `docs/` untouched.

---

## 2026-06-10 — Production rollout: structured clinic facts replacement

Deployed and verified the structured clinic-facts replacement in production.

- Commit `604f57376eb77144728ce4ae04e06f3e8b116457`
  ("account: replace AI knowledge with structured clinic facts") pushed to
  `origin/main`; GitHub-triggered Vercel deployment
  `dpl_79nKPJ5Ztvzf7nQ8urfyPo9mubXv` built normally (no INITIALIZING hang this
  time), reached READY, and is aliased to `https://app.missedcallsdental.com`.
- Migration `20260615000100_replace_ai_knowledge_with_structured_facts.sql` was
  applied and verified before the deploy (see previous entry). The brief window
  between table drop and deploy only affected the non-critical AI knowledge
  section (test-only data, no real customers).

Production verification (all pass):

- `GET /api/health` -> 200 `ok: true`.
- `GET /api/account/ai-knowledge` unauthenticated -> 401 JSON.
- `POST /api/account/ai-knowledge/scan-website` unauthenticated -> 401 JSON
  (auth gate runs before any website fetch).
- `/account?section=ai_knowledge` -> 200 (sign-in gate when unauthenticated).
- `/account?section=business` -> 200; `/workspace` -> 200.
- DB: `clinic_ai_knowledge_entries` gone; all 7 structured tables present with
  RLS enabled.

No SMS sent, no calls placed, no Twilio/Stripe mutations, no env or DNS
changes, no AI provider calls, no raw website HTML stored.

---

## 2026-06-10 — AI Knowledge UX + website loader refinements

Focused fix on the structured-facts AI Knowledge page. No AI runtime, no
Twilio/SMS changes, no schema changes.

What changed:

- Website loader (`lib/ai-knowledge/website-scan.ts`) now bootstraps the
  homepage from safe same-site variants via `homepageVariants()` in
  `scan-url-safety.ts`: https://host, https://www-variant, http://host,
  http://www-variant (scheme + www only, each re-validated). Cross-domain
  redirects remain rejected; follow-up pages stay same-origin with the
  resolved homepage origin.
- Real-world finding: `https://allyexp.com` (Business profile website of the
  test clinic) redirects to a DIFFERENT domain, `allyexporter.com`, on every
  variant — so it is correctly not scanned under the same-site policy. Setting
  the Business profile website to `https://allyexporter.com` loads fine (the
  page is a small placeholder with no dental facts, so the scan reports no
  information found).
- Owner-facing scan outcomes are now neutral: unreachable/invalid sites and
  zero-fact scans all show "No website information was loaded. You can fill in
  the sections below." The scan API returns `loaded: false` instead of a 502
  technical message; the technical reason stays in
  `clinic_website_scan_runs.error_message` + a server log line.
- UI (`AiKnowledgeCard.tsx`): Website block moved to the top (after the global
  principle, before Business profile facts) with helper "We can try to load
  basic information from your website…" and button "Load website information";
  the bottom "Website check" accordion was removed. Global principle second
  line now reads "Questions AI cannot answer go to someone in your office."
  "Preferred time question" renamed to "Preferred first time question".
  Accordion headers got small summaries (Insurance/Services "N selected",
  Hours "Needs setup").
- Services/insurance single-save model: Add only updates the visible list
  (checked by default, "Added items are saved when you click Save."); custom
  items show an accessible Remove button (defaults cannot be removed); one
  Save persists selections + `customToAdd` (labels validated, keys minted
  server-side) + `customToRemove` in a single transaction
  (`saveServiceSection`/`saveInsuranceSection` in `lib/db/ai-knowledge.ts`,
  payload validated by `validateCatalogSectionUpdate` in
  `lib/ai-knowledge/facts.ts`). Duplicate labels rejected case-insensitively;
  50-entry caps enforced in validation and re-checked in the transaction.
  The old immediate-add API actions were removed.

Validation: `npm run typecheck`, `npm run test:ai-knowledge` (39 pass, up from
32), `npm run test:phone-numbers` (32), `npm run test:a2p` (64),
`npm run test:sms-recovery` (52), `npm run build`, `git diff --check` — all
pass. No `lint` script exists in `package.json`.

Not done: no SMS sent, no calls, no Twilio mutations, no AI provider calls, no
env changes, no migrations, no raw website HTML stored, `docs/` untouched.

---

## 2026-06-10 — Production rollout: AI Knowledge UX + website loader refinements

- Commit `73a20f1ca1c8e7537aa0066a6969a66e6f5070c1`
  ("account: refine AI knowledge website loading UX") pushed to `origin/main`;
  GitHub-triggered Vercel deployment `dpl_E3evtBHeLzmUZnwrZKZP1BnZ2e1P` reached
  READY and is aliased to `https://app.missedcallsdental.com`.

Production verification (all pass):

- `GET /api/health` -> 200 `ok: true`.
- `GET /api/account/ai-knowledge` unauthenticated -> 401 JSON.
- `/account?section=ai_knowledge` -> 200; `/account?section=business` -> 200;
  `/workspace` -> 200 (expected gates when unauthenticated).
- Deployment serves exactly commit 73a20f1 (new copy/UI verified by build +
  unit tests; the page-specific client chunk only loads in an authenticated
  session, so in-browser owner verification is Vlad's final click-through).

Operational note for the test clinic: `https://allyexp.com` redirects to the
different domain `allyexporter.com`, so the same-site policy correctly refuses
to scan it and the owner sees the neutral no-information message. To get a
successful load, set the Business profile website to the domain the site
actually lives on (e.g. `https://allyexporter.com`).

No SMS, no calls, no Twilio/Stripe mutations, no env/DNS changes, no AI
provider calls, no raw HTML stored.

---

## 2026-06-10 — AI Knowledge UI cleanup: Languages section, Form link, parser strictness

Focused UI/parser cleanup on the structured-facts AI Knowledge page. No AI
runtime, no Twilio/SMS changes, no schema changes, no migration.

What changed:

- Top principle card: added vertical spacing between the bold line and the
  second line (no text change).
- Removed the repeated "Suggested from your website" text under each
  Services/Insurance checkbox; the section-header "Review" badge still appears
  when website suggestions exist.
- Languages moved out of Office policies into its own accordion section
  (`POST /api/account/ai-knowledge/languages`, stored in the existing
  `clinic_ai_office_policies.languages text[]` — no new table). Defaults:
  English, Spanish, Russian, Polish, Chinese. English is always selected,
  locked, and re-added server-side by `validateLanguagesList()`. Custom
  languages add/remove (deduped case-insensitive, max 20, ≤40 chars).
  `saveOfficeLanguages` writes only the languages column so it never clobbers
  policy text.
- Office policies now contain only: Form link, What to bring, Cancellation /
  reschedule policy, Parking notes, Accessibility notes. "New patient forms"
  became a one-line **Form link** field validated as a URL/path
  (`looksLikeFormLink`) — free text is rejected. Added placeholders for what to
  bring, cancellation/reschedule, and parking; renamed "Cancellation policy" →
  "Cancellation / reschedule policy".
- Website parser strictness: the scan only drafts a new-patient **form link**
  from a clear same-origin anchor (`extractNewPatientFormLink`) and never writes
  page-text excerpts into office policy fields (the old noisy
  `new_patient_forms` excerpt source is gone). What-to-bring, cancellation, and
  parking are never parser-filled.
- Existing bad draft handling: `getClinicAiFacts` hides any
  `new_patient_forms` value that is not a link (returns blank), so the legacy
  test-only noisy excerpt no longer displays and is cleared on the next save.
  No production SQL was run (out of this task's scope); the read-sanitize +
  parser fix fully neutralize it.
- Custom items in Languages/Services/Insurance share one compact design: a
  checkbox cell with a small accessible `×` (`aria-label="Remove <label>"`);
  default catalog items have no remove button.

Validation: `npm run typecheck`, `npm run test:ai-knowledge` (51 pass, up from
39), `npm run test:phone-numbers` (32), `npm run test:a2p` (64),
`npm run test:sms-recovery` (52), `npm run build`, `git diff --check` — all
pass. No `lint` script exists in `package.json`.

Not done: no SMS sent, no calls, no Twilio mutations, no AI provider calls, no
env changes, no migration, no raw website HTML stored, `docs/` untouched.

---

## 2026-06-10 — Production rollout: AI Knowledge UI cleanup

- Commit `8e1df28b9ff13358dfafa43984411b3ebe0dadd4` pushed to `origin/main`;
  GitHub-triggered Vercel deployment `dpl_FvgRLzi9pkSgFwt8KY76hmek37K4` READY
  and aliased to `https://app.missedcallsdental.com`.

Production verification (all pass):

- `GET /api/health` -> 200 `ok: true`.
- `POST /api/account/ai-knowledge/languages` unauthenticated -> 401 (new
  owner/admin-only route is live).
- `/account?section=ai_knowledge` -> 200; `/account?section=business` -> 200;
  `/workspace` -> 200 (expected gates when unauthenticated).
- New copy/UI (Languages section, Form link, placeholders, removed per-item
  suggested text) verified by build + 51 unit tests; the authenticated
  click-through is the owner's final check.

No SMS, no calls, no Twilio/Stripe mutations, no env/DNS changes, no AI
provider calls, no migration, no raw HTML stored.

---

## 2026-06-11 — AI Knowledge intro + payment facts refactor (deployed)

- Commit `33bf9a56c989d163becc84f0b0fd15d717c626ae` pushed to `origin/main`;
  Vercel deployment `dpl_9FARK2rjVtQofbkH7ZesRURzYpwA` READY and aliased to
  `https://app.missedcallsdental.com`.
- Intro card: removed the inline gap style; real `.aifacts-intro` CSS class.
- Payment split into Payment methods (cash, credit/debit cards, personal
  checks, HSA/FSA cards) and Financing & plans (in-office payment plans,
  CareCredit, Alphaeon Credit, membership plan + custom options, max 50).
  Pricing policy textarea removed from the owner UI (legacy column cleared on
  next save).
- Migration `20260616000100_payment_methods_and_financing.sql` applied to
  production (`qfjpvbvfvhbtebwivcdc`): new boolean columns on
  `clinic_ai_payment_settings` (backfilled `in_office_payment_plans` from
  legacy `payment_plans`) + new `clinic_ai_financing_options` table (RLS, no
  policies).
- Website parser maps payment plans / CareCredit / Alphaeon to the new
  columns; payment methods are never inferred from generic text.
- Verification: `/api/health` 200; `/account?section=ai_knowledge`,
  `/account?section=business`, `/workspace` all 200; unauthenticated
  `/api/account/ai-knowledge` 401. All test suites + build pass.

No SMS, no Twilio mutations, no AI provider calls, no env changes.

---

## 2026-06-11 — AI Knowledge review workflow: Needs review → Complete, Save→Edit locking, Appointments owner UI removed

Owner-workflow simplification of `/account?section=ai_knowledge` (commit on
`main`; see git log for `account: simplify AI knowledge review workflow`).

What changed:

- Removed the editable Appointments accordion (Accepting new patients,
  Cleaning/Same-day/Emergency appointments, Reschedule/cancel requests,
  Preferred first time question). Appointment request collection is now
  explained in the intro card: "AI collects appointment requests. Your office
  confirms appointments." The `clinic_ai_appointment_settings` table and the
  `/appointments` API route remain for compatibility but have no owner UI, and
  the website scan no longer writes appointment drafts (no owner-review work).
- Intro card copy now has three scannable body rows (appointments explanation,
  office fallback, no medical advice); `.aifacts-stack` gained a `margin-top`
  so the card is clearly separated from the "AI Front Desk Knowledge" title.
- Business profile facts: collapsed by default, read-only, no badge.
- Removed all selected-count summaries ("N selected") from accordion headers.
- Review lifecycle: every editable section (Hours & location, Insurance,
  Services, Languages, Payment methods, Financing & plans, Office policies)
  shows a yellow "Needs review" badge until its first successful Save, then a
  green "Complete" badge. Saved sections lock (fields read-only, add/remove
  hidden) and show `Edit` instead of `Save` — the Business profile lock/edit
  pattern. The old blue "Review" badges are replaced by this lifecycle.
- Persistence: new table `public.clinic_ai_knowledge_section_reviews`
  (PK `(clinic_id, section_key)`; keys hours/insurance/services/languages/
  payment_methods/financing/office_policies; RLS, no policies;
  `set_updated_at` trigger). Saves upsert exactly one section row — saving
  Payment methods never marks Financing complete (shared payment row), and
  Languages/Office policies stay independent (shared policies row). Website
  scan drafts delete only the affected sections' review rows.
- Migration `20260617000100_ai_knowledge_section_reviews.sql` applied to
  production (`qfjpvbvfvhbtebwivcdc`); verified table, check constraint,
  trigger, and RLS. `supabase_migrations.schema_migrations` reconciled to the
  repo filename version.
- `GET /api/account/ai-knowledge` now returns `reviewedSections` so the badge
  state survives reloads.

Validation: `npm run typecheck` pass; `npm run test:ai-knowledge` 69 pass;
`npm run test:phone-numbers` 32 pass; `npm run test:a2p` 64 pass;
`npm run test:sms-recovery` 52 pass; `npm run build` pass; `git diff --check`
clean. (No lint script exists.)

No SMS, no Twilio mutations, no AI provider calls, no env changes, no secrets
printed, no patient-facing behavior changed.

## 2026-06-11 — AI Knowledge follow-up: badge follows visible mode, Needs review tooltip, Bank transfer / ACH payment method

Follow-up fix on the review workflow (commit on `main`; see git log for
`account: refine AI knowledge review badges and payment methods`).

What changed:

- Complete + Save can no longer appear together: the header badge is derived
  from reviewed AND locked (`sectionStatus()` in `AiKnowledgeCard.tsx`). A
  reviewed section re-opened via `Edit` shows "Needs review" + Save; after a
  successful Save it returns to "Complete" + Edit. Applied to all seven
  editable sections; Business profile facts unchanged.
- The yellow "Needs review" badge now carries an owner help tooltip
  (`ReviewStatusBadge`, hover `title` + keyboard-focusable wrapper with
  `aria-label`): "Review this section and click Save to mark it complete."
  Scoped to AI Knowledge — the shared `StatusBadge` is untouched.
- Payment methods reordered (cards first, cash later) and a fixed
  `Bank transfer / ACH` checkbox added: Credit/debit cards, HSA/FSA cards,
  Personal checks, Cash, Bank transfer / ACH. Fixed-list only — no custom
  payment methods, no Zelle/Venmo/Cash App defaults.
- Migration `20260618000100_add_bank_transfer_ach_payment_method.sql` applied
  to production (`qfjpvbvfvhbtebwivcdc`): adds nullable `bank_transfer_ach`
  boolean to `clinic_ai_payment_settings`. No backfill; legacy payment
  columns left in place.
- Website parser drafts `bank_transfer_ach` only on an explicit "ACH" (word
  match) or "bank transfer" mention; generic wording ("convenient payment
  options", "we accept most payment methods") and Zelle mentions are ignored.
  An ACH draft re-opens the payment_methods review section; financing drafts
  keep re-opening financing.

Rollout: pushed to `origin/main` (GitHub→Vercel production auto-deploy);
deployment READY + `/api/health`, `/account?section=ai_knowledge`,
`/account?section=business`, `/workspace` verified post-deploy.

No SMS, no Twilio mutations, no AI provider calls, no env changes, no secrets
printed, no patient-facing behavior changed.

---

## 2026-06-11 — SMS readiness production audit and local Brand hardening

Production-readiness audit for missed-call recovery SMS live-send safety.

What changed:

- Audited the outbound SMS send path: `sendRecoverySms()` remains the only direct
  Twilio `messages.create` path, and `tests/sms-single-send-path.test.ts`
  enforces that it is only invoked from the voice status webhook.
- Hardened local-number live-send readiness in `lib/db/sms-readiness.ts`:
  `REGISTERED`/`registered` is no longer treated as a safe live Brand status.
  Only `APPROVED`/`VERIFIED` unlock local A2P readiness. `registered` remains a
  Mock A2P lifecycle completion status only.
- Added a regression test in `tests/a2p-brand-status.test.ts` so SMS live-send
  readiness cannot regress and accept `REGISTERED` for local A2P.
- Updated operational and Knowledge System docs to reflect the live-send rule.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 52 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean.

No SMS sent, no real Twilio mutations, no provider console/API checks, no
Supabase/Vercel/env changes, no deploy, and no secrets printed.

---

## 2026-06-11 — SMS safety fix pushed and production deploy verified

Pushed commit `cd66cad0a0713baa96fa3bf12e9ee7c14c57de9f`
(`fix: harden local sms brand readiness`) to `origin/main`.

Verification:

- `origin/main` and GitHub `main` resolved to
  `cd66cad0a0713baa96fa3bf12e9ee7c14c57de9f` after fetch.
- GitHub Pages/check run for `main` completed successfully.
- Vercel production deployment `dpl_cukGHTQogbFYN3L65kcEohS1TNzz` reached
  `Ready` and was aliased to `https://app.missedcallsdental.com`.
- `https://app.missedcallsdental.com/api/health` returned 200 with
  `{"ok":true,"service":"missed-calls-dental","version":"foundation-v1"}`.

No SMS sent, no Twilio resource mutations, no provider console changes, no env
changes, and no secrets printed.

---

## 2026-06-11 — Read-only pilot SMS provider readiness check

Verified the current production pilot clinic/number from app DB state and
read-only Twilio provider APIs. No SMS was sent and no provider/app state was
changed.

Pilot identity:

- Clinic: Fairstone Dental Smile
  (`f37f24a1-070f-436b-b803-956f55466093`).
- Exact active assigned number: toll-free `+1***4944`, PN SID `PN...05a402`.
- Messaging Service: `MG...8f7d93`.

Findings:

- Twilio IncomingPhoneNumber exists, matches the DB PN SID/phone number, is
  `in-use`, and has Voice/SMS capability.
- Twilio Messaging Service exists and the exact PN SID is in its sender pool.
- Toll-free verification exists for the exact PN SID and is `TWILIO_APPROVED`.
- Local A2P is not required for this toll-free pilot number. The provider listed
  no A2P Campaigns for the Messaging Service; one Brand was listed as approved.
- App DB still blocks live missed-call SMS recovery: the exact number's
  `clinic_sms_number_readiness.last_synced_at` is stale relative to the
  24-hour live-send freshness limit, and `clinics.sms_recovery_enabled=false`.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 52 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `git diff --check` clean before this documentation update.

Conclusion: provider state appears ready for the exact toll-free pilot number,
but the app is **not ready** for live missed-call SMS recovery until readiness
is refreshed and owner-approved live enablement is performed.

---

## 2026-06-11 — Pilot toll-free readiness refreshed

Refreshed production app readiness state for Fairstone Dental Smile's exact
active toll-free pilot number (`+1***4944`, PN SID `PN...05a402`) using the
same toll-free readiness semantics as `lib/texting-status/sync.ts`.

What changed:

- Read Twilio Toll-Free Verification for the exact PN SID: `TWILIO_APPROVED`.
- Read Messaging Service sender coverage for the exact PN SID: `covered`.
- Updated only the exact app rows for this phone number:
  `clinic_phone_numbers` texting sync fields and
  `clinic_sms_number_readiness`.
- The refreshed readiness row is fresh, `production_safe=true`, has no sync
  error, and has no launch blocking reason.

Launch gate after refresh:

- Provider readiness: ready for the exact toll-free number.
- App number readiness: ready/fresh for the exact toll-free number.
- Controlled activation is still intentionally gated:
  `SMS_RECOVERY_MODE=owner_test`, `clinics.sms_recovery_enabled=false`, and
  `clinics.sms_status='waiting_for_approval'`.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 52 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.

No SMS sent, no call placed, no Twilio resource mutations, no A2P submission or
retry, no number lifecycle action, no Stripe change, no env change, and no
secrets printed.

---

## 2026-06-11 — Owner-test missed-call SMS E2E passed

Ran one controlled production owner-test missed-call recovery flow for
Fairstone Dental Smile's active toll-free pilot number (`+1***4944`) from an
allowlisted test caller (`+1***9236`).

Result: **PASS**.

Observed and verified:

- Twilio inbound call completed: caller `+1***9236` -> pilot `+1***4944`;
  Twilio Call SID `CA...45b9cd`.
- App received the voice status webhook and recorded
  `webhook_events.external_id='voice:status:CA...45b9cd'`.
- Exactly one missed-call recovery SMS was sent from `+1***4944` to
  `+1***9236`; Twilio Message SID `SM...4e2954`; final DB delivery status
  `delivered`.
- SMS used the fixed recovery template, identified Fairstone Dental Smile,
  included STOP opt-out language, and contained no medical claims, fake
  urgency, discounts, or spammy wording.
- The owner reply was received by Twilio and stored in the app:
  Twilio Message SID `SM...ef190c`, webhook event `sms.inbound`, body matched
  the expected owner-test reply, and the message was linked to the existing
  Fairstone conversation.
- Workspace-safe conversation query shows the conversation for `+1***9236`
  with the latest message as the inbound owner reply.
- Duplicate checks: one outbound recovery SMS, one expected inbound owner reply,
  and one conversation for the test caller in the test window.

Safety gates after test:

- `SMS_RECOVERY_MODE=owner_test`.
- `clinics.sms_recovery_enabled=false`.
- `clinics.sms_status='waiting_for_approval'`.
- Pilot readiness remained fresh, `production_safe=true`, and Messaging Service
  sender coverage remained `covered`; toll-free verification remained
  `TWILIO_APPROVED`.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 52 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `git diff --check` clean before this documentation update.

No live patient SMS was enabled, no STOP test was performed, no Twilio resource
mutation occurred, no A2P action occurred, no Stripe change occurred, no env
change occurred, and no secrets were printed.

---

## 2026-06-11 — Fairstone live activation blocked by existing enabled owner-test clinic

Attempted preflight for controlled LIVE activation of missed-call SMS recovery
for Fairstone Dental Smile only.

Result: **BLOCKED before any production change**.

Blocker:

- Another clinic already had `sms_recovery_enabled=true`: Owner Test Dental
  Office (`e9f21de4-3a35-4216-bb16-66ea3aeb2e47`, slug `owner-test`).
- Activation instructions required stopping if any clinic other than Fairstone
  was enabled before switching global `SMS_RECOVERY_MODE` to `live`.
- The prior owner-test caller (`+1***9236`) also remained inside the 24-hour
  duplicate suppression window. Use a different controlled test caller, such as
  allowlisted `+1***7848`, or wait for the duplicate window to expire.

Preflight confirmed:

- Production `SMS_RECOVERY_MODE=owner_test`.
- Fairstone `sms_recovery_enabled=false`.
- Fairstone `sms_status='waiting_for_approval'`.
- Pilot number `+1***4944` was active with `removal_status='active'` and
  `texting_status='active'`.
- Pilot readiness was fresh, `production_safe=true`, with no sync error or
  blocking reason.
- Messaging Service sender coverage was `covered`.
- Toll-free verification was `TWILIO_APPROVED`.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 52 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `git diff --check` clean.

No env change, DB mutation, Twilio resource mutation, A2P action, Stripe
change, number lifecycle action, SMS, call, live patient SMS enablement, or
secret printing occurred.

---

## 2026-06-11 — Fairstone live activation rolled back after uncontrolled test caller

Cleared the prior live-activation blocker, attempted controlled LIVE activation
for Fairstone Dental Smile only, then rolled back because the required
controlled caller did not complete the live test.

Approved cleanup completed:

- Set only Owner Test Dental Office
  (`e9f21de4-3a35-4216-bb16-66ea3aeb2e47`, slug `owner-test`)
  `sms_recovery_enabled=false`.
- Verified zero clinics had `sms_recovery_enabled=true` before activation.

Activation attempt:

- Verified production `SMS_RECOVERY_MODE=owner_test`.
- Verified production health returned 200.
- Verified Fairstone pilot number `+1***4944` was active, toll-free,
  `removal_status='active'`, `texting_status='active'`.
- Verified readiness was fresh, `production_safe=true`, no sync error, no launch
  blocking reason, Messaging Service sender coverage `covered`, and toll-free
  verification `TWILIO_APPROVED`.
- Verified prior caller `+1***9236` was still inside the duplicate suppression
  window, so selected controlled caller `+1***7848`.
- Validation passed before activation:
  `npm run typecheck`, `npm run test:sms-recovery` (52 tests),
  `npm run test:a2p` (65 tests), `npm run test:phone-numbers` (32 tests), and
  `git diff --check`.
- Set production `SMS_RECOVERY_MODE=live`.
- Deployed production config: Vercel deployment
  `dpl_84GYRwiAou9eJVb8VhJD6hDszHWy` reached `Ready`; health returned 200; mode
  verified as `live`.
- Set only Fairstone
  (`f37f24a1-070f-436b-b803-956f55466093`) `sms_recovery_enabled=true`;
  `sms_status` remained `waiting_for_approval`.

Live test result: **ROLLED BACK**.

- Required controlled caller `+1***7848` produced no call, message, or
  conversation records during the watch window.
- The prior duplicate-window caller `+1***9236` produced additional inbound
  call/reply activity instead; duplicate suppression prevented a new outbound
  recovery SMS in that live-test window.
- Because the requested controlled live test could not be completed, the
  activation was not left live.

Rollback completed:

- Set Fairstone `sms_recovery_enabled=false`.
- Set production `SMS_RECOVERY_MODE=owner_test`.
- Deployed rollback config: Vercel deployment
  `dpl_HR6h6UP8oBU8GPVJJLLh6VCQDBu9` reached `Ready`; health returned 200; mode
  verified as `owner_test`.
- Final verified state: zero clinics have `sms_recovery_enabled=true`; Fairstone
  `sms_recovery_enabled=false`; Owner Test Dental Office
  `sms_recovery_enabled=false`; Fairstone `sms_status='waiting_for_approval'`;
  readiness remained fresh and provider coverage remained ready.

No Twilio resource mutation, A2P action, Stripe change, number lifecycle action,
secret printing, deletion, phone-number release, or patient-data dump occurred.

---

## 2026-06-11 — Internal SMS duplicate suppression test bypass added

Added code support for an internal production test-only duplicate suppression
bypass using `SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO`.

Behavior:

- The env value is a comma-separated list of full E.164 caller numbers.
- Empty or missing config preserves existing duplicate suppression behavior.
- When a caller is configured, only the duplicate-window check is bypassed.
- All other missed-call recovery guards still run first: `SMS_RECOVERY_MODE`,
  exact-number readiness, `clinic.sms_recovery_enabled`, local-number
  `clinic.sms_status` behavior, STOP/opt-out, wrong-clinic/wrong-number
  protections, and the guarded Twilio send path.
- Voice greeting prediction uses the same duplicate decision so the greeting
  matches the send path.
- Bypass usage logs
  `twilio.sms.duplicate_suppression_bypassed_for_test_number` with caller last 4
  only.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 60 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean.

No production env change was made in this code task. No Twilio resource
mutation, A2P action, Stripe change, number lifecycle action, SMS send, or
secret printing occurred.

---

## 2026-06-11 — Production SMS duplicate suppression bypass env enabled

Set production `SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO` for the internal
primary test caller (`+1***9236`) and redeployed production.

Verification:

- Commit `90b30e9` was present locally and on `main`.
- Production `SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO` pulled back as
  `+1***9236` after recreating it as a non-sensitive Vercel env var so the
  operator can verify the masked value.
- Production `SMS_RECOVERY_MODE=live` remained unchanged.
- Fairstone Dental Smile remained the only clinic with
  `sms_recovery_enabled=true`.
- All other clinics remained `sms_recovery_enabled=false`.
- Vercel production deployment `dpl_GD5WDofqaC36mBBXCwp6X9QwdKnG` reached
  `Ready`.
- Production health returned HTTP 200.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 60 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `git diff --check` clean.

No SMS was sent, no call was placed, and no Twilio resource, Stripe, A2P,
phone-number lifecycle, `SMS_RECOVERY_MODE`, or clinic enablement change was
made.

---

## 2026-06-11 — Duplicate suppression bypass live test passed

Verified the internal production duplicate suppression bypass for the Fairstone
Dental Smile test clinic.

Operator test:

- Test caller: `+1***9236`.
- Clinic number: `+1***4944`.
- Operator placed two missed-call tests and replied after the second recovery
  SMS with the expected bypass-test reply.

Verification:

- Production `SMS_RECOVERY_MODE=live`.
- Production `SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO=+1***9236`.
- Fairstone remained the only clinic with `sms_recovery_enabled=true`; all other
  clinics remained disabled.
- Production DB recorded exactly two missed-call events in the test window, both
  routed to Fairstone.
- Production DB recorded exactly two outbound recovery SMS messages in the test
  window, both from `+1***4944` to `+1***9236`, both delivered, and both linked
  to the same Fairstone conversation.
- Twilio read-only message/call logs agreed with DB state: the two newest test
  calls completed and the two newest recovery SMS messages were delivered from
  `+1***4944`.
- Vercel production logs contained exactly two
  `twilio.sms.duplicate_suppression_bypassed_for_test_number` events in the
  verification window, both for caller last4 `9236`.
- No duplicate suppression bypass log was found for any other caller.
- The inbound bypass-test reply was received, stored, linked to the same
  Fairstone conversation, and visible as the latest workspace conversation
  message.
- No duplicate webhook external IDs were found in the test window.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 60 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `git diff --check` clean.

No Twilio resource mutation, Stripe change, A2P action, phone-number lifecycle
change, production env change, or clinic enablement change was made during this
verification.

---

## 2026-06-11 — Fairstone internal production live mode enabled

Enabled internal production LIVE missed-call SMS recovery for Fairstone Dental
Smile only. This is an internal production live test state, not a real customer
clinic launch; current clinics are test clinics and the Fairstone number is not
publicly advertised.

Preflight:

- Verified production `SMS_RECOVERY_MODE=owner_test`.
- Verified zero clinics had `sms_recovery_enabled=true`.
- Verified Fairstone `sms_recovery_enabled=false`.
- Verified Fairstone pilot number `+1***4944` was active, toll-free,
  `removal_status='active'`, `texting_status='active'`.
- Verified readiness was fresh, `production_safe=true`, no sync error, no launch
  blocking reason, Messaging Service sender coverage `covered`, and toll-free
  verification `TWILIO_APPROVED`.

Validation before activation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 52 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `git diff --check` clean.

Activation:

- Set production `SMS_RECOVERY_MODE=live`.
- Deployed production config: Vercel deployment
  `dpl_4TEaEpPo8MFBtvGh6oEzKmGZV7QZ` reached `Ready`; production health returned
  200.
- Set only Fairstone
  (`f37f24a1-070f-436b-b803-956f55466093`) `sms_recovery_enabled=true`.
- Left Fairstone `sms_status='waiting_for_approval'` unchanged because the
  enabled number is toll-free and the live-send gate does not require local A2P
  `sms_status='active'` for toll-free.

Final verified state:

- Production `SMS_RECOVERY_MODE=live`.
- Exactly one clinic has `sms_recovery_enabled=true`: Fairstone Dental Smile.
- Owner Test Dental Office (`owner-test`) remains `sms_recovery_enabled=false`.
- Fairstone readiness remained fresh and provider coverage remained ready.
- No recent test call/message from controlled caller `+1***7848` was present at
  final verification, so live mode is ready for manual internal testing.

No Twilio resource mutation, A2P action, Stripe change, number lifecycle action,
secret printing, deletion, phone-number release, or patient-data dump occurred.

---

## 2026-06-11 — System-admin AI Knowledge + SMS Conversation Builder v1

Built admin-side AI Knowledge management and a deterministic SMS Conversation
Builder. No AI runtime, no AI provider calls. Default behavior unchanged: with
no saved conversation settings, `max_auto_replies` defaults to 0 and the
missed-call SMS is byte-for-byte the existing fixed message.

What changed:

- Migration `supabase/migrations/20260619000100_sms_conversation_builder.sql`
  (additive/idempotent): `clinic_sms_conversation_settings`
  (max_auto_replies 0–3), `clinic_sms_message_templates` (initial seq 0 +
  auto_reply seq 1–3, body ≤240, role/sequence checks), conversation state on
  `patient_conversations` (`patient_display_name`, `sms_auto_reply_count`,
  `sms_auto_reply_last_sent_at`), and `messages.message_kind`
  (missed_call_recovery | conversation_auto_reply | manual | inbound). RLS
  enabled on the two new tables.
- Admin AI Knowledge: `AiKnowledgeCard` now takes `apiBasePath`
  (owner default `/api/account/ai-knowledge` unchanged). New admin routes
  `GET /api/admin/clinics/[clinicId]/ai-knowledge` + section POSTs (hours,
  services, insurance, languages, payment, policies) + scan-website, guarded by
  `lib/auth/admin-clinic.ts` (`requirePlatformAdminClinic`, clinic id from URL).
  Shared handlers in `lib/ai-knowledge/section-handlers.ts` reuse the owner
  validation/DB functions; admin saves audit `clinic.ai_knowledge.<section>.update`
  / `clinic.ai_knowledge.website_scan` (redacted). New **AI knowledge** tab in
  `AdminClinicConsole`.
- SMS Conversation Builder: pure helpers
  `lib/sms-recovery/conversation-templates.ts` (prefix/suffix, default middle,
  follow-up suggestions, render with natural {{patient_name}} fallback,
  `buildInitialSmsBody` delegating to the fixed builder when no middle),
  `template-safety.ts` (banned phrases/URLs/emails/phones/unknown placeholders/
  caps), `patient-name.ts` (conservative fail-closed extractor),
  `auto-reply-evaluation.ts` (pure ordered decision). DB helper
  `lib/db/sms-conversation-settings.ts`; conversation helpers
  (`setPatientDisplayNameIfEmpty`, `getConversationAutoReplyState`,
  `claimAutoReplySlot`) and message helpers (`message_kind`,
  `hasPriorRecoveryOutbound`, recovery-filtered `hasSentRecoverySmsSince`).
- Outbound: `outbound-sms.ts` builds the initial body from the saved middle
  (safe fallback to the fixed default on any settings/build error) and records
  `message_kind='missed_call_recovery'`.
- Inbound webhook: after a first-seen ordinary reply, conservatively extracts +
  stores a patient name, then `maybeSendConversationAutoReply`
  (`lib/twilio/conversation-auto-reply.ts`) may send one deterministic
  follow-up. It enforces mode, exact-number readiness, recovery gate, opt-out,
  prior-recovery, max/enabled-slot, keyword and duplicate guards itself, claims
  the slot atomically, and records `conversation_auto_reply`. Webhook still
  returns empty TwiML.
- Admin SMS builder API `GET|POST /api/admin/clinics/[clinicId]/sms-conversation`
  (`clinic.sms_conversation.update` audit) + `AdminSmsConversationBuilder` UI;
  new **SMS messages** tab.
- Tests: `tests/sms-conversation-templates.test.ts`,
  `tests/sms-patient-name.test.ts`, `tests/sms-auto-reply-evaluation.test.ts`,
  `tests/admin-ai-knowledge-routing.test.ts`; updated single-send-path static
  guard to allow the second fully-guarded send module. Added to
  `test:sms-recovery` + the unit-tests tsconfig.

Validation: `npm run typecheck`, `npm run test:sms-recovery` (92),
`npm run test:ai-knowledge` (76), `npm run test:a2p` (65),
`npm run test:phone-numbers` (32), `npm run build`, `git diff --check` — all
pass. No `lint` script exists in `package.json`.

Not done / out of scope: no SMS sent, no calls, no Twilio resource mutations,
no A2P submit/retry, no Stripe changes, no phone-lifecycle changes, no env
changes. No follow-up templates were enabled in production data.

---

## 2026-06-11 — Production rollout: admin SMS Conversation Builder + admin AI Knowledge

- Commit `9bba26ea2493cceb6b64df76fad7342e7264b4a3` pushed to `origin/main`;
  GitHub-triggered Vercel deployment `dpl_GxM2LXPPEnEGW98GxhofnWCuv1yX` READY and
  aliased to `https://app.missedcallsdental.com`.
- Migration `20260619000100_sms_conversation_builder.sql` **applied to
  production** (Supabase project `qfjpvbvfvhbtebwivcdc`, MCP apply_migration;
  history version aligned to `20260619000100`). Verified: both new tables
  present, RLS enabled on both, 3 new `patient_conversations` columns,
  `messages.message_kind` present. **0 rows** in
  `clinic_sms_conversation_settings` / `clinic_sms_message_templates` →
  auto-replies inactive for every clinic; missed-call SMS unchanged.

Production verification (all pass):

- `GET /api/health` → 200 `ok:true`.
- `GET/POST /api/admin/clinics/{id}/ai-knowledge*` and
  `GET /api/admin/clinics/{id}/sms-conversation` → 401 unauthenticated
  (platform-admin guarded).
- `GET /api/account/ai-knowledge` → 401 unauthenticated (owner behavior
  unchanged).
- `/account?section=ai_knowledge` → 200; `/workspace` → 200.

No SMS sent, no calls, no Twilio/Stripe/A2P/phone-lifecycle mutations, no env
changes. No follow-up templates enabled in production data.

---

## 2026-06-12 — Production rollout: admin SMS builder initial-template correction

- Commit `31d37b256b13ea1865534a63bfbf7503bae55f2d`
  (`fix: improve admin sms message builder`) pushed to `origin/main`.
- GitHub-triggered Vercel production deployment
  `dpl_26bXPhmgXE197fcShcAQPovkR5yM` reached **Ready** and was aliased to
  `https://app.missedcallsdental.com`.
- Production health check passed:
  `GET https://app.missedcallsdental.com/api/health` -> HTTP 200,
  `ok:true`.

What changed:

- Platform-admin **SMS messages** now edits the full Initial missed-call SMS
  template in one textarea. The locked start/end UI was removed.
- Server validation still requires clinic identity and `Reply STOP to opt out`,
  rejects unsafe wording, and strips unresolved placeholders before send.
- Existing `clinic_sms_message_templates` schema was reused; no migration was
  added or applied. Old middle-only initial rows render safely as full
  templates, and rows that already contain the full initial SMS are not wrapped
  again, preventing duplicate clinic identity / STOP language.
- Follow-up suggestions were refreshed to the current copy.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 102 tests.
- `npm run test:ai-knowledge` pass: 76 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean (only Git's line-ending warning for this markdown
  file).

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no env change, no migration,
and no secrets printed.

---

## 2026-06-12 — SMS Conversation Builder live-test fixes + voice greetings

Built the follow-up fixes for production live testing without sending SMS or
placing calls.

What changed:

- Initial missed-call SMS send path now has a pure
  `buildRecoverySmsBodyFromConversationConfig` helper used by
  `sendRecoverySms`, with tests proving saved full initial templates render in
  the real recovery-send body path. With no saved initial template, the fixed
  default remains unchanged.
- Added deterministic inbound reply classification:
  `thanks`, `acknowledgement`, `negative`, and `unclear_short` save inbound
  messages without normal follow-up, slot consumption, or courtesy reply;
  `informative` and safe `name_provided` replies can continue through the
  existing guarded auto-reply flow.
- Improved fail-closed patient-name extraction to support clear first replies
  such as "My name is Jon Svillow. I need an appointment"; existing names are
  not overwritten. When a name is already known or safely collected on the first
  reply, the name-question follow-up is skipped and the actual sent sequence is
  claimed atomically.
- Added platform-admin Voice greeting editing inside the existing **SMS
  messages** builder. The three fixed scenarios are `will_send`, `duplicate`,
  and `none`; TwiML/Say/Hangup behavior remains system-controlled. Voice
  templates allow only `{{clinic_name}}`, use XML-safe final TwiML escaping,
  and duplicate/no-text scenarios reject future SMS promises.
- Added additive migration
  `20260620000100_voice_greeting_templates.sql` to widen
  `clinic_sms_message_templates` role/sequence constraints for
  `template_role='voice_greeting'`.
- Admin API GET/POST now returns and saves SMS + voice settings together and
  audits compact metadata only: `max_auto_replies`, `initial_customized`,
  `follow_up_enabled_count`, and `voice_customized_count`.

Validation so far:

- `npm run test:sms-recovery` pass: 119 tests.
- `npm run typecheck` pass.
- `npm run build` pass.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `git diff --check` clean, with only Git's CRLF normalization warning for
  `MVP_BUILD_DOCS/SETUP-LOG.md`.

Production migration application and Vercel deployment verification were
completed in the rollout entry below.

---

## 2026-06-12 — Production rollout: SMS Conversation Builder live-test fixes + voice greetings

- Commit `8fbef8851703148e84539d7ed2168b161102578c`
  (`fix: harden sms conversation builder`) pushed to `origin/main`.
- Applied production migration
  `supabase/migrations/20260620000100_voice_greeting_templates.sql` over the
  documented direct/admin DB connection. Recorded migration history version
  `20260620000100`.
- Verified production DB: migration history count for `20260620000100` = 1;
  `clinic_sms_message_templates_role_check` and
  `clinic_sms_message_templates_sequence_check` allow `voice_greeting`;
  current `clinic_sms_message_templates` row counts are `initial` = 1,
  `auto_reply` = 3, `voice_greeting` = 0. No template bodies were read or
  logged.
- GitHub-triggered Vercel production deployment
  `dpl_B7wq64a5NKUpRRD9Kc3Cb9evW5N3` reached **Ready** and was aliased to
  `https://app.missedcallsdental.com`.

Production verification:

- `GET https://app.missedcallsdental.com/api/health` -> HTTP 200, `ok:true`.
- `GET /api/admin/clinics/{Fairstone clinic id}/sms-conversation` -> HTTP 401
  unauthenticated (platform-admin guarded).
- `GET /api/admin/clinics/{Fairstone clinic id}/ai-knowledge` -> HTTP 401
  unauthenticated (admin guard unchanged).
- `GET /account?section=ai_knowledge` -> HTTP 200 (owner account page still
  renders).
- Read-only DB check confirmed Fairstone `sms_recovery_enabled=true`.

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no env change, no secret
printing, no template body dump, and `.qwen/` remained untouched.

---

## 2026-06-12 — SMS Conversation Builder auto-reply reset and UI simplification

Fixed the missed follow-up observed during internal live testing, without
sending SMS or placing calls.

What changed:

- Added `resetConversationAutoReplyCycle(conversationId)` in
  `lib/db/conversations.ts`. It clears `sms_auto_reply_count` to 0 and
  `sms_auto_reply_last_sent_at` to null while leaving `patient_display_name`
  unchanged.
- `sendRecoverySms()` now resets the deterministic auto-reply cycle only after
  Twilio accepts a new recovery SMS and `recordOutboundMessage` successfully
  stores the outbound `message_kind='missed_call_recovery'` row. Failed sends or
  failed message records do not reset the cycle.
- The regression sequence for internal caller `+1***9236` is covered in tests:
  recorded recovery row, count reset to 0, `"I need cleaning appointment"`
  eligible for follow-up #1, `"I'm Vlad"` extracts `Vlad` and is eligible for
  follow-up #2, and thanks/ok replies do not consume or send follow-up slots.
- Refreshed deterministic default copy for the Initial SMS, follow-ups, and the
  `will_send` voice greeting using ASCII apostrophes only.
- Simplified the platform-admin SMS Conversation Builder: read-only by default,
  Edit -> Save -> read-only flow, Voice greeting block first, SMS messages
  second, no visible Suggestion/Default helper lines, compact variable helper,
  and reset buttons only while editing.
- Updated operational and platform-admin Knowledge System docs for the new
  reset behavior and UI flow.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 130 tests.
- `npm run test:ai-knowledge` pass: 76 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean.

No migration was added or applied. No SMS sent, no calls placed, no Twilio
resource mutation, no A2P mutation, no Stripe change, no phone-number lifecycle
change, no production env change, no secret printing, and `.qwen/` remained
untouched.

---

## 2026-06-12 — SMS Conversation Builder default-backed template storage cleanup

Fixed the SMS Conversation Builder default/custom storage model and applied the
production data-only cleanup for stale saved default-like template text.

What changed:

- Code defaults are now the source of truth for the Initial SMS, follow-up
  templates, and voice greetings.
- `clinic_sms_message_templates.body_text = NULL` now explicitly means "use the
  current code default" for default-backed rows.
- Saving text equal to the canonical default removes the unnecessary override or
  stores a NULL default-backed body instead of saving the literal default text.
- Enabled follow-up rows can have `body_text=NULL`; those send the current code
  default for that follow-up slot. Disabled default-backed rows are cleaned up.
- Admin API responses expose active state as `defaultText`, `effectiveText`,
  `customBody`, and `isCustom`; the builder UI uses effective active text and no
  longer depends on suggestion fields.
- Added data-only migration
  `supabase/migrations/20260621000100_clean_sms_template_default_overrides.sql`.

Production data cleanup:

- Supabase project verified: `qfjpvbvfvhbtebwivcdc`.
- Preflight count-only check found stale saved default-like rows in the initial
  template, follow-up #1, follow-up #2, and all three voice greeting scenarios.
  No template bodies were printed.
- Applied migration `20260621000100_clean_sms_template_default_overrides.sql`
  over the documented direct/admin DB connection and recorded migration history
  version `20260621000100`.
- Post-migration count-only verification: all known default-like body counts are
  0. Follow-up rows remain 3 total / 3 enabled / 2 default-backed NULL bodies /
  1 custom body. No template bodies were printed.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 134 tests.
- `npm run test:ai-knowledge` pass: 76 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean.

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no production env change, no
secret printing, and `.qwen/` remained untouched.

---

## 2026-06-12 — SMS Conversation Builder 10 follow-ups and thanks courtesy reply

Expanded the deterministic SMS Conversation Builder follow-up model and applied
the production schema update without sending SMS or placing calls.

What changed:

- Follow-up slots are now centralized as #1-#10 with
  `max_auto_replies` allowed from 0 to 10.
- Slots #1-#3 keep their canonical code defaults and may be stored as enabled
  default-backed rows with `body_text=NULL`.
- Slots #4-#10 have no code default; admin save and storage logic require
  custom text before they are usable or included in the configured maximum.
- The platform-admin builder exposes slots #4-#10 under an additional
  follow-ups disclosure, keeps read-only/Edit/Save behavior, and disables
  custom-only slots when their text is cleared.
- Thanks replies still do not trigger a normal numbered follow-up or increment
  `sms_auto_reply_count`. They may send exactly one deterministic courtesy
  reply per recovery cycle: `You're welcome. Our team will follow up.`
- Added `patient_conversations.sms_thanks_courtesy_sent_at` as the courtesy
  idempotency marker. A new successfully recorded recovery SMS clears the
  normal auto-reply counter, last-sent timestamp, and courtesy marker.
- Real callers keep `patient_display_name` across recovery cycles. Configured
  duplicate-suppression bypass test callers only have `patient_display_name`
  reset after the new recovery SMS is accepted by Twilio and recorded.
- Added migration
  `supabase/migrations/20260622000100_expand_sms_conversation_followups.sql`.

Production migration:

- Supabase project verified: `qfjpvbvfvhbtebwivcdc`.
- Applied migration `20260622000100_expand_sms_conversation_followups.sql`
  over the documented direct/admin DB connection and recorded migration history
  version `20260622000100`.
- Post-migration verification: migration history count = 1;
  `clinic_sms_conversation_settings_max_check` allows 10;
  `clinic_sms_message_templates_sequence_check` allows `auto_reply` sequence
  1-10 while keeping `voice_greeting` sequence 1-3; and
  `patient_conversations.sms_thanks_courtesy_sent_at` exists.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 143 tests.
- `npm run test:ai-knowledge` pass: 76 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean, with only Git's CRLF normalization warning for
  `app/admin/(console)/clinics/[clinicId]/_components/AdminSmsConversationBuilder.tsx`.

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no production env change, no
secret printing, no template body dump, and `.qwen/` remained untouched.

---

## 2026-06-12 — Safety-aware SMS replies and expanded patient-name extraction

Added a deterministic emergency/pain safety layer to the SMS Conversation
Builder and widened conservative patient-name extraction, without sending SMS
or placing calls.

What changed:

- `classifyInboundReply` adds a `safety_concern` class for potential
  emergency/pain wording (pain, emergency, urgent, swelling, bleeding,
  infection, fever, abscess, trauma, "knocked out", "can't breathe", "trouble
  breathing"). No AI, no diagnosis, no severity inference, no treatment advice.
- A safety-concern reply runs through the SAME guarded auto-reply flow. When
  the next follow-up is otherwise eligible, the conditional line
  `If this is a medical emergency, call 911.` is prepended ONCE per recovery
  cycle. The prefixed reply consumes its normal numbered slot and is recorded
  as `message_kind='conversation_auto_reply'` with `safety_notice: true` and
  `auto_reply_sequence` metadata. No standalone safety SMS exists:
  `max_auto_replies=0`, opt-out, readiness/clinic-gate failure, missing prior
  recovery outbound, STOP/START/HELP, and duplicate webhooks all block it.
- Added `patient_conversations.sms_safety_notice_sent_at` with atomic
  `claimSafetyNotice` (mirrors `claimThanksCourtesyReply`; never rolled back
  after a failed Twilio send). `resetConversationAutoReplyCycle` now clears it
  when a new missed-call recovery SMS starts a cycle. `patient_display_name`
  reset behavior is unchanged (test-only duplicate-bypass callers only).
- `extractPatientName` stays fail-closed but now recognizes explicit inline
  phrases anywhere in a bounded message: "use X as (it's|it is) my name",
  "X is my name" (sentence start), "my name should be X", "my name is X"
  mid-message, "you can use X", "you can call me X", "call me X".
  "Ok. maybe, use alex sikorsky as it's my name appointment need tomorrow"
  now extracts "Alex Sikorsky". Digits/links/emails/keywords, >3 words,
  request/filler/safety words still fail closed; existing names are never
  overwritten; the webhook still attempts extraction on every ordinary inbound
  until a name is stored.
- Follow-up #1 default updated to ask for name + preferred time:
  `Thanks for the info. What name should we use when our office follows up?
  If you're looking for an appointment, what time works best for you?`
  (ASCII apostrophes). Follow-ups #2/#3 unchanged. Default/override model
  unchanged (code defaults are source of truth; `body_text=NULL` =
  default-backed).
- Added migration `supabase/migrations/20260623000100_sms_safety_notice.sql`:
  idempotent `sms_safety_notice_sent_at` column + data-only cleanup setting old
  default-like Follow-up #1 bodies to NULL (enabled flags and true custom text
  preserved).
- Thanks courtesy reply, ok/ack/negative silence, STOP/START/HELP handling,
  opt-out, readiness, clinic gate, sender pinning, and owner template-edit
  blocking are all unchanged.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 161 tests.
- `npm run test:ai-knowledge` pass: 76 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean.

Production migration:

- Supabase project verified: `qfjpvbvfvhbtebwivcdc`.
- Applied `20260623000100_sms_safety_notice.sql` via the Supabase management
  apply-migration path and recorded migration history version
  `20260623000100` (name `sms_safety_notice`).
- Post-migration verification: `patient_conversations.sms_safety_notice_sent_at`
  exists; Follow-up #1 rows: 0 custom-body rows, 1 default-backed (NULL body)
  row — default-backed clinics now use the new Follow-up #1 default. No
  template bodies were printed.

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no production env change, no
secret printing, no template body dump, and `.qwen/` remained untouched.

---

## 2026-06-12 — SMS settings split, editable special replies, anti-spam pause

Reorganized the admin SMS Conversation Builder into focused panels, made the
safety-notice and thanks-courtesy texts admin-editable, and added a simple
per-conversation anti-spam automation pause — without sending SMS or placing
calls.

What changed:

- Admin left nav: the single "SMS messages" section became a grouped
  **SMS settings** block with three panels: Voice greeting, SMS texts
  (initial + follow-ups #1-#10 + Safety notice + Thanks reply), and
  Limits & anti-spam. `AdminSmsConversationBuilder` takes
  `view="voice"|"texts"|"limits"`; each subview keeps Edit -> Save ->
  read-only and saves ONLY its own section. The admin API merges missing
  sections from the saved config, so saving one panel never resets another.
- Special replies are stored as `clinic_sms_message_templates` rows with
  `template_role='special_reply'` (seq 1 = safety_notice, 2 = thanks_courtesy).
  Code defaults stay the source of truth (defaults in
  `lib/sms-recovery/special-reply-templates.ts`); default-equal/blank saves
  remove the override row. The safety notice remains a once-per-cycle PREFIX
  on the next eligible follow-up (never standalone, never a separate branch);
  the thanks courtesy keeps its once-per-cycle, no-slot behavior.
  `validateSafetyNoticeText` requires "medical emergency" + "call 911" with
  911 as the only digits; `validateThanksReplyText` rejects digits, variables,
  and contact details; both inherit the banned-phrase rules.
- Anti-spam: after automation ENDS for a recovery cycle
  (`max_auto_replies_reached` / `template_disabled`), ordinary inbound SMS
  with no automated response increment
  `patient_conversations.unanswered_after_automation_count` atomically.
  Defaults (code-backed, NULL columns): pause automation at 6 unanswered for
  24 hours (`automation_muted_until`), flag high volume at 10
  (`high_volume_flagged_at`). While muted, the auto-reply path skips ALL
  automation with reason `automation_muted`, inbound messages are still
  recorded and counted, STOP/START/HELP is unaffected, and the number is
  never blocked. A new recovery SMS resets count/flag and clears an EXPIRED
  mute only — an active mute is never cleared early. Keywords, duplicates,
  gate failures, and thanks/ack/negative/unclear replies never count.
- Settings live on `clinic_sms_conversation_settings`
  (`unanswered_mute_after`, `unanswered_high_volume_after`,
  `automation_mute_hours`; NULL = defaults 6/10/24; bounds 1-100, 1-200,
  1-168; high-volume >= mute enforced in the API). The settings row is kept
  whenever max_auto_replies > 0 OR anti-spam is customized.
- Added migration
  `supabase/migrations/20260624000100_sms_special_replies_and_anti_spam.sql`
  (additive + idempotent).
- Unchanged: STOP/START/HELP, opt-out, readiness, clinic gate, sender pinning,
  duplicate-webhook handling, follow-up #1-#10 behavior, safety-concern
  classification, patient-name extraction, test-only duplicate-bypass name
  reset, and the owner/front-desk template-editing block.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 185 tests.
- `npm run test:ai-knowledge` pass: 76 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean.

Production migration:

- Supabase project verified: `qfjpvbvfvhbtebwivcdc`.
- Applied `20260624000100_sms_special_replies_and_anti_spam.sql` via the
  Supabase management apply-migration path and recorded migration history
  version `20260624000100` (name `sms_special_replies_and_anti_spam`).
- Post-migration verification: the three anti-spam settings columns and the
  three patient_conversations volume columns exist, and both
  `clinic_sms_message_templates_role_check` and
  `clinic_sms_message_templates_sequence_check` now allow `special_reply`
  (sequence 1-2). No template bodies were printed.

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no production env change, no
secret printing, no template body dump, and `.qwen/` remained untouched.

---

## 2026-06-12 — Front-desk Workspace operational queue redesign

Rebuilt `/workspace` into a real front-desk patient-request queue with archive/
handled/block actions and deterministic request details — without sending SMS
or placing calls.

What changed:

- Queue with Active / Archived / Blocked filter pills; cards show name (or
  phone), status badge, flags (Safety concern, Automation paused, High volume),
  last-message snippet with direction, and last activity.
- Patient header card: name or Unknown, phone shown once, status + flags,
  primary Call patient (`tel:` link), and Mark handled / Archive / Block
  number (Reopen when archived, Unblock number when blocked).
- Request details card always renders Name, Phone, Request, Preferred
  appointment time, Safety concern, Payment / insurance, First seen, and Last
  activity. Fields derive deterministically from INBOUND text and conversation
  state via `lib/workspace/request-summary.ts` (no AI; fail-closed Unknown /
  None detected).
- Conversation preview shows the last 2 messages immediately with Patient /
  Your office labels; Show full conversation toggles the full timeline. The
  old "Latest patient reply" block and the big Outcome radio form are removed;
  `/api/workspace/outcome` remains for backward compatibility only.
- Internal note (renamed from Note) saves independently via the new
  `POST /api/workspace/conversation-action` route
  (`save_note|archive|reopen|mark_handled|block_number|unblock_number`):
  clinic-scoped, sample IDs rejected, UUID + 300-char note validation,
  cross-clinic conversations indistinguishable from missing.
- "Block number" blocks the PATIENT/CALLER number for this clinic only via
  `public.clinic_blocked_patient_numbers` (unique clinic+phone, RLS enabled,
  no policies). It never touches the clinic's Twilio business number, never
  mutates Twilio, never deletes history, and is separate from carrier
  opt-outs. `sendRecoverySms` and `maybeSendConversationAutoReply` now fail
  closed with reason `patient_number_blocked`; inbound messages from blocked
  numbers are still recorded and STOP/START/HELP is unchanged. Blocking
  archives the conversation; unblocking sends nothing and keeps it archived.
  The UI requires inline confirmation naming the patient number explicitly.
- `lib/db/front-desk.ts` now also returns patient_display_name, safety and
  anti-spam signals, workspace archive/handled state, and the block join —
  still no Twilio SIDs, raw payloads, billing, or compliance fields.
- Samples rebuilt to the new structure (appointment, pain/urgent, insurance,
  handled/archived) and collapse by default when real conversations exist.
- Added migration
  `supabase/migrations/20260625000100_workspace_queue_and_patient_blocks.sql`.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 211 tests.
- `npm run test:ai-knowledge` pass: 76 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean.

Production migration:

- Supabase project verified: `qfjpvbvfvhbtebwivcdc`.
- Applied `20260625000100_workspace_queue_and_patient_blocks.sql` via the
  Supabase management apply-migration path and recorded migration history
  version `20260625000100` (name `workspace_queue_and_patient_blocks`).
- Post-migration verification: `public.clinic_blocked_patient_numbers` exists
  with RLS enabled and zero policies (service-role only), and all six
  workspace archive/handled columns exist on `patient_conversations`. No
  patient data was printed.

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no production env change, no
secret printing, no patient data printed, and `.qwen/` remained untouched.

---

## 2026-06-13 — Workspace queue cards simplified and inbound-only SMS auto-blocked

Tightened the `/workspace` left queue cards and added a webhook guard so Missed
Calls Dental remains a missed-call recovery workflow rather than a public SMS
inbox.

What changed:

- Left queue cards now show only safe name when available, phone number, and
  last activity. They no longer show request summaries, `Review conversation`,
  latest-message snippets, Patient/Office prefixes, chips, or status badges.
  The right detail panel still keeps the deterministic request summary,
  conversation preview, name edit, actions, and internal note.
- Section sorting is now: Needs follow-up oldest first by last activity;
  Handled / Archived / Blocked newest first by handled / archived / blocked
  timestamp when present, falling back to last activity.
- Ordinary non-keyword inbound SMS now checks for any prior missed-call recovery
  outbound to the same clinic + patient phone after the inbound message is
  saved. Legacy null `message_kind` outbound rows count as recovery;
  `conversation_auto_reply` rows and other clinics do not count. If no recovery
  history exists, the patient/caller number is clinic-scoped blocked with reason
  `inbound_without_recovery_history`, the conversation is archived when
  practical, classification/name extraction/auto-reply are skipped, and the
  webhook returns normal empty TwiML 200.
- STOP/START/HELP handling, duplicate inbound suppression, blocked-number
  inbound recording, patient-number block semantics, Twilio settings, and
  phone-number lifecycle behavior are unchanged.

Validation:

- `npm run test:sms-recovery` pass: 226 tests.
- `npm run typecheck` pass.
- `npm run test:ai-knowledge` pass: 76 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean.

Production migration: none needed (existing `messages`,
`patient_conversations`, and `clinic_blocked_patient_numbers` structures cover
the behavior).

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no production env change, no
secret printing, no patient data printed, and `.qwen/` remained untouched.

---

## 2026-06-13 — Front-desk Workspace decluttered section queue

Decluttered `/workspace` so the queue is organized by section headers instead
of repeated per-card status badges — no migration needed, no SMS sent, no calls
placed.

What changed:

- Queue sections now render in this order: Needs follow-up, Handled, Archived,
  Blocked. Needs follow-up uses warning/yellow styling and is expanded by
  default; Handled (success), Archived (neutral/info), and Blocked (danger)
  are collapsed by default.
- Section membership priority is blocked > handled > archived > needs
  follow-up. Active conversations remain under Needs follow-up regardless of
  latest inbound/outbound message; the older outbound-waiting label is not
  staff-facing.
- Each section initially shows up to 6 cards with a visible client-side
  `Load more` button for the next 6. Section header counts always show total
  section counts.
- Cards and selected detail headers no longer repeat the primary section status
  badge. Cards show title, optional phone, one-line request summary, latest
  message snippet, last activity, and only non-redundant system chips
  (`Automation paused`, `High volume`).
- Request-summary signal chips for pain/urgent, payment, and insurance no
  longer duplicate the headline. The deterministic fallback remains
  `Review conversation`; no AI was added.
- Samples now use the same four-section structure as real requests and remain
  collapsed when real conversations exist.
- Updated `FRONT-DESK-WORKSPACE.md`, `OPERATIONS-RUNBOOK.md`, and the
  Knowledge System workspace/help inventory to match the staff-facing behavior.

Validation:

- Focused workspace tests pass: 38 tests.
- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 223 tests.
- `npm run test:ai-knowledge` pass: 76 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean.

Production migration: none needed (existing columns and tables cover the
feature; no schema change).

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no production env change, no
secret printing, no patient data printed, and `.qwen/` remained untouched.

---

## 2026-06-12 — Front-desk Workspace polish (sections, handled flow, name edit)

Polished `/workspace` into a cleaner, faster front-desk screen — no migration
needed (existing columns cover everything), no SMS sent, no calls placed.

What changed:

- Layout: Active queue first; Handled (success tone), Archived (info tone),
  and Blocked (danger tone) are collapsed sections below with counts and
  quick actions (Reopen / Unblock number). Section priority:
  blocked > archived > handled > active; Handled never appears in Active.
  Client-side Load more: Active pages 25, sections 10.
- Handled flow: clicking `Handled` opens an inline "Was appointment booked?"
  Yes/No panel; choosing either saves immediately. `mark_handled` now
  REQUIRES `appointmentBooked: boolean` and records
  `front_desk_outcome` (`appointment_booked` / `no_appointment_booked`) +
  `front_desk_outcome_at` + lifecycle status alongside `workspace_handled_at`.
- Reopen (from Handled or Archived) fully returns the request to Active:
  clears handled + archived state, clears `front_desk_outcome(_at)`, and
  resets status to `open` so no stale booked state shows. Nothing is deleted.
- Name handling: placeholder is now `Not provided` (never `Unknown`).
  `lib/workspace/display-name.ts` sanitizes stored display names through the
  conservative fail-closed extractor — request text like "I Need Appointment"
  never displays as a name. Staff can inline-edit the name via the new
  `save_name` action (empty clears; digits/URLs/emails/phones/keywords/request
  words rejected server-side; clinic-scoped).
- Request summary: replaced the field table with one compact card — a
  deterministic one-line headline ("Cleaning appointment · Tomorrow",
  "Mentions pain/urgent concern · Wants appointment", fallback
  "Review conversation") plus signal-only chips (Pain/urgent, Payment,
  Insurance, Automation paused, High volume). No "None detected" rows.
  `buildWorkspaceRequestSummary` keeps a future `aiSummary` hook; nothing
  produces AI (no provider, no env, no calls).
- Tooltips (exact strings) on Call / Handled / Archive / Block / Reopen /
  Unblock; block/unblock copy describes only the phone number. Block stays a
  confirmed, visually separated danger action.
- Visual polish via token-based `.ws-*` classes in `app/globals.css`: toned
  collapsed sections, clearer selected states, primary-accent summary card,
  distinct patient (info tone + accent) vs office bubbles, mobile-wrapping
  action rows. Inline styles reduced.
- Samples rebuilt to the five demo layouts (active with name+time, active
  with `Not provided`, handled booked-yes, archived, blocked); still collapsed
  whenever real conversations exist.
- Unchanged: patient-number block suppression of initial SMS/auto-replies,
  inbound recording for blocked numbers, STOP/START/HELP, opt-out, readiness,
  clinic gate, sender pinning, `/api/workspace/outcome` compatibility route.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass: 221 tests.
- `npm run test:ai-knowledge` pass: 76 tests.
- `npm run test:a2p` pass: 65 tests.
- `npm run test:phone-numbers` pass: 32 tests.
- `npm run build` pass.
- `git diff --check` clean.

Production migration: none needed (existing columns and tables cover the
feature; no schema change).

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no production env change, no
secret printing, no patient data printed, and `.qwen/` remained untouched.

---

## 2026-06-13 — Front-desk Workspace simplified to three visible states

Simplified `/workspace` from four visible queue sections to three visible
states: Needs follow-up, Handled, and Blocked. Archive remains as backend
compatibility/internal stored state only; it is no longer a staff-facing button,
tooltip, or visible section.

What changed:

- Visible queue sections are exactly Needs follow-up, Handled, and Blocked.
  Needs follow-up starts expanded; Handled and Blocked start collapsed.
- Section headers keep total counts; each section still pages 6 cards at a time
  with `Load more`.
- Moving a card to Handled or Blocked no longer auto-expands the destination
  section.
- Archived-only legacy conversations remain reachable under Needs follow-up so
  no old conversation is hidden by the removed Archived section.
- Handled cards show the saved result badge only in the Handled section:
  `Appointment booked` or `No appointment booked`.
- Reopen from Handled clears handled/archive/outcome state and returns the card
  to Needs follow-up. Unblock now also clears the archived/handled trap and
  returns the request to a visible follow-up state without sending SMS.
- Updated `FRONT-DESK-WORKSPACE.md`, `OPERATIONS-RUNBOOK.md`, and the
  Knowledge System customer-help Workspace entries/inventory.

Validation:

- Focused workspace tests pass: 47 tests.
- `npm run typecheck` pass.

Production migration: none needed (existing columns and tables cover the
behavior; no schema change).

No SMS sent, no calls placed, no Twilio resource mutation, no A2P mutation, no
Stripe change, no phone-number lifecycle change, no production env change, no
secret printing, no patient data printed, and `.qwen/` remained untouched.

---

## 2026-06-13 — Notification Settings foundation + MVP scope alignment (AI Answering)

Added a minimal, extensible Notification Settings foundation to `/account` and
aligned the source-of-truth docs so the MVP direction is **AI Answering + SMS
Recovery + Workspace**. AI Answering is documented as a planned MVP channel that
is **not live** (narrow call capture, not a full AI receptionist; owner-approval +
safety gates required). No AI voice runtime, no usage metering, no overage billing,
and no email/SMS delivery were built. Trial-start behavior was not changed (still
first included business number assignment).

What changed:

- New config `config/notifications.config.ts` (notification types/labels;
  included-minutes copy derives from `config/billing.config.ts`).
- New additive migration
  `supabase/migrations/20260626000100_clinic_notification_preferences.sql`
  (`clinic_notification_preferences` + future `clinic_notifications`; RLS enabled,
  no public policies; service-role/server access; `set_updated_at` trigger).
- New DB helpers `lib/db/notifications.ts` (degradation-safe read returns
  default-enabled preferences if the table is missing; save throws a typed
  unavailable error the API maps to a clear message).
- New API route `app/api/account/notification-settings/route.ts` (owner/admin
  only via `requireOwnerAdminAccess`; front-desk rejected; validates known types +
  boolean enabled).
- New UI `NotificationSettingsCard` wired into the Account group nav
  ("Notification Settings"); v1 alerts = AI answered call minutes 90% / 100%, both
  default on, either can be turned off (no mandatory/critical concept).
- Docs: `PROJECT-CONTEXT.md`, `START-HERE.md`, `BILLING-AND-USAGE-POLICY.md`,
  `OWNER-SETTINGS.md`, `Skills/missed-calls-dental-product-context.md`,
  `Skills/twilio-dental-sms.md`.

Production migration:
`20260626000100_clinic_notification_preferences.sql` is **created but NOT applied**
to production. The account page degrades safely (default-enabled preferences) until
it is applied; saving returns a clear message if the table is missing. Apply via
the approved migration path when ready.

Validation: `npm run typecheck` pass; `npm run test:ai-knowledge` and
`npm run test:sms-recovery` pass; `npm run build` pass; `git diff --check` clean.

No SMS sent, no calls placed, no Twilio/A2P/Stripe/Vercel/Supabase production
mutation, no provider env change, no trial-start change, no secret printing, no
patient data printed, and `.qwen/` remained untouched.

---

## 2026-06-14 — Notification Settings migration applied to production

Applied the pending additive migration
`20260626000100_clinic_notification_preferences.sql` to the production Supabase
project `sms_dental` (ref `qfjpvbvfvhbtebwivcdc`) via Supabase MCP
`apply_migration`. The MCP recorded it under a generated timestamp version
(`20260614152045`); per the project convention, the
`supabase_migrations.schema_migrations` version was then aligned to the repo
filename **`20260626000100`** (name `clinic_notification_preferences`) so future
CLI diff/push stays consistent.

Verification (all passed):

- Tables `public.clinic_notification_preferences` and
  `public.clinic_notifications` exist.
- RLS **enabled** on both; **zero** policies (service-role/server access only).
- Constraints confirmed: preferences PK `(clinic_id, notification_type)` + FK to
  `clinics(id)` ON DELETE CASCADE; notifications PK `(id)`, FK cascade, UNIQUE
  `(clinic_id, notification_type, dedupe_key)`; `set_updated_at` trigger present
  on preferences.
- Production `/api/health` → HTTP 200 `{"ok":true}`.
- `/api/account/notification-settings` is deployed; unauthenticated GET and POST
  both return HTTP 401 (owner/admin gate working).
- Persistence proven with a reversible DB round-trip on one real clinic:
  upsert (90%=off, 100%=on) → read back across a separate query (persisted) →
  update (trigger bumped `updated_at`) → delete. Test rows removed; **0** residual
  rows, so all clinics return to default-enabled behavior.

Not done / out of scope: authenticated production **UI** click-through (no owner
credentials / browser available — verified the equivalent API + DB behavior
instead). No Twilio/Stripe/Vercel env/DNS/SMS-settings/AI-runtime/billing/trial
changes; no SMS/email sent; no secrets or database URLs printed; `.qwen/` and
other pre-existing working-tree changes left untouched.

---

## 2026-06-27 — AI Answering foundation (data model + Workspace mock flow; NOT live)

Added the next non-live foundation so the product can later support **AI
Answering + SMS Recovery + Workspace**. This task only lets the system
**represent** AI answered calls in the database and Workspace. It does **not**
build an AI voice runtime: no Twilio ConversationRelay, no WebSocket
infrastructure, no OpenAI dependency, no SMS/email send, no metering/billing, and
no change to Twilio/Stripe/Vercel env/DNS/trial/SMS-mode behavior.

Changed/added (code):

- `config/ai-answering.config.ts` — vocabulary (session sources, statuses,
  workspace source channels), field-length limits, source-channel labels, default
  future AI voice id + `isValidAiVoiceId` (no billing literals duplicated).
- `lib/workspace/ai-voice-summary.ts` — pure `deriveWorkspaceSourceChannel` +
  fail-closed `buildAiVoiceCallSummary` (safety = front-desk flag only).
- `lib/db/ai-voice-sessions.ts` — `getClinicAiAnsweringSettings` (degradation-safe
  defaults), `upsertClinicAiAnsweringSettings` (voice validated; typed unavailable
  error), `createMockAiVoiceSession` (reuses `getOrCreateConversation`, safe
  display-name only-if-empty, no SMS/provider/transcript),
  `listLatestAiVoiceSessionsForConversations` (degradation-safe).
- `app/api/admin/clinics/[clinicId]/ai-answering/mock-session/route.ts` —
  platform-admin-only mock session creator (`requirePlatformAdminClinic`, clinic
  id from URL).
- Workspace display wiring: `lib/db/front-desk.ts`, `app/workspace/page.tsx`,
  `app/workspace/_components/workspace-types.ts`,
  `app/workspace/_components/Workspace.tsx` (Source line, AI call summary card,
  "No SMS messages yet." copy, one AI sample card).
- `/account` read-only **AI Answering** section: `AiAnsweringCard.tsx` wired into
  `BusinessProfile.tsx` ("Not active yet"; no enable toggle/activation/charts).
- Tests: `tests/ai-answering.test.ts` (wired into `test:sms-recovery` +
  `tsconfig.unit-tests.json`); `tests/workspace-queue.test.ts` factory updated for
  the new required `sourceChannel`.

Migration ADDED in this commit, applied to production in the follow-up entry
below (**"AI Answering foundation migration applied + verified"**):

- `supabase/migrations/20260627000100_ai_answering_foundation.sql` —
  `clinic_ai_answering_settings` + `ai_voice_sessions`. Additive, idempotent,
  clinic-scoped, RLS enabled, **no public policies** (service-role/server access
  only), `set_updated_at` triggers, length CHECK constraints, partial unique index
  on `(clinic_id, source, external_session_id)`. Stores no transcript/audio/raw
  AI prompts/responses/raw Twilio payloads/secrets/payment/diagnosis text. Reads
  are degradation-safe until it is applied.

Validation: `npm run typecheck` ✓, `npm run test:sms-recovery` ✓ (239 tests),
`npm run test:ai-knowledge` ✓ (76 tests), `npm run build` (see commit), `git diff
--check` (see commit).

Not done / out of scope: production migration apply (HOLD for explicit approval);
running the mock route against production; any AI voice runtime / ConversationRelay
/ OpenAI / WebSocket; SMS/email; metering/overage billing; Twilio/Stripe/Vercel/
DNS/trial changes. No secrets or database URLs printed. Pre-existing working-tree
changes (`.qwen/`, `design/recall/IMPLEMENTATION-STATUS.md`, KNOWLEDGE-SYSTEM
edits) left untouched and unstaged.

Commit: `feat: add AI answering workspace foundation` (pushed to `origin/main`).

---

## 2026-06-27 — AI Answering foundation migration applied + verified (production)

Applied the pending AI Answering foundation migration to **production** and
verified the deployed non-live foundation. This is **not** a live AI rollout: no
AI voice runtime, no Twilio ConversationRelay, no WebSocket, no OpenAI, no SMS/
email, and no change to Twilio/Stripe/Vercel env/DNS/billing/trial/SMS gates/
SMS_RECOVERY_MODE/clinic SMS enablement.

Migration applied:

- Applied **only** `supabase/migrations/20260627000100_ai_answering_foundation.sql`
  to production Supabase project `sms_dental` (ref `qfjpvbvfvhbtebwivcdc`) via
  Supabase MCP `apply_migration` (result `{"success":true}`). The MCP recorded a
  generated version (`20260614162150`); per the project convention the
  `supabase_migrations.schema_migrations` version was then aligned to the repo
  filename **`20260627000100`** (name `ai_answering_foundation`).

Database verification (all passed):

- Tables `public.clinic_ai_answering_settings` and `public.ai_voice_sessions`
  exist; both **empty** (0 rows). Additive create-if-not-exists — no existing data
  deleted or rewritten.
- RLS **enabled** on both; **zero** policies on both (service-role/server access
  only, matching every other internal clinic-scoped table).
- `set_updated_at` triggers present on both tables.
- Indexes present: `ai_voice_sessions_external_id_key` (partial, `where
  external_session_id is not null`), `ai_voice_sessions_clinic_created_idx`,
  `ai_voice_sessions_conversation_created_idx`, `ai_voice_sessions_patient_idx`,
  plus both primary keys.
- Constraints present on `ai_voice_sessions`: `source` check (`mock`,
  `future_twilio`), `status` check (`captured`, `incomplete`, `failed`), and all
  length checks (name ≤80, reason ≤240, preferred_time ≤120, summary ≤240,
  handoff ≤500, patient_phone ≤32, clinic_phone ≤32, external_id ≤200).
- Security advisor: the only finding on the two new tables is
  `rls_enabled_no_policy` at **INFO** level — the intended service-role-only
  pattern shared by all internal tables. The two **WARN** items
  (`set_updated_at` mutable search_path; auth leaked-password protection) are
  **pre-existing** and were not introduced by this migration.

Deployed-app verification:

- Production deploy for commit `d92ac6b` is live (the `mock-session` route
  responds, so it is deployed — not 404).
- `GET https://app.missedcallsdental.com/api/health` → HTTP 200
  `{"ok":true,...}`.
- Unauthenticated `POST /api/admin/clinics/{clinicId}/ai-answering/mock-session`
  → HTTP **401** `unauthorized` ("Please sign in to continue."). Platform-admin
  gate working; clinic id from the URL.

Mock route test: **skipped.** No platform-admin authenticated session/tooling was
available to call the route as an admin, so the authenticated mock session was
not created. No mock row was inserted by any other path; production has **zero**
`ai_voice_sessions` rows. DB gate (RLS, no policies) + API auth gate (401) were
verified instead.

Validation: `npm run typecheck` ✓, `npm run test:sms-recovery` ✓ (239 tests),
`npm run test:ai-knowledge` ✓ (76 tests), `npm run build` ✓ (compiled
successfully), `git diff --check` ✓ (no whitespace errors).

Not done / out of scope: no AI voice runtime / ConversationRelay / OpenAI /
WebSocket; no SMS/email; no metering/overage billing; no Twilio/Stripe/Vercel
env/DNS/trial/SMS-mode/SMS-enablement changes; no manual deploy; no provider
mutated other than the approved Supabase migration. No secrets, database URLs, or
service-role keys printed. Pre-existing working-tree changes (`.qwen/`,
`design/recall/IMPLEMENTATION-STATUS.md`, KNOWLEDGE-SYSTEM edits) left untouched.

Commit: `docs: log AI Answering foundation migration applied` (pushed to
`origin/main`).

---

## 2026-06-27 — Platform-admin AI Answering mock tester UI (NON-LIVE)

Added a platform-admin-only UI to create and inspect **mock** AI answered call
sessions for a clinic, on top of the already-applied AI Answering foundation.
This is **not** a live AI rollout: no AI voice runtime, no Twilio
ConversationRelay, no WebSocket, no OpenAI, no SMS/email, and no change to
Twilio/Stripe/Vercel env/DNS/billing/trial/SMS gates/SMS_RECOVERY_MODE/clinic SMS
enablement. No production mock session was created in this task.

Added/changed (code):

- `app/admin/(console)/clinics/[clinicId]/_components/AdminAiAnsweringMockTester.tsx`
  — new client component: non-live callout + safety copy, future voice label,
  latest mock sessions list, and a "Create mock Workspace request" form
  (phone/name/reason/preferred time/status/safety flag/handoff note). No enable
  toggle, no activation, no provider/billing controls. Shows "No call is placed.
  No AI runs. No SMS is sent." and an "Open Workspace if your account has clinic
  access" link.
- `AdminClinicConsole.tsx` — new **AI Answering** tab (between "AI knowledge" and
  the "SMS settings" group; nav status "Not live"). Admin-only; not in owner
  `/account`, not for front desk.
- `app/api/admin/clinics/[clinicId]/ai-answering/route.ts` — new platform-admin
  GET (guard `requirePlatformAdminClinic`, clinic id from URL). Returns future
  voice preference + latest mock sessions (phone masked to last 4) + count;
  degradation-safe `foundationApplied:false` when the table is missing. No
  provider IDs / raw payloads / transcripts / SIDs returned.
- `app/api/admin/clinics/[clinicId]/ai-answering/mock-session/route.ts` — response
  now also returns `workspaceUrl` + `message` (validation/guard unchanged).
- `lib/db/ai-voice-sessions.ts` — added `listLatestAiVoiceSessionsForClinic`
  (admin-safe fields only) + `countAiVoiceSessionsForClinic` (null when table
  missing). Both degradation-safe.
- `config/ai-answering.config.ts` — admin label maps `aiVoiceStatusLabel` /
  `aiVoiceSourceLabel` (pure, tested).
- Tests: extended `tests/ai-answering.test.ts` (label maps, clinic-level helper
  safe fields, GET route guard/mask/safe-fields, console tab presence).

Validation: `npm run typecheck` ✓, `npm run test:sms-recovery` ✓ (243 tests),
`npm run test:ai-knowledge` ✓ (76 tests), `npm run build` ✓ (both AI Answering
routes present), `git diff --check` ✓.

Manual QA: authenticated platform-admin click-through **not performed** (no admin
browser/session available; not explicitly approved). No production mock session
created; no rows inserted directly. Unauthenticated gate verified in production:
`POST .../ai-answering/mock-session` → 401; the new `GET .../ai-answering` was 404
pre-deploy and is expected to return 401 unauthenticated after this push
auto-deploys (same `requirePlatformAdminClinic` guard).

Not done / out of scope: no AI voice runtime / ConversationRelay / OpenAI /
WebSocket; no SMS/email; no metering/billing; no Twilio/Stripe/Vercel env/DNS/
trial/SMS-mode changes; no migration; no manual deploy; no provider mutated. No
secrets, DB URLs, or real patient data. Pre-existing working-tree changes
(`.qwen/`, `design/recall/IMPLEMENTATION-STATUS.md`, KNOWLEDGE-SYSTEM edits) left
untouched.

Commit: `feat: add admin AI answering mock tester` (pushed to `origin/main`).

---

## 2026-06-14 — AI Answering test request admin preview + visibility fix

Fixed the platform-admin verification path for non-live AI Answering test
requests. This is **not** a live AI rollout: no Twilio ConversationRelay, no
WebSocket runtime, no OpenAI, no SMS/email, no metering/billing, and no
Twilio/Stripe/Vercel env/DNS/trial/SMS gate/SMS_RECOVERY_MODE/clinic SMS
enablement changes.

Read-only production investigation:

- Count-only sanity check found exactly 1 `ai_voice_sessions` row across exactly
  1 clinic, so the detailed read stayed within the single test clinic.
- Single test clinic used: `Test Dental Clinic`
  (`f37f24a1-070f-436b-b803-956f55466093`, slug
  `fairstone-dental-smile`).
- Latest test request exists: yes. It is linked to conversation
  `8a075f82-629d-43f0-a0dc-9c884a19e430` for caller `***-***-9236`.
- The linked conversation belongs to the same clinic: yes.
- The linked conversation already had SMS history and was marked handled/booked
  before the test request (`workspace_handled_at` present; 71 SMS messages).
- The logged-in `/workspace` clinic id was not safely available from a DB-only
  read without the user's authenticated browser/session context.

Diagnosis:

- Generic `/workspace` is account/clinic-context scoped and is not reliable for a
  platform admin verifying a selected clinic from `/admin/clinics/[clinicId]`.
- The existing production test request also reused an already-handled
  conversation for the test caller number, so it would not naturally appear as a
  fresh Needs follow-up card even if the same clinic workspace were open.

Changed/added (code):

- Added a platform-admin **Patient requests** tab inside
  `/admin/clinics/[clinicId]`, immediately after **AI Answering**.
- Added `GET /api/admin/clinics/[clinicId]/patient-requests`, guarded by
  `requirePlatformAdminClinic`, using the URL clinic id. It returns display-safe
  fields only, masks caller phones to last 4, and does not return provider IDs,
  raw payloads, internal diagnostics, billing/legal details, secrets, or SMS
  message bodies.
- Extracted shared patient-request card mapping to
  `lib/workspace/patient-request-card.ts` so `/workspace` and the admin preview
  derive source labels, summaries, names, and AI/SMS mixed requests consistently.
- `createMockAiVoiceSession` now touches the linked conversation after inserting
  the mock AI session, preserving the inserted session if that secondary touch
  fails and logging only safe metadata.
- Cleaned platform-admin AI Answering copy: "Create test request", "Latest test
  requests", "Caller phone", "Internal note", and "View patient request" now
  replaces the generic `/workspace` link.
- Calmed owner `/account` AI Answering copy while keeping it clearly not active.

Validation:

- `npm run typecheck` pass.
- `npm run test:sms-recovery` pass (248 tests).
- `npm run test:ai-knowledge` pass (76 tests).
- `npm run build` pass.
- `git diff --check` pass.

Mock/data changes:

- Production data modified: no.
- Production mock request created: no.
- Existing production mock request deleted or changed: no.

Not done / out of scope:

- No real AI voice runtime, ConversationRelay, WebSocket, OpenAI, SMS/email,
  billing/metering, provider mutation, migration, deploy, or manual production
  mock request.

---

## 2026-06-14 — AI Answering test caller reset tool + UI copy cleanup

Added a narrow, platform-admin-only reset path for the configured AI Answering
test caller so future tests can start from a clean patient request. This is not a
live AI rollout and does not enable or mutate Twilio, OpenAI, Stripe, A2P,
billing, trial, SMS recovery, Vercel env, or provider state.

Code/doc changes:

- Added `config/test-callers.config.ts` for the single allowed reset target:
  `Test Dental Clinic` (`f37f24a1-070f-436b-b803-956f55466093`,
  `fairstone-dental-smile`) and masked caller `***-***-9236`.
- Added `lib/db/test-caller-reset.ts`, which validates the exact clinic, caller,
  and `RESET_TEST_CALLER` confirmation before opening a DB transaction.
- Added `POST /api/admin/clinics/[clinicId]/ai-answering/reset-test-caller`,
  guarded by `requirePlatformAdminClinic`, using only the URL clinic id.
- Added a collapsed **Reset test caller** action in the platform-admin
  **AI Answering** tab. It shows only the masked caller, requires typed
  confirmation, returns deletion counts, and refreshes latest test requests.
- Cleaned customer-facing Workspace copy from "Activity & SMS audit trail" /
  "raw SMS" wording to **Message history**.
- Added a concise `AGENTS.md` rule: normal UI must use product/user language,
  with deep technical wording limited to explicitly labeled diagnostics,
  docs, runbooks, or code comments.

Safety scope:

- The reset deletes only exact clinic+caller rows from `ai_voice_sessions`,
  `messages`, `patient_conversations`, `call_events`, `opt_outs`, and
  `clinic_blocked_patient_numbers`.
- The reset intentionally does not delete or mutate `webhook_events`, `clinics`,
  `clinic_phone_numbers`, billing/Stripe state, Twilio/A2P/provider state, SMS
  recovery gates, trial state, or any other clinic/caller.

Production reset result:

- Pending at code-change time; perform only after validation and code push per
  the authorized task scope.

---

## 2026-06-14 — Safe platform-admin clinic deletion

Added a platform-admin-only **Delete clinic** action under
`/admin/clinics/[clinicId]` -> Admin tools -> Danger zone. The action is for
explicitly authorized app-database cleanup only; it is not a provider cleanup
tool and is not shown in the clinic list table.

Code/doc changes:

- Added `lib/db/admin/clinic-delete.ts` for preflight checks, explicit
  clinic-scoped table counts, blocker evaluation, and transaction-scoped app
  database deletion.
- Added `GET /api/admin/clinics/[clinicId]/delete-preflight` and
  `POST /api/admin/clinics/[clinicId]/delete`, both platform-admin guarded and
  URL-scoped.
- Added the Admin tools Danger zone UI with preflight summary, blockers,
  accessible confirmation dialog, exact `DELETE` confirmation, and redirect to
  `/admin/clinics` after success.
- Added unit/source tests in `tests/clinic-delete.test.ts` and wired them into
  `npm run test:sms-recovery`.
- Updated the operations runbook and platform-admin knowledge article with the
  delete behavior and safety boundaries.

Safety scope:

- The delete is blocked by unknown clinic/schema state, active SMS recovery,
  active assigned phone numbers, provider-linked phone-number state,
  Stripe/billing state, provider-linked number-purchase attempts, provider-linked
  SMS approval state, and unknown clinic-linked rows outside the explicit delete
  list.
- Successful delete removes app database rows only, deletes the `clinics` row
  last, and records an audit row with counts only.
- No Twilio, Stripe, Vercel, DNS, Supabase management API, SMS send path,
  provider release/cancel/refund flow, production data delete, or
  `webhook_events` deletion was performed during implementation.

---

## 2026-06-14 — Delete clinic modal scroll and grouped blockers fix

Fixed the platform-admin **Delete clinic** confirmation flow after initial
implementation.

Code/doc changes:

- Updated `DeleteClinicDialog` so the modal fits inside the viewport, scrolls
  long preflight content internally, and keeps the Cancel / Delete clinic action
  row reachable.
- Added the active-clinic safety blocker:
  `Clinic is active. Set clinic to inactive first.`
- Grouped blocker output by operator action: active clinic, SMS recovery on,
  phone attached, billing connected, SMS approval connected, unknown clinic data,
  and schema inspection issue.
- Updated `tests/clinic-delete.test.ts` for active-clinic blocking, grouped
  phone/billing blockers, distinct grouped blockers together, and modal scroll
  structure.
- Updated the operations runbook and platform-admin knowledge note.

Safety scope:

- No delete API response shape change.
- No migration.
- No production delete.
- No Twilio, Stripe, Vercel env, DNS, A2P, billing provider, SMS runtime, phone
  provider, or SMS send mutation.

---

## 2026-06-14 — Admin Clinics list shows real SMS readiness (not raw sms_status)

The `/admin/clinics` table previously had a column titled **Setup** that rendered
the raw `clinics.sms_status` enum (e.g. `waiting_for_approval`) — misleading,
snake_case, and not the same source of truth as real send readiness.

Code changes (commit `fix: show real SMS readiness in admin clinic list`):

- `lib/db/admin/types.ts` — added `AdminSmsReadinessStatus`
  (`verified | needs_review | no_phone | unknown`), added
  `smsReadinessStatus` / `smsReadinessReason` to `AdminClinicListItem` (kept the
  legacy `smsStatus` field for diagnostics), and added a pure, unit-tested
  `resolveAdminSmsReadiness()` mapper (fails closed).
- `lib/db/admin/clinics.ts` — `listAdminClinics()` now computes readiness per
  clinic from `evaluateTextingStatusForLaunch()` (DB-only; no Twilio/Stripe/
  provider calls, no mutation). No active phone → `no_phone`; ok → `verified`;
  blocked → `needs_review`; thrown → `unknown`. Sequential loop (DB client is
  `max: 1`, so queries serialize anyway).
- `app/admin/(console)/_components/AdminUI.tsx` — added server-safe
  `smsReadinessListLabel()` / `smsReadinessListTone()` (Verified/Needs review/
  No phone/Unknown; success/warning/neutral). No raw enums in the table.
- `app/admin/(console)/clinics/page.tsx` — column renamed `Setup` →
  `SMS readiness`; cell now uses the readiness helpers. The separate
  **SMS recovery** On/Off gate column is unchanged.
- Tests: `tests/admin-clinics-sms-readiness.test.ts` (mapping + UI/column
  guards), wired into `tsconfig.unit-tests.json` and `npm run test:sms-recovery`.

Read-only production check (no data modified): clinic `Test Dental Clinic`
(`f37f24a1…`) has one active number, toll-free `+1•••4944`
(`removal_status=active`, `texting_status=active`). Its number readiness snapshot
is `messaging_service_sender_status=covered`, `production_safe=true`, but
`last_synced_at` was ~33h old (> 24h `SMS_READINESS_MAX_AGE_MS`), so
`evaluateTextingStatusForLaunch()` fails closed with
`number_sms_readiness_stale`. Truthful list status today: **Needs review** (not
Verified). A fresh readiness sync (within 24h) flips it to **Verified**
automatically — not hardcoded, and never resolved by editing `clinics.sms_status`.
The second production clinic has no active number → **No phone**.

Safety scope:

- No migration. No production data modified (read-only SELECTs only).
- No Twilio / Stripe / provider calls, no SMS sent, no `SMS_RECOVERY_MODE` /
  send-gate / billing changes, no `clinics.sms_status` writes.
- Validation: `npm run typecheck`, `npm run test:sms-recovery`,
  `npm run test:ai-knowledge`, `npm run build`, `git diff --check`.

---

## 2026-06-14 — AI Answering runtime skeleton (off by default; no live AI)

Added the provider-agnostic AI Answering **runtime skeleton** so a future real
AI answered-call runtime has a foundation. It is **disabled by default** and
changes **nothing** in production: no live AI answering, no Twilio
ConversationRelay, no WebSocket route, no OpenAI call, no streaming audio, no
transcript/raw-payload/prompt storage. The existing SMS Recovery voice flow
(`twilio/voice/incoming` + `twilio/voice/status`) is unchanged.

Code changes (commit `feat: add disabled AI answering runtime skeleton`):

- `lib/ai-answering/runtime-config.ts` — server-only lazy mode reader.
  `AI_ANSWERING_RUNTIME_MODE` ∈ { `disabled`, `test_only` }, **default
  `disabled`**; optional `AI_ANSWERING_TEST_CLINIC_IDS` /
  `AI_ANSWERING_TEST_CALLER_NUMBERS` allowlists. No `live` mode, no new env
  required for build, never throws/logs secrets.
- `lib/ai-answering/runtime-gate.ts` — pure `evaluateAiAnsweringRuntimeGate()`.
  Fails closed: `disabled` always blocks; `test_only` needs BOTH clinic id and
  caller allowlisted; blocks missing/inactive clinic, invalid caller phone, and
  scheduled/removed numbers. No DB, no provider, no SMS decision. **Not wired
  into the live webhook.**
- `lib/db/ai-voice-runtime-sessions.ts` — `start`/`complete`/`fail` lifecycle on
  the existing `ai_voice_sessions` table (`source = 'future_twilio'`). Reuses the
  mock route's `trimToLimit` sanitizer (now exported from `ai-voice-sessions.ts`)
  so captured-field validation cannot drift. Captured sessions link + touch the
  Workspace conversation; incomplete/failed do not create one. **No migration.**
- `lib/ai-answering/front-desk-context.ts` — approved-facts context builder from
  `getClinicAiFacts`. Includes only selected+approved facts (excludes
  `needs_review` suggestions), omits unknowns (never invents), carries the fixed
  safety + fallback policy. No OpenAI, no patient data, no prompt storage.
- `MVP_BUILD_DOCS/AI-ANSWERING-RUNTIME.md` (new) — skeleton overview + provider
  guardrail (read current Twilio/OpenAI docs before any provider-specific code).
- Tests: `tests/ai-answering-runtime.test.ts`, wired into
  `tsconfig.unit-tests.json` + `npm run test:sms-recovery`.

Safety scope:

- No migration. No production data written. No Twilio / Stripe / DNS / Vercel /
  OpenAI env or provider mutation. No SMS sent, no SMS-recovery gate change, no
  billing/metering change, no customer enable toggle.
- Existing voice webhook behavior unchanged (no route edits).
- Validation: `npm run typecheck`, `npm run test:sms-recovery` (294 pass),
  `npm run test:ai-knowledge` (76 pass), `npm run build`, `git diff --check`.
