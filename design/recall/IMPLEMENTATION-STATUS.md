# Recall implementation status

Tracks how the Recall design system (this folder) has been applied to the real
product. "Recall" is the internal codename — never customer-facing.

Last updated: 2026-05-29.

## Done

**Phase 1 — Tokens + base (foundation).**
- `app/globals.css` (new) ports `colors_and_type.css` (all tokens, `.t-*` type
  scale, base reset) + the component layer from `components.css`
  (`.btn`/`.btn-primary`/`.btn-secondary`/`.btn-ghost`, `.field`/`.input`/`.select`/
  `.check`, `.card`/`.card-pad`, `.badge-*`, `.alert-*`, `.tile`, `.spinner`).
  Light theme only — the dark block is intentionally omitted (parked here).
- Fonts (Schibsted Grotesk / Hanken Grotesk / IBM Plex Mono) load via a CSS
  `@import` at the top of `globals.css` (runtime load — no build-time network
  dependency). `app/layout.tsx` imports `globals.css`.

**Phase 3 (partial) — Onboarding.** `app/setup/[token]` restyled to the token
system: `PageShell`, `ClinicForm` (design-system `.card`/`.field`/`.input`/`.btn`
+ calm UX copy), `BusinessProfile` (app-style checklist: sidebar steps, status
badges using semantic status colors, subtle "Saved · <time>" instead of a green
block), `SetupStatusReady`, `SetupInvalid`, and `/setup/[token]/status`. All
inline hex values re-pointed to Recall CSS variables.

**Phase 5 — Compliance mini-site.** `app/business/[slug]` (profile / privacy /
sms-terms) + shared `Shell` restyled to tokens + display/body fonts; nav, footer,
and back-link retained.

**Root + copy.** `app/page.tsx` re-branded on the token system. Trial copy
corrected from "14-day" → **21-day** across customer-facing `docs/` (index,
pricing) and internal planning docs (`00-product-brief`, `08-compliance-and-onboarding`,
`OWNER-FILL-THIS-OUT`).

## Deferred (intentional)

- **Phase 2 — Marketing site (`docs/`).** Still the original static
  GitHub-Pages system (its own 1046-line `styles.css`, dark-theme toggle, 9
  pages). A faithful Recall rebuild is a sizeable, self-contained effort and is
  the recommended next pass. Only the trial-length copy was corrected here.
- **Phase 4 — Product app** (Overview / Missed calls / Patient requests /
  Settings). Net-new surfaces; building them now would render UI for behavior
  the backend does not yet expose. Deferred until the data/APIs exist, per the
  "no fabricated product behavior" + MVP-safe-metrics rules. The Patient
  Requests model + metrics policy in `UX-WRITING.md`/`HANDOFF.md` still govern
  it when built.
- **Auth screens** — `docs/sign-in.html` is static and there is no real auth
  backend yet; deferred with the marketing rebuild.
- **Dark theme** — parked (light only).
- **`NumberSearch.tsx`** — alternate/reference component, not routed in the
  default onboarding flow; left on its previous styling (not rendered live).

## Notes for the next pass

- Icons: production should adopt Lucide (`lucide-react`); current app surfaces
  use minimal inline SVG / none. Not yet added (avoids a new dependency this pass).
- When rebuilding `docs/`, port `globals.css` tokens rather than duplicating
  values, and drop the dark-theme toggle to match the approved light-only scope.
