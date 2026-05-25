# Backend Foundation v1

First buildable Next.js / Vercel foundation for the Missed Calls Dental SaaS.
This milestone establishes structure, webhook scaffolding, env handling,
database access, and idempotent event ingress. It does **not** send SMS,
create cloud resources, apply migrations, or deploy.

The existing `docs/` GitHub Pages marketing site is unchanged.

## What was added

### Root Next.js project

| File              | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `package.json`    | Next.js 15 + React 19 + TypeScript 5.7. Scripts below.        |
| `tsconfig.json`   | Strict TS, App Router, `@/*` path alias. Excludes `docs/`.    |
| `next.config.mjs` | Strict mode on. `poweredByHeader` off.                        |
| `next-env.d.ts`   | Standard Next.js type ambient declarations.                   |

Scripts:

- `npm run dev` — local dev server on `http://localhost:3000`
- `npm run build` — production build (does not require runtime secrets)
- `npm run start` — production server on `http://localhost:3000`
- `npm run typecheck` — `tsc --noEmit`

The existing static marketing site continues to run independently at
`http://localhost:8080`.

### App Router pages

| Path                           | Purpose                                          |
| ------------------------------ | ------------------------------------------------ |
| `app/layout.tsx`               | Minimal root layout. `noindex, nofollow`.        |
| `app/page.tsx`                 | Plain placeholder for the future clinic app.     |
| `app/README.md`                | Preserved from the prior repo state.             |

### API routes

| Method | Path                                                          | Purpose                                                                                  |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/health`                                                 | Public liveness probe. Static safe JSON.                                                 |
| GET    | `/api/internal/health`                                        | Protected. Requires `x-internal-admin-secret`. Reports env presence + DB `SELECT 1`.     |
| POST   | `/api/webhooks/twilio/voice/incoming`                         | Twilio voice webhook. Validates signature, records `webhook_event`, returns empty TwiML. |
| POST   | `/api/webhooks/twilio/messaging/incoming`                     | Twilio inbound SMS. Validates signature, detects STOP/START/HELP, records event.         |
| POST   | `/api/webhooks/twilio/messaging/status`                       | Twilio message status callback. Validates signature, records status transition.          |
| POST   | `/api/webhooks/stripe`                                        | Stripe webhook placeholder. Validates signature, records event. No billing logic yet.    |

All routes use Node.js runtime (`export const runtime = "nodejs"`) and
`dynamic = "force-dynamic"` to avoid static rendering of dynamic state.

### Library modules

| File                          | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `lib/env.ts`                  | Lazy zod env validators (per feature) + presence reporter.     |
| `lib/logging/logger.ts`       | JSON-line logger with naive secret-name redaction.             |
| `lib/http/responses.ts`       | `jsonOk` / `jsonError` / `twimlResponse` helpers.              |
| `lib/db/client.ts`            | Lazy `postgres.js` client over `SUPABASE_DB_URL`.              |
| `lib/db/health.ts`            | Safe `SELECT 1` roundtrip check.                               |
| `lib/db/webhook-events.ts`    | Idempotent insert into `webhook_events`.                       |
| `lib/twilio/signature.ts`     | `validateRequest` wrapper. Never throws.                       |
| `lib/twilio/request.ts`       | Form payload parser + signed URL reconstruction.               |
| `lib/twilio/keywords.ts`      | STOP / START / HELP detector (case + punctuation tolerant).    |
| `lib/stripe/webhook.ts`       | `constructEvent` wrapper. Never throws.                        |

### Database migration (NOT applied)

`supabase/migrations/20260525000100_backend_foundation.sql` creates:

- `clinics`
- `clinic_phone_numbers`
- `webhook_events` — unique on `(provider, external_id)`
- `call_events` — unique on `twilio_call_sid`
- `patient_conversations` — unique on `(clinic_id, patient_phone)`
- `messages` — unique on `twilio_message_sid`
- `opt_outs` — unique on `(clinic_id, phone_number)`
- `set_updated_at()` trigger function + per-table triggers
- `pgcrypto` extension (for `gen_random_uuid()`)
- RLS enabled on every multi-tenant table

**RLS policies are intentionally not defined in this migration.** Until policies
land, only the service role (via `SUPABASE_DB_URL`) can access these tables —
which is also the only access path the foundation uses. Policies will be
added in the messaging milestone when we also wire app auth roles.

### Environment example

Added one new placeholder to `.env.local.example`:

- `PUBLIC_WEBHOOK_BASE_URL` — optional. Used so Twilio signature verification
  reconstructs the exact URL Twilio called even when behind a proxy. Leave
  blank in local dev. Set to `https://app.missedcallsdental.com` (or the
  eventual production host) in deployed environments.

