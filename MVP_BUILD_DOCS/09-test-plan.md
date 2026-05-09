# 09 — Test Plan

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1  
Stage: 5 — Test Plan  
Primary audience: AI coding agent, QA, founder, pilot operator

---

## 1. Purpose of this file

This file defines the minimum test plan for the MVP.

The MVP is considered testable when the full loop works:

```txt
missed call -> Twilio voice webhook -> call/missed_call created -> first SMS sent -> inbound SMS received -> intent/urgency detected -> inbox item visible -> mark booked/lost -> dashboard updates
```

Testing must cover:

- unit tests;
- integration tests;
- webhook signature validation;
- database idempotency;
- UI flows;
- end-to-end Twilio tests;
- Stripe webhook tests;
- onboarding/activation tests;
- failure and retry cases.

---

## 2. Test environments

### Local development

Used for:

- unit tests;
- component tests;
- local database migrations;
- mocked Twilio and Stripe payloads.

Requirements:

```txt
local Next.js app
local/test Supabase project or local Supabase
mock Twilio request payloads
mock Stripe webhook payloads
```

---

### Staging

Used for:

- real webhook testing;
- test Twilio number;
- test Stripe mode;
- full E2E flow.

Requirements:

```txt
public HTTPS URL
staging Supabase database
Twilio test/staging number
Stripe test mode keys
separate env vars from production
```

---

### Production

Used only after staging pass.

Requirements:

```txt
production Supabase database
production Twilio account/subaccount setup
production Stripe account
production webhook URLs
admin access controls
monitoring enabled
```

---

## 3. Critical MVP test matrix

| Area | Must pass before pilot? |
|---|---:|
| Auth and clinic isolation | Yes |
| Database migrations | Yes |
| Twilio voice webhook | Yes |
| Twilio SMS send | Yes |
| Twilio inbound SMS | Yes |
| Twilio opt-out handling | Yes |
| Follow-up cancellation | Yes |
| Recovery Inbox | Yes |
| Manual booked/lost outcomes | Yes |
| Callback bridge | Yes |
| Stripe trial after activation | Yes |
| Admin activation checklist | Yes |
| Dashboard metrics | Yes |
| Advanced reporting | No |
| Multi-location support | No |
| PMS integration | No |

---

## 4. Unit tests

### 4.1 Phone normalization

Test module:

```txt
lib/phone/normalize.ts
```

Cases:

```txt
(312) 555-1234 + US default -> +13125551234
312-555-1234 + US default -> +13125551234
+1 312 555 1234 -> +13125551234
invalid input -> validation error
empty input -> validation error
```

Acceptance criteria:

- all stored patient/clinic numbers use E.164;
- invalid numbers do not silently save.

---

### 4.2 Clinic business hours

Test module:

```txt
lib/business-hours/is-open.ts
lib/business-hours/next-business-time.ts
```

Cases:

```txt
Monday 10:00 local -> open
Monday 18:00 local -> closed
Saturday 10:00 local with no hours -> closed
Friday after close -> next business day Monday 09:00
holiday -> closed
DST transition -> no crash
```

Acceptance criteria:

- after-hours template is selected correctly;
- next-day follow-up schedules in clinic local time.

---

### 4.3 Intent detection

Test module:

```txt
lib/messages/classify-intent.ts
```

Exact replies:

```txt
"1" -> new_patient
"2" -> existing_patient
"3" -> urgent_tooth_pain
"4" -> cleaning
"5" -> reschedule
```

Keyword replies:

```txt
"I have tooth pain" -> urgent_tooth_pain
"Need a cleaning" -> cleaning
"Can I reschedule?" -> reschedule
"I want to book" -> appointment_request
"cancel my appointment" -> reschedule_or_cancel
```

Acceptance criteria:

- urgent keywords produce urgency = urgent;
- unknown replies do not fail;
- unknown replies create general appointment opportunity.

---

### 4.4 SMS template rendering

Test module:

```txt
lib/templates/render.ts
```

Cases:

```txt
valid clinic_name renders
missing required variable -> error
STOP language present in first automated SMS
no unresolved {variable} placeholders remain
message length warning if too long
```

Acceptance criteria:

- first SMS always includes opt-out language;
- rendering failure blocks send and creates internal error log.

---

### 4.5 Missed-call detection logic

Test module:

```txt
lib/calls/detect-call-type.ts
```

Cases:

```txt
ForwardedFrom matches clinic main number -> forwarded_missed_call
ForwardedFrom missing + open conversation + outbound SMS exists -> callback
ForwardedFrom missing + no open conversation -> forwarded_missed_call
ambiguous -> forwarded_missed_call safe fallback
```

Acceptance criteria:

- callback bridge is not used for likely new missed-call events;
- ambiguous events do not crash.

---

### 4.6 Follow-up eligibility

Test module:

```txt
lib/followups/is-eligible.ts
```

Cases:

```txt
no reply + no callback + not opted out -> eligible
inbound reply exists -> not eligible
callback exists -> not eligible
patient opted out -> not eligible
incident closed -> not eligible
max SMS reached -> not eligible
```

Acceptance criteria:

- no follow-up after patient reply;
- no follow-up after STOP;
- no more than max automated SMS per incident.

---

## 5. Database tests

### 5.1 Unique constraints

Test:

```txt
insert duplicate twilio_call_sid -> fails or upserts safely
insert duplicate twilio_message_sid -> fails or upserts safely
insert duplicate stripe_event_id -> ignored safely
insert duplicate patient phone within clinic -> fails/upserts
same patient phone across different clinics -> allowed
```

Acceptance criteria:

- webhook retries do not duplicate business records.

---

### 5.2 RLS / clinic isolation

Test:

```txt
clinic A user cannot read clinic B calls
clinic A user cannot read clinic B messages
clinic A user cannot mark clinic B opportunity booked
admin role can access all clinics if explicitly allowed
```

Acceptance criteria:

- every user-visible table is clinic-scoped;
- service-role backend can process webhooks safely.

---

### 5.3 State transitions

Test:

```txt
missed_call detected -> sms_pending -> sms_sent -> engaged -> handoff_pending -> recovered
missed_call detected -> sms_sent -> no_reply -> followup_sent -> closed_lost
any open state -> opted_out
```

Acceptance criteria:

- invalid transitions are blocked or ignored;
- audit logs record manual outcome changes.

---

## 6. API and webhook integration tests

### 6.1 Twilio voice incoming webhook

Endpoint:

```txt
POST /api/webhooks/twilio/voice/incoming
```

Test cases:

```txt
valid Twilio signature -> 200 TwiML
invalid signature -> 403
unknown recovery number -> 404 or safe TwiML with admin alert
duplicate CallSid -> no duplicate call/missed_call
ForwardedFrom present -> forwarded_missed_call
callback scenario -> TwiML Dial
```

Acceptance criteria:

- response is valid XML/TwiML;
- endpoint responds quickly;
- heavy work is queued.

---

### 6.2 Twilio voice call-status webhook

Endpoint:

```txt
POST /api/webhooks/twilio/voice/call-status
```

Test cases:

```txt
initiated status stored
ringing status stored
answered status updates callback answered flag
completed status stores duration
unknown ParentCallSid handled safely
duplicate callback ignored/upserted
```

Acceptance criteria:

- callback attempts are visible in opportunity detail.

---

### 6.3 Twilio inbound SMS webhook

Endpoint:

```txt
POST /api/webhooks/twilio/messaging/incoming
```

Test cases:

```txt
valid inbound SMS -> message stored
unknown patient -> patient created
open conversation found -> thread updated
no open conversation -> new conversation created or logged
"3" -> urgent opportunity
STOP with OptOutType -> opted_out
invalid signature -> 403
```

Acceptance criteria:

- inbound reply cancels pending follow-ups;
- patient reply appears in UI.

---

### 6.4 Twilio message status webhook

Endpoint:

```txt
POST /api/webhooks/twilio/messaging/status
```

Test cases:

```txt
queued -> status updated
sent -> status updated
delivered -> delivered_at set
failed -> error_code stored
undelivered -> error_code stored
unknown MessageSid -> safely logged
```

Acceptance criteria:

- dashboard can count sent/delivered/failed messages;
- failed messages do not trigger infinite resend.

---

### 6.5 Stripe webhook

Endpoint:

```txt
POST /api/webhooks/stripe
```

Test cases:

```txt
checkout.session.completed -> subscription created/updated
customer.subscription.created -> status trialing
invoice.paid -> active
invoice.payment_failed -> past_due
customer.subscription.deleted -> subscription.status=canceled and clinic.status=cancelled
same event id twice -> processed once
invalid signature -> 400/403
```

Acceptance criteria:

- billing state gates clinic usage;
- event processing is idempotent.

---

## 7. UI tests

### 7.1 Signup/login

Cases:

```txt
owner can create account
owner can log in
invalid login shows error
logged-out user cannot access app routes
```

Acceptance criteria:

- authenticated app shell works;
- user is linked to clinic.

---

### 7.2 Onboarding/settings

Cases:

```txt
owner can enter clinic name
owner can enter main phone
owner can enter business hours
owner can enter emergency instruction
owner can see setup status
owner cannot start trial before activation_ready
```

Acceptance criteria:

- saved settings affect SMS templates and business-hour logic.

---

### 7.3 Recovery Inbox

Cases:

```txt
open conversations visible
urgent conversations sorted first
conversation shows last message
status badge visible
empty state visible when no conversations
```

Acceptance criteria:

- front desk can identify what needs action within 10 seconds.

---

### 7.4 Opportunity detail

Cases:

```txt
message history visible
call history visible
intent visible
urgency visible
follow-up status visible
mark booked works
mark lost works
add note works
```

Acceptance criteria:

- manual outcome updates dashboard.

---

### 7.5 Dashboard

Cases:

```txt
missed calls count updates
SMS sent count updates
reply rate updates
urgent count updates
booked count updates
estimated recovered revenue updates
```

Acceptance criteria:

- owner sees business value, not only message activity.

---

### 7.6 Admin/concierge panel

Cases:

