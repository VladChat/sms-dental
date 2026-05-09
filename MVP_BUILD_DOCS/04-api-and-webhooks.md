# 04 — API and Webhooks

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1  
Stage: 3 — API and Webhooks  
Primary audience: AI coding agent / technical founder

---

## 1. Purpose of this file

This file defines the MVP API surface and webhook behavior.

The system has two types of endpoints:

1. **Public provider webhooks** from Twilio and Stripe.
2. **Authenticated app endpoints/actions** used by the clinic dashboard and internal admin tools.

The most important implementation requirements are:

- validate provider signatures;
- process webhooks idempotently;
- respond quickly;
- store raw provider payloads for debugging;
- separate provider state from product state;
- never let duplicate provider retries create duplicate calls, messages, follow-ups, or subscriptions.

---

## 2. Endpoint summary

| Endpoint | Method | Auth | Source | Purpose |
|---|---:|---|---|---|
| `/api/webhooks/twilio/voice/incoming` | POST | Twilio signature | Twilio Voice | Receive inbound call to recovery number, classify missed call vs callback, return TwiML |
| `/api/webhooks/twilio/voice/call-status` | POST | Twilio signature | Twilio Voice | Receive callback bridge child-call status events |
| `/api/webhooks/twilio/messaging/incoming` | POST | Twilio signature | Twilio Messaging | Receive inbound patient SMS, classify intent, update conversation/opportunity |
| `/api/webhooks/twilio/messaging/status` | POST | Twilio signature | Twilio Messaging | Receive outbound SMS delivery status updates |
| `/api/webhooks/stripe` | POST | Stripe signature | Stripe | Process subscription lifecycle events |
| `/api/messages/send` | POST | App auth or service role | Internal app/job | Send or queue a manual/internal SMS |
| `/api/opportunities/:id/mark-booked` | POST | App auth | Dashboard | Mark a recovery opportunity as booked |
| `/api/opportunities/:id/mark-lost` | POST | App auth | Dashboard | Mark a recovery opportunity as lost |
| `/api/opportunities/:id/mark-contacted` | POST | App auth | Dashboard | Mark front-desk handoff/contact action |
| `/api/opportunities/:id/pause-automation` | POST | App auth | Dashboard | Pause remaining follow-ups for one opportunity |
| `/api/clinics/:id/settings` | PATCH | App auth | Dashboard | Update clinic settings |
| `/api/admin/clinics/:id/activate` | POST | Admin auth | Internal admin | Move clinic to activation-ready/trialing when setup is complete |

---

## 3. Global webhook rules

### 3.1 Signature validation

Every provider webhook must validate the provider signature before making database changes.

Required headers:

- Twilio: `X-Twilio-Signature`
- Stripe: `Stripe-Signature`

If validation fails:

- return `403` or provider-appropriate error;
- do not process the payload;
- create a minimal security log if possible;
- do not expose secrets in logs.

---

### 3.2 Raw request body handling

Stripe signature verification requires the raw request body.

Implementation note:

- Do not parse the Stripe request body before verifying the signature.
- For Twilio form-encoded requests, validate against the full webhook URL and form params.

---

### 3.3 Idempotency

Provider retries are normal.

Use idempotency keys:

| Provider/event | Idempotency key |
|---|---|
| Twilio inbound voice | `CallSid` |
| Twilio child call status | `CallSid` + `CallStatus` + timestamp if needed |
| Twilio inbound SMS | `MessageSid` |
| Twilio outbound SMS status | `MessageSid` + latest status priority |
| Stripe webhook | `event.id` |
| Internal first SMS job | `missed_call_id` + `template_key=first_missed_call` |
| Follow-up job | `followup.id` |

The database must enforce uniqueness where possible.

---

### 3.4 Fast response rule

Webhook handlers should avoid slow work.

Allowed synchronous work:

- validate signature;
- normalize payload;
- upsert basic records;
- create jobs/followups;
- return valid provider response.

Move slow work into background jobs:

- outbound SMS send;
- retries;
- metric recalculation;
- admin notifications;
- long provider API lookups.

---

### 3.5 Provider payload storage

Store normalized payloads in `payload_json` or `webhook_events.payload_json`.

Do not store unnecessary PHI. The MVP should store operational messaging data only.

---

## 4. Twilio Voice — incoming call

### 4.1 Endpoint

