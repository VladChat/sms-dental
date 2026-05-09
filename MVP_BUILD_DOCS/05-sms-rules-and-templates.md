# 05 — SMS Rules and Templates

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1  
Stage: 3 — SMS Rules and Templates  
Primary audience: AI coding agent / technical founder

---

## 1. Purpose of this file

This file defines the MVP SMS behavior.

The MVP should not behave like a full AI receptionist. It should use a deterministic rules engine:

```txt
missed call -> first SMS -> classify reply -> handoff to front desk -> manual booked/lost outcome
```

The goal is to recover appointment opportunities, not to diagnose patients, replace staff, or fully automate scheduling.

---

## 2. Core principles

### 2.1 Keep messages operational

SMS should focus on:

- missed-call recovery;
- scheduling intent;
- callback coordination;
- basic urgency routing;
- front-desk handoff.

Avoid asking for or storing detailed medical information.

---

### 2.2 No diagnosis

Do not generate messages that diagnose, recommend treatment, prescribe medication, or interpret symptoms.

Safe:

```txt
We marked this as urgent. Please call the office now.
```

Unsafe:

```txt
Your symptoms sound like an abscess and you should take medication.
```

---

### 2.3 Deterministic first

For v0.1, use rules and templates.

Do not use LLM/AI for patient-facing messages in MVP unless explicitly added later with compliance review.

---

### 2.4 Front desk remains responsible

The system should surface opportunities and urgency. The clinic handles booking and clinical decisions.

---

## 3. Automation timeline

### 3.1 Default sequence

| Step | When | Condition | Template |
|---|---|---|---|
| First SMS | 10–20 seconds after missed call detection | Patient not opted out, clinic automation enabled | `first_missed_call_a` |
| Follow-up 1 | 15 minutes after first SMS | No inbound reply, no callback, not opted out, opportunity still open | `no_reply_15m` |
| Follow-up 2 | Next business day at 9:00 local clinic time | No inbound reply, no callback, not opted out, opportunity still open | `next_day_followup` |

---

### 3.2 Hard limits

Per missed-call incident:

```txt
max automated outbound SMS = 3
```

This includes:

1. first missed-call SMS;
2. 15-minute follow-up;
3. next-business-day follow-up.

Manual messages from the front desk are a separate product decision. If manual messaging is included, they should still respect opt-out.

---

### 3.3 Cancellation triggers

Cancel all pending automated follow-ups when any of these happen:

- patient sends inbound SMS;
- patient calls back the recovery number;
- patient opts out;
- front desk marks opportunity booked;
- front desk marks opportunity lost;
- front desk pauses automation;
- clinic automation is disabled;
- clinic subscription/status is no longer active/trialing.

---

### 3.4 Business-hours behavior

The first SMS may be sent both during and after business hours, but the template should differ.

During business hours:

- use `first_missed_call_a` or `first_missed_call_b`.

After business hours:

- use `after_hours`.

Follow-up 2 should be scheduled for the next business day at 9:00 AM in the clinic timezone.

---

### 3.5 Timezone rule

All patient-facing schedule decisions must use `clinics.timezone`.

Store timestamps in UTC. Display them in clinic local time.

---

## 4. Eligibility rules before sending SMS

Before any automated SMS send, check:

1. Clinic exists.
2. Clinic status is `trialing` or `active`.
3. Clinic automations are enabled.
4. Clinic has valid recovery number and Messaging Service.
5. Patient exists.
6. Patient has not opted out.
7. Missed call exists and is still open.
8. Max automated SMS count for incident has not been reached.
9. The specific follow-up step has not already been sent.
10. Message body is non-empty and under SMS-safe length.

If any check fails, do not send. Store a skipped/cancelled job state.

---

## 5. Message length rule

Keep default templates short enough for one or two SMS segments.

Target:

```txt
under 320 characters
```

First SMS may be longer because it includes menu options and STOP language, but avoid unnecessary text.

