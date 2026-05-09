# 03 — Database Schema

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1  
Stage: 2 — Database  
Primary audience: AI coding agent / technical founder

---

## 1. Purpose of this file

This file defines the database schema for the MVP.

The database must support the core recovery graph:

```txt
clinic
  -> phone number
  -> patient
  -> call
  -> missed call
  -> conversation
  -> messages
  -> appointment opportunity
  -> manual outcome
```

The system should not just store calls and texts. It must store the business object that matters:

> A missed-call recovery opportunity that may become a booked appointment.

---

## 2. Database principles

### 2.1 Multi-tenant from day one

Every clinic-facing table should be scoped by `clinic_id`.

Clinic users must not see other clinics' data.

---

### 2.2 Idempotency from day one

External providers retry webhooks.

Use unique constraints on:

- Twilio `CallSid`
- Twilio `MessageSid`
- Stripe `event.id`
- Stripe `subscription.id`
- clinic phone numbers

---

### 2.3 Store raw provider payloads

Store important raw payloads as `jsonb` for debugging:

- Twilio voice webhook payloads;
- Twilio SMS inbound payloads;
- Twilio status callback payloads;
- Stripe webhook payload summaries.

Do not over-normalize too early.

---

### 2.4 Separate provider state from product state

Provider state examples:

- Twilio call status;
- Twilio message status;
- Stripe subscription status.

Product state examples:

- missed call detected;
- conversation engaged;
- opportunity booked;
- follow-up cancelled.

Do not use Twilio status directly as the main product state.

---

### 2.5 Keep MVP healthcare data minimal

The app should not intentionally collect detailed medical information.

Avoid adding fields for:

- diagnosis;
- prescriptions;
- x-rays;
- medical records;
- insurance details;
- clinical notes.

The front desk can use the dental PMS for clinical and scheduling details.

---

## 3. Recommended extensions

Suggested Supabase/Postgres extensions:

```sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
```

Use `gen_random_uuid()` for UUID primary keys.

---

## 4. Enums

Use Postgres enums or text check constraints. Enums are cleaner but require migrations for changes. For fast MVP iteration, text + check constraints can be easier.

Recommended initial enums/check values are below.

### 4.1 user_role

```txt
owner
front_desk
admin
```

---

### 4.2 clinic_status

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

### 4.3 phone_number_purpose

```txt
main
recovery
callback_destination
emergency
```

---

### 4.4 call_detected_type

```txt
forwarded_missed_call
callback
unknown
```

---

### 4.5 missed_call_status

```txt
detected
sms_pending
sms_sent
engaged
callback_in_progress
handoff_pending
recovered
closed_lost
opted_out
spam
duplicate
error
```

---

### 4.6 conversation_state

```txt
open
waiting_for_patient
waiting_for_front_desk
paused
closed
opted_out
```

---

### 4.7 patient_intent

```txt
unknown
new_patient
existing_patient
urgent_tooth_pain
cleaning
appointment_request
reschedule
billing_question
other
```

MVP should support the first six well. `billing_question` and `other` are useful fallbacks.

---

### 4.8 urgency

```txt
unknown
normal
urgent
emergency_redirect
```

The app does not diagnose emergencies. It only flags potentially urgent dental issues and can show clinic-provided emergency instructions.

---

### 4.9 message_direction

```txt
inbound
outbound
system
```

---

### 4.10 message_channel

```txt
sms
voice
system
```

MVP mostly uses `sms`.

---

### 4.11 message_status

```txt
created
accepted
queued
sending
sent
delivered
undelivered
failed
received
skipped
cancelled
```

---

### 4.12 opportunity_status

```txt
open
contacted
booked
lost
spam
duplicate
cancelled
```

---

### 4.13 followup_status

```txt
pending
processing
sent
skipped
cancelled
failed
```

---

### 4.14 template_key

