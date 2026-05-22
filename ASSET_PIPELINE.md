# Asset Pipeline

## Final Website Decisions
- Correct domain: missedcallsdental.com
- Support email: support@missedcallsdental.com
- Brand name shown on site: Missed Calls Dental
- Core positioning: Recover missed patient calls with automatic SMS follow-up
- FAQ page removed
- Header navigation: How it works | Pricing | Sign In
- Homepage shortened
- Pricing page added
- Logo remains raster from approved PNG source
- Codex must not redraw artwork
- Approved images remain unchanged

## Approved Source Images
- Source directory: `design/image-sources/`
- Approved source files:
  - `01-logo-mark-source.png`
  - `02-hero-workflow-visual-source.png`
  - `03-trust-privacy-visual-source.png`
  - `04-background-motif-source.png`
  - `05-og-background-source.png`

Do not modify or replace these source files.

## Production Brand Assets
- Use existing generated raster logo assets only:
  - `docs/brand/logo-mark.webp`
  - `docs/brand/logo-mark.png`
  - matching copies in `public/brand/`
- Browser icons remain from the approved logo source:
  - `docs/favicon.ico`
  - `docs/apple-touch-icon.png`
  - `docs/icon-192.png`
  - `docs/icon-512.png`
  - matching copies in `public/`

## Marketing Visual Assets
Use existing approved assets as-is. Do not regenerate or compress.
- `docs/images/marketing/hero-workflow-visual.webp`
- `docs/images/marketing/trust-privacy-visual.webp`
- `docs/images/marketing/background-motif.webp`
- `docs/images/marketing/og-background.png`
- `docs/images/marketing/og-image.png`
- plus PNG fallback copies in `docs/images/marketing/`
- matching copies in `public/images/marketing/`

## Guardrails
- Do not create new AI images.
- Do not draw new SVG logo artwork.
- Do not alter approved artwork.
- Keep logo text as real HTML text next to the raster mark.
