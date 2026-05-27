# Automated Clinic Onboarding Workflow — Build Guide

Status: Source of truth  
Audience: AI coding agent / implementation agent  
Project: Missed Calls Dental  
Last updated: 2026-05-26  
Purpose: Build the automated onboarding workflow for new dental clinics.

This document defines the final onboarding workflow. It is not a brainstorming note, not a prompt, and not a list of optional approaches. Implement the workflow exactly as specified here unless a hard technical blocker is found. If a blocker is found, stop and report it before changing the product direction.

---

## 1. Final Product Outcome

The finished workflow must let a dental clinic complete setup without a human operator manually buying a number or manually inserting clinic phone mappings.

Final production flow:

1. Clinic owner enters their work email on the public website (email-only form;
   owner name is collected later during onboarding).
2. Backend creates a setup request.
3. Backend generates a secure one-time setup token.
4. Backend sends a setup email containing a unique setup link.
5. Clinic owner opens the setup link.
6. Clinic owner completes the clinic setup form.
7. Backend searches available Twilio local numbers with Voice + SMS capability.
8. Clinic owner chooses an office texting number from the available numbers.
9. Backend purchases the selected Twilio number after the owner clicks `Use this number`.
10. Backend configures Twilio webhooks on the purchased number.
11. Backend creates or updates the clinic record.
12. Backend creates the clinic phone mapping.
13. SMS remains disabled by default.
14. The app shows forwarding and QA instructions.
15. QA is completed.
16. Live SMS is enabled only after compliance approval, QA pass, and explicit owner approval.

The clinic must not manually buy a Twilio number.  
The operator must not manually insert phone mappings for standard onboarding.  
The system must automate number search, number purchase, webhook setup, clinic creation, and phone mapping.

---

## 2. Domain and URL Rules

There are two production domains:

```text
Public marketing site:
https://missedcallsdental.com

App / backend / onboarding:
https://app.missedcallsdental.com
```

The public marketing site hosts the landing page and public legal pages.

The onboarding workflow must run on the app domain because it validates setup tokens, writes to the database, searches Twilio numbers, purchases Twilio numbers, and creates clinic records.

The setup link sent by email must have this format:

```text
https://app.missedcallsdental.com/setup/<setup-token>
```

`<setup-token>` is the raw secure token shown only in the emailed setup URL. Store only the token hash in the database.

Do not place the onboarding page under the static GitHub Pages site.  
Do not generate setup links from request `Host` headers. Use the configured trusted app base URL.  
Do not send links using `https://missedcallsdental.com/setup/<token>`. That is the wrong domain.

Required production env var:

```text
APP_BASE_URL=https://app.missedcallsdental.com
PUBLIC_SITE_URL=https://missedcallsdental.com
```

Each setup request receives its own unique setup link.

---

## 3. Customer-Facing Terminology

Do not use `recovery number` in customer-facing UI.

Use:

```text
office texting number
```

The number selection page title must be:

```text
Choose your office texting number
```

The subtitle must be:

```text
This is an additional number for missed-call text follow-ups. It will not replace your existing office phone number.
```

The selection button must be:

```text
Use this number
```

After successful number purchase, show:

```text
Your office texting number is ready
```

The explanation must be:

```text
Use this number for missed-call forwarding or tracking. Your existing office phone number does not change.
```

Internal code and internal docs may use technical names such as Twilio number, assigned number, recovery number, or tracking number. Public UI must use “office texting number.”

---

## 4. Required Onboarding Screens

### Screen 1 — Public Setup Request

The existing public website form is the entry point.

Required fields:

- Work email (the only field on the public form)

Optional fields (backward-compatible; `"Clinic owner"` fallback used when omitted):

- Full name

On submit:

1. Send request to backend endpoint `POST /api/setup-requests`.
2. Create setup request in the database.
3. Generate a secure raw setup token.
4. Store only the token hash in the database.
5. Create setup link using `APP_BASE_URL`.
6. Send setup email to the clinic owner.
7. Redirect to confirmation page.

