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
  - lib/sms-recovery/reply-classification.ts
  - lib/sms-recovery/voice-greeting-templates.ts
last_verified: 2026-06-12
---

# SMS Conversation Builder v1

Internal platform-admin reference. **Clinic owners cannot edit SMS copy.** Only
a platform admin configures the SMS conversation flow for a selected clinic from
**/admin/clinics/[clinicId] → SMS messages**. This is deterministic — there is
no AI, no booking, no medical advice, and no unlimited chatbot.

## What it controls

- **Edit mode.** The tab is read-only by default. Click **Edit** to make the
  Voice greeting and SMS message fields editable, then **Save**. A successful
  save returns the tab to read-only and shows the saved status. Reset-to-default
  controls appear only while editing and place the default text directly in the
  field.
- **Voice greeting.** This block appears first. The admin can edit three fixed
  scenarios: `will_send`, `duplicate`, and `none`. The system still chooses the
  scenario and owns TwiML/Say/Hangup behavior; the admin edits only safe text
  that may use `{{clinic_name}}`.
- **Initial missed-call SMS.** The admin edits one full initial SMS template.
  There are no locked start/end blocks. With no saved template, the message
  uses the current approved default:
  `Hi, this is {{clinic_name}}. We missed your call. How can we help? Reply STOP to opt out.`
  Rows saved by the first implementation as middle-only text are wrapped safely
  when rendered; rows that already contain a full initial SMS are not wrapped
  again.
- **Up to three deterministic follow-ups.** After a patient replies, the office
  may send follow-up #1, then #2, then #3. Each has its own enabled toggle and
  body. The **Maximum automated replies** setting (0–3) caps how many may send;
  it cannot exceed the enabled follow-ups in order. **0 disables follow-ups.**
- **Variables.** `{{clinic_name}}` (always from the clinic profile) and
  `{{patient_name}}` (only when safely collected). When no name was collected,
  `{{patient_name}}` is removed cleanly so the sentence stays natural.

## Default-safe behavior

- With no saved settings, `max_auto_replies` = 0: **no follow-ups send** and the
  current default missed-call SMS sends. Follow-ups are inactive until an admin
  saves and enables them for that specific clinic.
- With no saved voice greeting rows, each scenario uses the system default
  wording from `lib/sms-recovery/voice-greeting-templates.ts`.
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

Simple replies classified as thanks, acknowledgements, negative replies, or
unclear short replies are saved but do not trigger a normal follow-up and do not
consume an auto-reply slot. Informative replies and safe name-provided replies
may continue through the normal guarded flow.

When a new missed-call recovery SMS is successfully sent and its outbound
`missed_call_recovery` message row is recorded, the conversation starts a fresh
auto-reply cycle: `sms_auto_reply_count` resets to 0 and
`sms_auto_reply_last_sent_at` clears. The safely stored patient display name is
kept. This reset does not happen before the Twilio send or before the outbound
message record succeeds.

## Patient name collection

Names are extracted conservatively and fail-closed: short simple replies
("John", "My name is John Smith", "I'm John") and clear name-prefix messages
with later request content ("My name is Jon Svillow. I need an appointment")
can yield a name. Anything with digits, links, emails, keywords, or ambiguous
appointment/problem content is ignored. A name is stored only when none exists
yet and is never overwritten. If a name is safely found on the first reply, the
name-question follow-up is skipped.

## Template safety (deterministic)

Saved templates are rejected if they contain banned spam/medical/urgency
phrasing (e.g. "urgent", "guarantee", "discount", "diagnosis", "appointment
confirmed", "we can book you"), URLs, emails, phone numbers, unknown variables,
excessive punctuation, or all-caps shouting.

The initial SMS has two extra requirements: it must include clinic identity
(`{{clinic_name}}` or the rendered clinic name) and it must include
`Reply STOP to opt out`. The preview renders `{{clinic_name}}` to the real
clinic name and does not leave unresolved placeholders.

Voice greetings allow only `{{clinic_name}}`. Duplicate/no-text greetings cannot
promise that a text will be sent now.

## Audit

Saving the builder writes `clinic.sms_conversation.update` with redacted
metadata only (`max_auto_replies`, whether the initial template is customized,
enabled follow-up count, customized voice greeting count) — never message bodies.

## Source of truth

- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — operate & verify, migration, guards
- `lib/sms-recovery/conversation-templates.ts` — defaults, render, build rules
- `lib/sms-recovery/reply-classification.ts` — deterministic reply taxonomy
- `lib/sms-recovery/voice-greeting-templates.ts` — voice scenario defaults
- `config/sms-recovery.config.ts` — fixed default template + length limits
