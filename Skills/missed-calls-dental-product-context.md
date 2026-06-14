---
name: missed-calls-dental-product-context
description: Product context for the Dental SMS missed calls SaaS project.
---

# Dental SMS Product Context

We are building a B2B SaaS for dental clinics.

Product name:
Dental SMS / Missed Calls Dental

Domain:
missedcallsdental.com

Core problem:
Dental clinics miss phone calls. Missed calls mean lost patients and lost revenue. Many patients do not call back.

Core product:
The app sends a professional SMS follow-up after a missed-call event reaches our system.

Important product clarification:
The app cannot automatically detect calls to an unrelated clinic phone number. The call event must reach the system through forwarding, a prepared local-number path, or a future direct phone-provider integration.

Main goal:
Recover missed callers and help dental offices book more appointments.

Target customers:
- Independent dental clinics
- Small dental offices
- Local healthcare offices with front desk call volume
- Offices that do not already have a strong missed-call SMS recovery workflow

Primary MVP connection modes:

1. Conditional forwarding mode
   - The clinic keeps its existing main phone number.
   - The clinic or phone provider forwards no-answer, busy, unavailable, or after-hours calls to the assigned Twilio recovery number.
   - The forwarded call must preserve the patient's caller ID for SMS recovery to work correctly.

2. Owner self-service business number path (current account flow)
   - The owner searches local numbers from `/account` and chooses a business number.
   - The first number is included with the $99/month plan and requires a saved payment method.
   - The current backend starts the 21-day trial after the first successful number assignment.
   - Real Twilio purchasing remains gated by `runtimeConfig.onboarding.twilioNumberPurchaseMode = "live"`.
   - Additional numbers require a webhook-confirmed active paid plan and explicit $20/month consent.
   - The assigned number can be used for conditional forwarding, direct routing, or campaign needs where appropriate.

Future connection mode:
- Direct integrations with phone providers or dental communication platforms may be added later.
- Examples: RingCentral, Dialpad, Nextiva, Weave, Mango Voice, RevenueWell, Adit, or similar systems.
- This is not required for the first MVP.

Core workflow:
1. Patient calls the clinic's main number or assigned business number path.
2. The call reaches our system through conditional forwarding or direct routing to the assigned number.
3. Twilio sends a signed webhook to the backend.
4. Dental SMS records the event idempotently.
5. The system checks opt-out and duplicate rules.
6. After explicit product approval/configuration, the patient receives a professional SMS follow-up.
7. Conversation continues.
8. Office books or marks the opportunity as lost.

Tech stack:
- Next.js
- React
- Supabase
- Stripe
- Twilio
- Vercel

Design requirement:
The website and app must look like a real professional B2B SaaS.
No placeholder look.
No fake startup design.
No childish UI.
No messy landing page.

Tone:
Clear.
Professional.
Simple.
Trustworthy.
Direct.

Compliance:
- Respect SMS opt-out.
- Avoid spammy language.
- No fake medical claims.
- No aggressive messaging.
- Keep the product trustworthy for Stripe, Twilio, and dental clinics.

Business requirement:
The site must be good enough for Stripe verification, Twilio review, and real clinic customers.

Current onboarding/account source of truth:
Create office profile (clinic name, main office phone, ZIP code) first, then Business Profile cards for Business Information and A2P Approval Information. Owners purchase the first business number through `/account` after saving a payment method; the first number is included and does not charge that day. Paid plan conversion is explicit through Stripe Checkout and webhook-confirmed subscription status. SMS recovery remains separately gated by compliance, QA, owner approval, runtime mode, and clinic settings; it is never enabled automatically.

## Planned MVP channel: AI Answering (not live yet)

Status: planned MVP channel — NOT live yet. The MVP direction is now **AI
Answering + SMS Recovery + Workspace**. AI Answering is **not built, not billed,
and not enabled** today, and must never be turned on without explicit owner
approval and safety gates. The shipping product today is still missed-call SMS
recovery.

AI Answering is a **narrow call-capture assistant — NOT a full AI receptionist**
(historically called the "AI Call Assistant").

How the three channels fit together:
- **Voice-first:** AI Answering can be useful immediately after the first assigned
  business number and forwarding setup. It does not depend on SMS approval.
- **SMS-second:** SMS Recovery still turns on later, only after carrier
  approval/readiness. AI Answering does not remove the SMS approval requirement.
- **Workspace is central:** AI voice sessions and SMS replies should eventually
  become **one patient request card** in the Workspace.
- **No duplicate outreach:** if AI captured the request, a later SMS is
  confirmation/continuation; if AI failed/was incomplete and SMS is approved, SMS
  is fallback.

What it is, in customer terms:
- AI Answering lets a clinic have **AI answered calls** when calls are forwarded to
  a dedicated **AI assistant number** (for missed-call overflow, busy lines, and
  after-hours). Phone forwarding decides which calls reach it; if a call reaches
  the AI assistant number, the assistant answers.
- It collects the caller's **name, callback intent/reason, and preferred time**,
  creates a **Workspace request** (and a call summary), and may send an SMS
  follow-up or transfer the caller to the clinic. It uses only approved AI Front
  Desk Knowledge facts (hours, services, insurance, languages, payment, policies).
- It is **not** a front-desk replacement, full AI receptionist, dental CRM, or PMS
  integration, and must never diagnose, give treatment advice or medical triage,
  promise availability, book into a PMS, collect payment, pretend to be human, use
  fake urgency, or use aggressive sales messaging.

Billing/trial: trial start is unchanged (first included business number
assignment). The plan includes 100 AI answered call minutes; during the trial AI
Answering should pause/fail closed if those are exhausted. Usage metering and
overage billing are not implemented. Account **Notification Settings** start with
AI answered call minute alerts at 90% and 100% (settings only — no delivery yet).

Customer-facing language to use:
- "AI Call Assistant", "AI answered calls", "AI answered call time",
  "AI assistant number", "forwarded calls", "call summaries".
- Usage is measured as **AI answered call time** (not "Conversation Relay minutes"
  or "call-tracking minutes").

Do NOT show clinic users technical terms:
- ConversationRelay, STT, TTS, OpenAI model, WebSocket, Twilio SID, webhook
  status, token usage, latency, raw prompts, or raw logs. These stay internal.

Clinic users should see simple controls only:
- AI assistant status (Off / Test / Live), AI assistant number, transfer-to-person
  number, the clinic information the assistant uses, a test-call button, and recent
  AI call summaries.

Sources of truth: product/architecture `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`;
billing/usage `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` + `config/billing.config.ts`;
implementation guidance `Skills/twilio-dental-sms.md`.