```txt
POST /api/webhooks/twilio/voice/incoming
```

### 4.2 Source

Twilio Voice webhook configured on each clinic recovery number.

### 4.3 Request format

```txt
Content-Type: application/x-www-form-urlencoded
```

### 4.4 Important fields

| Field | Required | Notes |
|---|---:|---|
| `CallSid` | yes | Unique Twilio call id |
| `AccountSid` | yes | Twilio account id |
| `From` | yes | Patient phone number |
| `To` | yes | Recovery number |
| `CallStatus` | yes | Usually `ringing` on initial webhook |
| `Direction` | usually | Usually `inbound` |
| `ForwardedFrom` | optional | Carrier-dependent; may be missing |

Example normalized payload:

```json
{
  "CallSid": "CA1234567890abcdef1234567890abcd",
  "AccountSid": "AC1234567890abcdef1234567890abcd",
  "From": "+15551234567",
  "To": "+18885550123",
  "CallStatus": "ringing",
  "Direction": "inbound",
  "ForwardedFrom": "+13125550000"
}
```

---

### 4.5 Logic

1. Validate `X-Twilio-Signature`.
2. Normalize phone numbers to E.164.
3. Find clinic by `To` recovery number.
4. If no clinic is found:
   - log event;
   - return safe TwiML hangup.
5. Upsert patient by `clinic_id + From`.
6. Upsert call by `CallSid`.
7. Classify call as:
   - `forwarded_missed_call`
   - `callback`
   - `unknown`
8. If `forwarded_missed_call` or `unknown`:
   - create or reuse `missed_calls` row for this call;
   - create or reuse open `conversation`;
   - create `appointment_opportunity` with `intent=unknown` if none exists;
   - create first SMS follow-up/job;
   - return short apology/hangup TwiML.
9. If `callback`:
   - update relevant missed call/conversation status to `callback_in_progress`;
   - cancel pending follow-up jobs;
   - return TwiML `<Dial>` to clinic callback destination/main number.

---

### 4.6 Classification rule

Use this order:

1. If `ForwardedFrom` exists and equals clinic `main_phone_e164`, classify as `forwarded_missed_call`.
2. Else if patient has an open conversation and the latest outbound recovery SMS was sent before this call, classify as `callback`.
3. Else if patient has open missed call in the last 24 hours, classify as `callback`.
4. Else classify as `forwarded_missed_call` for MVP safety.

Rationale:

- `ForwardedFrom` may be missing depending on carrier support.
- A patient callback usually happens after an outbound recovery SMS.
- If uncertain, it is safer in v0.1 to send a missed-call SMS than to incorrectly bridge random calls.

---

### 4.7 TwiML for forwarded missed call

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry we missed your call. We'll text you right away.</Say>
  <Hangup/>
</Response>
```

---

### 4.8 TwiML for callback bridge

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" timeout="15">
    <Number
      statusCallbackEvent="initiated ringing answered completed"
      statusCallback="https://app.example.com/api/webhooks/twilio/voice/call-status"
      statusCallbackMethod="POST">
      +13125550000
    </Number>
  </Dial>
</Response>
```

Replace `+13125550000` with the clinic callback destination number. Replace `https://app.example.com` with `NEXT_PUBLIC_APP_URL` or the production app base URL.

---

### 4.9 Database writes

Minimum writes for forwarded missed call:

- `webhook_events`
- `patients`
- `calls`
- `missed_calls`
- `conversations`
- `appointment_opportunities`
- `followups` or job queue row for first SMS
- `audit_logs` optional

Minimum writes for callback:

- `webhook_events`
- `calls`
- update `missed_calls.callback_started_at`
- update `missed_calls.status = callback_in_progress`
- update `conversations.state`
- cancel pending `followups`

---

### 4.10 Response behavior

Must always return valid XML TwiML for valid Twilio requests.

Error fallback:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, we could not connect your call right now.</Say>
  <Hangup/>
