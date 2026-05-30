# 12 — Production Launch Checklist

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1  
Stage: 6 — Production Readiness  
Primary audience: founder, AI coding agent, pilot operator

---

## 1. Purpose of this file

This checklist defines what must be true before the MVP is used by a real clinic with real patient traffic.

The MVP is not production-ready just because the code deploys. It is production-ready when the full operational loop works safely:

```txt
clinic setup -> forwarding test -> missed-call webhook -> first SMS -> inbound reply -> inbox handoff -> manual booked/lost -> dashboard -> billing -> monitoring
```

---

## 2. Production readiness summary

Before activating the first clinic, the team must complete:

```txt
[ ] Production app deployed
[ ] Production database configured
[ ] Production Twilio configured
[ ] Production Stripe configured
[ ] Webhooks live and verified
[ ] RLS/data isolation verified
[ ] Opt-out handling verified
[ ] Follow-up cancellation verified
[ ] Admin activation checklist ready
[ ] Monitoring and logs enabled
[ ] First clinic onboarding packet complete
[ ] Live missed-call test passed
[ ] Live SMS test passed
[ ] Live callback bridge test passed
```

---

## 3. Code and repository checklist

```txt
[ ] Main branch protected
[ ] Required checks enabled if CI exists
[ ] TypeScript passes
[ ] Lint passes
[ ] Build passes
[ ] No secrets committed
[ ] env/.env.secrets.example exists with names only
[ ] config/runtime.config.example.ts exists for non-secret config
[ ] README has local setup instructions
[ ] Migrations are committed
[ ] Seed templates are committed
[ ] Production deploy command documented
```

---

## 4. Database checklist

```txt
[ ] Production Supabase project created
[ ] All migrations applied
[ ] RLS enabled on tenant-scoped tables
[ ] Server-side admin/service role access limited
[ ] Unique constraints exist for Twilio CallSid, MessageSid, and Stripe event IDs
[ ] Clinic data isolation tested
[ ] Backup/restore plan understood
[ ] Seed SMS templates inserted
[ ] Seed automation defaults inserted
[ ] Admin user created
```

Critical tables:

```txt
clinics
profiles/users
phone_numbers
patients
calls
missed_calls
conversations
messages
appointment_opportunities
followups
templates
automations
subscriptions
audit_logs
```

---

## 5. Twilio production checklist

```txt
[ ] Production Twilio account ready
[ ] Recovery number purchased for clinic
[ ] Messaging Service created for clinic
[ ] Recovery number attached to Messaging Service
[ ] Voice incoming webhook URL configured
[ ] Voice call status webhook URL configured
[ ] Messaging incoming webhook URL configured
[ ] Messaging status webhook URL configured
[ ] Advanced Opt-Out enabled where applicable
[ ] STOP/START/HELP behavior tested
[ ] A2P/10DLC path understood and tracked
[ ] Clinic A2P/downstream registration status tracked manually or in admin
[ ] Test inbound call reaches app
[ ] Test outbound SMS sends successfully
[ ] Test inbound SMS reaches app
[ ] Test delivery status updates message row
```

Webhook URLs:

```txt
POST /api/webhooks/twilio/voice/incoming
POST /api/webhooks/twilio/voice/call-status
POST /api/webhooks/twilio/messaging/incoming
POST /api/webhooks/twilio/messaging/status
```

---

## 6. Stripe production checklist

```txt
[ ] Stripe live mode configured
[ ] Product created
[ ] Monthly price created
[ ] Optional annual price created
[ ] Customer Portal configured
[ ] Stripe webhook endpoint configured
[ ] Stripe webhook secret added to production env
[ ] checkout.session.completed handled
[ ] customer.subscription.created/updated/deleted handled
[ ] invoice.paid handled
[ ] invoice.payment_failed handled
[ ] customer.subscription.trial_will_end handled
[ ] Stripe events are idempotent
[ ] Trial starts only after activation_ready
```

Webhook URL:

```txt
POST /api/webhooks/stripe
```

---

## 7. App configuration checklist

