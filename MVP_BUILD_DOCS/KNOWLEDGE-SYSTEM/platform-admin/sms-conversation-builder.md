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
**/admin/clinics/[clinicId] → SMS settings**. This is deterministic — there is
no AI, no booking, no medical advice, and no unlimited chatbot.

## Panels (SMS settings group)

The left admin nav groups three focused panels under **SMS settings** (the old
single "SMS messages" page was split):

- **Voice greeting** — only the three voice scenarios.
- **SMS texts** — initial SMS, follow-ups #1-#10, Safety notice, Thanks reply.
- **Limits & anti-spam** — maximum automated replies + automation pause
  settings.

Each panel has its own Edit → Save → read-only flow and saves ONLY its own
section; the API merges the rest from the saved config, so saving one panel
never resets another.

## What it controls

- **Edit mode.** Each panel is read-only by default. Click **Edit** to make its
  fields editable, then **Save**. A successful
  save returns the panel to read-only and shows the saved status. Reset-to-default
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
  Resetting to the default does not save that literal default text as an
  override.
- **Up to ten deterministic follow-ups.** After a patient replies, the office
  may send follow-up #1 through #10 in order. Each has its own enabled toggle
  and body. The **Maximum automated replies** setting (0–10) caps how many may
  send; it cannot exceed the enabled/usable follow-ups in order. **0 disables
  follow-ups.** Slots #1-#3 keep the canonical defaults; slots #4-#10 have no
  default and require custom text before they can be enabled. The Follow-up #1
  default asks for both the name and a preferred appointment time:
  `Thanks for the info. What name should we use when our office follows up? If you're looking for an appointment, what time works best for you?`
- **Variables.** `{{clinic_name}}` (always from the clinic profile) and
  `{{patient_name}}` (only when safely collected). When no name was collected,
  `{{patient_name}}` is removed cleanly so the sentence stays natural.

## Default-safe behavior

- With no saved settings, `max_auto_replies` = 0: **no follow-ups send** and the
  current default missed-call SMS sends. Follow-ups are inactive until an admin
  saves and enables them for that specific clinic.
- Code defaults are the source of truth. `clinic_sms_message_templates.body_text
  = NULL` means "use the current code default" only for templates that have a
  code default. For follow-ups, that means slots #1-#3 only. Slots #4-#10 must
  store custom text before they are usable.
- Saving text equal to the canonical default stores NULL or removes the
  unnecessary override. Enabled follow-ups #1-#3 can have `body_text=NULL`;
  those send the current default for that slot. Disabled default-backed
  follow-ups are not kept as junk rows.
- With no saved voice greeting rows, each scenario uses the system default
  wording from `lib/sms-recovery/voice-greeting-templates.ts`.
- Migration `20260621000100_clean_sms_template_default_overrides.sql` cleans old
  saved default-like template bodies while preserving true custom text and
  follow-up enabled flags.
- Migration `20260622000100_expand_sms_conversation_followups.sql` widens
  `max_auto_replies` and auto-reply template sequence constraints to 10, keeps
  voice greetings at sequence 1-3, and adds
  `patient_conversations.sms_thanks_courtesy_sent_at`.
- Migration `20260623000100_sms_safety_notice.sql` adds
  `patient_conversations.sms_safety_notice_sent_at` and clears old
  default-like Follow-up #1 bodies to NULL so default-backed clinics pick up
  the new Follow-up #1 default (true custom text untouched).
- Migration `20260624000100_sms_special_replies_and_anti_spam.sql` allows
  `template_role='special_reply'` (sequence 1 = safety_notice, 2 =
  thanks_courtesy), adds the nullable anti-spam settings columns, and adds the
  per-conversation volume state columns.

## Editable special replies (SMS texts panel)

- **Safety notice** (default `If this is a medical emergency, call 911.`) —
  a PREFIX added once per recovery cycle before the next otherwise-eligible
  automated follow-up when the patient mentions pain/emergency wording. It is
  never a standalone SMS and never a separate branch; the panel preview shows
  prefix + next follow-up as one SMS. Validation requires "medical emergency"
  and "call 911", allows 911 as the only digits, and rejects diagnosis/
  treatment/urgency wording, links, emails, and phone numbers.
- **Thanks reply** (default `You're welcome. Our team will follow up.`) — sent
  once per recovery cycle when the patient says thanks; it does not consume a
  follow-up slot or increment the auto-reply count. Validation rejects digits,
  variables, contact details, and the shared banned phrases.
- Both follow the default/override model: code default is the source of truth;
  only true custom text is stored; reset/default-equal saves remove the
  override row (≤160 chars, no `{{patient_name}}`/variables).

## Limits & anti-spam panel

Defaults (code-backed; NULL columns): pause automation after **6** unanswered
inbound SMS once automation has ended for the cycle, pause for **24 hours**,
flag high volume after **10** unanswered. Bounds: 1-100 / 1-168h / 1-200, and
the high-volume threshold can never be below the pause threshold.

- Only inbound messages skipped because automation ENDED (max replies reached
  or no eligible follow-up) count as unanswered. Keywords, duplicates, gate
  failures, and thanks/ok/negative/unclear replies never count.
- While paused (`automation_muted_until` in the future) nothing automated
  sends — no follow-ups, no thanks courtesy, no safety prefix — but inbound
  messages are STILL saved and counted toward the high-volume flag, and
  STOP/START/HELP keeps working. The pause is temporary; the phone number is
  never blocked.
