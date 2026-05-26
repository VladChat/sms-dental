# Setup Log — Missed Calls Dental

Status: Active  
Purpose: Chronological record of infrastructure and backend setup  
Last updated: 2026-05-25

This log records what was done, in order, without storing secrets.

---

## Maintenance Rule

Update this file after every durable backend, infrastructure, deployment, DNS, Supabase, Vercel, Twilio, Stripe, or production-like change.

Each new entry should include:

- date
- what changed
- why it mattered
- result
- commit hash or deployment ID if relevant
- verification result
- what was intentionally not done

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

Actions completed:

- Installed Vercel Plugin for Claude Code.
- Installed official Vercel MCP.
- Authorized Vercel MCP.
- Verified visible Vercel team:
  - Team name: `vladchat-1500's projects`
  - Team slug: `vladchat-1500s-projects`
  - Team ID: `team_1F2PWbZbJldYTbtZ8HlEVMCm`
- Verified no existing Vercel project for `sms-dental` before backend deployment work.

Result:

- Vercel MCP connected.
- No files changed.
- No Vercel project created at this stage.

---

## 2026-05-25 — Repository preparation before backend

Actions completed:

- Added `.local-agent/` to `.gitignore`.
- Updated `.env.local.example` to match local env variable names without secret values.
- Created `MVP_BUILD_DOCS/backend-foundation-handoff.md`.
- Confirmed `docs/` was untouched.
- Confirmed `.env.local` and `.local-agent/` were not committed.

Commit:

```txt
36b5aab chore: prepare backend foundation handoff
```

Pushed to `origin/main`.

---

## 2026-05-25 — Master project context added

Actions completed:

- Created `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`.
- Updated `AGENTS.md` to read project context first.
- Updated `MVP_BUILD_DOCS/MANIFEST.md`.

Commit:

```txt
464dcf6 docs: add master project context
```

Notes:

- Initial Markdown formatting was later corrected.

---

## 2026-05-25 — MVP build docs refreshed

Actions completed:

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

Actions completed by Claude:

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

Pre-check completed:

- Database connection: pass.
- Database user: `postgres`.
- Can create in public schema: yes.
- Can create in database: yes.
- Foundation tables absent before migration.
- Safe to apply migration: yes.

Migration applied:

```txt
supabase/migrations/20260525000100_backend_foundation.sql
```

Result:

- Migration applied: yes.
- Tables verified: yes.
- RLS enabled: yes.
- DB health check: pass.
- Typecheck: pass.
- Build: pass.
- Files modified: no.
- Secrets printed: no.

Tables created:

- `clinics`
- `clinic_phone_numbers`
- `webhook_events`
- `call_events`
- `patient_conversations`
- `messages`
- `opt_outs`

---

## 2026-05-25 — Vercel project created and first deployment tested

Actions completed:

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

Root cause found:

- Direct Supabase DB connection was not suitable for Vercel serverless runtime.
- Runtime needed Supabase transaction pooler on port `6543`.

Actions completed:

- Added `SUPABASE_DB_DIRECT_URL` locally to preserve the old direct/admin DB connection.
- Updated `SUPABASE_DB_URL` locally to transaction pooler URL.
- Confirmed pooler URL format:
  - host contains `pooler.supabase.com`
  - port `6543`
- Fixed `.env.local` UTF-8 BOM issue that prevented Node env parsing.
- Updated DB client to use `prepare: false` for Supabase transaction pooler.

Commit:

```txt
aa4eeb9 fix: support Supabase transaction pooler
```

Validation:

- Local pooler DB connection: pass.
- Foundation tables visible: yes.
- Typecheck: pass.
- Build: pass.
- Secrets printed: no.

---

## 2026-05-25 — Vercel env updated and deployed DB health verified

Actions completed:

- Updated Vercel `SUPABASE_DB_URL` to working transaction pooler URL.
- Redeployed Vercel project.
- Verified `https://sms-dental.vercel.app/api/health`.
- Verified internal health with `x-internal-admin-secret`.

Result:

- `/api/health`: pass.
- `/api/internal/health`: pass.
- Deployed `db.ok`: true.
- DB latency observed: about 617ms.
- Secrets printed: no.

---

## 2026-05-25 — Custom app domain added

Actions completed:

- Added custom Vercel domain: `app.missedcallsdental.com`.
- Vercel provided DNS record:
  - Type: `A`
  - Host: `app`
  - Value: `76.76.21.21`
  - TTL: Automatic or 300
- Added DNS record at Namecheap.
- Domain verified.
- SSL certificate issued.
- Updated Vercel `PUBLIC_WEBHOOK_BASE_URL` to `https://app.missedcallsdental.com`.
- Redeployed.

Known redeploy ID:

```txt
dpl_89HfxNTrc4KtgzTJJM1Pyk2W8kp2
```

Validation:

- `https://app.missedcallsdental.com/api/health`: pass.
- `https://app.missedcallsdental.com/api/internal/health`: pass.
- `db.ok`: true.
- Secrets printed: no.
- Twilio changed: no.
- SMS sent: no.

---

## 2026-05-25 — Twilio webhook plan prepared

Actions completed:

- Confirmed Twilio env variable names exist locally.
- Confirmed live webhook endpoints exist.
- Confirmed unsigned POST returns `403`, which is expected and correct.
- Prepared Twilio Console/API configuration plan.

Live webhook URLs:

- Voice: `https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming`
- Inbound SMS: `https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming`
- SMS status: `https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status`

Current status:

- Twilio has not been changed yet.
- SMS has not been sent yet.
- Next step is to configure Twilio webhooks through API after owner approval.

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

Current next action:

```txt
Configure Twilio webhooks by API, then run one inbound SMS test and one inbound call test.
```

Do not enable outbound SMS yet.