```txt
[ ] NEXT_PUBLIC_APP_URL set to production URL
[ ] runtime app env = production
[ ] Supabase production public config + private secrets set
[ ] Twilio production identifiers + private secrets set
[ ] Stripe live identifiers + private secrets set
[ ] ADMIN_EMAIL_ALLOWLIST set
[ ] Error monitoring DSN set if used
[ ] Logs available to AI agent/founder
[ ] Health endpoint returns OK
```

Health endpoint:

```txt
GET /api/health
```

Expected response:

```json
{ "ok": true }
```

---

## 8. Security checklist

```txt
[ ] Twilio webhook signature validation enabled
[ ] Stripe webhook signature validation enabled
[ ] Internal job endpoints protected by secret
[ ] Admin routes restricted to admin users
[ ] Service role key never exposed to browser
[ ] No PHI in logs beyond necessary operational metadata
[ ] Message body logging policy decided
[ ] Secrets stored only in secure env/secret manager
[ ] AI/production access limited
[ ] Production DB access restricted
```

---

## 9. Compliance and patient messaging checklist

```txt
[ ] First SMS includes clinic name
[ ] First SMS includes STOP opt-out language
[ ] Templates avoid diagnosis/treatment advice
[ ] Urgent template redirects serious issues to office/emergency instructions
[ ] Opt-out state stored in database
[ ] Future automated SMS blocked after opt-out
[ ] HELP/START behavior understood
[ ] Clinic has reviewed and approved message templates
[ ] Clinic has provided emergency instruction text
[ ] Clinic has provided privacy/terms URLs if needed for messaging registration
```

MVP communication rule:

```txt
Scheduling/callback/urgency coordination is allowed.
Diagnosis, treatment advice, insurance details, x-rays, prescriptions, and sensitive medical detail are out of scope.
```

---

## 10. First clinic activation checklist

For each clinic:

```txt
[ ] Clinic record created
[ ] Owner user created
[ ] Front desk user created if applicable
[ ] Main clinic number saved
[ ] Recovery number saved
[ ] Timezone saved
[ ] Business hours saved
[ ] Emergency instruction saved
[ ] Average recovered value saved if used
[ ] SMS templates reviewed by clinic
[ ] Twilio recovery number assigned
[ ] Messaging Service assigned
[ ] A2P/compliance status tracked
[ ] No-answer forwarding configured
[ ] Busy forwarding configured if available
[ ] Live missed-call test passed
[ ] Live first SMS test passed
[ ] Live inbound SMS test passed
[ ] Live callback bridge test passed
[ ] Dashboard shows test incident
[ ] Test incident closed/booked/lost
[ ] Trial activated only after live activation
```

---

## 11. End-to-end production smoke test

Run this before using real patient traffic:

### Test 1 — Missed call

```txt
1. Call clinic main number from test phone.
2. Let the call go unanswered or busy-forwarded.
3. Confirm Twilio recovery number receives forwarded call.
4. Confirm calls row is created.
5. Confirm missed_calls row is created.
6. Confirm TwiML response is returned.
```

Pass criteria:

```txt
[ ] No duplicate call rows
[ ] missed_call status correct
[ ] no server error
```

---

### Test 2 — First SMS

```txt
1. Wait 10–20 seconds after missed-call detection.
2. Confirm first SMS sends.
3. Confirm message row exists.
4. Confirm delivery status updates.
```

Pass criteria:

```txt
[ ] patient/test phone receives SMS
[ ] message status is sent/delivered or known provider state
[ ] no duplicate first SMS
```

---

### Test 3 — Inbound reply

```txt
1. Reply "3" from test phone.
2. Confirm inbound SMS webhook receives reply.
3. Confirm message row is created.
4. Confirm conversation intent = urgent_tooth_pain.
5. Confirm urgency = urgent.
6. Confirm follow-ups are cancelled.
```

Pass criteria:

```txt
[ ] inbox shows urgent conversation
[ ] opportunity is created/updated
[ ] no further automated follow-up sends for that incident
```

