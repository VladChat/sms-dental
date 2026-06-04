# First Clinic Onboarding Package

Status: Active  
Audience: founder / operator / AI agent  
Last updated: 2026-05-26

This document covers the practical steps to safely onboard the first real clinic with the current MVP backend.

**A2P/Toll-Free compliance prerequisite:** Before enabling live SMS for any real clinic, Twilio Toll-Free Verification (or 10DLC campaign registration) must be approved. Do not skip this. See `A2P-10DLC-COMPLIANCE-READINESS.md` for the full checklist and action items.

**What the system does today:**
- Records every inbound call (voice webhook → Supabase `call_events`).
- Plays a voice greeting and hangs up cleanly.
- After the call ends, sends one recovery SMS to the caller: *"Hi, this is {clinic_name}. We missed your call. Would you like us to help schedule an appointment?"*
- Enforces 24-hour duplicate suppression (no repeat SMS within 24 hours).
- Handles STOP/START opt-out via inbound SMS.
- All SMS is off by default for new clinics.

**What is not yet implemented:**
- Follow-up SMS (15-minute or next-day — see `05-sms-rules-and-templates.md`).
- Intent detection or reply routing.
- Callback bridge.
- Dashboard or inbox UI.
- Stripe billing gate.
- A2P/10DLC campaign management.

For the full future onboarding vision, see `08-compliance-and-onboarding.md`.

---

## 1. Clinic Information to Collect

Customer-facing Step 1 (Create office profile) collects only what is needed to start onboarding:

Scope rule: ask only for information required for the next immediate onboarding step. Defer non-essential fields to later profile/settings/compliance steps and include a short customer-facing explanation for each required field.

| Field | Notes |
|---|---|
| Main clinic phone number | The number patients currently call |
| Clinic name | Public-facing practice name used in SMS and voice greeting |
| ZIP code | Used to prepare/reserve the best local office texting number |

Later Business Profile cards collect details only when needed:

- Business Information: legal business name, EIN/Tax ID, business type, business address, optional website.
- A2P Approval Information: authorized representative details and authorization checkbox.
- Representative email should be prefilled from setup/login email when available.
- Representative phone should be prefilled from main office phone.
- Do not require duplicate entry for fields already collected.

Do not store secrets, passwords, or EHR credentials in this document.

### Implementation status (2026-05-28)

The Business Profile onboarding is implemented:

- Screen 1 **Create office profile** (`app/setup/[token]` → `ClinicForm`): three fields only —
  clinic name, main office phone (normalized to E.164), ZIP code. Button: **Create office profile**.
- On save, the backend (`POST /api/onboarding/[token]/clinic`) generates the public business
  `slug` and runs **automatic local-number preparation** (read-only Twilio candidate search; status
  shows **Preparing**). No number is purchased/reserved unless `TWILIO_NUMBER_PURCHASE_ENABLED=true`
  and the owner explicitly approves via the existing purchase route.
- Screen 2 **Business Profile** page (`BusinessProfile` component) shows a top status strip
  (Local number / SMS / Billing) and cards: Business Information, A2P Approval Information,
  Public Business Page, Billing, Billing History, Login & Security, Support. There is **no**
  Review & Submit step and no customer "submit for SMS approval" step.
- Business Information (`POST /api/onboarding/[token]/business-info`) and A2P Approval Information
  (`POST /api/onboarding/[token]/a2p`) save locally only. Saving A2P advances the displayed SMS
  status to **Waiting for approval** but never sets `sms_recovery_enabled=true` and never submits
  to Twilio.
- Public pages render at `/business/{slug}`, `/business/{slug}/privacy`, `/business/{slug}/sms-terms`
  and state that Missed Calls Dental / Dental SMS acts as the technology/service provider.
- Billing stays **Not started**; the 21-day trial baseline begins only after SMS recovery is
  activated, and the trial countdown does not start while approval is pending.
- The Billing card now supports **saving a payment method** via Stripe-hosted Checkout in
  `mode:"setup"` (Stripe **sandbox/test mode** only). This collects a card for future billing
  and does **not** charge, create a subscription/invoice, or change `billing_status`.
  `hasPaymentMethod` is keyed off the saved `stripe_payment_method_id`. Requires
  `STRIPE_SECRET_KEY` (`sk_test_…`) + `STRIPE_WEBHOOK_SECRET` for the `/api/webhooks/stripe`
  test endpoint, and `supabase/migrations/20260602000100_clinic_payment_method.sql` applied.
- New columns added by `supabase/migrations/20260528000100_business_profile_onboarding.sql`
  (EIN/Tax ID, business type, street address, website, A2P rep fields, status/lifecycle fields).
  This migration must be applied with owner approval before the live flow works.

