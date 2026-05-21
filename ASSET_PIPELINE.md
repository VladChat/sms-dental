# Asset Pipeline

## Approved Source Images
- Source directory: `design/image-sources/`
- Approved immutable source files:
  - `01-logo-mark-source.png`
  - `02-hero-workflow-visual-source.png`
  - `03-trust-privacy-visual-source.png`
  - `04-background-motif-source.png`
  - `05-og-background-source.png`

These source images are the only approved input assets for production logo and marketing image generation.

## Logo Strategy (Production)
- Primary logo is raster-only from approved source PNG.
- Current production logo files:
  - `public/brand/logo-mark.png`
  - `public/brand/logo-mark.webp`
- Browser icons are generated from `01-logo-mark-source.png`:
  - `public/apple-touch-icon.png`
  - `public/icon-192.png`
  - `public/icon-512.png`
  - `public/favicon.ico`
- `public/site.webmanifest` references `/icon-192.png` and `/icon-512.png`.

## Why SVG Redraw Was Rejected
- Previous hand-drawn SVG outputs changed approved visual details.
- Rejected SVG redraws were removed from production usage.
- Do not recreate, use, or ship custom-drawn SVG logo variants.

## Marketing Image Outputs
- PNG fallbacks are preserved from approved PNG sources:
  - `public/images/marketing/hero-workflow-visual.png`
  - `public/images/marketing/trust-privacy-visual.png`
  - `public/images/marketing/background-motif.png`
  - `public/images/marketing/og-background.png`
  - `public/images/marketing/og-image.png`
- High-quality WebP outputs are generated for runtime:
  - `public/images/marketing/hero-workflow-visual.webp`
  - `public/images/marketing/trust-privacy-visual.webp`
  - `public/images/marketing/background-motif.webp`

## OG Image Rules
- `public/images/marketing/og-image.png` is generated at exactly `1200x630`.
- Uses approved OG background source with left-side product text and preserved right-side visual.
- Do not add fake numbers, fake badges, fake certifications, or unsupported claims.

## UI Icons
- UI icon components are inline SVG React components in `src/components/marketing/MarketingIcons.tsx`.
- Use `currentColor` and consistent stroke style.
- Do not use PNG files for UI icons.

## Site Replacement Status
- Old public marketing homepage content has been replaced with the minimal Dental Missed Call Recovery homepage.
- Do not reintroduce old stock dental imagery, old broad automation copy, or rejected SVG logo files.