---

### Test 4 — Manual outcome

```txt
1. Open Recovery Inbox.
2. Open the conversation.
3. Mark opportunity as booked.
4. Add note.
5. Confirm dashboard updates.
```

Pass criteria:

```txt
[ ] status = booked/recovered
[ ] booked_at stored
[ ] dashboard booked count increments
```

---

### Test 5 — Callback bridge

```txt
1. From test phone, call the recovery number directly after SMS.
2. Confirm system treats this as callback if open conversation exists.
3. Confirm TwiML Dial bridges to clinic main/callback destination.
4. Confirm call status events are logged.
```

Pass criteria:

```txt
[ ] clinic/test destination rings
[ ] call status rows update
[ ] callback reflected in opportunity/conversation
```

---

### Test 6 — STOP opt-out

```txt
1. From test phone, send STOP.
2. Confirm opt-out state saved.
3. Attempt automated follow-up.
4. Confirm follow-up is blocked.
```

Pass criteria:

```txt
[ ] patient consent_status = opted_out
[ ] opted_out_at set
[ ] no automated SMS sends after STOP
```

---

## 12. Monitoring and alerting checklist

Minimum alerts:

```txt
[ ] Twilio voice webhook non-200
[ ] Twilio messaging webhook non-200
[ ] First SMS not sent within 60 seconds after missed_call detected
[ ] SMS failed/undelivered rate spike
[ ] Stripe webhook verification failure
[ ] invoice.payment_failed
[ ] follow-up job failure
[ ] urgent incident with no front-desk action during business hours
[ ] production app crash/error spike
```

Minimum logs:

```txt
[ ] webhook received
[ ] signature validation result
[ ] state transition
[ ] outbound SMS attempt
[ ] SMS delivery status
[ ] inbound SMS processed
[ ] booking/lost manual action
[ ] Stripe event processed
[ ] job run summary
```

---

## 13. Go / no-go criteria

### Go

Launch first pilot clinic only if:

```txt
[ ] All critical E2E tests passed in staging
[ ] Production smoke test passed
[ ] Twilio/SMS path active
[ ] Opt-out works
[ ] Admin can monitor clinic
[ ] Founder understands manual onboarding steps
[ ] Front desk knows how to use inbox
[ ] Billing/trial logic is configured correctly
```

### No-go

Do not launch if:

```txt
[ ] Webhook signatures are not validated
[ ] Duplicate webhooks create duplicate SMS
[ ] STOP does not block future messages
[ ] Clinic data isolation is not verified
[ ] Follow-ups can continue after patient replies
[ ] Production uses test Stripe/Twilio accidentally
[ ] No logs are available for failed SMS/calls
```

---

## 14. Post-launch first week checklist

For each pilot clinic, review daily:

```txt
[ ] missed calls count
[ ] first SMS latency
[ ] SMS delivery failures
[ ] reply rate
[ ] callback attempts
[ ] urgent incidents
[ ] front desk response time
[ ] booked/recovered count
[ ] incorrect intent classifications
[ ] patient confusion or complaints
[ ] clinic staff feedback
```

Weekly review with clinic:

```txt
[ ] Did any missed calls fail to receive SMS?
[ ] Did front desk understand the inbox?
[ ] Were urgent messages handled correctly?
[ ] Did the clinic actually book recovered patients?
[ ] What templates need changes?
[ ] What should stay manual for now?
```

---

## 15. Bottom line

The MVP is production-ready only after the full loop works in production with a test phone and the first clinic's forwarding setup.

The production launch should be concierge-style: one clinic, manual activation, live test, daily monitoring, then expand to the next clinic.


## 16. AI-agent launch approval

Before production launch, the owner must confirm:

```txt
[ ] AI did not commit secrets
[ ] AI did not connect MCP to production without approval
[ ] Supabase production migration was reviewed
[ ] Vercel production deploy approved
[ ] Stripe live mode changes approved
[ ] Twilio production settings approved
[ ] DNS changes approved
[ ] Real SMS sending approved
```