---

## 2. Onboarding Modes

### Mode A — Conditional Forwarding

**What the clinic does:**
Contact their phone provider (or configure their PBX/VoIP) to forward calls to the assigned Twilio number on:
- No answer (recommended minimum)
- Busy (recommended)
- Unavailable / after-hours (optional)

Do **not** enable unconditional forwarding. That would bypass the front desk entirely.

**What we configure:**
- Provision a Twilio number for the clinic.
- Set webhook URLs on that number (already applies to the whole account via Messaging Service; voice URLs need per-number configuration).
- Insert clinic row and phone mapping in DB.

**Important:** Confirm that forwarded calls preserve the original caller's number as `From`. If `From` becomes the clinic's own number, recovery SMS cannot reach the patient. Test this before enabling SMS.

**Pros:**
- Clinic keeps their existing published number.
- Patients always reach a human when staff answers.
- Recovery only fires on genuinely missed calls.

**Cons:**
- Requires clinic to configure forwarding with their phone provider.
- Forwarding behavior varies by provider; setup may take 1–3 days.
- If forwarding is misconfigured, calls never reach us.

**Recommended for:** most established clinics with an existing number.

---

### Mode B — Tracking Number (alternate/historical path)

**What the clinic does:**
Publish the assigned Twilio number directly in one or more channels:
- Website call-to-action button
- Google Ads campaign
- Landing page
- Print/mailer

**What we configure:**
- Same as above — provision number, configure webhooks, insert DB rows.

**Pros:**
- No forwarding configuration needed.
- Clinic can attribute calls per channel.
- Simpler to test end-to-end.

**Cons:**
- Patients calling the tracking number always reach our greeting — there is no live front desk pickup path unless the clinic adds a callback bridge later.
- Cannot capture calls to the clinic's existing main number.

**Recommended for:** new patient acquisition campaigns, or as an add-on to conditional forwarding.

---

### Current MVP Recommendation

Use **system-prepared local number** by default for onboarding, plus conditional forwarding where clinic phone operations require it. Do not require customer-facing manual number selection from a catalog.

---

## 3. Technical Setup Checklist

Run these steps in order. Each step has a verification query.

### Step 1 — Provision Twilio number for the clinic

- Buy or assign a Twilio number in the clinic's area code.
- Confirm the number is in E.164 format: `+1XXXXXXXXXX`.
- Note the Phone Number SID (`PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`).

Webhook URLs to configure on the Twilio number:
```
Voice URL (HTTP POST):         https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming
Voice Status Callback (POST):  https://app.missedcallsdental.com/api/webhooks/twilio/voice/status
```

SMS is handled by the existing Messaging Service (shared). Add the new number to the Messaging Service in Twilio Console.

---

### Step 2 — Insert clinic row

```sql
INSERT INTO public.clinics (name, slug, timezone, is_active, sms_recovery_enabled)
VALUES (
  'Acme Dental',      -- displayed in SMS and voice greeting
  'acme-dental',      -- lowercase-hyphenated, used in logs and reset procedures
  'America/Chicago',  -- IANA timezone
  true,               -- is_active
  false               -- SMS off by default — do not change yet
);
```

Verify:
```sql
SELECT id, slug, name, is_active, sms_recovery_enabled FROM public.clinics WHERE slug = 'acme-dental';
-- Expected: is_active=true, sms_recovery_enabled=false
```

---

### Step 3 — Map Twilio number to clinic

```sql
INSERT INTO public.clinic_phone_numbers (clinic_id, phone_number, twilio_phone_number_sid, role, is_active)
VALUES (
  (SELECT id FROM public.clinics WHERE slug = 'acme-dental'),
  '+1XXXXXXXXXX',  -- E.164 Twilio number
  'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',  -- Phone Number SID (optional)
  'recovery',
  true
);
```

Verify:
```sql
SELECT cpn.phone_number, cpn.is_active, c.name, c.sms_recovery_enabled
FROM public.clinic_phone_numbers cpn
JOIN public.clinics c ON c.id = cpn.clinic_id
WHERE c.slug = 'acme-dental';
```

---

### Step 4 — Verify call recording only (SMS still off)

Ask the clinic contact (or use a test phone) to call the Twilio number and let it ring to completion.

Check DB:
```sql
SELECT event_type, external_id, received_at
FROM public.webhook_events
WHERE provider = 'twilio' AND event_type LIKE 'voice.%'
ORDER BY received_at DESC LIMIT 4;
-- Expected: voice.ringing then voice.completed events
```