```txt
first_missed_call_a
first_missed_call_b
new_patient
existing_patient
urgent_tooth_pain
cleaning_request
appointment_request
reschedule
no_reply_15m
next_day_followup
after_hours
media_received
opted_out_internal_only
help
opt_out_confirmation
```

---

### 4.15 subscription_status

```txt
incomplete
trialing
active
past_due
canceled
unpaid
paused
none
```

---

## 5. Tables overview

| Table | Purpose |
|---|---|
| `clinics` | One dental clinic/customer. |
| `profiles` | App user profile linked to Supabase Auth user. |
| `clinic_memberships` | Allows users to belong to clinics with roles. |
| `phone_numbers` | Main/recovery/callback/emergency phone numbers and Twilio metadata. |
| `patients` | Lightweight patient/contact record by phone number. |
| `calls` | Twilio voice call records. |
| `missed_calls` | Product-level missed-call incidents. |
| `conversations` | SMS recovery conversation per patient/incident. |
| `messages` | Inbound/outbound SMS/system messages. |
| `appointment_opportunities` | Business object representing possible recovered appointment. |
| `followups` | Durable scheduled SMS jobs. |
| `templates` | SMS templates. |
| `automations` | Clinic-level automation settings. |
| `subscriptions` | Stripe subscription state. |
| `webhook_events` | Idempotency and debugging for provider webhooks. |
| `audit_logs` | Product/admin/user action trail. |

---

## 6. Table: clinics

### Purpose

Stores one dental clinic/customer.

### Fields

```txt
id uuid primary key default gen_random_uuid()
name text not null
legal_business_name text null
website_url text null
main_phone_e164 text null
recovery_phone_e164 text null
callback_phone_e164 text null
timezone text not null default 'America/Chicago'
default_locale text not null default 'en'
business_hours_json jsonb not null default '{}'
emergency_phone_e164 text null
emergency_instruction text null
avg_recovered_value_cents integer not null default 30000
status text not null default 'signup_started'
activation_ready_at timestamptz null
activated_at timestamptz null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
check (status in (
  'signup_started',
  'profile_incomplete',
  'setup_in_progress',
  'a2p_pending',
  'forwarding_pending',
  'qa_pending',
  'activation_ready',
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled'
))
```

### Indexes

```sql
create index clinics_status_idx on clinics(status);
create index clinics_main_phone_idx on clinics(main_phone_e164);
create index clinics_recovery_phone_idx on clinics(recovery_phone_e164);
```

### Notes

- `main_phone_e164` is the clinic's existing public number.
- `recovery_phone_e164` is the Twilio number used by the app.
- `callback_phone_e164` is where callback bridge dials. Usually same as main phone, but keep separate for flexibility.
- `business_hours_json` should use a predictable structure described below.

### Suggested business_hours_json

```json
{
  "monday": { "open": "09:00", "close": "17:00", "closed": false },
  "tuesday": { "open": "09:00", "close": "17:00", "closed": false },
  "wednesday": { "open": "09:00", "close": "17:00", "closed": false },
  "thursday": { "open": "09:00", "close": "17:00", "closed": false },
  "friday": { "open": "09:00", "close": "15:00", "closed": false },
  "saturday": { "closed": true },
  "sunday": { "closed": true }
}
```

---

## 7. Table: profiles

### Purpose

Stores app-level profile for each authenticated user.

### Fields

```txt
id uuid primary key references auth.users(id) on delete cascade
email text not null
name text null
phone_e164 text null
is_internal_admin boolean not null default false
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Indexes

```sql
create unique index profiles_email_unique_idx on profiles(lower(email));
```

### Notes

`profiles.id` should equal Supabase Auth user ID.

---

## 8. Table: clinic_memberships

### Purpose

Maps users to clinics and roles.

Even if MVP starts with one clinic per user, this table prevents rework later.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
profile_id uuid not null references profiles(id) on delete cascade
role text not null default 'front_desk'
active boolean not null default true
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
check (role in ('owner', 'front_desk', 'admin'))
unique (clinic_id, profile_id)
```