---

## 6. Required opt-out language

Include STOP language in:

- first automated SMS;
- follow-up 1;
- after-hours SMS.

Recommended text:

```txt
Reply STOP to opt out.
```

If Twilio Advanced Opt-Out is enabled, Twilio can handle STOP/START/HELP responses, but the app must still store opt-out state locally.

---

## 7. Template variables

Supported variables:

| Variable | Source | Required |
|---|---|---:|
| `{clinic_name}` | `clinics.name` | yes |
| `{main_phone}` | `clinics.main_phone_e164` or formatted display value | yes for urgent template |
| `{emergency_phone}` | clinic emergency phone or main phone fallback | yes for after-hours urgent guidance |
| `{recovery_phone}` | recovery phone display value | optional |
| `{front_desk_name}` | clinic/user setting | optional later |

If a required variable is missing, do not send the SMS. Create an internal setup error.

---

## 8. Default templates — English

### 8.1 `first_missed_call_a`

Use as default first SMS during business hours.

```txt
Hi, this is {clinic_name}. Sorry we missed your call. What do you need help with? Reply: 1 New patient, 2 Existing patient, 3 Tooth pain, 4 Cleaning, 5 Reschedule. Reply STOP to opt out.
```

Intent options:

```txt
1 = new_patient
2 = existing_patient
3 = urgent_tooth_pain
4 = cleaning
5 = reschedule
```

---

### 8.2 `first_missed_call_b`

Use as optional A/B variant or simpler default.

```txt
Sorry we missed you at {clinic_name}. Text us what you need and our front desk will help: new patient, cleaning, tooth pain, appointment, or reschedule. Reply STOP to opt out.
```

---

### 8.3 `new_patient`

Optional automated reply after patient indicates new patient intent.

```txt
Thanks for contacting {clinic_name}. Are you looking for your first appointment? Reply with your preferred day/time and our front desk will text or call you back.
```

---

### 8.4 `existing_patient`

Optional automated reply after patient indicates existing patient intent.

```txt
Thanks — we can help. Please text your name and what you need: checkup, follow-up, crown, filling, or other. Our front desk will follow up.
```

---

### 8.5 `urgent_tooth_pain`

Use after urgent signal.

```txt
We marked this as urgent. If you have swelling, trauma, uncontrolled bleeding, or severe pain, please call the office now at {main_phone}. If this is life-threatening, call 911.
```

Important:

- This template does not diagnose.
- It escalates to the clinic/911.
- It should also mark the conversation urgent in the dashboard.

---

### 8.6 `cleaning_request`

```txt
Great — we’ll help you with a cleaning visit. Reply with mornings / afternoons and the best day for you. Our front desk will follow up.
```

---

### 8.7 `appointment_request`

```txt
Thanks. What day works best for your appointment, and are you a new or existing patient? Our front desk will follow up.
```

---

### 8.8 `reschedule`

```txt
No problem — we can help reschedule. Please reply with your name and the best day/time to move your appointment.
```

---

### 8.9 `no_reply_15m`

```txt
Just checking in from {clinic_name}. If you still need an appointment, reply here and our front desk will follow up. Reply STOP to opt out.
```

---

### 8.10 `next_day_followup`

```txt
We tried to follow up on your missed call to {clinic_name}. If you still want help booking, text us here and we’ll get back to you.
```

---

### 8.11 `after_hours`

```txt
Thanks for calling {clinic_name}. Our office is currently closed. Reply here and our team will follow up next business day. For urgent dental issues, call {emergency_phone}. Reply STOP to opt out.
```

---

### 8.12 `media_received`

Use only if patient sends MMS/media and MVP does not store media.

```txt
Thanks. Our system can’t review images here. Our front desk will follow up. For urgent dental issues, please call {main_phone}.
```

---

### 8.13 `opted_out_internal_only`

