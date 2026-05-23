# Page Structure

## Website location

This repository publishes the public marketing website from:

```text
docs/
```

Build the website only in `docs/`.

Do not create a separate site in `src/`, `app/`, `public/`, `website/`, or another folder.

Build a complete, professional static marketing website.

The site can remain simple, but it must not look unfinished.

## Required pages

### 1. Home

Path:

```text
docs/index.html
```

Purpose:

Explain the product quickly and make the value obvious.

Recommended sections:

1. Header
2. Hero
3. Workflow visual
4. Problem
5. How it works
6. SMS example
7. Benefits
8. Trust/compliance
9. Pricing preview
10. Final CTA
11. Footer

Hero copy direction:

```text
Missed-call SMS recovery for dental offices
Recover missed patient calls with automatic SMS follow-up
When your dental office misses a call, the caller gets a professional text so your team can reconnect.
```

Hero visual direction:

Build a code-based visual showing:

```text
Missed call → Auto SMS sent → Patient replies → Front desk follows up
```

Use real HTML text, CSS, SVG/icons, cards, lines, and arrows.

Do not use image files for this flow.

### 2. How it works

Path:

```text
docs/how-it-works.html
```

Purpose:

Explain the workflow clearly.

Sections:

1. Intro
2. Step-by-step flow
3. SMS example
4. What the office sees / does next
5. Compliance notes
6. CTA back to pricing or email setup

Required workflow:

1. A patient calls.
2. The call is missed.
3. A follow-up text is sent.
4. The patient replies.
5. The front desk follows up.

### 3. Pricing

Path:

```text
docs/pricing.html
```

Purpose:

Make the offer simple and credible.

Required content:

- Simple monthly pricing
- What is included
- Setup/support note
- SMS usage caveat if needed
- CTA: Start setup by email

Avoid confusing tiers unless the repository already uses them.

### 4. Contact

Path:

```text
docs/contact.html
```

Purpose:

Make support/contact clear for Stripe, Twilio, and customers.

Required:

- support email
- short setup support text
- operator name if already used
- no fake office address unless verified

### 5. Privacy

Path:

```text
docs/privacy.html
```

Purpose:

Provide basic privacy information.

Must mention practical categories only:

- business contact details
- clinic account details
- call metadata
- SMS metadata
- message content
- opt-out records
- support messages

Do not overclaim compliance.

### 6. Terms

Path:

```text
docs/terms.html
```

Purpose:

Explain basic service terms.

Must mention:

- service is for missed-call SMS follow-up
- not an emergency service
- not medical advice
- clinics are responsible for patient communications and compliance review

### 7. SMS Consent

Path:

```text
docs/sms-consent.html
```

Purpose:

Explain why recipients may receive SMS and how opt-out works.

Must mention:

- text may be sent after a missed, busy, or unanswered dental office call
- STOP to opt out
- HELP for support
- message and data rates may apply
- no medical advice in automated SMS

### 8. Sign In

Path:

```text
docs/sign-in.html
```

Purpose:

Do not pretend the portal is finished if it is not.

Use honest language:

```text
Account access is being prepared.
Early office access is handled by support while the account portal is being finished.
```

CTA:

```text
Email support
```

## Header

Use consistent navigation:

```text
How it works | Pricing | Sign In
```

Brand:

```text
Missed Calls Dental
```

Use existing logo asset.

Do not redraw the logo.

## Footer

Every page should include:

- Missed Calls Dental
- Automatic SMS follow-up for missed patient calls.
- Contact
- Privacy
- Terms
- SMS Consent
- support@missedcallsdental.com

## Content density

Keep pages concise.

This is an MVP marketing website, not a large enterprise site.

Short, clear sections are better than long walls of text.

## Recovery workflow placement

The recovery process must be explained for dental clinic owners, not as backend logic.

Use the short workflow from:

```text
.claude/tasks/build-website/RECOVERY_WORKFLOW_FOR_WEBSITE.md
```

Show it in these places:

- homepage hero or workflow section
- How it works page
- SMS example section

Keep it short and clear.

Do not overload the page with a technical decision tree.

