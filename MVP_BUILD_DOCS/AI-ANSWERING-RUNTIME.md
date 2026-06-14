# AI Answering Runtime — Missed Calls Dental

Status: Active (provider-agnostic skeleton **+ a real test-live ConversationRelay
path**; still **disabled by default** in production)
Last updated: 2026-06-14

This document describes the **provider-agnostic AI Answering runtime skeleton**
(Sections 1–3) and the **first real test-live path** built on top of it using
**Twilio ConversationRelay + the OpenAI Responses API** (Section 5). The skeleton
is intentionally **off by default**. The test-live path only ever runs for the
single allowlisted test clinic + caller in `test_only` mode with relay config
present; in the production default (all AI env unset → `disabled`) it changes
**nothing** about the current voice flow.

> **What the skeleton (Sections 1–3) is NOT:** no live AI answering, no Twilio
> ConversationRelay connection, no WebSocket runtime, no OpenAI call. Section 5
> adds those, but **only** behind the `test_only` gate + allowlist + relay config.
> In every mode we still store **only** the narrow captured request — never
> transcripts, audio, raw provider payloads, prompts, or raw OpenAI responses —
> and the AI path never sends SMS. When the gate does not match (the production
> default), the existing **SMS Recovery** voice flow
> (`app/api/webhooks/twilio/voice/incoming` + `.../voice/status`) is unchanged.

---

## 1. What the skeleton implements

### Runtime mode (off by default)
`lib/ai-answering/runtime-config.ts` — **server-only**, lazy, never throws, never
logs secrets, never exposed to the client.

- Env: `AI_ANSWERING_RUNTIME_MODE` ∈ { `disabled`, `test_only` }. **Default
  `disabled`** when unset/empty/invalid. There is intentionally **no `live`
  mode** and no clinic-owner enable toggle in this task.
- Optional allowlists (only consulted in `test_only`):
  `AI_ANSWERING_TEST_CLINIC_IDS` (comma-separated clinic UUIDs),
  `AI_ANSWERING_TEST_CALLER_NUMBERS` (comma-separated E.164 numbers).
- No new env var is required for `next build`.

### Runtime gate (pure decision)
`lib/ai-answering/runtime-gate.ts` — `evaluateAiAnsweringRuntimeGate(input)`
returns `{ ok, reason, mode, meta }`. **Pure**: no DB, no provider, no SMS
decision. Fails closed:

- `disabled` → always blocks (`ai_answering_disabled`).
- `test_only` → blocks unless **both** the clinic id and caller number are
  allowlisted (`clinic_not_allowlisted` / `caller_not_allowlisted`).
- Blocks a missing clinic, an explicitly inactive clinic, an invalid/missing
  caller phone, and a number that is `scheduled`/`removed` (not routable).
- Only an exact `test_only` match returns `ok: true` (`allowed_test_only`).

The gate is **not wired into the live Twilio webhook** in this task. Importing it
in `disabled` mode would always block, so it cannot change current routing.

### Session lifecycle (provider-agnostic)
`lib/db/ai-voice-runtime-sessions.ts` — writes the existing `ai_voice_sessions`
table using the reserved `source = 'future_twilio'`. No migration was needed.

- `startAiVoiceRuntimeSession` — idempotently creates an `incomplete`
  `future_twilio` session keyed on the unique
  `(clinic_id, source, external_session_id)` index. No Workspace conversation is
  created yet (nothing captured).
- `completeAiVoiceRuntimeSession` — sanitizes captured fields (same length limits
  + label-like placeholder cleanup as the mock route, shared via `trimToLimit`),
  derives the summary headline with `buildAiVoiceCallSummary`, and on `captured`
  status gets/links the (clinic, patient) conversation, sets a safe display name
  only when empty, and touches the conversation so it appears in Workspace.
  `incomplete`/`failed` only record the outcome — **no new Workspace request**.
- `failAiVoiceRuntimeSession` — marks failed/completed; no Workspace request, no
  raw error payload stored.

The platform-admin `createMockAiVoiceSession()` is unchanged and keeps working.

### Approved-facts context builder
`lib/ai-answering/front-desk-context.ts` — **server-only**, provider-free. Builds
a typed `AiFrontDeskRuntimeContext` from `getClinicAiFacts(clinicId)`.

