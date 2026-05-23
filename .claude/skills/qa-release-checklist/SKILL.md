---
name: qa-release-checklist
description: Pre-release checklist for Dental SMS covering functionality, UX, compliance-sensitive messaging, and integration reliability.
---

# QA Release Checklist

Use this skill before shipping website or product changes.

Functional checks:
- Missed-call detection path works end-to-end.
- SMS send and reply flows work across expected scenarios.
- Billing and account state transitions behave correctly.

Content and UX checks:
- Primary pages have clear CTA and consistent messaging.
- No fake claims, fake testimonials, or unsupported compliance language.
- Mobile and desktop layouts are stable and readable.

Compliance and policy checks:
- STOP/HELP behavior is correct.
- Privacy and terms links remain accessible.
- No medical-advice wording is introduced.

Technical checks:
- Webhook signature validation active.
- Idempotency on event processors verified.
- Critical errors logged with actionable context.

Release decision:
- Block release on reliability, compliance, or billing-critical failures.