Confirmation page message:

```text
Check your email for your secure setup link. Your office texting number will be selected during setup. Your existing office phone number will not be replaced.
```

The setup request must not search Twilio numbers.  
The setup request must not buy a Twilio number.  
The setup request must not create a live clinic.  
The setup request must not enable SMS.

### Screen 2 — Setup Link Page

Route:

```text
/setup/[token]
```

Production URL format:

```text
https://app.missedcallsdental.com/setup/<setup-token>
```

The page must validate the setup token.

If the token is invalid, expired, or already completed, show:

```text
This setup link is invalid or expired. Please request a new setup link.
```

If the token is valid, show the clinic setup form.

### Screen 3 — Clinic Setup Form

Required fields:

- Public-facing clinic name
- Legal/business name
- Main office phone number
- Timezone
- Owner/admin contact name
- Owner/admin email
- Owner/admin phone
- Test patient phone for QA
- Setup mode

Setup mode values:

```text
conditional_forwarding
tracking_number
google_voice_forwarding_test
```

Required helper text:

```text
Your main office number stays the same. We will help you choose an additional office texting number for missed-call follow-ups.
```

On submit:

1. Validate all required fields.
2. Normalize phone numbers to E.164.
3. Save clinic setup data.
4. Create or update the clinic record.
5. Set setup request status to `clinic_details_completed`.
6. Continue to the office texting number search step.

### Screen 4 — Office Texting Number Search

Title:

```text
Choose your office texting number
```

Subtitle:

```text
This is an additional number for missed-call text follow-ups. It will not replace your existing office phone number.
```

Search behavior:

1. Extract area code from the clinic main office phone number.
2. Search available Twilio local US numbers.
3. Require both Voice and SMS capability.
4. Exclude numbers with address requirements when possible.
5. Return 5–10 available numbers.
6. Mark the best matching number as `Recommended`.
7. Allow the clinic owner to search a different area code.
8. Do not purchase any number during search.

Each number card must show:

- Phone number
- Area code / region label when available
- `Recommended` badge for the highest-ranked number
- `Use this number` button

Recommended number ranking:

1. Exact same area code as clinic main office phone
2. Voice + SMS capable
3. No address requirement
4. Same state or nearby region
5. Cleaner/simple-looking number pattern

The system must not show numbers that cannot support both Voice and SMS.

### Screen 5 — Number Purchase and Configuration

When the clinic owner clicks `Use this number`, the backend must:

1. Confirm the setup token is valid.
2. Confirm the clinic has no active assigned office texting number.
3. Confirm `TWILIO_NUMBER_PURCHASE_ENABLED=true`.
4. Attempt to purchase the selected Twilio number.
5. Configure voice incoming webhook.
6. Configure voice status callback.
7. Configure inbound SMS webhook.
8. Configure SMS status callback.
9. Add the number to the Messaging Service when required by current architecture.
10. Store the Twilio Phone Number SID.
11. Create or update `clinic_phone_numbers`.
12. Set clinic setup status to `number_assigned`.
13. Set setup request status to `number_assigned`.
14. Keep `sms_recovery_enabled=false`.

Webhook URLs:

```text
Voice incoming:
https://app.missedcallsdental.com/api/webhooks/twilio/voice/incoming

Voice status:
https://app.missedcallsdental.com/api/webhooks/twilio/voice/status

Inbound SMS:
https://app.missedcallsdental.com/api/webhooks/twilio/messaging/incoming

SMS status:
https://app.missedcallsdental.com/api/webhooks/twilio/messaging/status
```

If selected number purchase fails because the number is no longer available, show:

```text
That number is no longer available. Please choose another number.
```

Then return to number search.

The purchase function must be idempotent at clinic level:

- If the clinic already has an active office texting number, do not purchase a second number.
- Return the existing assigned number.
- Show the setup status page.

### Screen 6 — Setup Status Page

