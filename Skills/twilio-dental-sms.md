---
name: twilio-dental-sms
description: Use this skill when working on Twilio, SMS, missed calls, phone numbers, messaging webhooks, A2P compliance, opt-out handling, or SMS wording for the Dental SMS project.
---

# Twilio Dental SMS Skill

Use this skill for all Twilio-related work in the Dental SMS project.

Project:
Dental SMS

Domain:
missedcallsdental.com

Product:
A B2B SaaS for dental clinics that detects missed calls and automatically sends a professional SMS follow-up to help recover missed patients and book appointments.

Use this skill when the task involves:
- Twilio phone numbers
- Twilio Messaging Services
- SMS sending
- SMS receiving
- Missed call detection
- Call webhooks
- Message webhooks
- A2P 10DLC
- SMS compliance
- Opt-out handling
- STOP / START / HELP behavior
- Dental clinic SMS wording
- Twilio errors
- Twilio webhook security
- Twilio delivery status
- Twilio production readiness

Core rules:
- Keep SMS messages short, clear, and professional.
- Do not use spammy or aggressive wording.
- Do not make medical promises.
- Do not create fake urgency.
- Do not imply diagnosis or medical advice.
- Respect opt-out behavior.
- Make the product trustworthy for Twilio review and real dental clinics.

Default missed call SMS style:

"Hi, this is {{clinic_name}}. We missed your call. Would you like us to help schedule an appointment?"

Better follow-up style:

"Thanks for reaching out to {{clinic_name}}. We missed your call, but we can still help. Reply here and our team will follow up."

Avoid:
- "URGENT"
- "You need treatment"
- "We guarantee"
- "Limited time"
- "Click now"
- Fake discounts
- Medical claims
- Overly salesy copy

Implementation guidance:
- Webhook endpoints must validate Twilio signatures before trusting requests.
- Store inbound and outbound messages in Supabase.
- Store call events and message status events.
- Handle duplicate webhooks safely.
- Keep webhook handlers idempotent.
- Log Twilio errors clearly.
- Do not expose Twilio secrets to the browser.
- Keep all Twilio credentials server-side only.

Compliance guidance:
- Include opt-out language where appropriate.
- Support STOP, START, and HELP.
- Do not continue messaging users who opted out.
- Keep clinic identity clear in messages.
- Avoid misleading sender identity.

For this project, Twilio work must prioritize:
1. Reliability
2. Compliance
3. Clear dental-office communication
4. Production readiness
5. Simple maintainable code

