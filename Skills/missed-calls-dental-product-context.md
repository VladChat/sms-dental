---
name: missed-calls-dental-product-context
description: Product context for the Dental SMS missed calls SaaS project.
---

# Dental SMS Product Context

We are building a B2B SaaS for dental clinics.

Product name:
Dental SMS / Missed Calls Dental

Domain:
missedcallsdental.com

Core problem:
Dental clinics miss phone calls. Missed calls mean lost patients and lost revenue. Many patients do not call back.

Core product:
The app sends a professional SMS follow-up after a missed-call event reaches our system.

Important product clarification:
The app cannot automatically detect calls to an unrelated clinic phone number. The call event must reach the system through forwarding, a prepared local-number path, or a future direct phone-provider integration.

Main goal:
Recover missed callers and help dental offices book more appointments.

Target customers:
- Independent dental clinics
- Small dental offices
- Local healthcare offices with front desk call volume
- Offices that do not already have a strong missed-call SMS recovery workflow

Primary MVP connection modes:

1. Conditional forwarding mode
   - The clinic keeps its existing main phone number.
   - The clinic or phone provider forwards no-answer, busy, unavailable, or after-hours calls to the assigned Twilio recovery number.
   - The forwarded call must preserve the patient's caller ID for SMS recovery to work correctly.

2. Prepared local-number path (default onboarding path)
   - The system prepares/reserves the best local number automatically from clinic context.
   - The customer is not required to manually choose from a number catalog during default onboarding.
   - The prepared local number can later be used for direct routing/campaign needs where appropriate.

Future connection mode:
- Direct integrations with phone providers or dental communication platforms may be added later.
- Examples: RingCentral, Dialpad, Nextiva, Weave, Mango Voice, RevenueWell, Adit, or similar systems.
- This is not required for the first MVP.

Core workflow:
1. Patient calls the clinic's main number or prepared local number path.
2. The call reaches our system through conditional forwarding or local direct routing.
3. Twilio sends a signed webhook to the backend.
4. Dental SMS records the event idempotently.
5. The system checks opt-out and duplicate rules.
6. After explicit product approval/configuration, the patient receives a professional SMS follow-up.
7. Conversation continues.
8. Office books or marks the opportunity as lost.

Tech stack:
- Next.js
- React
- Supabase
- Stripe
- Twilio
- Vercel

Design requirement:
The website and app must look like a real professional B2B SaaS.
No placeholder look.
No fake startup design.
No childish UI.
No messy landing page.

Tone:
Clear.
Professional.
Simple.
Trustworthy.
Direct.

Compliance:
- Respect SMS opt-out.
- Avoid spammy language.
- No fake medical claims.
- No aggressive messaging.
- Keep the product trustworthy for Stripe, Twilio, and dental clinics.

Business requirement:
The site must be good enough for Stripe verification, Twilio review, and real clinic customers.

Current onboarding source of truth:
Create office profile (clinic name, main office phone, ZIP code) first, then Business Profile cards for Business Information and A2P Approval Information. Billing starts only after SMS recovery is active.
