---
title: Prepare answers for future AI
slug: prepare-ai-front-desk-knowledge
status: ready
visibility: clinic_owner
audience: Clinic owner
surface: /account
category: ai-front-desk-knowledge
owner: product
source_of_truth:
  - config/ai-front-desk-knowledge.config.ts
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
last_verified: 2026-06-10
related:
  - ../getting-started/what-missed-calls-dental-does
  - ../troubleshooting/contact-support
---

# Prepare answers for future AI

## Summary

Your account has an **AI Front Desk Knowledge** section where you can review
common patient questions and approve the answers a future AI front desk
assistant may use. **AI replies are not live yet** — saving answers here does
not change what patients receive today.

## Applies to

Clinic owners and admins. Front-desk staff do not manage AI knowledge.

## What this means

- We list common patient questions (hours, new patients, insurance, services,
  payment, and safety situations).
- For each question you can **approve an answer**, choose **handoff** (AI passes
  the patient to your office), or choose **do not answer automatically**.
- If you do not approve an answer, a future AI assistant will hand that question
  to your front desk instead of guessing.
- Medical, urgent, and treatment questions always use a standard short handoff
  reply. That reply cannot be edited, so AI can never give medical advice.

### Website source

The section shows the website from your **Business profile**. A future update
will be able to scan that website and suggest draft answers for your review.
You do not enter your website again here — edit it in Business profile if it
changes. Website scanning is not live yet.

## What you can do

- Open **/account → AI knowledge** to review the question list.
- Add and approve short answers for questions you want answered automatically
  in the future.
- Choose handoff or do-not-answer for anything you prefer your office handles.
- Save drafts and come back later — nothing here blocks your SMS setup or
  billing.

## What to expect

- AI replies stay off. This section only prepares your approved answer library.
- When AI features launch later, they will use only the answers you approved
  here, and everything else will hand off to your front desk.

## When to contact support

Contact support if the section will not load or save, or if you have questions
about how future AI features will use your answers.

Email: **support@missedcallsdental.com**

## Related articles

- [What Missed Calls Dental does](../getting-started/what-missed-calls-dental-does.md)
- [Contact support](../troubleshooting/contact-support.md)

## Source of truth

- `config/ai-front-desk-knowledge.config.ts` — recommended questions, statuses,
  and safety defaults
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — foundation scope and future phases