### Indexes

```sql
create index clinic_memberships_profile_idx on clinic_memberships(profile_id);
create index clinic_memberships_clinic_idx on clinic_memberships(clinic_id);
```

---

## 9. Table: phone_numbers

### Purpose

Stores clinic phone numbers and Twilio configuration metadata.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
e164 text not null
purpose text not null
label text null
twilio_phone_number_sid text null
twilio_messaging_service_sid text null
twilio_a2p_brand_sid text null
twilio_a2p_campaign_sid text null
is_active boolean not null default true
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
check (purpose in ('main', 'recovery', 'callback_destination', 'emergency'))
unique (clinic_id, e164, purpose)
```

### Indexes

```sql
create index phone_numbers_clinic_idx on phone_numbers(clinic_id);
create index phone_numbers_purpose_idx on phone_numbers(clinic_id, purpose);
create index phone_numbers_messaging_service_idx on phone_numbers(twilio_messaging_service_sid);
create unique index phone_numbers_active_recovery_e164_unique_idx
  on phone_numbers(e164)
  where purpose = 'recovery' and is_active = true;
```

### Notes

- MVP uses one recovery number per clinic.
- The recovery number should normally have a Twilio phone number SID and Messaging Service SID.
- Main/callback/emergency numbers may not be Twilio numbers.
- Main and callback destination may be the same phone number; do not enforce global uniqueness for every phone number purpose.
- The recovery number must be globally unique while active, enforced by a partial unique index.

---

## 10. Table: patients

### Purpose

Stores a lightweight patient/contact record by phone number within a clinic.

This is not a dental CRM patient profile.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
phone_e164 text not null
first_name text null
last_name text null
is_existing_patient boolean null
preferred_locale text not null default 'en'
consent_status text not null default 'unknown'
opted_out_at timestamptz null
last_seen_at timestamptz null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
unique (clinic_id, phone_e164)
check (consent_status in ('unknown', 'implied', 'confirmed', 'opted_out'))
```

### Indexes

```sql
create index patients_clinic_phone_idx on patients(clinic_id, phone_e164);
create index patients_opted_out_idx on patients(clinic_id, opted_out_at);
```

### Notes

`consent_status` should be conservative. For MVP, outbound SMS is triggered by a patient call to the clinic and should remain informational/transactional in nature.

---

## 11. Table: calls

### Purpose

Stores Twilio voice call events.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
patient_id uuid null references patients(id) on delete set null
twilio_call_sid text not null
parent_call_sid text null
from_e164 text not null
to_e164 text not null
forwarded_from_e164 text null
direction text null
raw_status text null
detected_type text not null default 'unknown'
started_at timestamptz not null default now()
ended_at timestamptz null
duration_sec integer null
payload_json jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
unique (twilio_call_sid)
check (detected_type in ('forwarded_missed_call', 'callback', 'unknown'))
```

### Indexes

```sql
create index calls_clinic_from_started_idx on calls(clinic_id, from_e164, started_at desc);
create index calls_patient_idx on calls(patient_id);
create index calls_parent_call_sid_idx on calls(parent_call_sid);
create index calls_detected_type_idx on calls(clinic_id, detected_type, started_at desc);
```

### Notes

- One row per Twilio `CallSid`.
- Parent and child calls from `<Dial>` can be linked using `parent_call_sid` where available.
- `payload_json` stores normalized form payload.

---

## 12. Table: missed_calls

### Purpose

Stores product-level missed-call incidents.

A missed call is not just a raw call. It is the incident that starts the recovery workflow.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
call_id uuid not null references calls(id) on delete cascade
patient_id uuid null references patients(id) on delete set null
status text not null default 'detected'
detected_at timestamptz not null default now()
sms_first_scheduled_at timestamptz null
sms_first_sent_at timestamptz null
callback_started_at timestamptz null
callback_answered_at timestamptz null
handed_off_at timestamptz null
closed_at timestamptz null
close_reason text null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
unique (call_id)
check (status in (
  'detected',
  'sms_pending',
  'sms_sent',
  'engaged',
  'callback_in_progress',
  'handoff_pending',
  'recovered',
  'closed_lost',
  'opted_out',
  'spam',
  'duplicate',
  'error'
))
```

