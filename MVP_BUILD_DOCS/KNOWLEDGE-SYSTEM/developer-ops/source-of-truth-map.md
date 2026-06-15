---
title: Source-of-truth map
slug: source-of-truth-map
status: internal
visibility: developer_ops
audience: Engineers
surface: dev
category: reference
owner: engineering
source_of_truth:
  - AGENTS.md
last_verified: 2026-06-27
related:
  - update-knowledge-system-checklist
---

## Summary

Maps each product domain to the canonical repo file(s) that own its facts. Every
Knowledge System article's `source_of_truth` should point here. When facts
conflict, defer to the higher-priority source per `AGENTS.md` ("Source Priority
for Project Facts").

## Domain → canonical file map

| Domain | Canonical file(s) |
|---|---|
| Product identity and architecture | `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` |
| Agent rules | `AGENTS.md`, `MVP_BUILD_DOCS/AGENT-RULES.md` |
| Missed-call SMS Recovery | `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`, `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`, `config/sms-recovery.config.ts`, `lib/sms-recovery/templates.ts` |
| Phone number lifecycle | `AGENTS.md` ("Phone Number Removal Lifecycle", "Toll-free vs Local Number Model"), `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`, `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` |
| Billing / pricing / usage / number policy / AI answered call minutes | `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`, `config/billing.config.ts` |
| Runtime settings | `config/runtime.config.ts` |
| Auth / access | `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` |
| Front desk workspace | `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` |
| Platform admin | `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` |
| A2P / SMS approval | `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md`, `MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md` |
| SMS Conversation Builder (admin SMS settings: voice greeting / SMS texts / limits & anti-spam) | `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`; `config/sms-recovery.config.ts`; `lib/sms-recovery/conversation-templates.ts`, `lib/sms-recovery/special-reply-templates.ts`, `lib/sms-recovery/automation-volume-limits.ts`, `lib/sms-recovery/reply-classification.ts`, `lib/sms-recovery/voice-greeting-templates.ts`; `Skills/twilio-dental-sms.md` |
| AI Front Desk Knowledge / structured clinic facts | `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`, `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`, `config/ai-front-desk-facts.config.ts`, `lib/ai-knowledge/facts.ts` |
| AI Answering / AI Call Assistant (planned channel; non-live foundation + gated test-only runtime) | product/architecture `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`; operate/verify + runtime status `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`; non-live vocabulary `config/ai-answering.config.ts`; curated voice defaults `config/voice-greeting.config.ts`; billing/included minutes `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` + `config/billing.config.ts`; Twilio/voice implementation guidance `Skills/twilio-dental-sms.md`; customer/product language `Skills/missed-calls-dental-product-context.md` |
| Notification settings / AI answered call minute alerts | `MVP_BUILD_DOCS/OWNER-SETTINGS.md`, `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`, `config/notifications.config.ts`, `config/billing.config.ts` |
| Delete clinic / danger zone | `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` ("Admin clinic deletion danger zone"), `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md`, `AGENTS.md` |
| Twilio / SMS / voice implementation guidance | `Skills/twilio-dental-sms.md` |
| Operations | `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` |
| Chronological setup/deployment facts | `MVP_BUILD_DOCS/SETUP-LOG.md` |
| Repeatable setup lessons | `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md` |

## Supporting references

- Onboarding workflow: `MVP_BUILD_DOCS/ONBOARDING-WORKFLOW-BUILD-GUIDE.md`
- First clinic onboarding: `MVP_BUILD_DOCS/FIRST-CLINIC-ONBOARDING.md`
- Real-vs-placeholder state: `MVP_BUILD_DOCS/PRODUCTION-READINESS-PLACEHOLDER-AUDIT.md`
- Toll-free verification packet: `MVP_BUILD_DOCS/TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md`
- Doc index: `MVP_BUILD_DOCS/MANIFEST.md`
- Universal project context skill: `Skills/missed-calls-dental-product-context.md`

## Source priority (from AGENTS.md, when facts conflict)

1. `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`
2. `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` (pricing/billing/number policy)
3. `MVP_BUILD_DOCS/OWNER-SETTINGS.md`
4. `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`
5. `MVP_BUILD_DOCS/SETUP-LOG.md`
6. `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md`
7. `config/runtime.config.ts`
8. `Skills/missed-calls-dental-product-context.md`
9. relevant `.claude/skills/*/SKILL.md`

## Usage

- Set article `source_of_truth` to the file(s) above for the article's domain.
- If a new canonical file is added to the repo, add it here and to
  `MVP_BUILD_DOCS/MANIFEST.md`.
- Never restate a canonical fact (price, gate, SID format) in an article — cite it.
