---
name: twilio-dental-sms
description: Use for Twilio phone numbers, Messaging Services, SMS, calls, webhooks, A2P 10DLC, toll-free verification, STOP/START/HELP, delivery callbacks, readiness checks, live-send gates, and SMS copy for Missed Calls Dental.
---

# Twilio Dental SMS

Use this skill for any Twilio, SMS, call-event, compliance, webhook, phone
number, sender, Messaging Service, A2P 10DLC, toll-free verification, delivery
status, or live-send-readiness work.

## Non-Negotiable Rules

- Do not expose Twilio credentials.
- Validate Twilio webhook signatures before trusting requests.
- Keep webhook handlers idempotent.
- Store inbound, outbound, delivery-status, and call events according to the
  existing database patterns.
- Fail closed when readiness, compliance, clinic mapping, billing, sender
  coverage, opt-out state, or exact number matching is missing.
- Match senders and numbers exactly; do not infer or substitute one clinic's
  number for another.
- Do not make live-send changes or send real SMS unless Vlad explicitly asks for
  that scope and all app readiness guards pass.
- Respect STOP, START, HELP, carrier opt-out behavior, and local opt-out state.
- Keep local A2P and toll-free verification models separate: local numbers use
  A2P 10DLC, toll-free numbers use toll-free verification.

## SMS Copy Rules

SMS copy must be short, professional, and dental-office appropriate.

Use:

- Clear clinic identity.
- Plain language.
- A helpful front-desk tone.
- Required opt-out language where the app requires it.

Avoid:

- Medical advice, diagnosis, prescriptions, treatment instructions, or triage.
- Fake urgency, scare language, guarantees, discounts as pressure, or spammy
  wording.
- Unsupported claims about appointment availability or outcomes.
- Links, marketing hype, or excessive punctuation unless the approved workflow
  requires them.

## Implementation Checklist

Before changing Twilio/SMS behavior:

- Read `Skills/twilio-dental-sms.md`.
- Read `.claude/skills/twilio-sms-compliance/SKILL.md` if present.
- Inspect current routes, helpers, migrations, config, and tests first.
- Keep owner-test and live modes separate.
- Verify exact send path, duplicate suppression, opt-out checks, and status
  callback handling.
- Run the relevant SMS/Twilio tests available in `package.json`.

## Source Priority

Use `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`, `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`,
and the relevant Twilio/SMS source files as the current behavior source of
truth. Do not rely on provider memory when code and docs already define the
guardrail.