### Indexes

```sql
create index missed_calls_clinic_status_detected_idx on missed_calls(clinic_id, status, detected_at desc);
create index missed_calls_patient_idx on missed_calls(patient_id);
```

### Notes

The status here is product state, not Twilio call status.

---

## 13. Table: conversations

### Purpose

Stores a recovery conversation between the clinic and the patient.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
patient_id uuid not null references patients(id) on delete cascade
open_missed_call_id uuid null references missed_calls(id) on delete set null
state text not null default 'open'
intent text not null default 'unknown'
urgency text not null default 'unknown'
assigned_to_profile_id uuid null references profiles(id) on delete set null
last_message_at timestamptz null
last_patient_reply_at timestamptz null
last_front_desk_action_at timestamptz null
automation_paused boolean not null default false
closed_at timestamptz null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
check (state in ('open', 'waiting_for_patient', 'waiting_for_front_desk', 'paused', 'closed', 'opted_out'))
check (intent in ('unknown', 'new_patient', 'existing_patient', 'urgent_tooth_pain', 'cleaning', 'appointment_request', 'reschedule', 'billing_question', 'other'))
check (urgency in ('unknown', 'normal', 'urgent', 'emergency_redirect'))
```

### Indexes

```sql
create index conversations_clinic_state_last_idx on conversations(clinic_id, state, last_message_at desc);
create index conversations_patient_idx on conversations(patient_id);
create index conversations_open_missed_call_idx on conversations(open_missed_call_id);
create index conversations_urgency_idx on conversations(clinic_id, urgency, last_message_at desc);
```

### Notes

For MVP, a patient may have multiple historical conversations but only one active/open conversation should usually exist per clinic/patient.

Optional partial unique index:

```sql
create unique index conversations_one_open_per_patient_idx
on conversations(clinic_id, patient_id)
where state in ('open', 'waiting_for_patient', 'waiting_for_front_desk', 'paused');
```

Use with caution if multiple incidents per patient are expected.

---

## 14. Table: messages

### Purpose

Stores inbound and outbound SMS/system messages.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
conversation_id uuid null references conversations(id) on delete set null
patient_id uuid null references patients(id) on delete set null
missed_call_id uuid null references missed_calls(id) on delete set null
twilio_message_sid text null
direction text not null
channel text not null default 'sms'
template_key text null
template_version integer null
ab_variant text null
body_redacted text not null
status text not null default 'created'
error_code text null
error_message text null
sent_at timestamptz null
delivered_at timestamptz null
received_at timestamptz null
payload_json jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
unique (twilio_message_sid)
check (direction in ('inbound', 'outbound', 'system'))
check (channel in ('sms', 'voice', 'system'))
check (status in ('created', 'accepted', 'queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'received', 'skipped', 'cancelled'))
```

Important:

Postgres unique constraints allow multiple `NULL` values. This is fine because some system/skipped messages may not have Twilio SIDs.

### Indexes

```sql
create index messages_conversation_created_idx on messages(conversation_id, created_at asc);
create index messages_clinic_status_sent_idx on messages(clinic_id, status, sent_at desc);
create index messages_patient_idx on messages(patient_id);
create index messages_missed_call_idx on messages(missed_call_id);
```

### Notes

- `body_redacted` stores the message body. Name it redacted to remind developers not to store sensitive content unnecessarily.
- For MVP, full body may be stored, but product copy should avoid collecting clinical details.