After successful number purchase and configuration, show:

```text
Your office texting number is ready
```

Required content:

- Selected office texting number
- Reminder that the main office number is not replaced
- SMS status: off by default
- Forwarding instructions
- QA checklist

Required message:

```text
Your existing office phone number does not change. To recover missed calls, forward unanswered or busy calls from your main office number to your office texting number.
```

Next steps shown to clinic:

1. Configure no-answer and busy forwarding from the main office phone number to the office texting number.
2. Make a test call.
3. Confirm caller ID is preserved.
4. Confirm the call is recorded.
5. Complete SMS QA before go-live.

---

## 5. Email Setup Link Requirements

Implement real setup email delivery.

Required file:

```text
lib/email/setup-link-email.ts
```

Required env vars:

```text
RESEND_API_KEY
SETUP_EMAIL_FROM
APP_BASE_URL
PUBLIC_SITE_URL
```

Email subject:

```text
Complete your Missed Calls Dental setup
```

Email body must include:

- Clinic owner name
- Setup link
- Statement that the existing office phone number will not be replaced
- Statement that the office texting number will be selected during setup
- Support email

Required email copy:

```text
Hi {owner_name},

Use the secure link below to complete your Missed Calls Dental setup:

{setup_link}

During setup, you will choose an office texting number for missed-call follow-up texts. This is an additional number and will not replace your existing office phone number.

If you did not request this setup link, you can ignore this email.

Missed Calls Dental
support@missedcallsdental.com
```

Production must not pretend that email was sent. If email delivery fails, show a clear error and keep the setup request in `requested` status.

---

## 6. Setup Token Security

Setup tokens must follow these rules:

- Generated with a cryptographically secure random generator.
- Long enough to resist brute force.
- Stored only as a hash in the database.
- Linked to exactly one setup request.
- Expire after a fixed lifetime.
- Invalidated after successful onboarding completion.
- Rate-limited on validation attempts.
- Never printed in logs.
- Never stored raw in the database.
- Sent only over HTTPS.
- Generated using trusted `APP_BASE_URL`, not request host headers.

Recommended token lifetime:

```text
72 hours
```

Recommended token byte length:

```text
32 random bytes minimum
```

---

## 7. Database Requirements

Add migrations only when a required table or field is missing.

### setup_requests

Required fields:

```text
id
owner_full_name
owner_email
setup_token_hash
status
created_at
updated_at
expires_at
completed_at
clinic_id
last_email_sent_at
email_status
```

Statuses:

```text
requested
email_sent
clinic_details_completed
number_selected
number_assigned
qa_pending
qa_passed
ready_for_approval
active
cancelled
expired
```

Store only token hash in the database. Do not store raw setup tokens.

### clinics

Required fields must support:

```text
id
name
slug
legal_business_name
main_phone
timezone
owner_contact_name
owner_contact_email
owner_contact_phone
test_patient_phone
setup_status
is_active
sms_recovery_enabled
created_at
updated_at
```

Required defaults:

```text
is_active = true
sms_recovery_enabled = false
setup_status = setup_pending
```

### clinic_phone_numbers

Required fields must support:

```text
id
clinic_id
phone_number
twilio_phone_number_sid
role
is_active
created_at
updated_at
```

Role for assigned office texting number:

```text
office_texting
```

The backend may internally treat this as the Twilio recovery/tracking number, but the UI must display “office texting number.”

---

## 8. Twilio Number Search

Create a server-side Twilio number search function.

Input:

```text
area_code
country = US
limit = 10
```

Output:

```text
phone_number
friendly_name
locality
region
postal_code
capabilities.voice
capabilities.sms
address_requirements
recommended
```

Rules:

- Search only local US numbers.
- Return only numbers with Voice + SMS capability.
- Prefer numbers with `address_requirements=none`.
- Mark the highest-ranked number as recommended.
- Do not purchase numbers in the search function.
- Do not expose Twilio credentials to the browser.

---

## 9. Twilio Number Purchase

