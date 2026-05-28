# A2P/10DLC Compliance Readiness

Status: Active  
Audience: founder / operator / AI agent  
Last updated: 2026-05-26

This document covers what must be done before sending live SMS to real patients in the United States, the current compliance state of the system, and the recommended campaign registration approach.

**Cross-references:**
- `SMS-APPROVAL-FIELD-MAPPING.md` — **canonical** mapping of customer UI fields ↔ internal fields ↔ approval fields, the exact `Business Type` enum, and which values are system-generated vs. customer-entered.
- `FIRST-CLINIC-ONBOARDING.md` — Step 7 requires A2P status confirmed before enabling live SMS.
- `OPERATIONS-RUNBOOK.md` Section 11 — Step 5 (enable SMS) is blocked until A2P is resolved.
- `08-compliance-and-onboarding.md` — full compliance and consent design.
- `TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md` — copy-ready Toll-Free Verification submission packet.

> Note (2026-05-28): The customer-facing "A2P Approval Information" step now
> collects only first name, last name, email, phone, and an authorization
> checkbox. Business Type uses the exact enum (`PRIVATE_PROFIT`, `PUBLIC_PROFIT`,
> `NON_PROFIT`, `SOLE_PROPRIETOR`, `GOVERNMENT`). Use case, sample message,
> representative title, opt-in keywords, policy URLs, and the other registration
> fields are system-generated — see `SMS-APPROVAL-FIELD-MAPPING.md`.

---

## 1. Current Compliance State

### What is already correct

The system is designed around transactional (not promotional) use:

| Compliance factor | Current state |
|---|---|
| Use case | Transactional — SMS triggered by a missed call, one message per event |
| Trigger | Patient called first — not unsolicited outreach |
| Copy | No urgency, no promo, no medical advice, no AI mention |
| Frequency | One recovery SMS per 24-hour window per (clinic, patient) pair |
| Opt-out | STOP/START enforced at DB and Twilio platform level |
| Opt-in implied | Patient initiated the call — implied consent |
| No spam indicators | Single template, no bulk sends, no rate blasting |
| Live SMS gate | `SMS_RECOVERY_MODE=live` + `clinics.sms_recovery_enabled=true` — both required |
| Current mode | `owner_test` — only allowlisted owner phone receives SMS |

### What is not yet resolved

| Blocker | Details |
|---|---|
| A2P/10DLC campaign registration | Not yet submitted or registered with TCR (The Campaign Registry) |
| Toll-free verification | If using toll-free number (+1 8XX), must verify with Twilio for unfiltered delivery |
| Business identity verification | Twilio requires EIN, business name, address for Brand registration |
| Website requirement | Campaign registration requires a public website with compliant SMS messaging disclosure |
| Consent language | Registration requires documented opt-in/opt-out language |

**Live patient SMS must not be enabled until at least one of the following is resolved:**
- A2P 10DLC local number campaign approved by TCR, or
- Toll-free number verified with Twilio

---

## 2. A2P/10DLC vs. Toll-Free — Which Path to Choose

### Option A — 10DLC (local number, `+1 NXX`)

**Use when:** clinic cares about local area code identity, or will eventually use multiple local numbers.

Requirements:
- Register a Brand with TCR (business legal name, EIN, address, website, vertical).
- Register a Campaign under the Brand (use case, message flow, sample messages, opt-in method).
- Link the registered Campaign to the Twilio number.
- TCR review: typically 1–5 business days. Twilio passes through Brand + Campaign fees.
- Once approved: low-volume transactional campaigns typically have high delivery rates.

Risk: local numbers without 10DLC registration are filtered or blocked by US carriers.

### Option B — Toll-Free Verification (+1 8XX)

**Use when:** already using a toll-free number (current Twilio number is `+1 844 723 4944`).

Requirements:
- Submit Toll-Free Verification request to Twilio (not TCR).
- Provide: business name, website, use case description, sample message, opt-in description.
- Twilio review: typically 3–7 business days.
- Once approved: unfiltered delivery on toll-free numbers.

