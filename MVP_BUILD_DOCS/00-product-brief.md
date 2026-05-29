# 00 — Product Brief

Project: Missed-call recovery SaaS for small dental clinics  
Version: MVP v1  
Audience: AI coding agent / technical implementer  
Status: Final reviewed build-spec file

---

## 1. One-line positioning

> Turn missed calls into booked dental appointments automatically.

This product helps small dental clinics recover appointment opportunities from calls they failed to answer.

---

## 2. Product summary

We are building a narrow SaaS product for independent small dental clinics. The product detects when a clinic misses a patient call, sends an automatic SMS from a recovery number, qualifies the patient's need, and hands the conversation to the front desk.

The product should behave like a safety net for missed calls, not like a replacement phone system.

The clinic's main public phone number stays the same. The clinic configures no-answer / busy call forwarding to a Twilio recovery number. When a forwarded call reaches the recovery number, the backend creates a missed-call incident, sends SMS, tracks the conversation, and shows the opportunity in the app.

---

## 3. Target customer

Primary ICP:

- small independent dental clinics in the United States;
- 1–3 dentists;
- small front desk team;
- meaningful number of new-patient calls;
- owner cares about lost marketing spend and missed appointment opportunities;
- no internal IT team;
- currently not ready to buy a large all-in-one platform.

The clinic must be able to configure one of these:

- no-answer call forwarding;
- busy call forwarding;
- provider-assisted forwarding to the recovery number.

---

## 4. User roles

### Clinic owner

Primary buyer and admin.

Responsibilities:

- creates clinic account;
- enters clinic settings;
- connects billing;
- reviews dashboard metrics;
- cares about recovered appointment revenue.

### Front desk user

Daily operator.

Responsibilities:

- watches the recovery inbox;
- responds to patient opportunities;
- calls/texts patients when needed;
- marks opportunities as booked, lost, contacted, or follow-up needed.

### Patient

External person calling the clinic.

Responsibilities:

- calls the clinic;
- receives SMS if the call is missed;
- replies with need/intent;
- may call back through the recovery number.

### Platform admin / concierge operator

Internal operator for early pilots.

Responsibilities:

- creates or verifies clinic setup;
- manages Twilio numbers and messaging services;
- tracks A2P/compliance status manually;
- helps with call forwarding setup;
- performs activation QA;
- starts trial only after the clinic is live.

---

## 5. Core MVP promise

The MVP should deliver three concrete outcomes:

1. The clinic no longer loses every missed call silently.
2. The patient receives a fast, clear, dental-specific SMS after a missed call.
3. The owner can see how many missed calls turned into appointment opportunities and booked appointments.

---

## 6. Core workflow

```text
Patient calls clinic main number
        ↓
Clinic does not answer / line is busy
        ↓
Phone provider forwards call to Twilio recovery number
        ↓
Backend receives Twilio voice webhook
        ↓
Backend creates call + missed_call incident
        ↓
Backend sends automatic SMS
        ↓
Patient replies or calls back
        ↓
System classifies intent/urgency
        ↓
Front desk handles conversation in recovery inbox
        ↓
Front desk manually marks booked/lost
        ↓
Dashboard shows recovered opportunities and revenue estimate
```

---

## 7. What makes this dental-specific

This should not be a generic missed-call text-back tool with a dental logo.

Dental-specific behavior comes from:

- intent categories:
  - new patient;
  - existing patient;
  - tooth pain / urgent;
  - cleaning;
  - appointment request;
  - reschedule;
- urgent prioritization for pain/emergency-like replies;
- front desk handoff rather than generic chat;
- recovered appointment tracking rather than message counting;
- careful message content that avoids diagnosis or treatment advice.

---

## 8. In-scope MVP features

### Clinic setup

- clinic account;
- clinic name;
- timezone;
- main clinic phone number;
- recovery phone number;
- callback destination number;
- business hours;
- emergency instruction text;
- average recovered appointment value;
- default SMS templates.

### Twilio voice

- one recovery number per clinic;
- inbound voice webhook;
- call record creation;
- missed-call incident creation;
- simple TwiML response for forwarded missed calls;
- callback bridge to clinic for patient callbacks;
- call status tracking.