- A new missed-call recovery SMS resets the count/high-volume flag and clears
  an EXPIRED pause, but an ACTIVE pause is never cleared early.
- The 11th and later patient replies, and any reply beyond the configured max,
  are **saved to the workspace only** unless they qualify for the one-time
  thanks courtesy reply.

## Guards (all enforced on every auto-reply)

An auto-reply sends only when ALL hold: global mode is live/owner-test; the exact
called number passes readiness; the clinic recovery gate passes (clinic enabled,
or owner-test allowlist); the patient is not opted out; the conversation already
has a missed-call recovery message; the next slot is within `max_auto_replies`
and its template is enabled (with either custom text or a NULL default-backed
body). Slots #4-#10 require custom text. STOP/START/HELP and duplicate webhook
deliveries never trigger an auto-reply, and slots are claimed atomically so
retries never double-send.
STOP/START/HELP compliance is still handled by Twilio (the webhook returns empty
TwiML).

Simple replies classified as thanks, acknowledgements, negative replies, or
unclear short replies are saved but do not trigger a normal follow-up and do not
consume an auto-reply slot. A thanks reply can send exactly one deterministic
courtesy reply per recovery cycle: `You're welcome. Our team will follow up.`
It requires `max_auto_replies > 0`, a prior recovery outbound, all normal
mode/readiness/recovery/opt-out gates, sender pinning, no STOP/START/HELP, and
no duplicate inbound. It is recorded as a conversation auto-reply with
`auto_reply_type='thanks_courtesy'`, does not use a numbered slot, and does not
increment `sms_auto_reply_count`. Acknowledgements, negative replies, and
unclear short replies never trigger a courtesy reply. Informative replies and
safe name-provided replies may continue through the normal guarded flow.

## Safety concern replies (deterministic, no medical advice)

A reply containing potential emergency/pain wording (pain, emergency, urgent,
swelling, bleeding, infection, fever, abscess, trauma, "knocked out", "can't
breathe", "trouble breathing") is classified as `safety_concern`. The system
**never diagnoses, never infers severity, and never gives treatment advice** —
it only conditionally prepends `If this is a medical emergency, call 911.` to
the next automated follow-up that is otherwise eligible under ALL normal guards
(mode, readiness, clinic gate, opt-out, prior recovery outbound,
`max_auto_replies`, enabled slot, no STOP/START/HELP, no duplicate webhook).

- The safety-prefixed reply consumes its normal numbered follow-up slot.
- The 911 line is sent at most **once per recovery cycle**, claimed atomically
  via `patient_conversations.sms_safety_notice_sent_at`; a second safety
  concern in the same cycle gets the normal follow-up without the prefix. A new
  missed-call recovery SMS resets the marker with the rest of the cycle state.
- There is **no standalone safety SMS**: if `max_auto_replies` is 0, the
  patient opted out, readiness or the clinic gate fails, or there is no prior
  recovery thread, nothing sends.
- A message containing both a safety concern and an explicit name ("Pain. Use
  Alex Sikorsky as my name.") still saves the name and renders
  `{{patient_name}}` in later follow-ups.
- The thanks courtesy reply, acknowledgement/negative silence, and
  STOP/START/HELP handling are unchanged.

When a new missed-call recovery SMS is successfully sent and its outbound
`missed_call_recovery` message row is recorded, the conversation starts a fresh
auto-reply cycle: `sms_auto_reply_count` resets to 0 and
`sms_auto_reply_last_sent_at` and `sms_thanks_courtesy_sent_at` clear. The
safely stored patient display name is kept for real callers. For configured
internal duplicate-suppression bypass callers only, the stored display name is
reset after the new recovery SMS is accepted and recorded so repeat live-test
cycles start clean. This reset does not happen before the Twilio send or before
the outbound message record succeeds.

## Patient name collection

Names are extracted conservatively and fail-closed: short simple replies
("John", "My name is John Smith", "I'm John") and clear name-prefix messages
with later request content ("My name is Jon Svillow. I need an appointment")
can yield a name. Explicit inline phrases are also recognized anywhere in a
bounded message: "use Alex Sikorsky as (it's/it is) my name", "Alex Sikorsky
is my name" (sentence start), "my name should be Alex Sikorsky", "you can use
Alex Sikorsky", "call me Alex" — so a reply like "Ok. maybe, use alex sikorsky
as it's my name appointment need tomorrow" extracts "Alex Sikorsky"
(title-cased). Anything with digits, links, emails, keywords, or ambiguous
appointment/problem content is ignored, and candidates longer than 3 words
fail closed. Classification (and therefore name extraction) runs on every
ordinary non-keyword inbound, so a name volunteered on the 3rd or 4th reply is
still captured. A name is stored only when none exists yet and is never
overwritten. If a name is safely found on the first reply, the name-question
follow-up is skipped.

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
enabled follow-up count, customized follow-up count, customized voice greeting
count) — never message bodies.

## Source of truth

- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — operate & verify, migration, guards
- `lib/sms-recovery/conversation-templates.ts` — defaults, render, build rules
- `lib/sms-recovery/reply-classification.ts` — deterministic reply taxonomy
- `lib/sms-recovery/voice-greeting-templates.ts` — voice scenario defaults
- `config/sms-recovery.config.ts` — fixed default template + length limits
