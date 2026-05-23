# Acceptance Checklist

Use this checklist before committing.

## Git safety

Before staging:

```bash
git status --short
```

Confirm:

- working on `main`
- no new branch created
- no unrelated dirty files staged
- no `git add .` used blindly

## Required pages

Confirm these pages exist and render consistently:

- `docs/index.html`
- `docs/how-it-works.html`
- `docs/pricing.html`
- `docs/contact.html`
- `docs/privacy.html`
- `docs/terms.html`
- `docs/sms-consent.html`
- `docs/sign-in.html`

## Navigation

Confirm header includes:

- Missed Calls Dental
- How it works
- Pricing
- Sign In

Confirm footer includes:

- Contact
- Privacy
- Terms
- SMS Consent
- support@missedcallsdental.com

## Homepage

Confirm homepage includes:

- clear hero
- product explanation
- code-based workflow visual
- SMS example
- benefits
- trust/compliance cards
- pricing preview
- final CTA

## Code-based visuals

Confirm core explanation visuals are built with HTML/CSS/SVG and real text, not raster marketing images.

Confirm all infographic text is real HTML text.

Confirm icons, cards, lines, arrows, and message bubbles are lightweight, consistent, and professional.

## Copy safety

Confirm no forbidden language:

- HIPAA Compliant
- guaranteed compliant
- guaranteed appointments
- AI-powered growth platform
- urgent scare language
- medical advice
- fake testimonials
- fake metrics

## SMS compliance

Confirm SMS consent page mentions:

- why someone may receive a text
- STOP opt-out
- HELP support
- message and data rates may apply
- no medical advice in automated SMS

## SEO

Confirm every page has:

- title
- meta description
- canonical URL
- Open Graph title/description/image
- correct domain where absolute URLs are used

## Accessibility

Confirm:

- one logical H1 per page
- visible focus states
- meaningful alt text for logo
- no emoji as structural icons
- readable contrast
- no horizontal scroll on mobile

## Performance

Confirm:

- no heavy new external libraries
- no unnecessary third-party scripts
- images have dimensions if used
- CSS is not bloated with unused experimental code
- no layout shift from core hero area

## Final commands

After checks:

```bash
git status --short
git add docs/index.html docs/how-it-works.html docs/pricing.html docs/contact.html docs/privacy.html docs/terms.html docs/sms-consent.html docs/sign-in.html docs/styles.css
git status --short
git commit -m "Build new marketing website"
git push
git rev-parse HEAD
```

If any of these files were not changed, do not force-add unrelated files.

Final report must include:

- changed files
- brief summary
- checks performed
- commit hash
