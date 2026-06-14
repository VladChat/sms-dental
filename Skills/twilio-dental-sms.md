---
name: twilio-dental-sms
description: Use this skill when working on Twilio, SMS, missed calls, phone numbers, messaging webhooks, A2P compliance, opt-out handling, or SMS wording for the Dental SMS project. Also covers AI Answering (the planned MVP voice channel, historically the AI Call Assistant) — Twilio Voice, ConversationRelay, voice webhooks/WebSocket handlers — which is planned but NOT live yet and must not be enabled without explicit owner approval and safety gates.
---

# Twilio Dental SMS Skill

Use this skill for all Twilio-related work in the Dental SMS project — both the
current SMS recovery MVP and the planned AI Answering voice channel (historically
the AI Call Assistant). The MVP direction is AI Answering + SMS Recovery +
Workspace. The SMS compliance rules below always apply; the voice guidance covers
a planned channel that is **not live yet** and must not be enabled without
explicit owner approval and safety gates.

Project:
Dental SMS

Domain:
missedcallsdental.com

Product:
A B2B SaaS for dental clinics that detects missed calls and automatically sends a professional SMS follow-up to help recover missed patients and book appointments.

Use this skill when the task involves:
- Twilio phone numbers
- Twilio Messaging Services
- SMS sending
- SMS receiving
- Missed call detection
- Call webhooks
- Message webhooks
- A2P 10DLC
- SMS compliance
- Opt-out handling
- STOP / START / HELP behavior
- Dental clinic SMS wording
- Twilio errors
- Twilio webhook security
- Twilio delivery status
- Twilio production readiness
- Future AI voice answering (AI Call Assistant): Twilio Voice, ConversationRelay,
  voice call webhooks, WebSocket handlers, transfer-to-clinic outbound calls

Core rules:
- Keep SMS messages short, clear, and professional.
- Do not use spammy or aggressive wording.
- Do not make medical promises.
- Do not create fake urgency.
- Do not imply diagnosis or medical advice.
- Respect opt-out behavior.
- Make the product trustworthy for Twilio review and real dental clinics.
- Keep live patient SMS inactive until carrier/A2P approval and number readiness are complete.
- Keep owner-only test mode separate from production live mode.
- Treat local number preparation/reservation as the default MVP onboarding path; do not require customers to choose from a manual number catalog.

Default missed call SMS style:

"Hi, this is {{clinic_name}}. We missed your call. Would you like us to help schedule an appointment?"

Better follow-up style:

"Thanks for reaching out to {{clinic_name}}. We missed your call, but we can still help. Reply here and our team will follow up."

Avoid:
- "URGENT"
- "You need treatment"
- "We guarantee"
- "Limited time"
- "Click now"
- Fake discounts
- Medical claims
- Overly salesy copy

Implementation guidance:
- Webhook endpoints must validate Twilio signatures before trusting requests.
- Store inbound and outbound messages in Supabase.
- Store call events and message status events.
- Handle duplicate webhooks safely.
- Keep webhook handlers idempotent.
- Log Twilio errors clearly.
- Do not expose Twilio secrets to the browser.
- Keep all Twilio credentials server-side only.

Compliance guidance:
- Include opt-out language where appropriate.
- Support STOP, START, and HELP.
- Do not continue messaging users who opted out.
- Keep clinic identity clear in messages.
- Avoid misleading sender identity.

## AI Answering (planned MVP voice channel) — NOT live yet

Status: planned MVP channel — not built/enabled. The MVP direction is AI Answering
+ SMS Recovery + Workspace, but the AI voice runtime does not exist yet. Do not
enable live AI voice behavior without explicit owner approval and safety gates
(same discipline as live patient SMS). All SMS compliance rules above remain
unchanged, and AI Answering does **not** remove the separate SMS carrier-approval
requirement.

Scope: AI Answering is a **narrow call-capture assistant, not a full AI
receptionist**. It collects name, callback intent/reason, and preferred time,
creates a **Workspace request**, and uses only approved AI Front Desk Knowledge
facts. It must never diagnose, give treatment advice/medical triage, promise
availability, book into a PMS, collect payment, or pretend to be human. It can be
useful right after the first assigned number + forwarding (before SMS approval);
SMS Recovery activates later after approval. AI sessions and SMS replies should
converge into one Workspace patient request card, and SMS must not duplicate a
successful AI conversation.

Planned architecture:
- For AI voice answering, Twilio handles the phone call and the voice connection.
- The preferred planned architecture is **Twilio Voice + Twilio ConversationRelay
  + a backend AI orchestration / OpenAI reasoning layer**.
- `ConversationRelay` (and `STT`, `TTS`, model names, token usage, latency) are
  technical/internal terms. **Never surface them to clinic customers** — customers
  see only "AI answered calls" and "AI answered call time".

Security and reliability (apply when this is built):
- Voice webhooks and WebSocket handlers must validate requests/signatures where
  applicable, and reject unsigned/unverified requests.
- Keep handlers idempotent; deduplicate repeated provider events.
- Never expose Twilio (or AI provider) secrets to the browser; keep all
  credentials server-side only.
- Store call events/summaries safely (redacted), the same way call/message events
  are stored today. No raw secrets or raw prompts in logs.

Cost note:
- Outbound voice cost applies only when Twilio places a **separate outbound call**
  — for example, transferring the caller to the clinic. Answering a forwarded
  inbound call is not the same as placing an outbound call.
- AI answered call usage is a future billable category; limits/rates must come from
  `config/billing.config.ts` (see `BILLING-AND-USAGE-POLICY.md`), never hard-coded.
- Trial start is unchanged (first included business number assignment). The plan
  includes 100 AI answered call minutes; during the trial AI Answering should
  pause/fail closed when those are exhausted. Usage metering and overage billing
  are not implemented.

For this project, Twilio work must prioritize:
1. Reliability
2. Compliance
3. Clear dental-office communication
4. Production readiness
5. Simple maintainable code

