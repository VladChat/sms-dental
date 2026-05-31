# Automated Clinic Onboarding Workflow — Build Guide

Status: Source of truth  
Audience: AI coding agent / implementation agent  
Project: Missed Calls Dental  
Last updated: 2026-05-28  
Purpose: Build the current customer onboarding flow around a simple Business Profile setup.

This file describes the current onboarding direction. It replaces the older flow where customers manually chose a Twilio number from a catalog.

---

## 1. Final Product Outcome

The finished workflow must let a dental clinic start setup with minimal input, then complete only the missing business/A2P information needed to prepare SMS activation.

Final customer flow:

1. Clinic owner starts setup from the public site or setup email.
2. Clinic owner opens a secure setup link.
3. Clinic owner creates an office profile with:
   - Clinic name
   - Main office phone
   - ZIP code
4. Backend creates/updates the business profile.
5. Backend prepares/reserves the best local number automatically from the clinic context.
6. Clinic owner lands on the Business Profile page.
7. Clinic owner completes Business Information.
8. Clinic owner completes A2P Approval Information.
9. Backend generates public business pages:
   - `/business/{slug}`
   - `/business/{slug}/privacy`
   - `/business/{slug}/sms-terms`
10. SMS remains inactive while carrier/A2P approval is pending.
11. Billing does not start until SMS recovery is active.

The customer must not manually buy a Twilio number.  
The customer must not manually choose from a number catalog in the default flow.  
The operator must not manually insert phone mappings for standard onboarding when the automated path is complete.  
The system should automate local number preparation/reservation, webhook setup where allowed, clinic creation, and phone mapping behind safety gates.

---

## 2. Domain and URL Rules

Public marketing site:

```text
https://missedcallsdental.com
```

App / onboarding / backend domain:

```text
https://app.missedcallsdental.com
```

Setup links must use:

```text
https://app.missedcallsdental.com/setup/<setup-token>
```

Generated business pages must use neutral route naming:

```text
https://app.missedcallsdental.com/business/{slug}
https://app.missedcallsdental.com/business/{slug}/privacy
https://app.missedcallsdental.com/business/{slug}/sms-terms
```

Do not use `/clinic/{slug}` for generated public pages.

Use `APP_BASE_URL` for setup links.  
Use `PUBLIC_SITE_URL` for links back to the marketing site.  
Do not build setup links from request host headers.

---

## 3. Customer-Facing Terminology

Use short, calm labels.

Preferred UI terms:

```text
Local number
SMS
Billing
Business Information
A2P Approval Information
Public Business Page
Login & Security
Billing History
```

Avoid customer-facing terms that sound internal or scary:

```text
Twilio number
carrier campaign submission
manual number catalog
Review & Submit
Submit for SMS approval
```

A2P card subtitle:

```text
Required for carrier approval before patient SMS can be activated.
```

---

## 4. Required Onboarding Screens

### Screen 1 — Public Setup Request

Public site form may collect only the work email or the currently approved lightweight setup request fields.

Current direction:

```text
Work email
```

Button:

```text
Continue setup
```

The public setup request must not search Twilio numbers.  
The public setup request must not buy a Twilio number.  
The public setup request must not create a live clinic.  
The public setup request must not enable SMS.

Future entry points may include Google and Apple login. These entry points must lead into the same onboarding flow.

---

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

If the token is valid and no office profile exists yet, show Create office profile.

---

### Screen 3 — Create Office Profile

Title:

```text
Create office profile
```

Required fields:

```text
Clinic name
Main office phone
ZIP code
```

Field helper text:

```text
Clinic name
Enter the public name patients know your office by.

Main office phone
Enter the phone number patients currently call.

ZIP code
We’ll use this ZIP code to prepare a local number for your office.
```

Button:

```text
Create office profile
```

On submit:

1. Validate the setup token.
2. Validate required fields.
3. Normalize the main office phone number to E.164 internally.
4. Keep MVP onboarding U.S.-only.
5. Save clinic name, main office phone, and ZIP code.
6. Create or update the business/clinic profile.
7. Trigger automatic local number preparation using existing safe Twilio logic.
8. Open the Business Profile page.