- Includes only facts the clinic **selected and saved** (approved). Unsaved
  website-scan suggestions (`needs_review` / `suggested`) are excluded.
- Unknown values are **omitted**, never invented; the fixed fallback policy is
  "send to office".
- Carries the fixed safety policy (no diagnosis, no treatment advice, no
  medication instructions, no clinical triage; unknown questions → office; urgent
  dental concerns flagged to the front desk; the 911 line reserved for a possible
  medical emergency).
- `toRuntimeInstructionText()` is a deterministic text helper for tests/future
  grounding only — it is **not stored in the database** and **not sent to any
  provider** here.

---

## 2. Off-by-default behavior

- Production `AI_ANSWERING_RUNTIME_MODE` is unset → `disabled`.
- No AI answering branch runs in any webhook. No ConversationRelay TwiML is
  emitted. No WebSocket route is exposed.
- All read paths remain degradation-safe: with the foundation migration applied
  or not, `/workspace` and `/account` behave exactly as before.

---

## 3. Tests

`tests/ai-answering-runtime.test.ts` (wired into `npm run test:sms-recovery`):
runtime config defaults/parsing, gate decisions (disabled/allowlist/inactive/
invalid phone/scheduled number), pure session sanitization + phone validation,
source guards proving the session helper is idempotent/provider-free/SMS-free and
that only the captured path creates+touches a conversation, and front-desk context
inclusion/exclusion + fixed safety policy. Existing `tests/ai-answering.test.ts`
and the Workspace/SMS-recovery suites still pass.

---

## 4. Provider guardrail — read before implementing the real runtime

Provider voice/AI contracts change. Before writing any provider-specific
TwiML / WebSocket / API code (Twilio ConversationRelay, OpenAI Realtime, etc.):

1. **Read the current official Twilio and OpenAI docs** for the exact event,
   XML, and API contracts. Do not rely on memorized shapes.
2. If the docs cannot be verified, **do not guess** provider XML/event contracts.
3. Keep the same safety invariants: fail closed via the runtime gate, store only
   the narrow captured request (never transcripts/audio/raw payloads/prompts),
   and never change the SMS recovery send gates or send SMS from the AI path.

### Next step after this task (future, gated, owner-approved only)
- Add a real (still-disabled) provider adapter behind the gate that converts a
  captured session into `start`/`complete`/`fail` calls — no live answering until
  explicitly approved and `test_only` is exercised against the single test
  clinic/caller.
- Only then consider a `live` mode, minute metering, billing, and a customer
  enable flow (all out of scope here).

---

## 5. Test-live ConversationRelay path (Twilio ConversationRelay + OpenAI)

This is the first path that can answer a real call — but **only** for the single
allowlisted test clinic + caller, in `test_only` mode, with relay config present.

### Provider choice (fixed)
- **Twilio ConversationRelay** owns the phone / speech-to-text / text-to-speech /
  session / WebSocket transport. We do **not** use Twilio Media Streams.
- **OpenAI Responses API** is the text brain. We do **not** use OpenAI Realtime.
- Our system only provides conversation logic and saves the captured request.

### Flow
```
Inbound call → Twilio voice webhook (Next app, app/api/webhooks/twilio/voice/incoming)
  → AI Answering runtime gate (test_only + clinic & caller allowlist)
  → ConversationRelay TwiML (lib/ai-answering/conversation-relay-twiml.ts)
  → wss://<relay-host>/twilio/conversation-relay   (services/ai-voice-relay)
  → OpenAI Responses API (text reply + captured fields)
  → ai_voice_sessions (source = future_twilio) via the shared lifecycle
  → Workspace shows "Source: AI answered call"
```

### Critical infrastructure rule
The ConversationRelay WebSocket is a **standalone Node service**
(`services/ai-voice-relay/`), deployed **separately** from the Next/Vercel app —
**never** run a long-lived WebSocket inside a Vercel route handler. The Next app
remains the normal web app + Twilio webhook app and just decides, per call,
whether to return the existing greeting or ConversationRelay TwiML.

### Next app responsibilities
- `lib/ai-answering/conversation-relay-twiml.ts` builds the
  `<Connect><ConversationRelay>` TwiML: wss URL from config, short clinic-branded
  `welcomeGreeting`, XML-escaped values, and call context passed as `<Parameter>`
  values authenticated by a short-lived HMAC token
  (`lib/ai-answering/relay-token.ts`, signed with `AI_ANSWERING_RELAY_SIGNING_SECRET`).
  The signing secret is never placed in the TwiML.