Check no SMS was sent:
```sql
SELECT COUNT(*) FROM public.messages
WHERE clinic_id = (SELECT id FROM public.clinics WHERE slug = 'acme-dental')
  AND direction = 'outbound';
-- Expected: 0
```

---

### Step 5 — Verify forwarding preserves caller ID

If using conditional forwarding mode, the clinic must configure forwarding before this test.

Make a call from a personal test phone to the **clinic's main number** and let it ring without answering. Confirm:
1. The call forwards to the Twilio number.
2. The `from_number` in `call_events` matches the personal test phone, not the clinic's main number.

```sql
SELECT from_number, to_number, call_status, occurred_at
FROM public.call_events
WHERE clinic_id = (SELECT id FROM public.clinics WHERE slug = 'acme-dental')
ORDER BY occurred_at DESC LIMIT 1;
```

If `from_number` is the clinic's own number: forwarding is stripping the original caller ID. Do not enable SMS until this is resolved — recovery SMS would be sent to the wrong number.

---

### Step 6 — Verify STOP/START opt-out (before enabling SMS)

From the test phone, send `STOP` to the Twilio number.

Verify:
```sql
SELECT opted_out_at, opted_back_in_at
FROM public.opt_outs
WHERE clinic_id = (SELECT id FROM public.clinics WHERE slug = 'acme-dental');
-- Expected: opted_out_at is set, opted_back_in_at is null
```

Send `START` from the same phone. Verify `opted_back_in_at` is set.

---

### Step 7 — Enable SMS for the clinic (requires A2P approval + owner approval)

**Before this step:** confirm that A2P/Toll-Free Verification is approved in Twilio. See `A2P-10DLC-COMPLIANCE-READINESS.md` Section 6 (go/no-go checklist). Enabling live SMS without carrier compliance risks silent message filtering for all patients.

Only after A2P/toll-free is approved AND Steps 4–6 pass AND owner explicitly approves:

```sql
UPDATE public.clinics
SET sms_recovery_enabled = true
WHERE slug = 'acme-dental';
```

Then switch `SMS_RECOVERY_MODE` from `owner_test` to `live` in Vercel env vars and redeploy:

```
SMS_RECOVERY_MODE = live
```

Remove `SMS_TEST_ALLOWED_TO` or leave it — it has no effect in `live` mode.

Verify health after redeploy:
```
GET https://app.missedcallsdental.com/api/health
```

---

### Step 8 — First live SMS verification

Make one test missed call from the clinic test phone to the Twilio number.

Expected sequence:
1. Voice greeting plays: *"Thanks for calling {clinic_name}. Sorry we missed you. We'll text you now…"*
2. Call ends cleanly.
3. SMS arrives on test phone: *"Hi, this is {clinic_name}. We missed your call. Would you like us to help schedule an appointment?"*
4. SMS arrives **after** the call ends, not during.

Verify:
```sql
SELECT direction, status, sent_at FROM public.messages
WHERE clinic_id = (SELECT id FROM public.clinics WHERE slug = 'acme-dental')
ORDER BY sent_at DESC LIMIT 2;
-- Expected: one outbound row, status=accepted or queued
```

---

### Step 9 — Verify duplicate suppression

Make a second call from the same test phone within 24 hours without resetting.

Expected: voice greeting plays the repeat-call variant (*"…We already sent a text…"*). No second SMS arrives.

---

## 4. Go-Live Safety Checklist

Before declaring a clinic live for real patient calls:

- [ ] `SMS_RECOVERY_MODE` changed to `live` in Vercel
- [ ] Redeployment completed and `/api/health` passes
- [ ] `clinics.sms_recovery_enabled = true` for this clinic only
- [ ] `clinics.is_active = true`
- [ ] Forwarding tested and caller ID is preserved (if forwarding mode)
- [ ] STOP/START opt-out verified in DB
- [ ] Duplicate suppression verified
- [ ] SMS arrives after call ends, not during
- [ ] SMS copy approved by owner: *"Hi, this is {clinic_name}. We missed your call. Would you like us to help schedule an appointment?"*
- [ ] Voice greeting copy approved by owner
- [ ] Rollback command noted and ready (see Section 5)
- [ ] Twilio A2P/10DLC or Toll-Free Verification approved (see `A2P-10DLC-COMPLIANCE-READINESS.md`)
- [ ] Owner understands system limitations (no reply routing, no dashboard yet)

---

## 5. Rollback and Offboarding Checklist

All commands take effect immediately — no code change or redeploy required.

