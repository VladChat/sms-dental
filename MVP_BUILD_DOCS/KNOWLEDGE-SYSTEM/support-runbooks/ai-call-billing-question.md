---
title: AI call billing question
slug: ai-call-billing-question
status: draft
visibility: internal_ops
audience: Internal support / operator
surface: support
category: billing
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - config/billing.config.ts
  - MVP_BUILD_DOCS/KNOWLEDGE-SYSTEM/platform-admin/ai-answering-foundation.md
last_verified: 2026-06-27
related:
  - billing-question
  - ../platform-admin/ai-answering-foundation
---

# AI call billing question

## Purpose

Answer a clinic's question about **AI answered call time** and how it relates to
billing, using only config-sourced amounts and without promising overage
behavior, refunds, credits, or activation.

## Audience / visibility

Internal support / operator. `visibility: internal_ops`. Internal-only — use the
customer-safe wording below in any reply.

## Symptom

A clinic asks about AI answered call billing. Common variants:

- "How much do AI answered calls cost?"
- "How many AI answered call minutes do I get?"
- "Was I charged for an AI answered call?"
- "What happens if I go over my AI answered call time?"

## Customer-safe explanation

> AI answered call time is planned as a usage category in your plan. AI answered
> calls are not generally active yet, and AI answered call time is **not being
> metered or billed today**. Your plan's current details — including any included
> AI answered call time — will be shown in your account before this affects
> billing. I can confirm the exact figures from your plan details.

Use the term **AI answered call time** (never "Conversation Relay minutes",
"call-tracking minutes", token/model usage, or STT/TTS).

## Internal triage checklist

- Confirm scope: AI answered calls are **planned / not broadly live**, and AI
  answered call time is **not metered or billed** today (see
  [../platform-admin/ai-answering-foundation.md](../platform-admin/ai-answering-foundation.md)).
- If amounts come up, **confirm against `config/billing.config.ts`** and
  `BILLING-AND-USAGE-POLICY.md`. **Never quote a price or minute count from
  memory**, and do not invent AI overage rates.
- For the overall plan/included-usage shape, use the standard
  [billing-question.md](billing-question.md) runbook.
- If the clinic reports an actual AI call **charge** or an unexpected billing line,
  treat it as a discrepancy to escalate — current behavior does not bill AI
  answered call time.

### What info to ask the customer for

- Clinic name and account email; the exact charge/line or figure they are asking
  about. Do not ask for card details, passwords, or other sensitive data.

## What not to expose to the customer

- Provider/runtime terms (ConversationRelay, OpenAI, Twilio, Railway, SIDs,
  tokens, payloads, STT/TTS), internal flags/allowlists, or mock-session tooling.
- Invented AI prices or overage rates; raw billing-provider objects/IDs.
- Promises of refunds, credits, overage handling, or billing activation that the
  source docs do not support.

## Safe resolution paths

- Give the customer-safe explanation; confirm any figure only from
  `config/billing.config.ts` / the billing article.
- Reassure that AI answered call time is not billed today and that plan details
  will be visible before it affects billing.
- Record the question; change no billing or provider state.

## Escalation criteria

Escalate (engineering) if the clinic reports:

- a real AI call charge or an unexpected billing line that mentions AI answered
  calls,
- an AI answered call minutes discrepancy, or
- any request that would require a real billing-provider change (live billing is
  gated).

## Related platform-admin docs

- [../platform-admin/ai-answering-foundation.md](../platform-admin/ai-answering-foundation.md)
- [../platform-admin/billing-operations.md](../platform-admin/billing-operations.md)

## Source of truth

- `config/billing.config.ts` — canonical amounts / included AI answered call
  minutes (never restated from memory)
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — usage policy; metering/overage
  not live
- `MVP_BUILD_DOCS/KNOWLEDGE-SYSTEM/platform-admin/ai-answering-foundation.md` —
  AI answered call time not metered/billed today
