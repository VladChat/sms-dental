# Customer Help — AI Answered Calls

Status: draft (planned feature; not published; not broadly live)
Audience: Clinic owners · Visibility: `clinic_owner`
Last updated: 2026-06-27

Owner-facing help for **AI answered calls** (the planned AI Call Assistant
channel). This category is **draft/planned**: AI answered calls are being
prepared and are **not generally active** for clinics yet. Nothing here is
published, and nothing here should say the feature is live.

## Articles

| Article | Title | Visibility | Status | Notes |
|---|---|---|---|---|
| [how-ai-answered-calls-will-work.md](how-ai-answered-calls-will-work.md) | How AI answered calls will work | clinic_owner | draft | Planned/not broadly live; what it will do; call summary / patient request in the Workspace; not a full receptionist; no medical advice; billing cited, not restated |

## Owner-safe notes (apply to every article here)

- Use customer wording: **AI answered calls**, **AI answered call time**, **AI call
  settings**, **call summary**, **patient request**, **Workspace**.
- Keep the status honest: **planned / not active yet**. Never say AI answered
  calls are live or enabled for all clinics, and never promise a launch date.
- Explain it as a future way to **capture** a caller's request into a call
  summary / patient request — not a full AI receptionist, and never medical
  advice, diagnosis, treatment, appointment guarantees, payment collection, or a
  replacement for the clinic's phone system.
- **Cite billing, do not restate it.** Included AI answered call minutes come from
  the plan; link to the billing article and `config/billing.config.ts` instead of
  quoting minute counts or overage prices. AI minute metering and overage billing
  are not running yet.
- SMS approval is a separate requirement; AI answered calls do not remove it.
- **Do not expose** internal/technical terms in customer copy (allowed only in
  this rule): provider names, ConversationRelay, WebSocket, STT, TTS, OpenAI,
  Twilio, Railway, SIDs, payloads, webhooks, runtime flags, allowlists, mock
  sessions, or internal test tooling.

## Source of truth

- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — "Next MVP Direction — AI Answering"
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`, `config/billing.config.ts` —
  included minutes / minute alerts (cited, not restated)
- `MVP_BUILD_DOCS/KNOWLEDGE-SYSTEM/platform-admin/ai-answering-foundation.md` —
  internal state (not customer-facing)

## Need more help?

Contact support: support@missedcallsdental.com
