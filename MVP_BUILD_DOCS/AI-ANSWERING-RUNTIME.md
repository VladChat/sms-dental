# AI Answering Runtime Skeleton — Missed Calls Dental

Status: Active (skeleton only — **disabled by default, does not answer live calls**)
Last updated: 2026-06-14

This document describes the **provider-agnostic AI Answering runtime skeleton**.
It is the foundation layer that a future real AI answered-call runtime would build
on. It is intentionally **off by default** and changes **nothing** about the
current production voice flow.

> **What this is NOT (this task):** no live AI answering, no Twilio
> ConversationRelay connection, no WebSocket runtime, no OpenAI/Realtime call, no
> streaming audio, no transcript/audio storage, no raw AI prompt/response storage,
> no provider request/response storage. The existing **SMS Recovery** voice flow
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