Create a server-side purchase function.

Input:

```text
clinic_id
selected_phone_number
setup_token
```

The function must:

1. Validate setup token.
2. Validate clinic ownership through the setup request.
3. Verify `TWILIO_NUMBER_PURCHASE_ENABLED=true`.
4. Purchase selected phone number through Twilio.
5. Configure voice and SMS webhook URLs.
6. Persist Twilio Phone Number SID.
7. Create or update `clinic_phone_numbers`.
8. Set clinic setup status to `number_assigned`.
9. Set setup request status to `number_assigned`.

The function must be idempotent at clinic level:

- If the clinic already has an active office texting number, do not purchase a second number.
- Return the existing assigned number.
- Show current status to the user.

---

## 10. SMS Safety Rules

Number assignment must not enable live SMS.

After onboarding:

```text
clinic.is_active = true
clinic.sms_recovery_enabled = false
clinic.setup_status = number_assigned
```

Live patient SMS remains blocked until all conditions are met:

1. Twilio Toll-Free / A2P compliance status is approved.
2. QA test passes.
3. Owner approves go-live.
4. `SMS_RECOVERY_MODE=live` is intentionally set.
5. `clinics.sms_recovery_enabled=true` is intentionally set for that clinic only.

Owner-test mode must continue to send SMS only to `SMS_TEST_ALLOWED_TO`.

---

## 11. Test Clinic Rule

Use this test clinic main phone for the controlled Google Voice test:

```text
+12245329257
```

This is the clinic’s main phone number for testing.

It is not a Twilio number.

The assigned Twilio office texting number is separate.

For the controlled test, Google Voice must forward missed/unanswered calls from the test clinic number to the assigned Twilio office texting number.

First QA test must verify caller ID preservation:

- Pass: Twilio receives `From` as the test patient phone.
- Fail: Twilio receives `From` as the Google Voice clinic number.

The system must not enable SMS for a clinic that fails caller ID validation.

---

## 12. QA Workflow

After number assignment, setup status is:

```text
qa_pending
```

QA steps:

1. Call the clinic main phone from the test patient phone.
2. Let the call forward to the office texting number.
3. Confirm `voice/incoming` webhook is hit.
4. Confirm `voice/status` webhook is hit after call completion.
5. Confirm `call_events` row is created.
6. Confirm caller ID is preserved.
7. Confirm no SMS is sent while `sms_recovery_enabled=false`.
8. Approve owner-test SMS QA for the test patient phone.
9. Confirm owner-test SMS sends only to allowlisted test patient phone.
10. Confirm SMS sends after call completion.
11. Confirm duplicate suppression.
12. Confirm STOP blocks future recovery SMS.
13. Confirm START clears opt-out.
14. Mark QA as passed.

When QA passes:

```text
clinic.setup_status = qa_passed
```

Do not enable live SMS at QA pass.

---

## 13. Production Go-Live Gate

The system must not automatically move any clinic to live SMS.

Required state before live activation:

```text
setup_status = qa_passed
sms_recovery_enabled = false
```

Activation requires explicit operator action:

1. Confirm Twilio compliance approval.
2. Confirm owner approval.
3. Confirm rollback command is ready.
4. Set `SMS_RECOVERY_MODE=live`.
5. Set `clinics.sms_recovery_enabled=true` for that clinic only.
6. Redeploy if required.
7. Run one controlled live test.
8. Monitor logs and delivery status.

---

## 14. Required Environment Variables

Required production variables:

```text
APP_BASE_URL=https://app.missedcallsdental.com
PUBLIC_SITE_URL=https://missedcallsdental.com
RESEND_API_KEY
SETUP_EMAIL_FROM
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_MESSAGING_SERVICE_SID
TWILIO_NUMBER_PURCHASE_ENABLED
```

Behavior:

```text
TWILIO_NUMBER_PURCHASE_ENABLED=false
```

Number search is allowed. Number purchase is blocked.

