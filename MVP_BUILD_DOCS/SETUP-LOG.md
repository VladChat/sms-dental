# Setup Log — Missed Calls Dental

Status: Active  
Purpose: Chronological record of infrastructure and backend setup  
Last updated: 2026-05-25

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
- Inbound voice webhook: verified end-to-end. Callers hear a polite acknowledgement and the call ends cleanly.

Current next action:

```txt
Test a real MVP phone path: conditional forwarding from a clinic-like phone system or direct tracking number call.
```

Do not enable outbound SMS until clinic mapping, opt-out enforcement, and explicit owner approval are complete.
