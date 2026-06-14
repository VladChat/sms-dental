# AI Voice Relay (Twilio ConversationRelay)

Standalone Node WebSocket service that powers **test_only** AI Answering for
Missed Calls Dental. It is a **separate deployable** from the Next.js app — do
**not** run a ConversationRelay WebSocket inside a Next/Vercel route handler.

## What it does

```
Inbound call → Twilio voice webhook (Next app) → runtime gate (test_only + allowlist)
  → ConversationRelay TwiML pointing at this service
  → wss://<relay-host>/twilio/conversation-relay
  → OpenAI Responses API (text brain)
  → captured request saved to ai_voice_sessions (source = future_twilio)
  → Workspace shows "Source: AI answered call"
```

Twilio ConversationRelay handles the phone/STT/TTS/session/WebSocket transport.
This service only provides conversation logic and persists the **narrow captured
request** (name / reason / preferred time / handoff note / safety flag).

It **never** stores transcripts, audio, raw Twilio messages, prompts, or raw
OpenAI responses, and it **never** sends SMS.

## Endpoints

- `GET /health` → `{ "ok": true }` (HTTP 200), or `{ "ok": false, "error": "<reason>" }`
  (HTTP 503) when required config is missing.
- `WS /twilio/conversation-relay` → accepts a Twilio ConversationRelay session.
  Validates the signed `token` custom parameter (HMAC), checks it matches the
  other custom parameters, re-applies the AI Answering runtime gate, and
  (best-effort) validates `X-Twilio-Signature`.

## Environment

Set these on the relay host (never print secret values):

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | no | Default `8080`. |
| `SUPABASE_DB_URL` | yes | Same database as the Next app. Persists sessions. |
| `AI_ANSWERING_RELAY_SIGNING_SECRET` | yes | **Same value** as the Next app. Verifies the token. |
| `OPENAI_API_KEY` | yes\* | Text brain. \*Or run the deterministic fallback (below). |
| `AI_ANSWERING_OPENAI_MODEL` | no | Model id; defaults to `gpt-4o-mini`. |
| `AI_ANSWERING_RUNTIME_MODE` | yes | Must be `test_only` to answer. |
| `AI_ANSWERING_TEST_CLINIC_IDS` | yes | Allowlisted clinic UUID(s). |
| `AI_ANSWERING_TEST_CALLER_NUMBERS` | yes | Allowlisted caller number(s), E.164. |
| `AI_ANSWERING_RELAY_WS_PATH` | no | Default `/twilio/conversation-relay`. |
| `AI_ANSWERING_RELAY_FALLBACK_BRAIN` | no | `true` → deterministic brain when no `OPENAI_API_KEY` (offline/local). |
| `AI_ANSWERING_RELAY_TOKEN_MAX_AGE_MS` | no | Token acceptance window. Default 10 min. |
| `TWILIO_AUTH_TOKEN` | no | Enables best-effort `X-Twilio-Signature` check. |
| `AI_ANSWERING_RELAY_ENFORCE_TWILIO_SIGNATURE` | no | `true` → hard-reject on signature mismatch. |

Without `OPENAI_API_KEY` and without `AI_ANSWERING_RELAY_FALLBACK_BRAIN=true`,
`/health` returns a safe config error and the WebSocket refuses sessions.

## Run

```bash
# from repo root
npm run ai-relay:dev     # tsx watch (local)
npm run ai-relay:build   # tsc emit to services/ai-voice-relay/dist
npm run ai-relay:test    # unit tests (mocked OpenAI + WebSocket, no live calls)

# or from this directory
npm install
npm run dev
npm start                # node dist/services/ai-voice-relay/src/server.js
```

## Deploy notes

- This service must be reachable at `wss://<relay-host>/twilio/conversation-relay`
  and that exact URL goes in the Next app's `AI_ANSWERING_RELAY_WS_URL`.
- ConversationRelay requires Twilio onboarding / the AI addendum before real
  calls work. If onboarding is incomplete, Twilio may reject the TwiML or the
  call may fall back. See `MVP_BUILD_DOCS/AI-ANSWERING-RUNTIME.md`.
- It is independent of Vercel: run it on any Node host that supports long-lived
  WebSocket connections (a plain Node host, container, or VM — not a Vercel
  serverless function).

## Safety invariants

- Test-only: an exact allowlisted clinic **and** caller, in `test_only` mode.
- No SMS is ever sent from this service.
- Only the narrow captured request is stored — no transcripts/audio/raw payloads/
  prompts/OpenAI responses.
- Fails closed: bad/forged/expired token, gate miss, or misconfiguration → the
  session is refused.