---

## 15. Table: appointment_opportunities

### Purpose

Stores the business opportunity created from a missed call.

This table powers the owner dashboard.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
patient_id uuid null references patients(id) on delete set null
missed_call_id uuid null references missed_calls(id) on delete set null
conversation_id uuid null references conversations(id) on delete set null
intent text not null default 'unknown'
urgency text not null default 'unknown'
status text not null default 'open'
estimated_value_cents integer not null default 30000
booked_value_cents integer null
booked_at timestamptz null
lost_at timestamptz null
loss_reason text null
front_desk_notes text null
created_by_profile_id uuid null references profiles(id) on delete set null
closed_by_profile_id uuid null references profiles(id) on delete set null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
check (intent in ('unknown', 'new_patient', 'existing_patient', 'urgent_tooth_pain', 'cleaning', 'appointment_request', 'reschedule', 'billing_question', 'other'))
check (urgency in ('unknown', 'normal', 'urgent', 'emergency_redirect'))
check (status in ('open', 'contacted', 'booked', 'lost', 'spam', 'duplicate', 'cancelled'))
```

### Indexes

```sql
create index opportunities_clinic_status_created_idx on appointment_opportunities(clinic_id, status, created_at desc);
create index opportunities_clinic_booked_idx on appointment_opportunities(clinic_id, booked_at desc);
create index opportunities_patient_idx on appointment_opportunities(patient_id);
create index opportunities_missed_call_idx on appointment_opportunities(missed_call_id);
```

### Notes

A missed call should usually create one opportunity, but keep flexibility for manual correction.

Optional unique index:

```sql
create unique index opportunities_one_per_missed_call_idx
on appointment_opportunities(missed_call_id)
where missed_call_id is not null;
```

---

## 16. Table: followups

### Purpose

Stores scheduled follow-up jobs.

This is the MVP durable queue.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
missed_call_id uuid not null references missed_calls(id) on delete cascade
conversation_id uuid null references conversations(id) on delete set null
step_key text not null
scheduled_for timestamptz not null
sent_message_id uuid null references messages(id) on delete set null
job_status text not null default 'pending'
last_error text null
attempt_count integer not null default 0
locked_at timestamptz null
processed_at timestamptz null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
check (job_status in ('pending', 'processing', 'sent', 'skipped', 'cancelled', 'failed'))
unique (missed_call_id, step_key)
```

### Indexes

```sql
create index followups_due_idx on followups(job_status, scheduled_for);
create index followups_clinic_idx on followups(clinic_id, scheduled_for);
create index followups_missed_call_idx on followups(missed_call_id);
```

### Suggested step_key values

```txt
first_sms
followup_15m
followup_next_business_day
resend_if_undelivered
```

---

## 17. Table: templates

### Purpose

Stores SMS templates.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid null references clinics(id) on delete cascade
key text not null
locale text not null default 'en'
channel text not null default 'sms'
ab_variant text not null default 'default'
body text not null
active boolean not null default true
version integer not null default 1
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
check (channel in ('sms'))
-- For clinic-specific templates, enforce uniqueness with a partial unique index.
-- For global templates where clinic_id is null, use a separate partial unique index.
-- Do not rely on a simple unique(clinic_id, ...) constraint because Postgres treats NULL values as distinct.
```

### Indexes

```sql
create index templates_lookup_idx on templates(clinic_id, key, locale, active);
create unique index templates_clinic_unique_idx
  on templates(clinic_id, key, locale, channel, ab_variant, version)
  where clinic_id is not null;
create unique index templates_global_unique_idx
  on templates(key, locale, channel, ab_variant, version)
  where clinic_id is null;
