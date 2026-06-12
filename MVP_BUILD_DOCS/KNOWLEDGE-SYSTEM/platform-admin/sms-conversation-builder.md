---
title: SMS Conversation Builder v1
slug: sms-conversation-builder
status: internal
visibility: platform_admin
audience: Platform admin / operator
surface: /admin
category: platform-admin
owner: platform
source_of_truth:
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - config/sms-recovery.config.ts
  - lib/sms-recovery/conversation-templates.ts
last_verified: 2026-06-12
---

# SMS Conversation Builder v1

Internal platform-admin reference. **Clinic owners cannot edit SMS copy.** Only
a platform admin configures the SMS conversation flow for a selected clinic from
**/admin/clinics/[clinicId] → SMS messages**. This is deterministic — there is
no AI, no booking, no medical advice, and no unlimited chatbot.

## What it controls

- **Initial missed-call SMS.** The admin edits one full initial SMS template.
  There are no locked start/end blocks. With no saved template, the message is
  byte-for-byte the existing fixed production message. Rows saved by the first
  implementation as middle-only text are wrapped safely when rendered; rows that
  already contain a full initial SMS are not wrapped again.
- **Up to three deterministic follow-ups.** After a patient replies, the office
  may send follow-up #1, then #2, then #3. Each has its own enabled toggle and
  body. The **Maximum automated replies** setting (0–3) caps how many may send;
  it cannot exceed the enabled follow-ups in order. **0 disables follow-ups.**
- **Variables.** `{{clinic_name}}` (always from the clinic profile) and
  `{{patient_name}}` (only when safely collected). When no name was collected,
  `{{patient_name}}` is removed cleanly so the sentence stays natural.

## Default-safe behavior

- With no saved settings, `max_auto_replies` = 0: **no follow-ups send** and the
  missed-call SMS is unchanged. Follow-ups are inactive until an admin saves and
  enables them for that specific clinic.
- The 4th and later patient replies are **saved to the workspace only** — never
  auto-replied.

## Guards (all enforced on every auto-reply)

An auto-reply sends only when ALL hold: global mode is live/owner-test; the exact
called number passes readiness; the clinic recovery gate passes (clinic enabled,
or owner-test allowlist); the patient is not opted out; the conversation already
has a missed-call recovery message; the next slot is within `max_auto_replies`
and its template is enabled and non-empty. STOP/START/HELP and duplicate webhook
deliveries never trigger an auto-reply, and slots are claimed atomically so
retries never double-send. STOP/START/HELP compliance is still handled by Twilio
(the webhook returns empty TwiML).

## Patient name collection

Names are extracted conservatively and fail-closed: only short, simple replies
("John", "My name is John Smith", "I'm John") yield a name; anything with
digits, links, emails, keywords, or appointment/problem words is ignored. A name
is stored only when none exists yet and is never overwritten. It is better to
store nothing than the wrong name.

## Template safety (deterministic)

Saved templates are rejected if they contain banned spam/medical/urgency
phrasing (e.g. "urgent", "guarantee", "discount", "diagnosis", "appointment
confirmed", "we can book you"), URLs, emails, phone numbers, unknown variables,
excessive punctuation, or all-caps shouting.

The initial SMS has two extra requirements: it must include clinic identity
(`{{clinic_name}}` or the rendered clinic name) and it must include
`Reply STOP to opt out`. The preview renders `{{clinic_name}}` to the real
clinic name and does not leave unresolved placeholders.

## Audit

Saving the builder writes `clinic.sms_conversation.update` with redacted
metadata only (max replies, enabled slot count, whether the initial template is
customized) — never the message bodies.

## Source of truth

- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — operate & verify, migration, guards
- `lib/sms-recovery/conversation-templates.ts` — defaults, render, build rules
- `config/sms-recovery.config.ts` — fixed default template + length limits