</Response>
```

---

### 4.11 Acceptance criteria

- Valid Twilio request creates a `calls` row.
- Forwarded missed call creates one `missed_calls` row.
- Duplicate `CallSid` does not create duplicate records.
- Missing `ForwardedFrom` does not break the flow.
- Callback bridge returns valid TwiML `<Dial>`.
- Pending follow-ups are cancelled when callback is detected.
- Unknown recovery number is logged and safely hung up.

---

## 5. Twilio Voice — call status callback

### 5.1 Endpoint

```txt
POST /api/webhooks/twilio/voice/call-status
```

### 5.2 Source

Twilio `<Dial><Number statusCallback=...>` events.

### 5.3 Request format

```txt
Content-Type: application/x-www-form-urlencoded
```

### 5.4 Important fields

| Field | Required | Notes |
|---|---:|---|
| `CallSid` | yes | Child call SID |
| `ParentCallSid` | optional | Parent inbound callback SID |
| `CallStatus` | yes | `initiated`, `ringing`, `answered`, `completed`, etc. |
| `From` | optional | Usually patient caller id |
| `To` | optional | Clinic number |
| `CallDuration` | optional | Available on completed calls |

---

### 5.5 Logic

1. Validate Twilio signature.
2. Store/update child call by `CallSid`.
3. Link child call to parent call using `ParentCallSid` if available.
4. Locate clinic and open missed call/conversation.
5. Update callback fields:
   - `callback_started_at`
   - `callback_answered_at` if status is `answered`
   - `duration_sec` if completed
6. If status is `answered`:
   - set missed call status to `handoff_pending` unless already closed;
   - set conversation state to `waiting_for_front_desk`;
   - cancel pending follow-ups.
7. If status is `completed` without answered signal:
   - keep opportunity open unless user closed it;
   - optionally create front-desk task/note.

---

### 5.6 Acceptance criteria

- `initiated`, `ringing`, `answered`, and `completed` events are stored.
- `answered` callback changes opportunity to front-desk handoff state.
- Duplicate callback events do not corrupt state.
- Completed call duration is saved when present.

---

## 6. Twilio Messaging — inbound SMS

### 6.1 Endpoint

```txt
POST /api/webhooks/twilio/messaging/incoming
```

### 6.2 Source

Twilio Messaging webhook configured on the clinic Messaging Service or recovery number.

### 6.3 Request format

```txt
Content-Type: application/x-www-form-urlencoded
```

### 6.4 Important fields

| Field | Required | Notes |
|---|---:|---|
| `MessageSid` | yes | Unique Twilio message id |
| `AccountSid` | yes | Twilio account id |
| `MessagingServiceSid` | often | Useful for clinic lookup |
| `From` | yes | Patient phone |
| `To` | yes | Recovery number |
| `Body` | yes | Patient text |
| `NumMedia` | yes | MVP should not process media |
| `OptOutType` | optional | `STOP`, `HELP`, `START` when Advanced Opt-Out matches |

Example normalized payload:

```json
{
  "MessageSid": "SM1234567890abcdef1234567890abcd",
  "MessagingServiceSid": "MG1234567890abcdef1234567890abcd",
  "From": "+15551234567",
  "To": "+18885550123",
  "Body": "3",
  "NumMedia": "0",
  "OptOutType": null
}
```

---

### 6.5 Logic

1. Validate Twilio signature.
2. Normalize phone numbers and message body.
3. Find clinic by:
   - `MessagingServiceSid`, if present; else
   - `To` recovery number.
4. Upsert patient by `clinic_id + From`.
5. Store inbound message by unique `MessageSid`.
6. If duplicate `MessageSid`, return `200 OK` without reprocessing.
7. If `OptOutType = STOP` or body is opt-out keyword:
   - set patient `consent_status = opted_out`;
   - set `opted_out_at`;
   - close or pause open conversations as `opted_out`;
   - cancel pending follow-ups;
   - return `200 OK`.
8. If `OptOutType = START` or body is opt-in keyword:
   - set patient `consent_status = confirmed` or `unknown` depending legal choice;
   - return `200 OK`.
9. Find or create open conversation.
10. Classify intent and urgency using deterministic rules from `05-sms-rules-and-templates.md`.
11. Update conversation:
    - `state = waiting_for_front_desk`
    - `intent`
    - `urgency`
    - `last_message_at`
12. Update or create appointment opportunity.
13. Set missed call status to `engaged` or `handoff_pending`.
14. Cancel pending follow-ups for that missed call.
15. Optional: enqueue a deterministic reply based on intent.

---

### 6.6 MVP media handling

If `NumMedia > 0`:

- store that media was present;
- do not download/store media in MVP;
- optionally reply with a safe message asking patient to call the office or wait for front desk.

Suggested internal note:

```txt
Patient sent media. MVP does not store media. Front desk should follow up manually.
```

---

### 6.7 Acceptance criteria

- Inbound SMS creates exactly one inbound `messages` row.
- Duplicate `MessageSid` is ignored safely.
- Patient is linked by phone number.
- Existing open conversation is reused.
- Intent is classified for simple numeric replies.
- Urgent replies are marked urgent.
- Any inbound patient reply cancels scheduled automated follow-ups.
- STOP/opt-out blocks future automated messages.

---

## 7. Twilio Messaging — outbound SMS status

### 7.1 Endpoint

```txt
POST /api/webhooks/twilio/messaging/status
```

### 7.2 Source

Twilio status callback from outbound messages.

### 7.3 Important fields

| Field | Required | Notes |
|---|---:|---|
| `MessageSid` | yes | Outbound message id |
| `MessageStatus` | yes | `queued`, `sent`, `delivered`, `undelivered`, `failed` |
| `ErrorCode` | optional | Present on failed/undelivered |
| `To` | optional | Patient phone |
| `From` | optional | Recovery number |
| `MessagingServiceSid` | optional | Clinic Messaging Service |

---

### 7.4 Logic

1. Validate Twilio signature.
2. Find `messages` row by `twilio_message_sid = MessageSid`.
3. If message is missing:
   - create `webhook_events` record;
   - optionally create unresolved provider event for later investigation;
   - return `200 OK`.
4. Update message status only if new status is not older than current status.
5. Set timestamps:
   - `sent_at` when status is `sent`;
   - `delivered_at` when status is `delivered`;
   - failure fields when `failed` or `undelivered`.
6. If status is `failed` or `undelivered`:
   - record `error_code`;
   - evaluate controlled resend policy from `05-sms-rules-and-templates.md`;
   - create internal note/task if needed.

---

### 7.5 Status priority

Use status priority to avoid downgrading state:

```txt
accepted < queued < sending < sent < delivered
accepted < queued < sending < failed
sent < undelivered
```

Do not replace `delivered` with `sent` if callbacks arrive out of order.

---

### 7.6 Acceptance criteria

- Status callback updates the matching outbound message.
- Failed messages store error code.
- Out-of-order callbacks do not downgrade final status.
- Missing message status callback is logged without throwing.

---

## 8. Stripe webhook

### 8.1 Endpoint

```txt
POST /api/webhooks/stripe
```

### 8.2 Source

Stripe subscription/checkout webhooks.

### 8.3 Request format

```txt
Content-Type: application/json
```

Signature validation requires raw request body.

---

### 8.4 Events to support in MVP

| Event | Purpose |
|---|---|
| `checkout.session.completed` | Link Stripe customer/subscription to clinic |
| `customer.subscription.created` | Create local subscription row |
| `customer.subscription.updated` | Update local status, trial dates, period end |
| `customer.subscription.deleted` | Mark subscription cancelled |
| `customer.subscription.trial_will_end` | Optional notification/internal task |
| `invoice.paid` | Mark subscription active/paid |
| `invoice.payment_failed` | Mark clinic/subscription past due |

---

### 8.5 Logic

1. Read raw body.
2. Validate `Stripe-Signature`.
3. If invalid, return `400`.
4. Check `webhook_events` for `event.id`.
5. If already processed, return `200 OK`.
6. Store event in `webhook_events`.
7. Process supported event types.
8. Update `subscriptions` table.
9. Update `clinics.status` when appropriate.
10. Mark event processed.

---

### 8.6 Clinic linking

Stripe Checkout sessions must include `clinic_id` in metadata.

Required metadata:

```json
{
  "clinic_id": "uuid",
  "product": "missed_call_recovery"
}
```

If metadata is missing:

- store unresolved event;
- do not guess clinic;
- alert admin.

---

### 8.7 Trial start rule

The app should only allow Checkout/trial start when clinic status is:

```txt
activation_ready
```

Do not start the free trial during signup or A2P/forwarding setup.

---

### 8.8 Acceptance criteria

- Duplicate Stripe event id is processed once.
- Checkout links customer/subscription to clinic.
- Subscription updates are reflected locally.
- Payment failure changes clinic/subscription status to `past_due`.
- Canceled Stripe subscription changes clinic status to `cancelled` or `paused` depending business rule.
- Trial cannot start before activation-ready.

---

## 9. Internal endpoint — send message

### 9.1 Endpoint

```txt
POST /api/messages/send
```

### 9.2 Auth

Allowed callers:

- authenticated app user for manual messages, if manual messaging is included;
- service role/background job for automated SMS.

### 9.3 Request body

```json
{
  "clinic_id": "uuid",
  "conversation_id": "uuid",
  "patient_id": "uuid",
  "template_key": "first_missed_call_a",
  "body": "optional explicit body",
  "send_reason": "first_missed_call",
  "idempotency_key": "missed_call:<id>:first_sms"
}
```

---

### 9.4 Logic

1. Authorize user/service for clinic.
2. Validate patient is not opted out.
3. Validate automation limits for the missed call.
4. Render template if `body` not provided.
5. Create outbound `messages` row with status `queued`.
6. Call Twilio Messages API using clinic Messaging Service.
7. Store `MessageSid` and initial provider status.
8. Update missed call fields, such as `sms_first_sent_at`.
9. Return message id/status.

---

### 9.5 Acceptance criteria

- Opted-out patient cannot receive automated SMS.
- Same idempotency key cannot send duplicate SMS.
- Message body is stored redacted/truncated according to data policy.
- Twilio API errors create failed message/task state, not silent failure.

---

## 10. Internal endpoint — mark booked

### 10.1 Endpoint

```txt
POST /api/opportunities/:id/mark-booked
```

### 10.2 Auth

Authenticated clinic user with role:

- `owner`
- `front_desk`
- `admin`

### 10.3 Request body

```json
{
  "booked_at": "2026-05-08T15:30:00.000Z",
  "booked_value_cents": 25000,
  "front_desk_notes": "Patient booked cleaning for next Tuesday."
}
```

---

### 10.4 Logic

1. Authorize user belongs to opportunity clinic.
2. Update `appointment_opportunities.status = booked`.
3. Set `booked_at`.
4. Set `booked_value_cents` or default from clinic average value.
5. Update linked missed call status to `recovered`.
6. Update conversation state to `closed` or `waiting_for_patient` depending product choice.
7. Cancel pending follow-ups.
8. Write audit log.

---

### 10.5 Acceptance criteria

- Booked opportunity appears in dashboard metrics.
- Pending follow-ups are cancelled.
- Audit log captures actor and timestamp.
- User cannot update another clinic's opportunity.

---

## 11. Internal endpoint — mark lost

### 11.1 Endpoint

```txt
POST /api/opportunities/:id/mark-lost
```

### 11.2 Request body

```json
{
  "lost_reason": "no_response",
  "front_desk_notes": "No reply after follow-up."
}
```

Recommended `lost_reason` values:

```txt
no_response
not_interested
already_booked_elsewhere
wrong_number
spam
duplicate
other
```

---

### 11.3 Logic

1. Authorize user.
2. Update opportunity status to `lost`.
3. Update linked missed call status to `closed_lost`.
4. Close or pause conversation.
5. Cancel pending follow-ups.
6. Write audit log.

---

### 11.4 Acceptance criteria

- Lost opportunities are excluded from open inbox.
- Lost opportunities remain visible in historical reporting.
- Pending follow-ups are cancelled.

---

## 12. Internal endpoint — mark contacted

### 12.1 Endpoint

```txt
POST /api/opportunities/:id/mark-contacted
```

### 12.2 Purpose

Used when front desk manually calls/texts patient outside the automated flow.

### 12.3 Request body

```json
{
  "contacted_at": "2026-05-08T15:30:00.000Z",
  "method": "phone",
  "notes": "Left voicemail."
}
```

### 12.4 Logic

1. Authorize user.
2. Set opportunity status to `contacted` or keep current status and record timestamp.
3. Set missed call status to `handoff_pending` if not closed.
4. Write audit log/note.

---

## 13. Internal endpoint — pause automation

### 13.1 Endpoint

```txt
POST /api/opportunities/:id/pause-automation
```

### 13.2 Purpose

Stops future automated follow-ups for this opportunity without closing it.

### 13.3 Logic

1. Authorize user.
2. Cancel pending followups for linked `missed_call_id`.
3. Set conversation state to `paused` or set automation-paused flag.
4. Write audit log.

---

## 14. Clinic settings endpoint

### 14.1 Endpoint

```txt
PATCH /api/clinics/:id/settings
```

### 14.2 Auth

Roles:

- `owner`
- `admin`

Optional: allow `front_desk` to edit non-billing/non-compliance settings only later.

### 14.3 Request body

```json
{
  "name": "Bright Smile Dental",
  "main_phone_e164": "+13125550000",
  "callback_phone_e164": "+13125550000",
  "timezone": "America/Chicago",
  "business_hours_json": {
    "mon": [{ "open": "09:00", "close": "17:00" }],
    "tue": [{ "open": "09:00", "close": "17:00" }],
    "wed": [{ "open": "09:00", "close": "17:00" }],
    "thu": [{ "open": "09:00", "close": "17:00" }],
    "fri": [{ "open": "09:00", "close": "15:00" }],
    "sat": [],
    "sun": []
  },
  "emergency_phone_e164": "+13125559999",
  "emergency_instruction": "For severe pain, swelling, trauma, or uncontrolled bleeding, call the office emergency line.",
  "avg_recovered_value_cents": 25000
}
```

### 14.4 Logic

1. Authorize user.
2. Validate E.164 phone formats.
3. Validate timezone.
4. Update clinic settings.
5. Update related `phone_numbers` records if needed.
6. Write audit log.

---

### 14.5 Acceptance criteria

- Settings changes are persisted.
- Invalid phone/timezone values are rejected.
- Main phone and recovery phone remain distinct.
- Audit log captures changes.

---

## 15. Admin activation endpoint

### 15.1 Endpoint

```txt
POST /api/admin/clinics/:id/activate
```

### 15.2 Auth

Internal admin only.

### 15.3 Purpose

Used during concierge onboarding after:

- Twilio recovery number is configured;
- Messaging Service is configured;
- A2P/campaign status is acceptable for go-live;
- forwarding test passed;
- SMS test passed;
- callback bridge test passed.

### 15.4 Logic

1. Authorize admin.
2. Validate activation checklist fields.
3. Set clinic status to `activation_ready`. Stripe Checkout/webhooks move the clinic to `trialing` or `active` later.
4. Store activation timestamp.
5. Enable automations.
6. Write audit log.

---

## 16. Error handling rules

### 16.1 Public webhook endpoints

For valid provider requests with business-level issues, prefer returning `200 OK` after logging.

Examples:

- unknown message SID in status callback;
- duplicate webhook;
- missing optional field.

For security issues, return error:

- invalid signature;
- malformed required fields.

---

### 16.2 Internal endpoints

Return standard JSON errors:

```json
{
  "error": {
    "code": "patient_opted_out",
    "message": "This patient has opted out of SMS."
  }
}
```

Recommended error codes:

```txt
unauthorized
forbidden
not_found
invalid_phone_number
invalid_timezone
patient_opted_out
automation_limit_reached
provider_error
idempotency_conflict
clinic_not_active
```

---

## 17. Observability and logs

Minimum logs/events:

- webhook received;
- signature validation result;
- unknown clinic/recovery number;
- duplicate provider event;
- call classified as missed/callback;
- first SMS job created;
- SMS sent/failed;
- inbound reply classified;
- urgent opportunity created;
- follow-up cancelled;
- opportunity marked booked/lost;
- Stripe payment failed;
- clinic activated.

Do not log provider auth tokens, Stripe secrets, or full request headers.

---

## 18. Implementation order

Recommended order for this file:

1. Shared provider signature utilities.
2. `webhook_events` storage utility.
3. Twilio voice incoming webhook.
4. First SMS queue/send path.
5. Twilio messaging status webhook.
6. Twilio inbound SMS webhook.
7. Opportunity action endpoints.
8. Clinic settings endpoint.
9. Stripe webhook.
10. Admin activation endpoint.

---

## 19. Definition of done for Stage 3 API work

The API/webhook layer is done when:

- all listed endpoints exist;
- Twilio signature validation works;
- Stripe signature validation works;
- duplicate webhooks are safe;
- missed calls create incidents;
- first SMS can be sent;
- inbound replies update conversations/opportunities;
- status callbacks update messages;
- booked/lost actions update metrics state;
- clinic settings can be saved;
- webhook behavior can be tested locally with Twilio/Stripe CLI or equivalent tools.
