# Logo Source Notes

## Source image used
- `design/image-sources/01-logo-mark-source.png`

## What was carried forward
- Rounded app-style navy container
- White call/phone receiver as the primary anchor
- Teal message bubble indicating SMS follow-up
- Teal recovery motion arrow to communicate return/reconnect flow

## What was simplified
- Removed the extra incoming-call arrow from the source concept
- Rebuilt all elements as flat vector geometry for clean rendering
- Reduced detail density so the mark remains clear at small sizes
- Simplified the favicon to only the strongest, legible mark elements

## Why the PNG was not embedded directly
- Embedded raster images do not scale cleanly at multiple UI sizes
- Production logo assets need editable, reusable vector shapes
- SVG keeps file size lower while preserving sharpness for high-DPI displays
- The task requires no base64, no raster embedding, and no pixel tracing

## Usage rules
- `logo-mark.svg`
  - Use for app icon blocks, social profile mark usage, and compact brand placements
  - Do not add effects, gradients, or alternate colors
- `logo-horizontal.svg`
  - Use for header/brand lockup on light backgrounds
  - Keep clear space around the lockup; do not stack extra tagline text beside it
- `favicon.svg`
  - Use for browser tab/site icon contexts where tiny sizes require a simplified mark
  - Keep geometry and colors fixed for consistency across generated favicon assets
