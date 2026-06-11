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
  - config/ai-front-desk-facts.config.ts
  - MVP_BUILD_DOCS/PROJECT-CONTEXT.md
last_verified: 2026-06-10
related:
  - ../getting-started/what-missed-calls-dental-does
  - ../troubleshooting/contact-support
---

# Prepare answers for future AI

## Summary

Your account has an **AI Front Desk Knowledge** section where you add the facts
a future AI front desk assistant may safely share with patients: office hours,
services, insurance plans, appointment requests your office handles, payment
options, and basic office rules. Questions without an approved answer go to
your office, and AI never gives medical advice.

## Applies to

Clinic owners and admins. Front-desk staff do not manage AI knowledge.

## What this means

- You fill in simple sections instead of writing answers: set your weekly
  hours, check the services you offer and the insurance plans you accept, and
  add short notes for payment options and office rules.
- Your clinic name, phone, address, and website come from **Business profile**
  — you don't retype them here. If they change, update Business profile.
- Anything you don't fill in or approve simply goes to your office. You don't
  need to complete every section.
- Medical and urgent questions always go to your office. That rule is built in
  and is not a setting.

### Website check

If your Business profile has a website, you can scan it to suggest facts —
hours, services, insurance plans, and payment options found on your site appear
as suggestions marked "Review". Nothing from your website is used until you
review and save the section yourself. The scan never changes your Business
profile.

## What you can do

- Open **/account → AI knowledge** and work through the sections.
- Set normal office hours by weekday.
- Check services and insurance plans, and add your own items if something is
  missing (up to 50 each).
- Choose the appointment requests your office handles.
- Scan your website to pre-fill suggestions, then review and save.

## What to expect

- Saving a section approves it. Suggestions from your website stay marked
  "Review" until you save.
- When AI features launch later, they will use only the facts you approved
  here; everything else goes to your front desk.
- Nothing here changes how patients are texted today, and nothing here blocks
  your SMS setup or billing.

## When to contact support

Contact support if a section will not load or save, if the website check keeps
failing, or if you have questions about how future AI features will use your
facts.

Email: **support@missedcallsdental.com**

## Related articles

- [What Missed Calls Dental does](../getting-started/what-missed-calls-dental-does.md)
- [Contact support](../troubleshooting/contact-support.md)

## Source of truth

- `config/ai-front-desk-facts.config.ts` — service/insurance catalogs and
  limits
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — structured clinic-facts foundation
  scope and future phases