Do not ask for legal business name, EIN, owner phone, timezone, test phone, setup mode, or billing information on this screen.

---

### Screen 4 — Business Profile Page

This is the main customer setup/account page.

Top status strip:

```text
Local number: Preparing / Reserved
SMS: Preparing / Waiting for approval
Billing: Free trial ends in 21 days
```

Cards:

```text
Business Information
A2P Approval Information
Public Business Page
Billing
Billing History
Login & Security
Support
```

Do not create a customer-facing Review & Submit step.

---

## 5. Business Information Card

Purpose:

```text
One place for business details.
```

Fields:

```text
Clinic name
Main office phone
ZIP code
Legal business name
EIN / Tax ID
Business type
Business address
Website
```

Address fields:

```text
Street address
City
State
ZIP code
```

Prefill:

- Clinic name from Create office profile.
- Main office phone from Create office profile.
- ZIP code from Create office profile.

Website is optional.

Button:

```text
Save business information
```

After save:

1. Save/update the business profile.
2. Mark Business Information complete when required fields are filled.
3. Generate or update the business slug.
4. Generate or update public business pages when enough data exists.

Do not split clinic name, main office phone, and ZIP code into a separate Office Profile card.

---

## 6. A2P Approval Information Card

Title:

```text
A2P Approval Information
```

Subtitle:

```text
Required for carrier approval before patient SMS can be activated.
```

Purpose:

```text
Collect only the missing representative data required for A2P approval.
```

Business data from Business Information must be reused. Do not make the customer type the same business data twice.

Fields:

```text
Representative first name
Representative last name
Business title
Representative email
Representative phone
```

Prefill:

- Representative email from setup/login email when available.
- Representative phone from main office phone.
- Business details from Business Information.

No long helper text under representative phone. Prefill it and allow editing.

Generated SMS preview:

```text
Use case
Missed-call follow-up for patients who called the office.

Sample message
Hi, this is {{clinic_name}}. We missed your call. Reply here and our team will follow up. Reply STOP to opt out.
```

Checkbox:

```text
I am authorized to approve SMS setup for this business.
```

Button:

```text
Save A2P information
```

After save:

1. Save/update A2P representative information.
2. Mark A2P Approval Information complete when required fields are filled.
3. Keep `sms_recovery_enabled=false`.
4. Do not submit or modify live Twilio A2P/campaign resources in this task unless explicitly approved.

---

## 7. Public Business Page Card

This is not a customer input form.

Show generated links:

```text
/business/{slug}
/business/{slug}/privacy
/business/{slug}/sms-terms
```

Buttons:

```text
View business page
View privacy policy
View SMS terms
```

Generated page requirements:

- Public business name.
- Legal business name.
- Business address/contact.
- Missed-call SMS use case.
- STOP / HELP language.
- Privacy policy.
- SMS terms.
- Missed Calls Dental / Dental SMS identified as the technology/service provider.

Use the generated business page as the primary supporting URL for SMS/A2P review.  
The clinic’s own website remains optional supporting information.

---

## 8. Billing and Billing History Cards

Billing card shows:

```text
Free trial ends in 21 days
Billing status: Not started
Plan: Missed-call SMS recovery
```

Button:

```text
View billing
```

Billing History before payments:

```text
No payments yet
```

Future billing history table shape:

```text
Date
Amount
Status
Invoice
```

Do not create live Stripe resources in this task.  
Do not start billing before SMS recovery is active.

---

## 9. Login & Security Card

For current email-link flow:

```text
Login method: Email link
Login email: prefilled
Password: Not created
Two-factor authentication: Off
```

Buttons:

```text
Create password
Set up 2FA
```

Future Google/Apple states may be supported later, but do not implement provider auth unless explicitly scoped.

---

## 10. Support Card

Show:

```text
Need help?
```

Button:

```text
Contact support
```

---

## 11. Setup Email Requirements

Implement real setup email delivery when email flow is used.

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

- Setup link.
- Statement that setup is secure.
- Statement that the existing office phone number is not replaced.
- Support email.

Suggested email copy:

```text
Hi,

Use the secure link below to continue your Missed Calls Dental setup:

{setup_link}

Your existing office phone number will not be replaced. We’ll use your office details to prepare your missed-call setup.

If you did not request this setup link, you can ignore this email.

Missed Calls Dental
support@missedcallsdental.com
```

Production must not pretend that email was sent. If email delivery fails, show a clear error and keep the setup request in a safe pending/requested status.

---

## 12. Setup Token Security

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

## 13. Database Requirements

Add migrations only when a required table or field is missing.

Data model must support future super-admin listing of:

- all business profiles
- local number status
- SMS/A2P status
- billing status
- generated business page status
- Twilio identifiers
- Stripe identifiers
- activity/history

Suggested setup request fields:

```text
id
work_email / owner_email
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

Suggested clinic/business profile fields:

```text
id
name
slug
main_phone
office_zip
legal_business_name
ein_tax_id
business_type
business_address_street
business_address_city
business_address_state
business_address_zip
website
setup_status
local_number_status
a2p_status
billing_status
is_active
sms_recovery_enabled
created_at
updated_at
```

Suggested A2P representative fields:

```text
representative_first_name
representative_last_name
representative_business_title
representative_email
representative_phone
representative_authorized_at
```

Suggested phone number fields:

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

Default values:

```text
is_active = true
sms_recovery_enabled = false
billing_status = not_started
local_number_status = preparing
a2p_status = not_submitted or waiting_for_information
```

---

## 14. Twilio Local Number Preparation

Create or reuse a server-side Twilio local number search/preparation function.

Input should come from clinic context, not manual customer selection:

```text
main_office_phone
ZIP code
country = US
```

Rules:

- Search only local US numbers for the default MVP path.
- Require Voice + SMS capability where applicable.
- Prefer numbers near the office ZIP / local area.
- Prefer no address requirements when possible.
- Automatically select/prep the best suitable number.
- Do not expose Twilio credentials to the browser.
- Do not expose a manual number catalog by default.
- Keep actual purchase/reservation behind existing safety gates.

Failure behavior:

```text
Local number: Preparing
```

If automated preparation fails, keep the setup usable and surface the issue to operator/admin handling later. Do not ask the customer to troubleshoot Twilio.

---

## 15. Twilio Number Purchase / Reservation Safety

Purchase/reservation must be server-side only.

The function must:

1. Validate setup token or authenticated session.
2. Validate clinic ownership through the setup request/session.
3. Verify purchase/reservation is allowed by the current safety flag.
4. Purchase/reserve the selected best local number only when allowed.
5. Configure voice/SMS webhook URLs where allowed.
6. Persist Twilio Phone Number SID.
7. Create or update `clinic_phone_numbers`.
8. Set local number status to `reserved` when successful.
9. Keep `sms_recovery_enabled=false`.

The function must be idempotent at clinic level:

- If the clinic already has an active local number, do not purchase/reserve a second number.
- Return the existing assigned number/status.
- Show current status to the user.

---

## 16. SMS Safety Rules

Number preparation/reservation must not enable live SMS.

After onboarding:

```text
clinic.is_active = true
clinic.sms_recovery_enabled = false
billing_status = not_started
```

Live patient SMS remains blocked until all conditions are met:

1. Carrier/A2P approval is complete.
2. QA test passes.
3. Owner approves go-live.
4. `SMS_RECOVERY_MODE=live` is intentionally set.
5. `clinics.sms_recovery_enabled=true` is intentionally set for that clinic only.

Owner-test mode must continue to send SMS only to `SMS_TEST_ALLOWED_TO`.

---

## 17. QA Workflow

QA steps:

1. Confirm Create office profile saves clinic name, main office phone, and ZIP code.
2. Confirm local number status shows Preparing or Reserved.
3. Confirm Business Information saves and reuses prefilled fields.
4. Confirm A2P Approval Information pre-fills representative email and phone when available.
5. Confirm generated `/business/{slug}` pages render.
6. Confirm no live SMS is sent while `sms_recovery_enabled=false`.
7. Confirm owner-test SMS sends only to allowlisted test numbers.
8. Confirm SMS sends after call completion in owner-test mode.
9. Confirm duplicate suppression.
10. Confirm STOP blocks future recovery SMS.
11. Confirm START clears opt-out.

Do not enable live SMS at QA pass.

---

## 18. Production Go-Live Gate

The system must not automatically move any clinic to live SMS.

Required state before live activation:

```text
sms_recovery_enabled = false
billing_status = not_started
```

Activation requires explicit operator action:

1. Confirm carrier/A2P approval.
2. Confirm QA pass.
3. Confirm owner approval.
4. Confirm rollback command is ready.
5. Set `SMS_RECOVERY_MODE=live`.
6. Set `clinics.sms_recovery_enabled=true` for that clinic only.
7. Start billing only after SMS recovery is active.
8. Run one controlled live test.
9. Monitor logs and delivery status.

---

## 19. Required Environment Variables

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

Number search/preparation may run only in safe mode; purchase/reservation is blocked.

```text
TWILIO_NUMBER_PURCHASE_ENABLED=true
```

Purchase/reservation is allowed.

Production purchase/reservation must only run when this variable is true.

---

## 20. Required API / Route Structure

Implement these routes or the closest equivalent required by the framework:

```text
POST /api/setup-requests
GET  /setup/[token]
POST /api/onboarding/[token]/office-profile
GET  /business-profile or /setup/[token]/business-profile
POST /api/onboarding/[token]/business-information
POST /api/onboarding/[token]/a2p-information
GET  /business/{slug}
GET  /business/{slug}/privacy
GET  /business/{slug}/sms-terms
```

Internal APIs for local number preparation may exist, but must not expose a customer-facing number catalog by default.

All mutation routes must:

- Validate setup token or authenticated session.
- Validate token expiration.
- Use server-side credentials only.
- Return safe errors.
- Never expose secrets.
- Never print setup tokens in logs.

---

## 21. Documentation Updates Required

Update these files in the same implementation task when behavior changes:

```text
MVP_BUILD_DOCS/SETUP-LOG.md
MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md
MVP_BUILD_DOCS/FIRST-CLINIC-ONBOARDING.md
MVP_BUILD_DOCS/MANIFEST.md
MVP_BUILD_DOCS/ONBOARDING-WORKFLOW-BUILD-GUIDE.md
```

Documentation must state:

- Setup links use `https://app.missedcallsdental.com/setup/<setup-token>`.
- Create office profile asks only for clinic name, main office phone, and ZIP code.
- Business Information and A2P Approval Information are Business Profile cards.
- Local number preparation/reservation is automatic by default.
- Customer does not manually choose from a number catalog.
- Generated business pages use `/business/{slug}`.
- SMS remains inactive before carrier/A2P approval.
- Billing starts only after SMS recovery is active.
- Trial baseline is 21 days.

