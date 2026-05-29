# 08 — Compliance and Onboarding

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1  
Stage: 5 — Compliance and Onboarding  
Primary audience: AI coding agent, founder, ops lead, implementation specialist

---

## 1. Purpose of this file

This file defines the operational and compliance-aware onboarding process for the MVP.

It is not legal advice. Before production launch with real clinics, the team should verify the latest requirements with Twilio, Stripe, legal counsel, and the clinic's own compliance advisors.

The goal is to prevent the developer from treating onboarding as a simple signup form. For this MVP, onboarding includes:

- clinic account setup;
- phone routing setup;
- Twilio recovery number setup;
- Messaging Service setup;
- A2P / messaging registration workflow;
- opt-out configuration;
- live test call;
- live test SMS;
- manual activation;
- trial start only after activation.

The MVP should launch early clinics concierge-style. Do not over-automate this process until the first 5–10 clinics are live and the failure patterns are understood.

---

## 2. Key operating principles

### Principle 1 — Recovery layer, not phone replacement

The clinic keeps its existing public phone number. The app provides a separate recovery number.

The clinic should configure:

```txt
no-answer forwarding -> recovery number
busy forwarding -> recovery number
```

Do not configure unconditional forwarding as the default, because that bypasses the front desk and turns the product into a phone replacement.

---

### Principle 2 — Activation happens after real tests

A clinic is not live just because it has signed up.

A clinic becomes live only after:

- recovery number exists;
- webhooks are configured;
- messaging compliance path is ready;
- forwarding is configured;
- test missed call succeeds;
- test SMS succeeds;
- test callback bridge succeeds;
- front desk knows how to handle inbox items;
- owner understands that booked/lost is manually marked in the MVP.

---

### Principle 3 — Trial starts on activation, not signup

The 21-day free trial should start only when the clinic is `activation_ready`, not when the owner creates an account.

Reason: messaging setup and A2P review may take time. A clinic should not lose trial days while waiting for operational activation.

Recommended statuses:

```txt
signup_started
profile_incomplete
setup_in_progress
a2p_pending
forwarding_pending
qa_pending
activation_ready
trialing
active
past_due
paused
cancelled
```

---

### Principle 4 — Keep SMS content operational

The MVP should not ask for diagnosis, insurance details, treatment plans, x-rays, prescriptions, or detailed symptoms.

Allowed SMS content:

- missed-call acknowledgement;
- appointment request;
- callback coordination;
- new/existing patient routing;
- cleaning request;
- reschedule request;
- urgency label such as tooth pain / urgent;
- safe emergency instruction.

Avoid:

- diagnosis;
- treatment advice;
- detailed medical history;
- insurance/payment details;
- attachments/media;
- call recording/transcription.

---

## 3. Onboarding statuses

### `signup_started`

Initial state after owner account/signup starts but before usable clinic setup exists.

Allowed actions:

- create account;
- start onboarding;
- enter first clinic basics.

Blocked actions:

- start trial;
- send patient SMS;
- activate automation.

---

### `profile_incomplete`

Meaning:

Required business or communication information is missing.

Common missing fields:

- clinic legal/business name;
- public practice name;
- main clinic phone;
- callback destination phone;
- timezone;
- business hours;
- emergency phone/instruction;
- owner/admin contact;
- website URL;
- privacy policy URL;
- terms URL.

Blocked actions:

- start trial;
- send production SMS;
- activate automation.

---

### `setup_in_progress`

Meaning:

Required profile data exists and operational setup has started, but Twilio/admin setup is not complete.

Allowed actions:

- edit clinic settings;
- admin can assign/configure recovery number;
- prepare A2P/compliance packet;
- prepare forwarding instructions.

Blocked actions:

- start trial;
- send production SMS;
- activate automation.

---

### `a2p_pending`

Meaning:

Messaging registration or approval is not ready.

Allowed actions:

- test voice webhook internally;
- edit settings;
- view setup checklist.

Blocked actions:

- send real patient recovery SMS;
- start trial;
- mark clinic live.

---

### `forwarding_pending`

Meaning:

Recovery number exists, but clinic has not configured no-answer/busy forwarding yet.

Allowed actions:

- show forwarding instructions;
- run manual call test;
- edit callback destination.

Blocked actions:

- production activation.

---

### `qa_pending`

Meaning:

Forwarding appears configured, but live QA has not passed.

QA requirements:

- test missed call reaches recovery number;
- app creates call record;
- app creates missed call incident;
- first SMS is sent;
- inbound SMS reply appears in inbox;
- callback bridge can dial the clinic;
- mark booked/lost works.

---

### `activation_ready`

Meaning:

The clinic passed setup and QA. Owner can start trial.

Allowed actions:

- start Stripe Checkout trial;
- enable production automation;
- activate clinic.

---

### `trialing`

Meaning:

Clinic is live and trial is active.

Allowed actions:

- process real missed calls;
- send recovery SMS;
- use inbox;
- view dashboard;
- update billing.

---

### `active`

Meaning:

Subscription is active and paid.

---

### `past_due`

Meaning:

Subscription/payment requires attention.

Allowed:

- show billing warning;
- keep admin/owner access;
- preserve historical data.

Not allowed by default:

- continue automated outbound SMS unless founder explicitly chooses a grace-period policy.

---

### `paused`

Meaning:

Clinic exists but automation is disabled.

Use cases:

- payment issue;
- compliance issue;
- Twilio campaign issue;
- clinic requested temporary pause;
- support/debugging.

---

### `cancelled`

Meaning:

Clinic subscription/service is cancelled. Keep historical reporting accessible to owner/admin according to the product policy, but do not send automated patient SMS.

---

## 4. Data to collect during onboarding

### Clinic basics

```txt
clinic_name
practice_display_name
legal_business_name
website_url
privacy_policy_url
terms_url
timezone
default_locale
owner_name
owner_email
owner_phone
```

Notes:

- `practice_display_name` is used in SMS templates.
- `legal_business_name` is used for compliance/admin workflows.
- `website_url`, `privacy_policy_url`, and `terms_url` may be needed for messaging registration and patient communication transparency.

---

### Phone setup

```txt
main_phone_e164
callback_destination_e164
recovery_phone_e164
phone_provider_name
forwarding_setup_method
forwarding_status
```

Definitions:

- `main_phone_e164`: public clinic number patients call.
- `callback_destination_e164`: number used when the callback bridge dials the clinic.
- `recovery_phone_e164`: Twilio number assigned to this clinic.

For small clinics, `main_phone_e164` and `callback_destination_e164` are often the same.

---

### Business hours

Store as structured JSON:

```json
{
  "timezone": "America/Chicago",
  "weekly_hours": {
    "monday": [{ "open": "08:00", "close": "17:00" }],
    "tuesday": [{ "open": "08:00", "close": "17:00" }],
    "wednesday": [{ "open": "08:00", "close": "17:00" }],
    "thursday": [{ "open": "08:00", "close": "17:00" }],
    "friday": [{ "open": "08:00", "close": "15:00" }],
    "saturday": [],
    "sunday": []
  },
  "holidays": []
}
```

Used for:

- after-hours template;
- next business day follow-up;
- urgent alert expectations;
- dashboard grouping.

---

### Emergency instruction

Collect:

```txt
emergency_phone_e164
emergency_instruction_text
```

Default safe pattern:

```txt
If you have swelling, trauma, uncontrolled bleeding, or severe pain, call the office now at {main_phone}. If this is life-threatening, call 911.
```

The clinic should approve the wording.

---

### Communication settings

```txt
default_first_sms_template
followup_1_enabled
followup_2_enabled
first_sms_delay_sec
followup_1_delay_min
followup_2_send_time_local
max_automated_sms_per_incident
```

Recommended MVP defaults:

```txt
first_sms_delay_sec = 15
followup_1_delay_min = 15
followup_2_send_time_local = 09:00
max_automated_sms_per_incident = 3
```

---

## 5. Twilio setup checklist

For each clinic:

