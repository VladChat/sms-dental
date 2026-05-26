# Twilio Toll-Free Verification Submission Packet

Status: Ready for owner submission  
Audience: founder / operator  
Prepared: 2026-05-26

Purpose: copy/paste packet for Twilio Toll-Free Verification submission for Missed Calls Dental.

Do not include secrets in this file.

---

## 1. Number and Messaging Path

- Toll-free number being verified: `+1 844 723 4944`
- Public website URL: `https://missedcallsdental.com`
- Privacy URL: `https://missedcallsdental.com/privacy.html`
- Terms URL: `https://missedcallsdental.com/terms.html`
- SMS Terms URL: `https://missedcallsdental.com/sms-consent.html`

---

## 2. Business and Product Description (Copy-Ready)

Missed Calls Dental is a missed-call SMS recovery service for dental offices. When a patient calls a participating dental office and the call is missed, busy, unanswered, or forwarded to the office's assigned recovery number, the platform sends one operational follow-up SMS so the patient can reply and the office can follow up for scheduling.

---

## 3. Recommended Use Case Category (Copy-Ready)

Transactional / customer care / appointment-related messaging only.

Not promotional marketing.

---

## 4. Campaign / Use Case Description (Copy-Ready)

Patients call a participating dental office. If the office misses the call (or the call forwards to the assigned recovery number), the system sends one operational follow-up SMS after the call ends. The message identifies the clinic and asks whether the caller would like help scheduling an appointment. The caller can reply so the clinic/front desk can follow up. STOP/START opt-out handling is supported. We do not send promotional blasts, discount campaigns, or marketing offers through this workflow.

---

## 5. Message Flow and Opt-In Explanation (Copy-Ready)

The caller initiates contact by calling a participating dental office. The follow-up SMS is directly related to that recent call and is sent as a transactional/customer-care message. Participating clinics may also verbally confirm SMS consent during onboarding or appointment communication. Message frequency varies based on caller activity and office follow-up needs. Message and data rates may apply. STOP/HELP instructions are publicly documented at `https://missedcallsdental.com/sms-consent.html`.

---

## 6. Sample Messages (Copy-Ready)

Primary missed-call recovery SMS:

```txt
Hi, this is {clinic_name}. We missed your call. Would you like us to help schedule an appointment?
```

HELP/support wording if requested:

```txt
Reply HELP for help or support@missedcallsdental.com. Reply STOP to opt out.
```

STOP/START behavior description for reviewer notes:

```txt
Recipients can reply STOP to opt out of future automated messages from the relevant sender and reply START to opt back in where supported.
```

---

## 7. Website Evidence Checklist

- `https://missedcallsdental.com/`
  - Shows product description and service purpose (missed-call SMS recovery for dental offices).
- `https://missedcallsdental.com/privacy.html`
  - Shows privacy policy and how SMS-related data is handled.
- `https://missedcallsdental.com/terms.html`
  - Shows terms of service including SMS compliance restrictions.
- `https://missedcallsdental.com/sms-consent.html`
  - Shows consent basis, message purpose, STOP/HELP instructions, and message frequency/rates language.
- `mailto:support@missedcallsdental.com`
  - Public support contact referenced on legal pages.

---

## 8. Twilio Submission Checklist (Owner)

1. Open Twilio Console and start Toll-Free Verification for `+1 844 723 4944`.
2. Copy Section 2 into business/product description fields.
3. Select transactional/customer-care category using Section 3 wording.
4. Copy Section 4 into campaign/use case description.
5. Copy Section 5 into opt-in and message flow explanation fields.
6. Paste the sample message from Section 6 as the primary sample message.
7. Add website evidence URLs from Section 7 exactly as listed.
8. Provide business legal entity details (legal name, address, EIN) directly in Twilio Console from owner records.
9. Upload screenshots only if Twilio asks; use current public pages showing product description and SMS/legal disclosures.
10. Do not claim promotional, bulk marketing, discount, or high-volume campaign use.
11. Do not enable live SMS after submission; wait for Twilio approval first.
12. After approval, update `SETUP-LOG.md` and continue with `FIRST-CLINIC-ONBOARDING.md` before any real clinic live sends.

---

## 9. After-Submission Tracking Template

| Submitted date | Submitted by | Twilio request/case ID | Status | Approved/rejected date | Notes/rejection reason |
|---|---|---|---|---|---|
| YYYY-MM-DD | Name | TBD | submitted | TBD | TBD |

---

## Constraints and Safety Notes

- This packet prepares submission content only.
- Live SMS remains disabled until approval and explicit owner go-live steps.
- Twilio settings are not changed by preparing this document.
- This workflow provides operational communication only and does not provide medical advice.
