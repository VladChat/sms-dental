---
title: What information is needed for SMS approval
slug: what-information-is-needed-for-sms-approval
status: ready
visibility: clinic_owner
audience: Clinic owner
surface: /account
category: sms-approval
owner: product
source_of_truth:
  - MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - AGENTS.md
last_verified: 2026-06-09
related:
  - what-sms-approval-means
  - why-sms-is-not-active-immediately
---

# What information is needed for SMS approval

## Summary

SMS approval asks for a short list of business and contact details so carriers can
confirm your clinic is a real business. You only enter the fields needed for
approval — the rest is filled in for you. Your business name and address come from
your **Business Profile**; the approval-specific details live in **SMS Approval
Information**.

## Applies to

Clinic owners completing the **SMS Approval Information** step in their account.

## What this means

Your account keeps two related sections separate so you do not enter anything
twice:

- **Business Profile** — your clinic's public identity and address (clinic name,
  main office phone, street address, city, state, ZIP, and an optional website).
  Your sign-in email is shown here but is read-only.
- **SMS Approval Information** — the extra legal and contact details that are only
  needed for carrier approval.

Your address is entered once in Business Profile and reused for approval — you do
not type it again.

### What you enter for SMS approval

You provide only these fields:

- **Legal business name** — your clinic's official registered business name.
- **Business type** — chosen from a short list (for example: private company
  (for-profit), public company (for-profit), non-profit, individual / sole owner,
  or government).
- **EIN** — your business tax ID number. Enter it carefully; it is used only for
  verifying your business and is handled securely. (For your privacy, we do not
  show example EIN values anywhere.)
- **Authorized representative — first name and last name** — the person
  authorizing texting for the clinic.
- **Authorized representative — email** — a contact email for that person (for
  example, `owner@example.com`).
- **Authorized representative — phone** — a contact phone for that person.
- **Authorization checkbox** — you check this to confirm you are authorized to
  enable business texting for the clinic.

The representative email and phone may be pre-filled from your account details for
convenience, and you can edit them.

### Why each field is needed

Carriers need to confirm a real, identifiable business is behind the texting
(legal name, business type, EIN), a real person is responsible for it (the
authorized representative), and that person has authorized it (the checkbox).
These are standard business-texting approval requirements.

### What you do NOT need to enter

Several approval details are generated for you and are not asked of you, including
the representative's title, the description of how texting is used, the sample
message, opt-in keywords, policy page links, and expected message volume. You do
not need to write or manage these.

## What you can do

- Open **SMS Approval Information** in your account and fill in the fields above.
- Double-check the legal business name and EIN match your real business records —
  accurate details help approval go smoothly.
- Check the authorization box to confirm you are authorized.
- Save the section when complete.

## What to expect

- Saving may mark the section **Complete**, but your separate **Texting** status
  is what tells you when texting is actually live. See
  [Why SMS is not active immediately](why-sms-is-not-active-immediately.md).
- After submitting, expect a **waiting for approval** status while the review is
  in progress.

## When to contact support

Contact support if you are unsure which business type to choose, if you do not
have a piece of required information, or if approval seems stuck after you have
filled everything in.

Email: **support@missedcallsdental.com**

## Related articles

- [What SMS approval means](what-sms-approval-means.md)
- [Why SMS is not active immediately](why-sms-is-not-active-immediately.md)

## Source of truth

- `MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md` — exact customer-entered vs
  system-generated fields, and Business Profile vs SMS Approval Information split
- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` — what approval reviews
- `AGENTS.md` — minimum-necessary information rule