```txt
admin can see all clinics
admin can update clinic setup status
admin can record A2P status
admin can mark QA passed
admin can move clinic to activation_ready
admin can pause/resume automation
```

Acceptance criteria:

- first clinics can be onboarded manually without database edits.

---

## 8. End-to-end test scenarios

### E2E 1 — Happy path: missed call to booked appointment

Steps:

```txt
1. Test phone calls clinic main number.
2. Clinic does not answer.
3. Call forwards to recovery number.
4. App creates missed_call.
5. First SMS sends.
6. Test phone replies "1".
7. Inbox shows new_patient conversation.
8. Front desk opens detail page.
9. Front desk marks booked.
10. Dashboard booked count increments.
```

Pass criteria:

- no duplicate records;
- SMS delivered or at least sent;
- reply attached to correct conversation;
- opportunity status = booked/recovered.

---

### E2E 2 — Urgent patient

Steps:

```txt
1. Missed call occurs.
2. First SMS sends.
3. Patient replies "I have severe tooth pain".
4. System classifies urgent_tooth_pain.
5. Inbox sorts conversation at top.
6. Urgent badge visible.
7. Follow-ups are canceled.
```

Pass criteria:

- urgent flag is set;
- front desk can identify urgency clearly.

---

### E2E 3 — No reply follow-up

Steps:

```txt
1. Missed call occurs.
2. First SMS sends.
3. No inbound reply.
4. Follow-up 1 sends after configured delay.
5. Follow-up 2 schedules for next business day.
```

Pass criteria:

- no more than configured max messages;
- follow-up respects business hours;
- no follow-up after manual close.

---

### E2E 4 — Opt-out

Steps:

```txt
1. Missed call occurs.
2. First SMS sends.
3. Patient replies STOP.
4. App stores opt-out.
5. Follow-ups cancel.
6. Attempted future automated SMS is blocked.
```

Pass criteria:

- no app-generated duplicate confirmation if provider already sent one;
- patient consent status visible in UI.

---

### E2E 5 — Callback bridge

Steps:

```txt
1. Missed call occurs.
2. First SMS sends.
3. Patient calls recovery number back.
4. App detects callback.
5. TwiML Dial bridges to clinic.
6. Call status updates opportunity.
```

Pass criteria:

- callback does not create duplicate missed-call incident;
- call status events visible.

---

### E2E 6 — Billing activation gate

Steps:

```txt
1. Clinic signs up.
2. Clinic status = signup_started, then moves through setup statuses until activation_ready.
3. Owner tries to start trial.
4. App blocks trial start.
5. Admin completes QA.
6. Admin sets activation_ready.
7. Owner starts Stripe trial.
8. Subscription status = trialing.
```

Pass criteria:

- trial does not start before activation;
- Stripe event updates local subscription.

---

## 9. Failure tests

### 9.1 Duplicate Twilio webhook

Send same voice webhook twice.

Expected:

```txt
one calls row
one missed_calls row
no duplicate first SMS
```

---

### 9.2 SMS provider failure

Simulate message status:

```txt
failed
undelivered
```

Expected:

```txt
message status updated
error code stored
opportunity shows warning
no infinite retry loop
```

---

### 9.3 Unknown clinic number

Send webhook to a number not assigned to any clinic.

Expected:

```txt
safe response
admin alert/log
no crash
```

---

### 9.4 Invalid signatures

Send Twilio/Stripe webhook with invalid signature.

Expected:

```txt
reject request
no database write
log security event
```

---

### 9.5 Database outage or slow query

Simulate DB error.

Expected:

```txt
webhook handles error safely
provider receives appropriate response
alert is created
no partial duplicate records if retried
```

---

## 10. Production readiness checklist

Before first live clinic:

```txt
[ ] All migrations applied cleanly
[ ] RLS policies tested
[ ] Twilio signatures validated
[ ] Stripe signatures validated
[ ] Webhook idempotency tested
[ ] First SMS tested from real phone
[ ] Inbound SMS tested from real phone
[ ] STOP tested from real phone
[ ] Callback bridge tested
[ ] Dashboard metrics verified
[ ] Admin activation workflow tested
[ ] Error logging enabled
[ ] Secrets stored outside repo
[ ] Production webhook URLs configured
[ ] Backup/restore plan documented
[ ] Support/admin access limited
```

---

## 11. Test data seed

Recommended seed data:

```txt
Clinic A: Smile Dental Austin
Clinic B: Lakeside Family Dental
Owner user for Clinic A
Front desk user for Clinic A
Admin user
One recovery number per clinic
Default templates
Default automations
Sample patient
Sample missed call
Sample conversation
Sample booked opportunity
Sample urgent opportunity
```

Purpose:

- test clinic isolation;
- test dashboard metrics;
- test inbox states;
- test admin panel.

---

## 12. Acceptance criteria for test plan completion

This test plan is complete when:

- AI agent has automated unit tests for core domain logic;
- webhook integration tests exist with sample payloads;
- staging can run live Twilio tests;
- Stripe test mode is validated;
- QA checklist is executable by non-developer founder/operator;
- first clinic can be onboarded without ad-hoc database edits.