```

### Notes

`clinic_id` can be null for global default templates.

Lookup logic:

1. Find active clinic-specific template.
2. Else use active global default template.

---

## 18. Table: automations

### Purpose

Stores clinic-level automation settings.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
enabled boolean not null default true
after_hours_enabled boolean not null default true
first_sms_delay_sec integer not null default 15
followup_1_delay_min integer not null default 15
followup_2_time_local text not null default '09:00'
followup_2_business_days_after integer not null default 1
callback_timeout_sec integer not null default 15
max_automated_sms_per_incident integer not null default 3
urgent_auto_reply_enabled boolean not null default true
normal_intent_auto_reply_enabled boolean not null default false
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
unique (clinic_id)
check (first_sms_delay_sec >= 0 and first_sms_delay_sec <= 300)
check (followup_1_delay_min >= 1 and followup_1_delay_min <= 1440)
check (callback_timeout_sec >= 5 and callback_timeout_sec <= 60)
check (max_automated_sms_per_incident >= 1 and max_automated_sms_per_incident <= 5)
```

---

## 19. Table: subscriptions

### Purpose

Stores local Stripe subscription state.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid not null references clinics(id) on delete cascade
stripe_customer_id text null
stripe_subscription_id text null
stripe_price_id text null
status text not null default 'none'
trial_start_at timestamptz null
trial_end_at timestamptz null
current_period_start_at timestamptz null
current_period_end_at timestamptz null
cancel_at_period_end boolean not null default false
cancelled_at timestamptz null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Constraints

```sql
unique (clinic_id)
unique (stripe_subscription_id)
check (status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'none'))
```

### Indexes

```sql
create index subscriptions_stripe_customer_idx on subscriptions(stripe_customer_id);
create index subscriptions_status_idx on subscriptions(status);
```

### Notes

Do not allow trial to start before clinic status is `activation_ready`.

Note: Stripe uses the American spelling `canceled` for subscription status. The clinic lifecycle uses `cancelled` elsewhere in these docs. Keep this mapping explicit in code.

---

## 20. Table: webhook_events

### Purpose

Stores webhook receipt/processing data for idempotency and debugging.

### Fields

```txt
id uuid primary key default gen_random_uuid()
provider text not null
event_type text not null
provider_event_id text not null
clinic_id uuid null references clinics(id) on delete set null
processed boolean not null default false
processing_error text null
payload_json jsonb not null default '{}'
received_at timestamptz not null default now()
processed_at timestamptz null
```

### Constraints

```sql
unique (provider, provider_event_id)
check (provider in ('twilio', 'stripe', 'internal'))
```

### Indexes

```sql
create index webhook_events_received_idx on webhook_events(provider, received_at desc);
create index webhook_events_processed_idx on webhook_events(provider, processed, received_at desc);
```

### Provider event IDs

Suggested values:

```txt
Twilio Voice incoming: CallSid
Twilio Voice call status: CallSid + ':' + CallStatus + ':' + timestamp if available
Twilio inbound SMS: MessageSid
Twilio SMS status: MessageSid + ':' + MessageStatus
Stripe: event.id
```

For Twilio status callbacks, full uniqueness may vary. Status callbacks can be stored as non-unique audit records if needed, while updates remain idempotent on the main `messages`/`calls` rows.

---

## 21. Table: audit_logs

### Purpose

Stores product/admin/user actions.

### Fields

```txt
id uuid primary key default gen_random_uuid()
clinic_id uuid null references clinics(id) on delete set null
actor_type text not null
actor_profile_id uuid null references profiles(id) on delete set null
event_type text not null
object_type text not null
object_id uuid null
changes_json jsonb not null default '{}'
created_at timestamptz not null default now()
```

### Constraints

```sql
check (actor_type in ('user', 'admin', 'system', 'provider'))
```

### Indexes

```sql
create index audit_logs_clinic_created_idx on audit_logs(clinic_id, created_at desc);
create index audit_logs_object_idx on audit_logs(object_type, object_id);
create index audit_logs_event_type_idx on audit_logs(event_type, created_at desc);
```

### Example event types

