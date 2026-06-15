---
title: AI Answering — foundation and admin overview
slug: ai-answering-foundation
status: internal
visibility: platform_admin
audience: Platform admin / operator
surface: /admin
category: admin-console
owner: platform
source_of_truth:
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - MVP_BUILD_DOCS/AI-ANSWERING-RUNTIME.md
  - config/ai-answering.config.ts
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
last_verified: 2026-06-27
related:
  - clinic-console
  - billing-operations
  - diagnostics-and-audit
  - support-boundaries
---

# AI Answering — foundation and admin overview

Internal platform-admin reference. AI Answering (historically the **AI Call
Assistant**) is a **planned MVP channel that is NOT broadly live.** What exists
today is a **non-live foundation** plus a **gated, test-only** runtime path.
Never describe AI Answering to a clinic as live, automatically enabled, or
guaranteed to launch on a date.

## Status — what is real today

| Layer | State |
|---|---|
| Data model + Workspace representation | **Built.** App database only. Lets the system *represent* an AI answered call as a patient request. |
| Platform-admin AI Answering tab (mock sessions) | **Built.** Operator-only foundation/testing. |
| Runtime skeleton | **Deployed but disabled.** No webhook AI branch runs in the default (production) configuration. |
| Test-live ConversationRelay path + relay service | **Exists, gated to `test_only`** for one allowlisted clinic + caller. Not for general clinics. |
| Broad live AI Answering for real callers | **Not built.** |
| AI minute metering / overage billing | **Not running.** Included-minutes number is defined in `config/billing.config.ts`; nothing meters or charges yet. |

The SMS Recovery voice + SMS flows are unchanged by all of the above.

## App database state vs provider/runtime state (keep separate)

- **App database (this product):** `clinic_ai_answering_settings` (future
  settings, e.g. selected voice preference — there is no "enable AI" switch) and
  `ai_voice_sessions` (a narrow captured request: name / callback / reason /
  preferred time, status, optional safety flag and short handoff note). Both are
  clinic-scoped, RLS on, **no public policies** (service-role/server access
  only), and store **no** transcript, audio, raw AI prompts/responses, raw
  provider payloads, secrets, payment data, or diagnosis/treatment text.
- **Provider / runtime state (separate systems):** Twilio (voice / ConversationRelay),
  OpenAI (Responses API), and the standalone **relay service** that runs on a
  long-lived-WebSocket host (Railway), not in the Next/Vercel app. These are
  distinct from the app database. Do not assume the app DB reflects provider
  state, and do not read provider state into customer-facing copy.
- **No provider mutation in this layer.** No task may change Twilio, OpenAI,
  Railway, Stripe, DNS, or Vercel for AI Answering unless a later task is
  explicitly authorized to do so. Operate the relay service per
  `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`; do not guess provider XML/event/API
  contracts — confirm against `MVP_BUILD_DOCS/AI-ANSWERING-RUNTIME.md` and
  current official provider docs.

## Admin AI Answering tab — what the operator can do

- View captured AI answered call sessions for the clinic (operator labels:
  Captured / Incomplete / Failed; source Mock (test) / Future (Twilio)).
- Create a **mock session** for foundation/testing:
  `POST /api/admin/clinics/[clinicId]/ai-answering/mock-session`
  (`requirePlatformAdminClinic`, clinic id from the URL). It writes a real
  `patient_conversations` thread + `ai_voice_sessions` row and may set a safe
  `patient_display_name` when empty — so it is internal testing only.
- Reset the test caller for repeat foundation testing.

> **Do not run the mock route against production unless explicitly approved** — it
> writes real rows for the target clinic. Only a platform admin can call it;
> clinic owner / front desk receive 401/403.

## Runtime gating (fail closed)

- Mode is server-only `AI_ANSWERING_RUNTIME_MODE`; production default is
  `disabled`, which always blocks. The only other value is `test_only`, which
  still requires BOTH the clinic id and caller number on the allowlists. There is
  **no `live` mode and no customer enable toggle** in this layer.
- The pure runtime gate (`lib/ai-answering/runtime-gate.ts`) returns safe
  metadata only and blocks on any missing/invalid/non-allowlisted input. Leaving
  the AI env vars unset is the safe default and is what production uses.

## Billing and minutes

- The plan/trial includes a fixed number of **AI answered call minutes** defined
  in `config/billing.config.ts` (cited, never restated here). See
  [billing-operations.md](billing-operations.md) and
  `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`.
- Minutes are **not metered** and overage is **not billed** today. Do not quote
  AI prices that are not canonical in `config/billing.config.ts`.

## Customer-safe wording (when replying to a clinic)

Use: "AI answered call", "AI answered calls", "AI answered call time", "AI call
settings", "call summary", "patient request". Avoid provider/runtime terms
(ConversationRelay, WebSocket, STT/TTS, OpenAI, Twilio, SID, payload) in any
customer-facing reply. Tell clinics it is **planned / not active yet** and never
promise a launch date, instant enablement, or a price.

## Redaction (internal diagnostics)

Mask patient phone numbers (last 4 only), use provider/session id tails only if
needed, presence-only for sensitive fields, never paste raw payloads, transcripts,
audio, secrets, or real patient data.

## Verify safely (no production writes)

- `npm run typecheck`, `npm run test:sms-recovery` (includes the `ai-answering`
  suites), `npm run test:ai-knowledge`, `npm run build`.
- Guard check: `POST .../ai-answering/mock-session` returns 401 (no session) or
  403 (signed in, not platform admin).
- Relay service health (when applicable): `GET /health` should return
  `{ "ok": true }`; a 503 + safe reason means required config is missing.

## Source of truth

- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` ("Next MVP Direction — AI Answering";
  "Built foundation — AI Answering sessions + Workspace mock flow")
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` (AI Answering foundation / runtime
  skeleton / test-live relay sections)
- `MVP_BUILD_DOCS/AI-ANSWERING-RUNTIME.md` (runtime contract — read before
  building)
- `config/ai-answering.config.ts` (non-live vocabulary/limits)
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` + `config/billing.config.ts`
  (included minutes)
