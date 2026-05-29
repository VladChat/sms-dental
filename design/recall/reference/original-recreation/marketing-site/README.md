# Marketing site — UI kit

Hi-fi, interactive recreation of the **Missed Calls Dental** marketing website
(`docs/` in the source repo). Dark theme by default with a working light toggle.

## Run
Open `index.html`. It's a click-through prototype:
- **Theme toggle** (sun/moon) switches dark ↔ light, exactly like the live site.
- **How it works / Pricing** nav links smooth-scroll to sections.
- **Start trial** → enter a work email → "Send setup link" → confirmation screen.
- **Sign in** → shows the inline error state (front-end demo, like the real site).

## Files
- `index.html` — mounts the app, owns theme + view state (home / sign-in / confirm).
- `components.jsx` — `Header`, `Hero`, `HowItWorks`, `Pricing`, `SignIn`, `Confirm`, `Footer`, plus inline icons.
- `styles.css` — lifted from source `docs/styles.css` (original token names preserved for fidelity).

## Coverage
Header + brand lockup, theme toggle, pill nav & auth group, hero with workflow
illustration, numbered steps card, example SMS conversation, front-desk patient
summary card with status badge, the pricing/conversion card, work-email capture
form, sign-in form, confirmation state, and the legal footer.

## Notes
- Uses the approved raster logo (`../../assets/logo-mark.webp`) and the real hero
  illustration — never redraw these.
- Font falls back to **Hanken Grotesk** off Windows (Aptos substitute). See root README.
- This is a cosmetic recreation — forms are simulated, not wired to a backend.
