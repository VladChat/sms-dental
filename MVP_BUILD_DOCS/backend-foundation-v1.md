# Backend Foundation v1

First buildable Next.js / Vercel foundation for the Missed Calls Dental SaaS.
This milestone establishes structure, webhook scaffolding, env handling, database access, and idempotent event ingress.

The existing `docs/` GitHub Pages marketing site is unchanged.

---

## Current deployed status

Backend Foundation v1 is now deployed and verified at:

```txt
https://app.missedcallsdental.com
```

Verified:

- `/api/health` passes.
- `/api/internal/health` passes with `db.ok: true`.
- Supabase foundation migration has been applied.
- Twilio account: Active / Full (upgraded from Trial on 2026-05-26).
- Twilio webhooks have been configured through Twilio API.
- Inbound SMS webhook: verified and recorded in `webhook_events`.
- Inbound voice webhook: verified end-to-end (2026-05-26). Returns polite `<Say>` + `<Hangup/>` TwiML. Callers hear an acknowledgement and the call ends cleanly.

---

## Product phone event strategy

The backend does not automatically know about calls to an unrelated clinic phone number.

For MVP, call events reach the backend through one of these modes:

1. Conditional forwarding mode
   - Clinic keeps its main number.
   - No-answer, busy, unavailable, or after-hours calls forward to the assigned Twilio recovery number.

2. Tracking number mode
   - Clinic uses the assigned Twilio number as a dedicated number on website, ads, landing pages, print, or campaigns.

3. Hybrid mode
   - Clinic uses forwarding for missed/no-answer main-number calls and tracking numbers for selected channels.

Future versions may add direct provider integrations.

---

## What was added

Root Next.js project:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next.config.mjs`
- `next-env.d.ts`

App Router files:

- `app/layout.tsx`
- `app/page.tsx`
- `app/README.md`

API routes:

- `GET /api/health`
- `GET /api/internal/health`
- `POST /api/webhooks/twilio/voice/incoming`
- `POST /api/webhooks/twilio/messaging/incoming`
- `POST /api/webhooks/twilio/messaging/status`
- `POST /api/webhooks/stripe`

Library modules:

- `lib/env.ts`
- `lib/logging/logger.ts`
- `lib/http/responses.ts`
- `lib/db/client.ts`
- `lib/db/health.ts`
- `lib/db/webhook-events.ts`
- `lib/twilio/signature.ts`
- `lib/twilio/request.ts`
- `lib/twilio/keywords.ts`
- `lib/stripe/webhook.ts`

---

## Database migration

`supabase/migrations/20260525000100_backend_foundation.sql` creates:

- `clinics`
- `clinic_phone_numbers`
- `webhook_events`
- `call_events`
- `patient_conversations`
- `messages`
- `opt_outs`

The migration has been applied to the configured Supabase project.

RLS policies are intentionally not defined in this migration. Policies will be added in a future milestone when app auth roles are wired.

---

## Environment notes

`PUBLIC_WEBHOOK_BASE_URL` is used so Twilio signature verification reconstructs the exact URL Twilio called even when behind a proxy.

Current production value:

```txt
https://app.missedcallsdental.com
```

`SUPABASE_DB_URL` should use the Supabase transaction pooler for Vercel/serverless runtime.

`SUPABASE_DB_DIRECT_URL` preserves the direct DB URL for local/admin/migration work.

Never print full DB URLs because they contain passwords.

---

## Required environment variables

Names only:

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
- `PUBLIC_WEBHOOK_BASE_URL`

---

## Live webhook URLs

Twilio voice incoming:

```txt
https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming
```

Twilio SMS incoming:

```txt
https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming
```

Twilio SMS/status callback:

```txt
https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status
```

Stripe placeholder:

```txt
https://app.missedcallsdental.com/api/webhooks/stripe
```

Twilio IncomingPhoneNumber and Messaging Service webhook fields have been configured through the Twilio API.

Inbound SMS has been verified.

Inbound voice is verified. The handler returns polite TwiML and records the event in `webhook_events`.

---

## How idempotency works

- Twilio voice: row keyed by `voice:<CallSid>` in `webhook_events`.
- Twilio SMS inbound: row keyed by `sms:<MessageSid>`.
- Twilio SMS status: row keyed by `sms_status:<MessageSid>:<status>`.
- Stripe: row keyed by `event.id`.

In every case the unique index `webhook_events (provider, external_id)` guarantees a single canonical row, and `ON CONFLICT DO NOTHING` makes the insert safe under concurrent retries.

---

## What was intentionally NOT done in Backend Foundation v1

- No outbound SMS sending.
- No Stripe products / prices / customers / subscriptions created.
- No full clinic onboarding flow.
- No dashboard.
- No AI receptionist.
- No PMS integration.
- No phone provider integrations.
- `docs/` was not modified.
- `.env.local` was not committed.

---

## Suggested next steps

1. Test a real MVP phone path: conditional forwarding from a clinic-like phone system or direct tracking number call.
2. Define clinic connection mode for first real test customer: conditional forwarding, tracking number, or hybrid.
3. Create clinic/phone mapping milestone.
4. Wire messaging milestone: opt-out enforcement, duplicate suppression, safe outbound SMS helper, controlled test to owner-owned phone only.
5. Wire billing milestone later.
