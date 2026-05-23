# Design Direction

## Overall design goal

Create a professional B2B SaaS website for a dental-office missed-call recovery product.

The site should look trustworthy and polished, not experimental or childish.

## Visual style

Use:

- dark professional SaaS theme or calm light theme
- clean typography
- strong spacing
- clear card system
- subtle gradients if useful
- consistent borders and surfaces
- simple SVG/icon-style symbols
- clean workflow diagrams made in HTML/CSS/SVG

Avoid:

- childish illustrations
- cartoon faces
- emojis as icons
- fake dashboard metrics
- excessive animations
- decorative clutter
- generic purple AI SaaS look
- text baked into images
- AI-generated infographic images

## Infographic rule

All website infographics must be code-based.

Allowed:

- HTML cards
- CSS layout
- CSS lines/arrows
- inline SVG icons
- simple phone/message/status cards
- real selectable text

Not allowed:

- PNG/WebP images with text inside
- AI-generated diagram images
- screenshots pretending to be real data
- unreadable raster labels

## Icon guidance

Icons are allowed and encouraged when they make the workflow easier to understand.

Use simple, consistent SVG-style icons where helpful, for example:

- phone or missed-call icon
- message/SMS bubble icon
- patient/person icon
- front desk or office icon
- calendar/appointment icon
- shield/check/trust icon
- arrow or connection icon

Icons may come from a consistent open-source SVG icon set or be simple inline SVG shapes.

Do not over-constrain the visual style, but keep icons professional, lightweight, consistent, and B2B SaaS appropriate.

Do not use raster icon images when SVG or CSS can do the job.

Do not put text inside icons. All important text must remain real HTML text.


## Hero visual requirements

Build the hero visual as a code-based workflow:

1. Missed call
2. Auto SMS sent
3. Patient replies
4. Front desk follows up

It should feel like a product explanation, not a decorative poster.

Suggested visual components:

- a missed-call card
- an SMS bubble/card
- a reply card
- a front desk follow-up card
- connecting lines/arrows
- small trust/compliance chips

All text inside the visual must be real HTML.

## Trust/compliance visual requirements

Use cards instead of a raster image.

Required trust cards:

- Clinic identity included
- STOP and HELP supported
- No medical advice in automated texts
- Office reviews patient replies

## Layout

Use mobile-first responsive layout.

Desktop:

- max-width container
- hero can be two columns
- workflow visual on the right or below hero copy
- clean section spacing

Mobile:

- single column
- large readable text
- buttons full-width where helpful
- no horizontal scroll
- workflow cards stack cleanly

## Typography

Use a simple professional system.

Rules:

- body text must be readable
- headings should have strong hierarchy
- avoid tiny body text
- avoid overly tight line-height
- keep line length reasonable

## Color

Use a consistent palette.

Current project has a dark navy/teal direction. It is acceptable to keep that if it looks professional.

Do not introduce random colors.

Use semantic variables in CSS where practical.

## Motion

Motion is optional.

If used:

- subtle only
- CSS-only preferred
- no excessive animation
- respect reduced motion
- do not animate layout in a way that causes jank

## Accessibility

Minimum requirements:

- visible focus states
- semantic links and buttons
- meaningful alt text for logo/images
- accessible color contrast
- no icon-only controls without labels
- logical heading order