- `lib/ai-answering/incoming-plan.ts` (`decideAiAnsweringIncoming`) is the pure
  routing decision (gate + relay-config presence). The incoming webhook starts a
  `future_twilio` session keyed on the call sid and returns ConversationRelay
  TwiML only on an exact allowlisted match with relay config; otherwise it
  **fails closed** to the existing missed-call greeting.
- `app/api/webhooks/twilio/voice/status` skips missed-call SMS recovery when an
  AI voice session exists for the call (`hasAiVoiceRuntimeSessionForCall`,
  reason `ai_answering_session_present`). Normal missed calls are unaffected.
- The incoming route sends **no SMS**, makes **no OpenAI call**, and makes **no
  Twilio API call**.

### Relay service responsibilities (`services/ai-voice-relay/`)
- `GET /health` → `{ ok: true }` (or 503 + a safe config-error reason).
- `WS /twilio/conversation-relay` validates the signed token + that the custom
  parameters match it, re-applies the runtime gate, and (best-effort) validates
  `X-Twilio-Signature`. On `setup` it starts/confirms the session; on a final
  `prompt` it runs the OpenAI brain; on completion it completes the session and
  sends a fixed final line + ConversationRelay `end`.
- The OpenAI brain returns strict JSON validated with zod
  (`reply`, captured name/reason/preferred time, `readyToComplete`, `safetySignal`,
  `handoffNote`). Invalid output → safe fallback reply, never completes from
  unvalidated data. Grounded only on the clinic's approved facts
  (`lib/ai-answering/front-desk-context.ts`); never diagnoses, gives treatment or
  medication advice, or triages; reserves “If this is a medical emergency, call
  911.” for a possible emergency.
- Stores **only** the narrow captured request — never transcripts, audio, raw
  Twilio messages, prompts, or OpenAI responses. Logs only safe metadata
  (call sid tail, clinic id, reason codes).

### Environment

Next app:
- `AI_ANSWERING_RUNTIME_MODE=test_only`
- `AI_ANSWERING_TEST_CLINIC_IDS=<allowlisted clinic uuid>`
- `AI_ANSWERING_TEST_CALLER_NUMBERS=<allowlisted E.164 caller>`
- `AI_ANSWERING_RELAY_WS_URL=wss://<relay-host>/twilio/conversation-relay`
- `AI_ANSWERING_RELAY_SIGNING_SECRET=<secret>`

Relay service (`services/ai-voice-relay/`):
- `PORT`
- `SUPABASE_DB_URL`
- `OPENAI_API_KEY`
- `AI_ANSWERING_OPENAI_MODEL`
- `AI_ANSWERING_RUNTIME_MODE=test_only`
- `AI_ANSWERING_TEST_CLINIC_IDS=<same allowlist>`
- `AI_ANSWERING_TEST_CALLER_NUMBERS=<same allowlist>`
- `AI_ANSWERING_RELAY_SIGNING_SECRET=<same secret as the Next app>`
- `TWILIO_AUTH_TOKEN` (only if validating `X-Twilio-Signature`)

Both default safely: unset Next env → `disabled` (existing greeting only); a
missing/invalid relay config → fail closed to the existing greeting.

### Provider onboarding caveat
- The existing Twilio phone number webhook stays the **same** incoming voice
  webhook. The app decides at runtime which TwiML to return.
- **ConversationRelay requires Twilio onboarding / the AI addendum** before real
  calls work. If onboarding is not complete, Twilio may reject the TwiML or the
  call may fall back. For the first real test, use only the allowlisted clinic and
  caller.

### Tests
- Next app: `tests/ai-answering-conversation-relay.test.ts` (TwiML builder +
  signed token + escaping + no-secret-leak; `decideAiAnsweringIncoming` wiring;
  relay env helper; voice-route source guards). Wired into
  `npm run test:sms-recovery`.
- Relay service: `npm run ai-relay:test` (setup/token validation, prompt
  handling, OpenAI brain JSON/fallback + safety, session lifecycle). OpenAI and
  the WebSocket are mocked; no live Twilio/OpenAI is required.