**Current situation:** the Twilio number assigned to this account (`+1 844 723 4944`) is a toll-free number. Toll-Free Verification is the most direct path for MVP launch.

Risk: unverified toll-free messages may be filtered by carriers even if volume is low.

### Recommendation for MVP

Submit **Toll-Free Verification** for `+1 844 723 4944` first. It is faster and requires no TCR involvement. If local numbers are needed for clinic branding later, register a 10DLC campaign at that time.

---

## 3. Recommended Campaign / Use-Case Wording

Use this language when submitting registration. Adjust legal business name and EIN.

### Brand registration fields

| Field | Value |
|---|---|
| Legal business name | *(your registered business entity)* |
| Business type | Private for-profit |
| Industry/vertical | Healthcare / Dental Services |
| EIN | *(your EIN)* |
| Business address | *(street, city, state, ZIP)* |
| Business website | `https://missedcallsdental.com` |
| Business contact | *(name, email, phone)* |

### Campaign registration fields (for 10DLC)

| Field | Value |
|---|---|
| Use case | Mixed (or `Notifications`) — transactional missed-call recovery |
| Campaign description | We send one SMS to a patient after they call our client dental clinic and reach no one. The message notifies the patient that their call was missed and offers to help them schedule an appointment. We do not send marketing messages. Patients initiate contact by calling. We do not purchase or import lists. |
| Message flow | Patient calls the clinic's phone number. If no one answers, the call forwards to our system. After the call ends, one SMS is sent to the patient's number. Messages are sent only once per 24-hour window per patient per clinic. |
| Sample message 1 | `Hi, this is Acme Dental. We missed your call. Would you like us to help schedule an appointment?` |
| Sample message 2 (optional) | `Hi, this is Acme Dental. We noticed you called again. We'll follow up with you shortly. Reply STOP to opt out.` |
| Opt-in method | Patients initiate contact by calling. Receiving an SMS after a missed call constitutes implicit opt-in. |
| Opt-out method | Reply STOP to any message. Opt-outs are recorded immediately and all future messages are blocked. |
| HELP response | Twilio Messaging Service sends STOP/START/HELP compliance replies at the platform level. |
| Subscriber opt-in | No. Patients are not pre-enrolled. First message is triggered by their inbound call. |

### For Toll-Free Verification

Submit similar information in Twilio Console:

- Business name, website
- Use case: Transactional — missed-call recovery for dental clinics
- Monthly volume: low (under 100 messages/month for initial launch)
- Sample message: *(same as above)*
- Opt-in: patient called first; we send one follow-up per missed call
- Opt-out: patient can reply STOP; system enforces it in DB

---

## 4. Sample Messages (for Registration and Owner Review)

These are the exact message templates in production. Do not deviate from these for compliance purposes.

### Recovery SMS (outbound, triggered by missed call)

```
Hi, this is {clinic_name}. We missed your call. Would you like us to help schedule an appointment?
```

Compliance notes:
- Clinic name is always included.
- No AI mention.
- No medical advice or diagnosis.
- No promotional language or urgency.
- No appointment promise — only an offer to help.
- Maximum one send per (clinic, patient) per 24 hours.

### What the system does NOT send

- No bulk/broadcast messages.
- No marketing or promotional SMS.
- No appointment reminders (future milestone — requires separate consent and registration).
- No messages to patients who have replied STOP.
- No messages triggered without an inbound call.

---

## 5. Website Checklist for Registration

Campaign registration (both 10DLC and toll-free) requires a public website that includes SMS messaging disclosures. This is required by TCR and Twilio.

**Required on `missedcallsdental.com`:**

- [ ] Terms of Service page (or section) that references SMS messaging
- [ ] Privacy Policy page that covers data collected via SMS
- [ ] SMS opt-out language visible somewhere — example: *"Reply STOP to opt out of SMS messages. Reply HELP for help."*
- [ ] Business contact information (name, address, email) — verifiable by the carrier/TCR