Do not necessarily send this if Twilio already sends opt-out confirmation.

Use as internal status/note:

```txt
Patient opted out of SMS. Do not send further automated messages unless they opt back in.
```

---

## 9. Optional templates — Russian localization

These are not required for US MVP unless a clinic explicitly needs Russian-language support. Keep STOP visible.

### 9.1 `first_missed_call_a_ru`

```txt
Здравствуйте, это {clinic_name}. Извините, мы пропустили ваш звонок. Чем помочь? Ответьте: 1 Новый пациент, 2 Действующий пациент, 3 Боль/срочно, 4 Чистка, 5 Перенос записи. Для отказа: STOP.
```

### 9.2 `urgent_tooth_pain_ru`

```txt
Мы отметили это как срочное. Если есть отек, травма, сильное кровотечение или сильная боль, пожалуйста, срочно позвоните в клинику: {main_phone}. В экстренной ситуации звоните 911.
```

### 9.3 `after_hours_ru`

```txt
Спасибо за звонок в {clinic_name}. Сейчас клиника закрыта. Ответьте здесь, и команда свяжется с вами в следующий рабочий день. По срочным вопросам звоните {emergency_phone}. Для отказа: STOP.
```

---

## 10. Intent detection v0

### 10.1 Numeric replies

If normalized body equals:

| Body | Intent | Urgency |
|---|---|---|
| `1` | `new_patient` | normal |
| `2` | `existing_patient` | normal |
| `3` | `urgent_tooth_pain` | urgent |
| `4` | `cleaning` | normal |
| `5` | `reschedule` | normal |

---

### 10.2 Keyword fallback

Normalize body:

- trim whitespace;
- lowercase;
- remove common punctuation for matching;
- keep original body for display/storage policy.

Then match in priority order.

#### Urgent

If body contains any:

```txt
pain
tooth pain
toothache
emergency
urgent
swelling
swollen
bleeding
trauma
broken tooth
can't sleep
severe
infection
abscess
```

Set:

```txt
intent = urgent_tooth_pain
urgency = urgent
```

#### Reschedule

If body contains any:

```txt
reschedule
move appointment
change appointment
cancel appointment
can't make it
can’t make it
move my appointment
```

Set:

```txt
intent = reschedule
urgency = normal
```

#### Cleaning

If body contains any:

```txt
cleaning
teeth cleaning
checkup
check up
hygiene
```

Set:

```txt
intent = cleaning
urgency = normal
```

#### New patient

If body contains any:

```txt
new patient
first appointment
first visit
never been
new to your office
```

Set:

```txt
intent = new_patient
urgency = normal
```

#### Appointment request

If body contains any:

```txt
appointment
book
schedule
available
availability
come in
visit
```

Set:

```txt
intent = appointment_request
urgency = normal
```

#### Existing patient

If body contains any:

```txt
existing patient
current patient
follow up
crown
filling
implant
retainer
```

Set:

```txt
intent = existing_patient
urgency = normal
```

#### Billing question

If body contains any:

```txt
bill
billing
insurance
payment
invoice
cost
price
```

Set:

```txt
intent = billing_question
urgency = normal
```

#### Fallback

If no rule matches:

```txt
intent = other
urgency = normal
```

---

### 10.3 Multi-intent priority

If multiple rules match, use this priority:

1. urgent_tooth_pain
2. reschedule
3. cleaning
4. new_patient
5. appointment_request
6. existing_patient
7. billing_question
8. other

Urgent always wins.

---

### 10.4 Human override

Front desk should be able to manually change:

- intent;
- urgency;
- opportunity status;
- notes.

Manual override should write to `audit_logs`.

---

## 11. Automated replies after inbound intent

MVP can choose one of two options.

### Option A — no second automated reply

After patient replies, just show the conversation to front desk.

Pros:

- safest;
- simplest;
- less compliance risk;
- fewer SMS costs;
- no over-automation.