```txt
[ ] Buy/assign one local recovery number
[ ] Create or assign one Messaging Service for the clinic
[ ] Add recovery number to the Messaging Service
[ ] Configure inbound SMS webhook
[ ] Configure message status callback
[ ] Configure voice incoming webhook
[ ] Configure voice call-status callback
[ ] Enable/configure Advanced Opt-Out for the Messaging Service
[ ] Complete A2P/10DLC registration path as needed
[ ] Attach approved campaign/Messaging Service/number as required
[ ] Run live SMS test
[ ] Run live voice forwarding test
[ ] Run callback bridge test
```

Recommended webhook URLs:

```txt
POST https://app.example.com/api/webhooks/twilio/voice/incoming
POST https://app.example.com/api/webhooks/twilio/voice/call-status
POST https://app.example.com/api/webhooks/twilio/messaging/incoming
POST https://app.example.com/api/webhooks/twilio/messaging/status
```

All Twilio webhook endpoints must validate `X-Twilio-Signature`.

---

## 6. Messaging compliance checklist

Before sending real patient SMS:

```txt
[ ] Clinic has approved SMS templates
[ ] First SMS includes STOP opt-out language
[ ] STOP/START/HELP behavior is tested from a real phone
[ ] OptOutType is persisted when present
[ ] Patient opted-out state is stored locally
[ ] Future messages are blocked for opted-out patients
[ ] No PHI-heavy content in templates
[ ] No attachments/media in MVP
[ ] No diagnosis/treatment advice in automation
[ ] Clinic has reviewed consent/communication workflow
[ ] A2P/10DLC status is ready for production use
```

Implementation requirement:

If a patient sends a STOP-like message, the app should immediately:

- store inbound message;
- update patient consent status to `opted_out`;
- cancel open follow-ups;
- close or pause active automation for that patient;
- not send an extra app-generated confirmation if Twilio already handled it.

---

## 7. HIPAA/PHI-aware MVP boundaries

This product is for dental clinics, so assume healthcare privacy risk exists.

For MVP:

- do not record calls;
- do not transcribe calls;
- do not request images or x-rays;
- do not request insurance details;
- do not request detailed symptoms;
- do not generate clinical advice;
- do not store unnecessary patient information;
- redact message bodies in logs where possible;
- keep raw webhook payloads access-controlled;
- keep support access audited.

Recommended storage approach:

```txt
messages.body_redacted = safe display text or redacted version
messages.payload_json = raw provider payload, admin/support access only
```

If the business decides to process PHI in messaging workflows, the production system must have the appropriate business associate agreements, policies, and vendor eligibility checks in place.

---

## 8. Phone forwarding setup instructions

The product should show generic instructions first:

```txt
Ask your phone provider to forward unanswered calls and busy calls from your main clinic number to your recovery number: {recovery_phone}.
Do not enable unconditional forwarding unless instructed.
```

UI should support provider-specific notes:

```txt
provider_name
forwarding_notes
setup_completed_by
setup_completed_at
last_tested_at
```

Do not hard-code provider instructions into business logic. Keep them as editable admin content.

---

## 9. Live QA checklist

A clinic can move to `activation_ready` only after these tests pass.

### Test 1 — Recovery number direct call

```txt
[ ] Call recovery number directly from test phone
[ ] Voice webhook receives request
[ ] calls row is created
[ ] missed_calls row is created or expected behavior is documented
[ ] TwiML response is valid
```

### Test 2 — Forwarded missed call

```txt
[ ] Call clinic main number from test phone
[ ] Let call ring without answering
[ ] Call forwards to recovery number
[ ] App detects missed call
[ ] First SMS is queued/sent
[ ] No duplicate incident is created
```

### Test 3 — SMS reply

```txt
[ ] Reply "3" from test phone
[ ] Inbound SMS webhook receives reply
[ ] Message appears in thread
[ ] Conversation intent = urgent_tooth_pain
[ ] Conversation urgency = urgent
[ ] Follow-ups are canceled
```

### Test 4 — Callback bridge

```txt
[ ] Call recovery number from test phone after SMS
[ ] App detects likely callback
[ ] TwiML Dial bridges to clinic callback destination
[ ] Call-status webhook records initiated/ringing/answered/completed
[ ] Opportunity records callback attempt
```

### Test 5 — Manual outcome

```txt
[ ] Open inbox
[ ] Open opportunity detail
[ ] Mark booked
[ ] Dashboard booked count updates
[ ] Opportunity status = booked/recovered
```

