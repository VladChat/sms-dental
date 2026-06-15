---
title: Notification settings
slug: notification-settings
status: ready
visibility: clinic_owner
audience: Clinic owner
surface: /account
category: notifications
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/OWNER-SETTINGS.md
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - config/notifications.config.ts
  - config/billing.config.ts
last_verified: 2026-06-27
related:
  - ../billing/understand-your-bill
  - ../troubleshooting/contact-support
---

# Notification settings

## Summary

Your account has a **Notification settings** section where you choose which
account notifications you want. The first version covers **AI answered call
minute alerts**: a heads-up when your AI answered call time reaches **90%** and
**100%** of the minutes included in your plan. Both are on by default and you can
turn each one off.

## Applies to

Clinic owners and admins, in **/account**. Front-desk staff do not manage
notification settings.

## What this means

- This is a **settings** screen: it records which alerts you want.
- The alerts are about your **AI answered call time** — the minutes used by AI
  answered calls — compared with the minutes included in your plan. The included
  amount comes from your plan; see [Understand your bill](../billing/understand-your-bill.md).
- AI answering is a planned feature and is **not active yet**, so there is no AI
  answered call time being used today. You can still set your preferences now so
  they are ready when the feature is available.

## What you can do

- Open **/account → Notification settings**.
- Keep or turn off the **90%** and **100%** AI answered call minute alerts.
- Your choices save to your account.

## What to expect

- Your preferences are saved, but notifications are **not being delivered yet** —
  there is no email or text alert sent at this stage. This screen lets you choose
  what you want ahead of time.
- When AI answered calls and alert delivery become available, your saved choices
  will apply.

## When to contact support

Contact support if the section will not save, or if you have questions about how
AI answered call minutes are counted toward your plan.

Email: **support@missedcallsdental.com**

## Related articles

- [Understand your bill](../billing/understand-your-bill.md)
- [Contact support](../troubleshooting/contact-support.md)

## Source of truth

- `MVP_BUILD_DOCS/OWNER-SETTINGS.md` — Notification Settings (v1, settings only)
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — minute alert thresholds, included
  minutes policy
- `config/notifications.config.ts` — notification types/labels
- `config/billing.config.ts` — included AI answered call minutes (cited, not
  restated)
