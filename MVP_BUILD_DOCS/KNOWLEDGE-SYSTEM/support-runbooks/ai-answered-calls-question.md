---
title: AI answered calls question
slug: ai-answered-calls-question
status: draft
visibility: internal_ops
audience: Internal support / operator
surface: support
category: ai-answering
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - MVP_BUILD_DOCS/AI-ANSWERING-RUNTIME.md
  - MVP_BUILD_DOCS/KNOWLEDGE-SYSTEM/platform-admin/ai-answering-foundation.md
last_verified: 2026-06-27
related:
  - ../platform-admin/ai-answering-foundation
  - sms-not-sending
  - clinic-cannot-access-account
---

# AI answered calls question

## Purpose

Answer a clinic's question about **AI answered calls** (the planned AI Call
Assistant channel) accurately and safely, without promising activation, a launch
date, or pricing, and without exposing internal runtime/provider detail.

## Audience / visibility

Internal support / operator. `visibility: internal_ops`. Internal-only — never
paste this runbook to a customer; use the customer-safe wording below.

## Symptom

A clinic asks about AI answered calls. Common variants:

- "Do I have AI answered calls?"
- "Can you turn it on for me?"
- "I see **Source: AI answered call** on a request in my Workspace — what is it?"
- "Does the AI replace my front desk staff?"
- "Does the AI give patients dental advice?"

## Customer-safe explanation

> AI answered calls are being prepared and are **not generally active yet**. When
> available, they will help your office capture a caller's name, callback number,
> and reason for calling into a short **call summary** and a **patient request**
> in your Workspace, so your team can follow up. It is a call-capture helper — not
> a full receptionist, and it never gives medical advice or books appointments on
> its own. I can't promise a turn-on date, but I can note your interest.

Tailor by variant (all stay within the wording above):

- **"Do I have it?" / "Can you turn it on?"** — It is not generally active yet and
  cannot be switched on for an individual clinic on request. No date to promise.
- **"What is Source: AI answered call in my Workspace?"** — It is the **source
  label** on a patient request showing the request came from an AI answered call;
  handle it the same as any other patient request, through normal scheduling.
- **"Does AI replace staff?"** — No. It captures the request; your front desk
  still follows up.
- **"Does AI give dental advice?"** — No. It does not diagnose or give treatment
  advice; urgent or medical concerns should follow the clinic's normal phone and
  emergency process.

## Internal triage checklist

- Confirm scope: AI answered calls are **planned / not broadly live**. There is no
  live-call troubleshooting to run for a general clinic yet.
- A real **app foundation** exists (the data model + Workspace representation can
  *represent* an AI answered call). Review state via the platform-admin
  **AI Answering** area and
  [../platform-admin/ai-answering-foundation.md](../platform-admin/ai-answering-foundation.md).
- The runtime is **disabled by default**; any test-only path is strictly gated to
  an allowlisted clinic/caller. Do **not** treat any of that as "available for
  this clinic."
- **Do not run the platform-admin mock-session tooling** to "demo" the feature for
  a clinic unless a task explicitly authorizes it — it writes real rows.
- If the clinic sees an AI answered call request in their Workspace, confirm it is
  being handled like any other patient request; nothing else is required of them.

## What not to expose to the customer

- Internal/runtime/provider detail: ConversationRelay, WebSocket, STT/TTS, OpenAI,
  Twilio, Railway, SIDs, payloads, webhooks, runtime mode/flags, allowlists, or
  mock-session/internal test tooling.
- Any claim that the feature is live for them, a launch date, or a price.
- Secrets, raw payloads, transcripts, audio, or another clinic's data.

## Safe resolution paths

- Give the customer-safe explanation and, if asked, note the clinic's interest.
- For a Workspace "Source: AI answered call" question, explain it is a source
  label and point them to normal follow-up.
- Record the question; do not change any clinic setting or provider state.

## Escalation criteria

Escalate to a platform admin / operator (engineering) if:

- a clinic insists AI answered calls **should be active** for them, or believes
  they were promised activation;
- a clinic reports an AI answered call they did not expect, or a request whose
  source looks wrong;
- anything would require checking or changing live provider/runtime state.

Do not attempt provider/runtime changes yourself.

## Related platform-admin docs

- [../platform-admin/ai-answering-foundation.md](../platform-admin/ai-answering-foundation.md)
- [../platform-admin/clinic-console.md](../platform-admin/clinic-console.md)

## Source of truth

- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — AI Answering planned / not live; narrow
  capture
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — foundation / runtime-disabled /
  gated test-only state
- `MVP_BUILD_DOCS/AI-ANSWERING-RUNTIME.md` — runtime contract (internal)
- `MVP_BUILD_DOCS/KNOWLEDGE-SYSTEM/platform-admin/ai-answering-foundation.md`
