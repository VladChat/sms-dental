# Brand Guidelines

## Brand Name
- Dental Missed Call Recovery

## Brand Position
- Focused B2B SaaS for dental offices.
- Value signal: reliable missed-call SMS follow-up that helps recover appointment opportunities.

## Logo Direction
- Primary concept: phone/call indicator + message bubble.
- Visual goal: communicate missed call then follow-up text in one mark.
- Tooth motif: avoid by default; if used, keep abstract and extremely subtle.
- Avoid:
  - Cartoon style
  - Childlike mascots
  - Patient-facing dental imagery
  - Smiling-face clinical clichés

## Visual Identity Direction
- Minimal, modern, operational.
- Trust-forward rather than trendy.
- Use whitespace and clear alignment to communicate reliability.
- Prefer simple geometric forms over decorative textures.

## Color Direction
- Base palette should feel professional and calm.
- Suggested role-based palette (tune values in implementation):
  - `--bg`: clean neutral background
  - `--surface`: elevated neutral surface
  - `--text-primary`: near-black
  - `--text-secondary`: muted neutral
  - `--brand-primary`: restrained blue/teal family for trust
  - `--brand-accent`: supportive accent used sparingly
  - `--success`: muted green for positive states
  - `--warning`: restrained amber for notices
- Avoid loud neon or playful candy palettes.
- Ensure accessible contrast across text and controls.

## Typography Direction
- Prioritize readability and credibility.
- Recommended stack direction:
  - Headings: clean contemporary sans with strong legibility
  - Body: neutral sans optimized for UI reading
- Use a conservative type scale with clear hierarchy.
- Avoid novelty display fonts and over-tight tracking.

## Icon System Direction
- Build a consistent minimal line-icon system.
- Icon style rules:
  - 1.5px to 2px stroke
  - Rounded joins/caps
  - 24x24 grid
  - Visually balanced negative space
- Required icons:
  - Missed call
  - Automatic SMS
  - Patient reply
  - Appointment opportunity
  - Existing phone number
  - Opt-out / STOP
  - Secure / compliant
  - Front desk
- Do not mix filled and outline sets without a defined rule.

## Reusable UI Components
- Global header with clear CTA
- Section container with consistent max width
- Feature card
- Workflow step card
- SMS preview card
- Trust/compliance callout
- FAQ accordion/list
- Footer legal links

## Button Rules
- Primary button:
  - High-contrast brand action color
  - Used for core conversion actions only
- Secondary button:
  - Lower emphasis, outline/neutral style
- Sizing:
  - Minimum touch target 44px height
- Labeling:
  - Action-first, concrete text (for example "Book a 15-Minute Demo")
- Avoid vague CTA labels like "Learn More" as primary action.

## Card Rules
- Keep card content concise and scannable.
- Use consistent padding, border radius, and subtle elevation.
- Avoid decorative overload, gradients, or heavy shadows.
- Each card must map to one message only.

## SMS Preview Card Rules
- Must include clear sender identity placeholder, for example `{{clinic_name}}`.
- Must show professional, non-spammy copy.
- Must avoid promises, urgency gimmicks, or medical claims.
- Should include optional compliance microcopy nearby (STOP/HELP, rates may apply) when contextually appropriate.

## Mobile-First Design Rules
- Start at small viewport layout, then scale up.
- Keep hero headline and CTA readable without zoom.
- Avoid side-by-side layouts that collapse poorly.
- Keep nav and CTA easy to tap.
- Prioritize vertical rhythm and short paragraphs.