```txt
clinic.created
clinic.status_changed
missed_call.detected
message.sent
message.received
conversation.intent_updated
opportunity.marked_booked
opportunity.marked_lost
followup.cancelled
stripe.subscription_updated
twilio.webhook_failed_validation
```

---

## 22. State transitions

### 22.1 Missed call status transitions

```txt
detected
  -> sms_pending
  -> sms_sent
  -> engaged
  -> handoff_pending
  -> recovered
```

Alternative endings:

```txt
sms_sent -> callback_in_progress -> handoff_pending
engaged -> closed_lost
any open state -> opted_out
any open state -> spam
any open state -> duplicate
any open state -> error
```

---

### 22.2 Conversation transitions

```txt
open
  -> waiting_for_patient
  -> waiting_for_front_desk
  -> closed
```

Alternative:

```txt
open -> opted_out
open -> paused
paused -> open
```

---

### 22.3 Opportunity transitions

```txt
open -> contacted -> booked
open -> contacted -> lost
open -> booked
open -> lost
open -> spam
open -> duplicate
```

---

## 23. RLS policy model

### 23.1 Helper function

Create a helper function that checks whether the current user belongs to a clinic.

Example:

```sql
create or replace function public.user_has_clinic_access(target_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from clinic_memberships cm
    where cm.clinic_id = target_clinic_id
      and cm.profile_id = auth.uid()
      and cm.active = true
  );
$$;
```

Admin helper:

```sql
create or replace function public.user_is_internal_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.is_internal_admin = true
  );
$$;
```

---

### 23.2 Generic RLS pattern

For clinic-scoped tables:

```sql
alter table TABLE_NAME enable row level security;

create policy "clinic members can select TABLE_NAME"
on TABLE_NAME
for select
using (
  public.user_has_clinic_access(clinic_id)
  or public.user_is_internal_admin()
);
```

For updates/inserts, restrict more carefully by role if needed.

`profiles`, `clinic_memberships`, and `webhook_events` need table-specific policies instead of blindly using the generic clinic-scoped policy. `webhook_events` should normally be visible only to internal admins/service-role code.

---

### 23.3 Tables needing RLS

Enable RLS on:

- `clinics`
- `profiles`
- `clinic_memberships`
- `phone_numbers`
- `patients`
- `calls`
- `missed_calls`
- `conversations`
- `messages`
- `appointment_opportunities`
- `followups`
- `templates`
- `automations`
- `subscriptions`
- `webhook_events`
- `audit_logs`

Webhook handlers using service-role bypass RLS.

---

## 24. Initial seed data

### 24.1 Default automation settings

When a clinic is created, create an `automations` row:

```txt
enabled = true
after_hours_enabled = true
first_sms_delay_sec = 15
followup_1_delay_min = 15
followup_2_time_local = '09:00'
followup_2_business_days_after = 1
callback_timeout_sec = 15
max_automated_sms_per_incident = 3
```

---

### 24.2 Default templates

Seed global templates with `clinic_id = null`.

Minimum templates:

```txt
first_missed_call_a
new_patient
existing_patient
urgent_tooth_pain
cleaning_request
appointment_request
reschedule
no_reply_15m
next_day_followup
after_hours
```

Detailed template copy is defined in `05-sms-rules-and-templates.md`.

---

## 25. Example migration skeleton

This is not a complete copy-paste migration, but it shows the expected style.

```sql
create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_business_name text,
  website_url text,
  main_phone_e164 text,
  recovery_phone_e164 text,
  callback_phone_e164 text,
  timezone text not null default 'America/Chicago',
  default_locale text not null default 'en',
  business_hours_json jsonb not null default '{}',
  emergency_phone_e164 text,
  emergency_instruction text,
  avg_recovered_value_cents integer not null default 30000,
  status text not null default 'signup_started',
  activation_ready_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in (
    'signup_started',
    'profile_incomplete',
    'setup_in_progress',
    'a2p_pending',
    'forwarding_pending',
    'qa_pending',
    'activation_ready',
    'trialing',
    'active',
    'past_due',
    'paused',
    'cancelled'
  ))
);

create index clinics_status_idx on clinics(status);
create index clinics_main_phone_idx on clinics(main_phone_e164);
create index clinics_recovery_phone_idx on clinics(recovery_phone_e164);
```