No values were copied from `.env.local`. The file `.env.local` was not
modified.

## Required environment variables

The handlers require these names. Real values live in `.env.local` (untracked).
Names only:

- `SUPABASE_DB_URL` — Postgres connection string. Needed for any DB work.
- `SUPABASE_SERVICE_ROLE_KEY` — Reserved for future Supabase JS use.
- `TWILIO_ACCOUNT_SID` — Identification only.
- `TWILIO_AUTH_TOKEN` — Used by `verifyTwilioSignature`.
- `TWILIO_PHONE_NUMBER` — Default recovery number (future).
- `TWILIO_PHONE_NUMBER_SID` — Optional. Future provisioning.
- `TWILIO_MESSAGING_SERVICE_SID` — Future outbound sender.
- `STRIPE_SECRET_KEY` — Future billing.
- `STRIPE_WEBHOOK_SECRET` — Used by `verifyStripeWebhook`.
- `STRIPE_ACCOUNT_ID` — Optional. Used by Connect (not in MVP).
- `JOB_RUNNER_SECRET` — Reserved for future cron-triggered jobs.
- `INTERNAL_ADMIN_SECRET` — Required by `/api/internal/health`.
- `PUBLIC_WEBHOOK_BASE_URL` — Optional. See above.

`npm run build` does **not** require any of these values to be set. The
zod schemas in `lib/env.ts` run only when a route handler executes.

## Future webhook URLs (NOT yet configured)

Do not set these in the Twilio or Stripe consoles until the backend is
deployed and explicitly approved by the owner.

- Twilio voice incoming: `https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming`
- Twilio SMS incoming:   `https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming`
- Twilio SMS status:     `https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status`
- Stripe:                `https://app.missedcallsdental.com/api/webhooks/stripe`

## How idempotency works

- Twilio voice: row keyed by `voice:<CallSid>` in `webhook_events`. Replays
  return `duplicate: true` and are not double-processed downstream.
- Twilio SMS inbound: row keyed by `sms:<MessageSid>`.
- Twilio SMS status: row keyed by `sms_status:<MessageSid>:<status>` so each
  distinct transition is captured exactly once.
- Stripe: row keyed by `event.id` (`evt_...`).

In every case the unique index `webhook_events (provider, external_id)`
guarantees a single canonical row, and `ON CONFLICT DO NOTHING` makes the
insert safe under concurrent retries.

## What was intentionally NOT done

- No deploy.
- No Vercel project created.
- No Twilio Console webhook URLs changed.
- No Twilio numbers purchased.
- No SMS sent.
- No Stripe products / prices / customers / subscriptions / endpoints created.
- No Supabase migration applied. SQL exists in the repo only.
- No GitHub Pages settings changed.
- `docs/` was not modified.
- `.env.local` was not modified or read for values.
- No git commit, no git push, no staged unrelated files.

## Suggested next steps (separate, future milestones)

1. **Owner approval to apply the migration** to the Supabase project
   (`qfjpvbvfvhbtebwivcdc`) in a staging-equivalent context.
2. **Create the Vercel project** under team `vladchat-1500s-projects` and link
   to this repository (root directory = repo root). Configure env vars in
   Vercel Project Settings only.
3. **Wire the messaging milestone**: clinic + phone number lookup, opt-out
   enforcement on outbound, RLS policies, outbound SMS via the Twilio
   Messaging Service.
4. **Wire the billing milestone**: Stripe Checkout + subscription, customer ↔
   clinic mapping, gated SMS sending.