Recommended for the very first live clinics.

---

### Option B — one deterministic intent reply

After patient replies, send one matching template.

Rules:

- only send if patient has not opted out;
- only send one intent reply per missed-call incident;
- urgent template may be sent immediately;
- no additional automated conversation beyond the template.

Recommended if clinics want immediate acknowledgment.

---

### 11.1 Recommended MVP choice

Start with:

```txt
Option A for normal intents
Option B only for urgent_tooth_pain
```

Reason:

- urgent needs immediate safe guidance;
- normal scheduling can be handled by front desk;
- this keeps MVP narrow.

---

## 12. Follow-up job states

Recommended `followups.job_status` values:

```txt
pending
processing
sent
skipped
cancelled
failed
```

Recommended `followups.step_key` values:

```txt
first_sms
followup_15m
followup_next_business_day
resend_if_undelivered
```

---

## 13. Follow-up creation rules

### 13.1 On missed call detected

Create:

```txt
first_sms pending for now + 10 to 20 seconds
```

Optional jitter:

```txt
random delay between 10 and 20 seconds
```

This avoids robotic exact timing and helps avoid burst behavior.

---

### 13.2 After first SMS sent

Create follow-up 1:

```txt
followup_15m pending for first_sms.sent_at + 15 minutes
```

Create follow-up 2:

```txt
followup_next_business_day pending for next business day at 9:00 AM clinic local time
```

Do not create follow-up 2 if the clinic disables next-day follow-ups.

---

### 13.3 Before sending a follow-up

Re-check:

- patient has not replied;
- patient has not called back;
- patient has not opted out;
- opportunity is still open;
- clinic is active/trialing;
- automation not paused;
- max automated message count not reached.

If any check fails, mark follow-up `skipped` or `cancelled`.

---

## 14. Delivery retry policy

### 14.1 API send retry

If Twilio API request fails before returning `MessageSid` because of transient network/app error:

Retry with backoff:

```txt
attempt 1: immediate
attempt 2: +10 seconds
attempt 3: +60 seconds
attempt 4: +5 minutes
```

Max attempts:

```txt
4 total attempts
```

After max attempts:

- mark message/followup `failed`;
- create admin/internal alert;
- do not keep retrying forever.

---

### 14.2 Delivery failure after MessageSid exists

If Twilio returns `failed` or `undelivered` after a `MessageSid` exists:

For MVP:

- do not automatically resend by default;
- create internal alert/task;
- optionally allow exactly one controlled resend after 15 minutes for technical failures.

Controlled resend allowed only if:

- patient has not opted out;
- opportunity is open;
- no inbound reply/callback happened;
- resend not already used;
- failure reason is likely technical/carrier delivery, not policy/opt-out.

---

### 14.3 No infinite loops

Never create a loop where failed messages keep generating new failed messages.

---

## 15. Opt-out handling

### 15.1 STOP

If inbound body or `OptOutType` indicates STOP:

- set `patients.consent_status = opted_out`;
- set `patients.opted_out_at = now()`;
- set open conversations to `opted_out` or closed;
- set linked missed calls to `opted_out`;
- cancel pending follow-ups;
- block future automated sends.

If Twilio Advanced Opt-Out already sends confirmation, the app does not need to send another confirmation.

---

### 15.2 START / UNSTOP

If inbound body or `OptOutType` indicates START/UNSTOP:

- update local consent status according to chosen compliance policy;
- do not automatically reopen old opportunities;
- allow future messages only if legally appropriate and clinic workflow supports it.

For MVP, set:

```txt
patients.consent_status = confirmed
```

and leave existing closed opportunities closed.

---

### 15.3 HELP

If inbound body or `OptOutType` indicates HELP:

- rely on Twilio Advanced Opt-Out response if configured;
- store inbound message;
- do not create a new appointment opportunity from HELP alone;
- keep existing conversation open if one exists.

