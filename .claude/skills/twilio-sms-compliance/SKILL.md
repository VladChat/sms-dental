---
name: twilio-sms-compliance
description: Twilio SMS and missed-call recovery rules for Dental SMS with compliance-safe wording, opt-out handling, and webhook reliability.
---

# Twilio SMS Compliance

Use this skill for all Twilio messaging and call-event workflows.

SMS content rules:
- Keep messages short and professional.
- Clearly identify the clinic.
- Avoid spammy marketing phrases.
- Do not imply diagnosis, treatment, prescriptions, or emergency advice.

Compliance behavior:
- Support STOP, START, and HELP.
- Honor opt-out state immediately.
- Keep sender identity and intent clear.

Technical rules:
- Validate webhook signatures.
- Process events idempotently.
- Store inbound, outbound, and delivery status events.
- Keep Twilio secrets out of client code.

Dental SMS context:
- Default style should reflect missed-call follow-up by a real office front desk.
- Prioritize trust, compliance, and deliverability over aggressive conversion phrasing.
