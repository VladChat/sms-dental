---
name: ui-ux
description: Use for Missed Calls Dental dashboard, admin console, account setup, onboarding, settings, front-desk workspace, and frontend UI/UX quality decisions.
---

# UI UX

Use this skill for dashboard, admin, account, onboarding, settings, workspace,
and other frontend UX work.

## Design Standard

The UI must feel like a real professional B2B SaaS for dental clinics:

- Clear and work-focused.
- Trustworthy and calm.
- Responsive on mobile and desktop.
- Accessible to keyboard and screen-reader users.
- Polished enough for clinic owners, front-desk staff, Stripe review, and
  Twilio review.

## Required States

Include clear states for:

- Loading.
- Empty data.
- Validation errors.
- Save failures.
- Disabled or unavailable actions.
- Success confirmation when a real write completes.

## Interaction Rules

- Use accessible labels and visible focus states.
- Keep touch targets large enough for mobile.
- Use consistent button styles and hierarchy.
- Do not create placeholder-looking UI.
- Do not invent fake metrics, testimonials, or sample data that looks real.
- Keep destructive confirmations inline in the same card when project rules
  require it.

## Forms

Follow the project-wide form scope rule:

- Ask only for what is needed now.
- Defer non-essential information.
- Add short helper text for required fields.
- Avoid duplicating fields already stored elsewhere.