---

## 16. Urgency handling

### 16.1 Urgent criteria

Urgent if:

- patient replies `3`; or
- keyword rule matches urgent list; or
- front desk manually marks urgent.

---

### 16.2 Urgent side effects

When urgent:

- set `conversations.urgency = urgent`;
- set `appointment_opportunities.urgency = urgent`;
- place item at top of inbox;
- optionally notify front desk/owner;
- send `urgent_tooth_pain` template if using urgent auto-reply.

---

### 16.3 Urgent dashboard SLA

Recommended internal alert:

```txt
If urgent incident has no front-desk action within 10 minutes during business hours, alert owner/admin.
```

This alert can be manual/admin-only in v0.1.

---

## 17. Message rendering

### 17.1 Template lookup order

When rendering a template:

1. Clinic-specific active template.
2. Default template for locale.
3. English default fallback.

---

### 17.2 Template versioning

Store template version on sent message:

```txt
messages.template_key
messages.template_version
messages.body_redacted
```

This lets support understand what was sent later.

---

### 17.3 Redaction/storage policy

For MVP, store message body only as needed for conversation view.

Recommended:

- store full body for inbound/outbound operational conversation in `messages.body` or `body_redacted` depending final compliance choice;
- do not store media;
- do not add structured medical fields;
- avoid extracting clinical details beyond intent/urgency.

If using `body_redacted`, keep enough text for front desk workflow.

---

## 18. Default automation settings

Recommended row in `automations` per clinic:

```json
{
  "enabled": true,
  "after_hours_enabled": true,
  "first_sms_delay_sec": 15,
  "followup_1_delay_min": 15,
  "followup_2_business_days_after": 1,
  "followup_2_time_local": "09:00",
  "max_automated_sms_per_incident": 3,
  "callback_timeout_sec": 15,
  "urgent_auto_reply_enabled": true,
  "normal_intent_auto_reply_enabled": false
}
```

---

## 19. Example state transitions

### 19.1 Missed call with no reply

```txt
missed_call.detected
-> first_sms sent
-> followup_1 sent after 15m
-> followup_2 sent next business day
-> remains open until front desk marks lost/booked
```

---

### 19.2 Missed call with patient reply

```txt
missed_call.detected
-> first_sms sent
-> patient replies "4"
-> intent = cleaning
-> conversation waiting_for_front_desk
-> followups cancelled
-> front desk marks booked/lost
```

---

### 19.3 Missed call with urgent reply

```txt
missed_call.detected
-> first_sms sent
-> patient replies "3"
-> intent = urgent_tooth_pain
-> urgency = urgent
-> urgent auto-reply sent
-> inbox item moves to top
-> followups cancelled
-> front desk acts
```

---

### 19.4 Patient opts out

```txt
missed_call.detected
-> first_sms sent
-> patient replies STOP
-> patient opted_out
-> conversation opted_out
-> followups cancelled
-> no future automated SMS
```

---

## 20. Seed data

The AI coding agent should seed default templates and automation settings during clinic creation.

Minimum seed templates:

```txt
first_missed_call_a
after_hours
urgent_tooth_pain
no_reply_15m
next_day_followup
media_received
```

Optional seed templates:

```txt
first_missed_call_b
new_patient
existing_patient
cleaning_request
appointment_request
reschedule
```

---

## 21. Definition of done for SMS rules

SMS rules are done when:

- first SMS sends after missed call;
- after-hours template is selected outside business hours;
- numeric intent replies are classified;
- urgent keyword replies are classified;
- inbound reply cancels follow-ups;
- callback cancels follow-ups;
- STOP blocks future messages;
- max 3 automated SMS rule is enforced;
- follow-up 1 can be sent after 15 minutes;
- follow-up 2 can be scheduled for next business day at 9 AM clinic local time;
- Twilio delivery failure does not create infinite resend loop;
- templates are seeded for new clinics.