**Disable SMS only (keep call recording):**
```sql
UPDATE public.clinics SET sms_recovery_enabled = false WHERE slug = 'acme-dental';
```

**Disable clinic entirely (stops all lookups and call recording):**
```sql
UPDATE public.clinics SET is_active = false WHERE slug = 'acme-dental';
```

**Disable phone mapping only (stops routing without touching the clinic row):**
```sql
UPDATE public.clinic_phone_numbers SET is_active = false
WHERE phone_number = '+1XXXXXXXXXX';
```

**Verify no future SMS after disable:**
```sql
SELECT is_active, sms_recovery_enabled FROM public.clinics WHERE slug = 'acme-dental';
-- Expected: sms_recovery_enabled=false or is_active=false
```

Historical records (`call_events`, `messages`, `webhook_events`) are preserved on all three options.

---

## 6. Clinic-Facing Setup Instructions

Use this draft message when communicating with the clinic. Adjust tone and details as needed. Do not expose internal system names, Supabase, Vercel, or raw Twilio SIDs.

---

**Subject: Setting up your missed-call recovery — what you need to do**

Hi [Name],

We're setting up your missed-call recovery service. Here is what you'll need to do on your end.

**Your recovery number**

We'll assign you a dedicated phone number. When a patient calls your main number and you miss the call, their call will be forwarded to this recovery number. The system will leave the patient a brief message and send them a text.

**What you need to configure**

Ask your phone provider to forward calls from your main clinic number to your recovery number when:
- No one answers (required)
- The line is busy (recommended)

Do not set unconditional forwarding — this is important. You still want your front desk to answer calls normally. Only missed/busy calls should forward.

If you use a VoIP system like RingCentral, Dialpad, or Google Voice, the setting is usually called *"Call Forwarding When Unanswered"* or *"No Answer Forwarding."* We can provide specific instructions for your provider if needed.

**What patients will experience**

When a call forwards to the recovery number:
1. The patient hears a brief message: *"Thanks for calling [Your Practice Name]. Sorry we missed you. We'll text you now so you can request an appointment or a call back."*
2. After the call ends, the patient receives a text from your recovery number: *"Hi, this is [Your Practice Name]. We missed your call. Would you like us to help schedule an appointment?"*
3. If the patient has previously opted out, no text is sent.

**To opt out of messages**

Patients can reply STOP at any time to stop messages, and START to resume. This is handled automatically.

**Test before going live**

Before we turn on real patient SMS, we'll run a test call together to confirm everything is working correctly.

Please let us know:
1. Which phone provider handles your main clinic line.
2. The main office phone and ZIP code used during Create office profile (for local number preparation).
3. Any questions about the setup.

---

## 7. Internal Operator Checklist

Short checklist for the operator or agent running this onboarding. Run in order.

```
[ ] Clinic information collected (Section 1)
[ ] Onboarding mode decided (Section 2)
[ ] Twilio number provisioned and webhooks configured (Step 1)
[ ] Clinic row inserted in DB with sms_recovery_enabled=false (Step 2)
[ ] Phone mapping inserted in DB (Step 3)
[ ] Test call verified — call recording working, SMS still off (Step 4)
[ ] Forwarding tested — caller ID preserved (Step 5)
[ ] STOP/START tested in DB (Step 6)
[ ] Owner approval received to enable SMS
[ ] sms_recovery_enabled set to true in DB (Step 7)
[ ] SMS_RECOVERY_MODE=live in Vercel and redeployed (Step 7)
[ ] First live SMS test passed (Step 8)
[ ] Duplicate suppression test passed (Step 9)
[ ] Go-live safety checklist signed off (Section 4)
[ ] Rollback command documented and tested (Section 5)
[ ] Clinic-facing instructions sent to owner (Section 6)
```

---

## Notes and Constraints

- Current SMS copy is fixed. Personalization by time of day or intent is a future milestone.
- The system does not yet detect whether a caller replied or booked. All opportunity tracking is manual until the dashboard is built.
- A2P/10DLC compliance must be verified before enabling live patient SMS. Current Twilio account is full (not trial). Toll-free number compliance may differ from 10DLC local number compliance.
- See `05-sms-rules-and-templates.md` for future SMS templates.
- See `08-compliance-and-onboarding.md` for the full future onboarding vision.
- See `OPERATIONS-RUNBOOK.md` Section 11 for the quick DB command reference.

---

## Automated Onboarding Path (added 2026-05-26)

The system now supports an automated onboarding flow for new clinics
end-to-end. The manual operator path below remains valid as a fallback,
but the default for any new clinic is the automated flow.

### Automated flow at a glance