---

## 22. Implementation Boundaries

Do not:

- Enable live SMS.
- Submit or change live Twilio A2P/campaign resources without explicit approval.
- Change existing Twilio toll-free verification status.
- Delete or release existing Twilio numbers.
- Change Stripe live resources.
- Print secrets.
- Commit `.env.local`.
- Add manual operator-only steps as the standard onboarding flow.
- Claim HIPAA compliance.
- Send live patient SMS automatically.
- Purchase/reserve a Twilio number when the required safety flag is not true.

---

## 23. Required Checks

Run:

```text
npm run typecheck
npm run build
```

Run lint/tests when present.

If migrations are added, document:

- migration file name
- fields/tables added
- whether migration was applied
- verification result

No live SMS test may run without owner approval.

---

## 24. Commit

Commit only relevant source, migration, and documentation files.

Suggested commit message:

```text
feat: simplify onboarding around business profile setup
```

---

## 25. Final Report Format

The final report must include:

```text
Files changed:
Migration added: yes/no
Create office profile added: yes/no
Business Profile page added: yes/no
Business Information card added: yes/no
A2P Approval Information card added: yes/no
Public business pages added: yes/no
Setup links use https://app.missedcallsdental.com/setup/<token>: yes/no
Email delivery implemented: yes/no
Known values are prefilled: yes/no
Manual number catalog removed from default flow: yes/no
Automatic local number preparation implemented: yes/no
Purchase safety flag preserved: yes/no
Twilio webhook auto-configuration changed: yes/no
SMS remains off by default: yes/no
Billing starts only after SMS active: yes/no
Live SMS enabled: no
Twilio A2P/campaign changed: no
Existing Twilio numbers deleted/released: no
Stripe live resources changed: no
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

---

## Update 2026-05-28 — Activation checklist + approval field cleanup

The Business Profile page is now an **app-style activation checklist**: a left
step nav with small status badges and one open step at a time. Steps:

1. Business Information
2. A2P Approval Information
3. Compliance Pages
4. Phone Number Setup
5. SMS Activation
6. Billing

Customer-facing status text only: `Saved`, `Needs attention`, `Ready for review`,
`Generated`, `Waiting for approval`, `Billing starts after SMS activation`. No
false `Complete` status; saves show a subtle `Saved · <time>` instead of a large
green banner.

Field changes:

- **Business Type** uses the exact enum `PRIVATE_PROFIT` (default), `PUBLIC_PROFIT`,
  `NON_PROFIT`, `SOLE_PROPRIETOR`, `GOVERNMENT` — stored/submitted letter-for-letter.
- Business Information adds **Address line 2** and uses the label **EIN** (not
  "EIN / Tax ID").
- **A2P Approval Information** collects only first name, last name, email, phone,
  and the authorization checkbox. Business title, use case, and sample message are
  system-generated.
- **Compliance Pages** are shown as a clean card with View / Copy-link actions,
  not raw path pills.

Generated mini-site (`/business/{slug}`, `/privacy`, `/sms-terms`) shares one
source of truth, has consistent header/footer nav + a back link, includes a
mobile-information non-sharing statement on Privacy, calmer SMS consent wording,
and a single public service name ("Missed Calls Dental").

Canonical field mapping: **`SMS-APPROVAL-FIELD-MAPPING.md`**.

---

## Update 2026-05-30 — Account/settings dashboard (supersedes the checklist)

The Screen 4 page was redesigned from the app-style 6-step activation checklist
into a real customer **account/settings dashboard**. This supersedes the
"Update 2026-05-28" checklist layout above. Product logic is unchanged; the
experience, field grouping, and billing gate changed.

Layout: a left section nav + a right panel showing **one** active section.
Desktop = sticky left nav; mobile (≤860px) = the nav collapses to wrapping tabs
(no horizontal overflow). The first unfinished section opens by default; each
nav item has a small status dot.

Sections (in order):

1. **Business profile** (form) — clinic name, read-only login email, main office
   phone, full address (street, line 2, city, state, ZIP), website. Saved by
   `POST /api/onboarding/[token]/business-info`; marks `business_info_completed`.
2. **SMS approval** (form) — legal business name, business type, EIN, and the
   authorized representative (first/last/email/phone) + a short authorization
   checkbox ("Texting will start after approval."). Saved by
   `POST /api/onboarding/[token]/a2p`; advances `sms_status` to
   `waiting_for_approval`. The heavy "What we'll submit" review block was removed;
   the business-type helper is neutral ("Select the legal business structure that
   matches your registration.") with no silent `PRIVATE_PROFIT` default.
3. **Billing** (payment method) — "Payment method needed"/"Added", plan, 21-day
   trial, an "Add payment method" CTA (disabled pre-launch; Stripe-ready, **no
   raw card storage, no Stripe network call**), and "You will not be charged
   until SMS recovery is active and your trial period ends."
4. **Phone number** (read-only status) — gated on billing: with no payment method
   it shows "Payment method needed" + "Add a payment method to receive your phone
   number." + a CTA to Billing (never "locked"/"blocked"). With a payment method
   it shows the number status + Voice / Calls and SMS / Texting sub-statuses.
5. **Documents** — the generated compliance links (business profile, privacy,
   SMS terms) with View + Copy link. Moved here out of SMS approval.

Field ownership: legal business name, EIN, and business type are saved by the
SMS approval form (carrier-approval-only). The business address is edited once
in Business profile and reused for approval — never duplicated.

Billing gate: a payment method must exist before a phone number is
prepared/assigned. `hasPaymentMethod` is derived server-side from
`stripe_customer_id` / `billing_status`; no raw card data is ever collected or
stored. Real card capture is deferred to a Stripe-hosted/tokenized flow
(SetupIntent / Checkout / Payment Element).

Persistence: both save endpoints return DB-persisted values; the client
reconciles to the response (not optimistic input); the page is `force-dynamic`
and re-reads on reload; DB failures return a structured `save_failed` error.

Components: `BusinessProfile.tsx` is the dashboard orchestrator; sections live in
`BusinessProfileForm.tsx`, `SmsApprovalForm.tsx`, `BillingCard.tsx`,
`AssignedNumberCard.tsx`, `DocumentsCard.tsx`, with shared primitives in
`AccountUI.tsx` and types in `account-types.ts`. Styling uses `.acct-*` classes
(`.acct-layout` / `.acct-nav` / `.acct-panel` / `.acct-callout`).

Canonical field mapping: **`SMS-APPROVAL-FIELD-MAPPING.md`**.

---

## Update 2026-05-31 — Phone-first dashboard + clarity polish (current state)

This section is the authoritative description of the `/account` dashboard and
supersedes the layout details in the "Update 2026-05-30" section above (which
still described a 5-item nav with a Documents section and a first-incomplete
default — both no longer true).

Current dashboard:

- Renders at the clean `/account` URL. `/setup/{token}` is the email
  magic-entry link only; after "Continue setup" an httpOnly account-context
  cookie is set and the customer moves to `/account` (the long token never stays
  in the address bar).
- Left section nav + right active panel (one section at a time; wrapping tabs on
  mobile). **Nav order: Phone number → Business profile → SMS approval →
  Billing.** Phone number is first and opens by default — it is the customer's
  primary resource. The dashboard does NOT auto-open the first incomplete
  section. There is no Documents nav item.
- **Phone number** (status): assigned number or muted "Not assigned yet" + Voice
  / Calls and SMS / Texting sub-statuses. With no payment method, a gentle info
  callout: "Add a payment method to receive your phone number." + the no-charge
  line. No "Add payment method" button here.
- **Business profile** (form): clinic name, read-only login email, main office
  phone, full address, website. Saved by `business-info`.
- **SMS approval** (form): legal business name, business type, EIN, authorized
  representative. The public-page links are a compact text row
  ("Review public pages: Business profile · Privacy policy · SMS terms") directly
  above the authorization checkbox — not a Documents section, cards, table,
  View/Copy buttons, or URL pills. Saving marks the section `Complete`; a
  separate **Texting** row shows the real texting state (`Not active` →
  `Waiting for approval` → `Active`) so Complete is never mistaken for live
  texting. Saved by `a2p`.
- **Billing** (payment method): single `Needs setup` status (no duplicate
  badges), a secure payment-method visual, plan row
  (`Missed-call text follow-up · $99/mo`), a live trial countdown
  (`Free Trial ends in N days`, "Trial ended" at 0), and an active "Add payment
  method" button opening a safe modal ("Secure payment setup will open here when
  billing is connected.") — no card fields, no storage, no Stripe call.

Unified status vocabulary: `Complete`, `Active`, `Waiting for approval`,
`Pending`, `Needs setup` (amber dot — default for unfinished setup),
`Needs action` (amber alert — act-now states like `Trial ended`),
`Not started`, `Not active`, `Error` (red — real errors only).

Roadmap (not built): an owner-only `SMS & conversation settings` section belongs
in this `/account` area (first missed-call template, follow-up questions,
reply-handling, conversation handoff rules, what is passed to the front desk).
The front-desk workspace is a separate future product (missed-call
conversations, patient replies, request summaries, callback/booked/handled,
notes/tasks) and must not expose EIN, legal business details, billing/payment
method, SMS approval controls, or owner setup settings.

Canonical field mapping: **`SMS-APPROVAL-FIELD-MAPPING.md`**.