### Test 6 — Opt-out

```txt
[ ] Send STOP from test phone
[ ] Patient consent_status = opted_out
[ ] Follow-ups canceled
[ ] Further automated SMS blocked
```

---

## 10. Activation checklist

Activation requires:

```txt
[ ] Clinic basics complete
[ ] Phone setup complete
[ ] Business hours complete
[ ] Emergency instruction approved
[ ] SMS templates approved
[ ] Recovery number assigned
[ ] Twilio webhooks configured
[ ] Messaging opt-out configured/tested
[ ] A2P/compliance path ready
[ ] Forwarding configured
[ ] Live missed-call test passed
[ ] Live SMS reply test passed
[ ] Callback bridge test passed
[ ] Front desk user invited
[ ] Owner understands manual booked/lost marking
[ ] Stripe trial checkout ready
```

Admin action:

```txt
clinic.status = activation_ready
```

Then owner can start trial.

---

## 11. Concierge pilot workflow

For the first 5–10 clinics, run this process manually.

### Day 0 — Signup/setup call

- collect clinic details;
- explain that this is not a phone system replacement;
- explain call forwarding;
- explain SMS opt-out;
- collect business hours and emergency instruction;
- confirm front desk owner.

### Day 1–15 — Messaging setup window

- complete Twilio/Messaging Service/A2P work;
- update clinic status;
- keep owner informed;
- do not start trial.

### Activation day

- configure forwarding with clinic;
- run live tests;
- enable production automation;
- move to `activation_ready`;
- start trial through Stripe.

### First week after go-live

Review daily:

- missed calls;
- first SMS latency;
- SMS delivery failures;
- patient replies;
- urgent incidents;
- booked/lost outcomes;
- front desk usage issues.

### End of first week

Run review with owner:

- how many calls were recovered;
- how many turned into appointments;
- whether SMS wording needs edits;
- whether urgent logic is working;
- whether front desk is marking outcomes.

---

## 12. Admin panel requirements for onboarding

The admin/concierge panel should show:

```txt
clinic name
clinic status
main phone
recovery phone
Messaging Service SID
A2P/campaign status manual field
forwarding status
QA status
trial status
last missed call test
last SMS test
last callback test
admin notes
```

Admin actions:

```txt
assign recovery number
update setup status
send test SMS
mark A2P pending/approved/rejected
mark forwarding configured
mark QA passed
move clinic to activation_ready
pause automation
resume automation
```

---

## 13. Failure modes and manual resolutions

### A2P rejected or delayed

Symptoms:

- clinic cannot send production SMS;
- status remains `a2p_pending`.

Manual resolution:

- review business info;
- review opt-in/out description;
- review message samples;
- resubmit or contact provider support;
- do not start trial.

---

### Forwarding does not work

Symptoms:

- calls to clinic main number never reach recovery number.

Manual resolution:

- verify recovery number;
- verify no-answer vs busy forwarding;
- ask provider to enable conditional forwarding;
- run direct call to recovery number;
- update admin notes.

---

### Duplicate missed calls

Symptoms:

- duplicate incidents for one real call.

Manual resolution:

- verify idempotency by `CallSid`;
- check retries;
- check if multiple calls actually occurred;
- merge/close duplicate incidents if needed.

---

### SMS undelivered

Symptoms:

- message status = `failed` or `undelivered`.

Manual resolution:

- show warning in opportunity detail;
- do not run infinite resend loop;
- allow one controlled retry if configured;
- create front desk action item.

---

### Front desk does not mark outcomes

Symptoms:

- opportunities remain open forever;
- dashboard underreports recovered revenue.

Manual resolution:

- add end-of-day open opportunities review;
- allow admin/owner to mark booked/lost manually;
- show stale opportunity warning.

---

## 14. Acceptance criteria for onboarding system

The onboarding system is complete when:

- clinic cannot start trial before activation readiness;
- admin can track each setup stage;
- clinic can see setup checklist;
- recovery number and forwarding status are visible;
- live QA results are recorded;
- SMS templates and emergency instruction are stored;
- opt-out test is documented;
- activation flips the clinic into a live-ready state;
- Stripe trial starts only after activation.