1. Owner visits the public marketing site
   (`https://missedcallsdental.com`) and submits their work email
   (the public form is email-only; owner name is collected later in onboarding).
2. `POST /api/setup-requests` creates a setup request, issues a secure
   token (hash stored in DB), and emails a setup link of the form:

   ```
   https://app.missedcallsdental.com/setup/<setup-token>
   ```

3. Owner opens the setup link.
4. Owner fills the clinic setup form. **Step 1 collects only three fields**:
   clinic name, main office phone (any common U.S. format — normalized to
   E.164 internally), and ZIP code. Owner email comes from the verified
   setup request. Other details (legal name, owner contact phone, timezone,
   test patient phone, setup mode) are collected later only when they are
   actually required for the next step. See `AGENTS.md` →
   "Form and Onboarding Scope Rule".
5. App searches Twilio for available local US numbers with Voice + SMS
   capability, using the ZIP code and/or the area code derived from the
   main office phone.
6. Owner picks an "office texting number" and clicks **Use this
   number**.
7. App purchases the chosen Twilio number (only when
   `TWILIO_NUMBER_PURCHASE_ENABLED=true`), configures voice + SMS
   webhooks, and stores the mapping in `clinic_phone_numbers` with
   `role='office_texting'`.
8. App shows the **Your office texting number is ready** status page
   with forwarding and QA instructions.

SMS remains disabled at this point. Live customer SMS still requires:

- Twilio Toll-Free / A2P compliance approval.
- QA pass (forwarding test, caller-ID preservation, owner-test SMS QA).
- Explicit owner approval to flip
  `SMS_RECOVERY_MODE=live` and `clinics.sms_recovery_enabled=true` for
  that single clinic.

### Test clinic for controlled QA

The test clinic main phone for the controlled Google Voice test is:

```
+12245329257
```

This is the clinic-side number, **not** a Twilio number. The assigned
Twilio office texting number is separate. Google Voice must forward
missed/unanswered calls from this clinic number to the assigned Twilio
number. The first QA test must verify caller ID preservation: Twilio
must receive `From` as the test patient phone, not as the Google Voice
clinic number. If caller ID fails, do not enable SMS for that clinic.

---

## Country scope (updated 2026-05-27 — U.S.-only MVP)

Automated onboarding is now **United States only**. The clinic setup
form does not show a country selector; the backend forces
`country = 'US'` and rejects any non-US payload with:

```
Automated setup is currently available for U.S. clinics only.
```

International onboarding can be added later as separate modules.

### Local number default (no customer catalog)

Current onboarding defaults to automatic local number preparation/reservation.
The customer should not manually choose from a broad number catalog as part of default onboarding.
Toll-free can remain an alternate/reference path for special cases, but it is not the main MVP onboarding path.

Owner number **request** (2026-06-02, multi-number 2026-06-03): once a payment method is
saved, the owner can search local numbers on `/account → Phone numbers` and click
**Request this number** (first/included number) or **Request additional number** (a paid
$20/month number, which also requires checking the explicit authorization). This **saves a
request for admin review** (`public.clinic_number_requests`, status `pending`) — it is not a
purchase or assignment. It does **not** purchase, reserve, assign, provision, or activate a
number, and does not touch `clinic_phone_numbers` or `sms_recovery_enabled`. Multiple
different open requests (and existing assigned numbers) coexist; an exact duplicate request
is de-duped. The platform admin reviews each requested number (shown in the admin clinic
console) and finishes assignment through the existing gated admin **Add number** flow. Apply
`supabase/migrations/20260602000200_clinic_number_requests.sql` and
`supabase/migrations/20260603000100_clinic_number_request_billing.sql` before using it.

### Production safety still applies

- `TWILIO_NUMBER_PURCHASE_ENABLED=true` is the only switch that
  permits a real purchase. Keep it `false` for dry runs.
- Onboarding never sets `clinic.sms_recovery_enabled=true`.
- The Toll-Free Verification submission packet lives in
  `TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md`.

### Pricing + additional numbers (2026-06-03)

Plan/pricing is documented in `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` and
sourced from `config/billing.config.ts`: $99/mo includes 1 business number +
1,000 call minutes + 1,000 SMS segments (shared); additional numbers $20/mo each
(billed only after activation); overage $0.07/min, $0.06/SMS segment. An owner may
hold several assigned numbers and several open requests; the first is included and
each extra requires an explicit $20/mo authorization (stored as a consent
snapshot). Pending requests are never charged, and a requested number is never
purchased/assigned until the operator completes the gated admin Add number flow.
Live Stripe subscription/usage billing remains a later milestone — no
charge/subscription/invoice is created here.
