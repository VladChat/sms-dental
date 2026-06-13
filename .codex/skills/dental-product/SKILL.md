---
name: dental-product
description: Use for Missed Calls Dental product decisions, onboarding, admin console behavior, clinic UX, product boundaries, production launch planning, and customer-facing workflow decisions for the dental missed-call SMS SaaS.
---

# Dental Product

Use this skill when deciding what Missed Calls Dental should do, what it should
not do, how clinic users should experience it, or how launch readiness should be
framed.

## Product Positioning

Missed Calls Dental helps dental clinics recover missed calls with automatic,
professional SMS follow-up. A call event must reach the system through an
approved phone-event path such as conditional forwarding, an assigned business
number, or a future approved provider integration.

Keep the positioning simple:

- Dental offices miss calls.
- Missed calls can become lost appointment opportunities.
- Timely SMS follow-up helps the front desk respond faster.
- The product supports the office; it does not replace the front desk.

## MVP Boundaries

Stay inside the current MVP unless Vlad explicitly expands scope.

- Do not build an AI receptionist or AI voice assistant as current behavior.
- Do not build a full CRM, PMS integration, phone-system replacement, number
  porting flow, diagnosis tool, or medical-advice workflow.
- Do not assume the app can detect calls to unrelated clinic numbers.
- Keep SMS recovery separately gated by compliance, QA, owner approval,
  runtime mode, number readiness, opt-out state, and clinic settings.

## Clinic UX

Design for a busy dentist or front desk user:

- Ask only for information needed for the next immediate step.
- Explain why required fields are needed in plain customer-facing copy.
- Use office-friendly language: clear, calm, trustworthy, and direct.
- Keep technical terms such as Twilio SID, webhook, A2P payload, model name,
  token usage, and raw provider status in admin/internal views only.
- Prefer simple statuses and next actions over dense diagnostics.

## Source Priority

When product facts conflict, follow `AGENTS.md` source priority. For current
product behavior, start with `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` and
`Skills/missed-calls-dental-product-context.md`.