### SMS automation

- first SMS after missed call;
- inbound SMS handling;
- message status tracking;
- deterministic intent detection;
- urgency detection;
- follow-up SMS rules;
- opt-out handling.

### Recovery inbox

- list open missed-call conversations;
- sort urgent items first;
- show patient phone, intent, urgency, last message, status, and time since call;
- open conversation detail;
- mark contacted;
- mark booked;
- mark lost;
- add internal note;
- pause automation.

### Dashboard

- missed calls;
- SMS sent;
- replies;
- callbacks;
- urgent incidents;
- appointment opportunities;
- booked/recovered appointments;
- estimated recovered revenue.

### Billing

- Stripe Checkout;
- Stripe Customer Portal;
- subscription status;
- trial starts only after live activation, not immediately after signup.

### Admin / concierge operations

- internal view of clinics;
- setup status;
- A2P/compliance status as a manual field in v1;
- activation checklist;
- test SMS;
- test call/callback notes;
- manual go-live control.

---

## 9. Out of scope for MVP

Do not build these in v1:

- AI receptionist;
- voice bot;
- automated phone answering;
- full dental CRM;
- PMS integration;
- automatic appointment booking inside Dentrix/Open Dental/etc.;
- number porting;
- hosted SMS as default;
- call recording;
- transcription;
- diagnosis or medical advice;
- insurance verification;
- payments from patients;
- multi-location enterprise hierarchy;
- WhatsApp;
- email campaigns;
- reputation management;
- marketing automation suite.

---

## 10. Product principles

### Narrow beats broad

The MVP wins by being focused on one painful workflow, not by being a mini-Weave or mini-NexHealth.

### Revenue recovery, not texting

The product should report appointment opportunities and booked appointments, not just message volume.

### Manual before automated

For the first clinics, manual onboarding, manual A2P tracking, manual QA, and manual booking confirmation are acceptable.

### No PHI-heavy features in v1

Avoid call recording, transcription, diagnosis, treatment advice, and detailed symptom collection.

### One clinic, one recovery number

For v1, assume each clinic has one recovery number and one recovery inbox.

---

## 11. MVP success metrics

The app should track these owner-facing metrics:

- missed calls;
- recovery SMS sent;
- first SMS latency;
- reply rate;
- callback rate;
- urgent incidents;
- appointment opportunities;
- booked appointments;
- recovered revenue estimate;
- median time to first front desk action.

---

## 12. Suggested pricing assumption

Initial pricing assumption for product design:

```text
$99–199/month per clinic
21-day free trial starts after live activation
```

Do not hard-code this pricing. The billing system should support configurable Stripe prices.

---

## 13. Activation model

A clinic should not start its free trial immediately after signup.

Recommended status flow:

```text
signup_started
        ↓
profile_incomplete
        ↓
setup_in_progress
        ↓
a2p_pending
        ↓
forwarding_pending
        ↓
qa_pending
        ↓
activation_ready
        ↓
trialing
        ↓
active
```

`past_due`, `paused`, and `cancelled` are post-activation lifecycle states.

The trial should begin only after:

- recovery number is assigned;
- messaging setup is ready;
- forwarding has been tested;
- live missed-call test works;
- live SMS test works;
- clinic is marked `activation_ready` by admin or setup flow.

---

## 14. High-risk assumptions

The AI coding agent should be aware of these product/technical risks:

1. Some phone carriers may not send `ForwardedFrom` reliably.
2. Differentiating forwarded missed calls from patient callbacks requires conversation-history heuristics.
3. SMS compliance/A2P onboarding may delay activation.
4. Front desk may forget to mark booked/lost, so the app should support manual admin cleanup.
5. If the product expands into AI receptionist or PMS sync too early, MVP scope becomes too large.

---

## 15. Definition of done for product scope

The MVP product scope is implemented when:

- a clinic can be configured;
- a forwarded missed call creates an incident;
- the patient receives SMS;
- the patient can reply;
- the reply appears in inbox;
- urgent replies are prioritized;
- front desk can mark booked/lost;
- owner can see recovered opportunity metrics;
- Stripe subscription state exists;
- admin can manage early clinic activation.
