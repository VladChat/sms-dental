---
name: security-owasp
description: OWASP-aligned security guardrails for Dental SMS application surfaces, integrations, secrets, and compliance-sensitive data paths.
---

# Security OWASP

Use this skill for security review and implementation decisions.

Core controls:
- Strong authentication and least-privilege authorization.
- Input validation and output encoding.
- Parameterized queries only.
- Server-side secret management.
- Secure session handling and CSRF protections.

Integration security:
- Validate Twilio webhook signatures.
- Verify Stripe webhook signatures.
- Enforce idempotency for event handlers.
- Log security-relevant events without leaking secrets.

Data protection:
- Minimize retained personal data.
- Restrict dashboard/admin access.
- Use encryption in transit and at rest where supported.

Dental SMS context:
- Treat call and messaging data as sensitive operational data.
- Prevent spoofed webhook events and replay abuse.