---

## 26. Important implementation notes

### 26.1 Phone normalization

All phone numbers should be stored in E.164 format.

Examples:

```txt
+13125550000
+15551234567
```

Do not store formatted phone strings as canonical values.

---

### 26.2 Timestamps

Use `timestamptz` everywhere.

Clinic-local time should be calculated using the clinic `timezone` field.

---

### 26.3 Soft delete

Do not implement complex soft delete for MVP unless needed.

For user-visible records, use status fields instead of deleting.

Examples:

- `cancelled`
- `closed`
- `inactive`
- `paused`

---

### 26.4 Raw payload retention

MVP can store raw payloads for debugging.

Later, define retention policy for sensitive data.

---

### 26.5 Body redaction

The MVP can store SMS bodies, but UI and product copy should discourage patients from sending detailed clinical information.

Future version may add body redaction/scrubbing.

---

## 27. Dashboard query examples

### 27.1 Missed calls today

```sql
select count(*)
from missed_calls
where clinic_id = :clinic_id
  and detected_at >= :start_of_day
  and detected_at < :end_of_day;
```

### 27.2 Recovered/booked opportunities

```sql
select count(*)
from appointment_opportunities
where clinic_id = :clinic_id
  and status = 'booked'
  and booked_at >= :start_at
  and booked_at < :end_at;
```

### 27.3 Estimated recovered revenue

```sql
select coalesce(sum(coalesce(booked_value_cents, estimated_value_cents)), 0)
from appointment_opportunities
where clinic_id = :clinic_id
  and status = 'booked'
  and booked_at >= :start_at
  and booked_at < :end_at;
```

### 27.4 Open urgent conversations

```sql
select *
from conversations
where clinic_id = :clinic_id
  and state in ('open', 'waiting_for_front_desk')
  and urgency in ('urgent', 'emergency_redirect')
order by last_message_at desc;
```

---

## 28. Inbox query example

```sql
select
  c.id as conversation_id,
  c.state,
  c.intent,
  c.urgency,
  c.last_message_at,
  p.phone_e164,
  mc.detected_at,
  ao.status as opportunity_status
from conversations c
join patients p on p.id = c.patient_id
left join missed_calls mc on mc.id = c.open_missed_call_id
left join appointment_opportunities ao on ao.conversation_id = c.id
where c.clinic_id = :clinic_id
  and c.state in ('open', 'waiting_for_patient', 'waiting_for_front_desk', 'paused')
order by
  case when c.urgency in ('urgent', 'emergency_redirect') then 0 else 1 end,
  c.last_message_at desc nulls last;
```

---

## 29. Minimum done criteria for database stage

Database work is done when:

- all core tables exist;
- required constraints exist;
- provider idempotency constraints exist;
- RLS is enabled for clinic-facing tables;
- seed templates exist;
- default automation settings are created for new clinics;
- AI agent can create a clinic, patient, call, missed_call, conversation, message, and opportunity in local DB;
- duplicate Twilio `CallSid` and `MessageSid` are prevented;
- dashboard/inbox queries are possible without major schema changes.

---

## 30. Known future schema additions, not MVP

Do not build these in v0.1 unless absolutely required:

- PMS integration tables;
- appointment calendar sync tables;
- call recording tables;
- transcription tables;
- insurance data tables;
- multi-location enterprise org hierarchy;
- advanced AI conversation memory;
- document/media attachment storage;
- campaign analytics beyond missed-call recovery.
