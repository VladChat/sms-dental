# 06 — AI-Support Boundaries

Status: planned (AI support is NOT implemented in this task)
Last updated: 2026-06-09

Strict rules for any future AI-support assistant grounded on this Knowledge
System. These rules are binding on the future implementation; this pass only
records them.

## 1. Not implemented yet

AI support is **not** built in this task. No model is wired to retrieve or answer
from this content. This document defines the guardrails the eventual
implementation must follow.

## 2. Role-scoped retrieval

- The future AI must retrieve **only** articles allowed by the requesting user's
  role, filtered **server-side by `visibility`** before any content reaches the
  model (see [01-AUDIENCE-AND-ACCESS-MODEL.md](01-AUDIENCE-AND-ACCESS-MODEL.md)).
- A customer-facing assistant must never load, summarize, quote, or leak
  `platform_admin`, `internal_ops`, or `developer_ops` content — even indirectly.
- A platform-admin assistant may use internal runbooks and admin knowledge but
  **still must not expose secrets**.

## 3. No secrets, ever

- Never output secrets: service-role keys, Twilio Auth Token, Stripe secret keys,
  full DB URLs with passwords, raw setup/recovery tokens.
- Never output raw provider payloads, raw webhook events, or raw patient message
  content.
- For platform-admin answers, follow the same redaction the console uses (phones
  masked, SID tails only).

## 4. No invented behavior

- The AI must not invent product behavior. Answers come from Knowledge System
  articles grounded in source-of-truth files.
- If the docs are incomplete or conflict, the AI must **say what is unknown** and
  escalate to human support — it must not fill the gap with a guess.

## 5. Source priority

- When grounding facts, the AI must prefer source-of-truth files in the **same
  priority order as `AGENTS.md`** ("Source Priority for Project Facts"):
  `PROJECT-CONTEXT.md` → `BILLING-AND-USAGE-POLICY.md` (for pricing/billing/number
  policy) → `OWNER-SETTINGS.md` → `OPERATIONS-RUNBOOK.md` → `SETUP-LOG.md` →
  `REPEATABLE-SETUP-CHECKLIST.md` → `config/runtime.config.ts` → project skills.
- A Knowledge System article that conflicts with a higher-priority source-of-truth
  file is wrong; defer to the source of truth and flag the article for update.

## 6. Cite and escalate

- Every answer should **cite/link the source article** it used.
- When confidence is low, when the question is outside documented behavior, or
  when allowed content does not contain the answer, the AI must **escalate**
  (route to `support@missedcallsdental.com` or the platform operator) rather than
  speculate.

## 7. Domain limits

- The AI must not give **medical advice**, **legal advice**, or
  provider-specific claims beyond documented product behavior. Missed Calls
  Dental is a missed-call recovery tool, not a clinical or legal authority.

## 8. SMS / A2P / Twilio compliance wording

For anything touching SMS, A2P, or Twilio, the AI must respect compliance wording
from `A2P-10DLC-COMPLIANCE-READINESS.md` and the project SMS rules:

- Never encourage spammy messages, marketing blasts, or bulk sends.
- Never suggest fake urgency, discounts-as-pressure, fake guarantees, or medical
  claims in messages.
- Never suggest bypassing opt-out (STOP/START) handling.
- Reinforce: one recovery SMS per missed-call event per 24-hour window per
  (clinic, patient); patient-initiated (implied consent); clear sender identity.
- Use the customer-facing term **"SMS approval"**; keep "A2P/10DLC" as
  internal/registration terminology unless the audience is internal/admin.

## 9. Tone and safety defaults

- Customer-facing answers use customer-safe vocabulary (no provider SIDs, no
  internal workflow detail).
- When uncertain whether something is safe to say to a customer, default to the
  more restrictive behavior and escalate.