```text
TWILIO_NUMBER_PURCHASE_ENABLED=true
```

Number purchase is allowed.

Production purchase must only run when this variable is true.

---

## 15. Required API / Route Structure

Implement these routes or the closest equivalent required by the framework:

```text
POST /api/setup-requests
GET  /setup/[token]
POST /api/onboarding/[token]/clinic
GET  /api/onboarding/[token]/numbers?area_code=XXX
POST /api/onboarding/[token]/numbers/purchase
GET  /setup/[token]/status
```

All mutation routes must:

- Validate setup token.
- Validate token expiration.
- Use server-side credentials only.
- Return safe errors.
- Never expose secrets.
- Never print setup tokens in logs.

---

## 16. Documentation Updates Required

Update these files in the same implementation task:

```text
MVP_BUILD_DOCS/SETUP-LOG.md
MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md
MVP_BUILD_DOCS/FIRST-CLINIC-ONBOARDING.md
MVP_BUILD_DOCS/MANIFEST.md
```

Create or update this file:

```text
MVP_BUILD_DOCS/ONBOARDING-WORKFLOW-BUILD-GUIDE.md
```

Documentation must state:

- Setup links use `https://app.missedcallsdental.com/setup/<setup-token>`.
- Customer-facing term is “office texting number.”
- The office texting number does not replace the clinic’s existing phone number.
- Clinic owner chooses from available Twilio numbers.
- System purchases and configures the selected number automatically.
- SMS remains off after number assignment.
- QA and compliance approval are required before live SMS.
- The test clinic main phone is `+12245329257`.
- Google Voice forwarding test must verify caller ID preservation.

---

## 17. Implementation Boundaries

Do not:

- Enable live SMS.
- Change existing Twilio toll-free verification status.
- Delete or release existing Twilio numbers.
- Change Stripe.
- Print secrets.
- Commit `.env.local`.
- Add manual operator-only steps as the standard onboarding flow.
- Use “recovery number” in public UI.
- Claim HIPAA compliance.
- Send live patient SMS automatically.
- Purchase a Twilio number when `TWILIO_NUMBER_PURCHASE_ENABLED` is not true.

---

## 18. Required Checks

Run:

```text
npm run typecheck
npm run build
```

If migrations are added, document:

- migration file name
- fields/tables added
- whether migration was applied
- verification result

No live SMS test may run without owner approval.

---

## 19. Commit

Commit only relevant source, migration, and documentation files.

Commit message:

```text
feat: add automated clinic onboarding workflow
```

---

## 20. Final Report Format

The final report must include:

```text
Files changed:
Migration added: yes/no
Setup request flow added: yes/no
Setup token/link flow added: yes/no
Setup links use https://app.missedcallsdental.com/setup/<token>: yes/no
Email delivery implemented: yes/no
Clinic onboarding form added: yes/no
Office texting number wording used in UI: yes/no
“Does not replace existing office phone number” wording included: yes/no
Twilio number search added: yes/no
Number selection UI added: yes/no
Number purchase implemented: yes/no
Purchase safety flag added: yes/no
Twilio webhook auto-configuration implemented: yes/no
Clinic creation/update implemented: yes/no
clinic_phone_numbers mapping implemented: yes/no
SMS remains off by default: yes/no
Test clinic main phone documented: yes/no
Google Voice forwarding caller ID test documented: yes/no
Live SMS enabled: no
Twilio verification changed: no
Existing Twilio numbers deleted/released: no
Stripe changed: no
Typecheck: pass/fail
Build: pass/fail
Docs updated:
- SETUP-LOG.md yes/no
- OPERATIONS-RUNBOOK.md yes/no
- REPEATABLE-SETUP-CHECKLIST.md yes/no
- FIRST-CLINIC-ONBOARDING.md yes/no
- MANIFEST.md yes/no
- ONBOARDING-WORKFLOW-BUILD-GUIDE.md yes/no
Commit hash:
Pushed: yes/no
Blockers:
```