**Optional but recommended:**

- [ ] A landing page or section describing the missed-call recovery service
- [ ] Explicit disclosure: *"By missing a call, you may receive one SMS message from the clinic. Message and data rates may apply."*

**Note:** The current marketing site at `missedcallsdental.com` must be reviewed before submitting registration. If privacy policy or Terms of Service pages are missing, they must be added first.

---

## 6. Go / No-Go Checklist for Live Patient SMS

All boxes must be checked before changing `SMS_RECOVERY_MODE` to `live` in Vercel.

### Compliance prerequisites

- [ ] Toll-Free Verification submitted AND approved by Twilio, OR 10DLC Brand + Campaign approved by TCR
- [ ] Twilio number linked to the approved campaign or verification
- [ ] `missedcallsdental.com` has Terms of Service and Privacy Policy pages
- [ ] Opt-out language present on website

### Per-clinic prerequisites

- [ ] Clinic row inserted in DB with `sms_recovery_enabled = false`
- [ ] Twilio number mapped to clinic in DB
- [ ] Inbound call recording verified with SMS off (call events appear in DB)
- [ ] STOP/START opt-out flow verified for this clinic's number
- [ ] Caller ID preservation confirmed (for forwarding mode clinics)
- [ ] Owner explicitly approved enabling SMS for this clinic
- [ ] `clinics.sms_recovery_enabled` set to `true` for this clinic only
- [ ] Voice greeting copy approved by clinic owner

### System prerequisites

- [ ] `SMS_RECOVERY_MODE=live` set in Vercel env vars
- [ ] Vercel redeployed after env change
- [ ] `/api/health` passes after redeploy
- [ ] One test missed call sent to verify SMS fires after call ends (not during)
- [ ] Duplicate suppression verified on second test call

---

## 7. Internal Risk Notes

### Carrier filtering risk

SMS to unregistered US numbers is increasingly filtered by carriers (T-Mobile, AT&T, Verizon). Even low-volume transactional messages can be silently dropped without registration. Patient experience risk: missed-call SMS never arrives, patient assumes clinic doesn't care.

Mitigation: register before enabling live mode. Do not assume owner-test delivery rates reflect live patient delivery rates.

### TCPA / consent risk

Sending unsolicited SMS to a US mobile number without explicit or implied consent can trigger TCPA liability. The current flow (patient called first → implied consent) is a widely-accepted basis for transactional SMS but is not risk-free.

Mitigation:
- Only send one message per missed call.
- Honor STOP immediately and permanently (system already does this).
- Do not send messages to numbers not associated with a recent call.
- Do not send bulk or broadcast messages.
- Keep message copy non-promotional.

### Healthcare data

Phone numbers are not PHI by themselves, but pairing a phone number with a dental clinic relationship creates a health-adjacent record. The `messages` and `patient_conversations` tables store this.

Mitigation:
- All tables have RLS enabled.
- Service role key is not exposed publicly.
- No patient medical information is ever stored or transmitted.
- Privacy Policy must disclose SMS data handling.

### Scope of current registration

Registration covers the current single toll-free number. If additional Twilio numbers are provisioned for other clinics (especially local 10DLC numbers), each must be linked to a registered campaign before live use.

---

## 8. Action Items Before First Real Clinic

Priority order:

1. **Add Terms of Service and Privacy Policy to `missedcallsdental.com`** — required for registration.
2. **Prepare submission fields from packet** in `TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md`.
3. **Submit Toll-Free Verification** in Twilio Console for `+1 844 723 4944`.
4. Track request/case ID and status in the packet's after-submission table.
5. Wait for Twilio approval (typically 3–7 business days).
6. Once approved: proceed with first clinic onboarding using `FIRST-CLINIC-ONBOARDING.md`.
7. Set `SMS_RECOVERY_MODE=live` only after verification is confirmed and per-clinic checklist (Section 6) is complete.
