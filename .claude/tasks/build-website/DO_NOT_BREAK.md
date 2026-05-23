# Do Not Break

This file defines hard boundaries for the website rebuild task.

## Do not create branches

Work only on:

```text
main
```

Do not create preview/design branches.

## Do not touch unrelated work

Before editing:

```bash
git status --short
```

If unrelated uncommitted files exist:

- do not reset them
- do not stash them
- do not clean them
- do not restore them
- do not stage them
- do not commit them

Only stage files required for this website task.

## Do not change backend or integrations

Do not edit:

- Supabase migrations
- API routes
- Twilio webhook logic
- Stripe webhook logic
- environment files
- package manager files
- lockfiles
- secrets
- deployment config

unless the website task is impossible without it and Vlad explicitly approves.

## Do not break protected assets

Protected assets:

- logo
- favicon
- brand mark
- OG image

Do not redraw, distort, regenerate, or replace these unless Vlad explicitly asks.

## Marketing images

Marketing graphics are not protected.

But do not delete image files unless Vlad explicitly asks.

For the website rebuild, prefer removing usage of old raster marketing images from explanation sections and replacing them with code-based visuals.

## Do not use fake content

Do not invent:

- clinic testimonials
- clinic logos
- metrics
- awards
- certifications
- compliance claims
- fake screenshots
- fake dashboard numbers

## Do not overclaim compliance

Do not write:

```text
HIPAA Compliant
guaranteed compliant
```

Do not imply legal compliance is guaranteed.

## Do not write medical advice

Automated SMS and website copy must not include:

- diagnosis
- treatment recommendations
- prescription advice
- emergency guidance
- statements that imply a patient needs treatment

## Do not use spammy SMS language

Avoid:

- URGENT
- limited time
- click now
- guaranteed
- discount bait
- aggressive sales wording

## Do not use raster text graphics

Do not create or rely on PNG/WebP images with text baked into the graphic for website explanation sections.

All core explanation text must be real HTML text.

## Do not leave the site half-finished

The website must feel complete enough for:

- Stripe review
- Twilio review
- real dental clinic visitors
- a simple MVP launch

If a section cannot be finished properly, simplify it rather than leaving placeholders.
