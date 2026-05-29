# Implementation handoff — Recall design system

For Claude Code (or any engineer) implementing this against the existing
`VladChat/sms-dental` frontend. Practical, not inspirational. **Design-only
artifacts; production implementation is separate, later work.**

> "Recall" = internal codename. Public product name = **Missed Calls Dental**.
> Scope: **light theme only**, **21-day trial**, **Patient requests** (not a chat
> inbox), **MVP-safe metrics**.

---

## 1 · Final direction summary
Light-first, high-trust healthcare-operations system. One unified token set across
marketing, onboarding, and the product app. Clinical **teal** primary, warm-cool
slate neutrals, distinct semantic colors. Display = Schibsted Grotesk, body =
Hanken Grotesk, numbers = IBM Plex Mono. Restrained radii, neutral layered
shadows, accessible contrast, calm copy. Full rationale in `DESIGN-DIRECTIONS.md`.

## 2 · Design tokens (source of truth)
**`colors_and_type.css`** holds every token as CSS custom properties (full list in
`TOKENS.md`): teal/neutral/accent/ink scales; semantic surface/text/border/primary;
success/warning/error/info; focus + disabled; radii, spacing (4px base), shadows,
layout widths; fonts + `.t-*` type classes.

**Light theme only.** A `[data-theme="dark"]` block exists in the CSS but is
flagged **future-only — do not ship**. Do not add a theme toggle in Phase 1.

**Port path:** map these to your styling layer. If Tailwind, generate a
`tailwind.config` theme from these variables (colors, fontFamily, borderRadius,
boxShadow, spacing). If CSS-in-JS, expose them as a theme object. Keep names.

## 3 · Component layer
**`components.css`** is the reference implementation (specs in `COMPONENTS.md`):
`.btn` (primary/secondary/ghost/destructive/sm/lg/block), `.input/.select/.textarea/
.check/.switch`, `.card/.metric-card`, `.badge-*`, `.alert-*`, `.list/.list-row/
.avatar`, `.empty/.skeleton/.spinner`, `.tabs/.segment/.progress`, `.tile`, plus
the **patient request card** + **detail drawer** pattern (see `screens/app.html`).
Re-implement as framework components but match the visual spec exactly.

**Icons:** `icons.js` exports `svgIcon(name,{size})` + `[data-icon]` hydration — a
Lucide-style 24×24 / 1.75-stroke set. In production, **use Lucide directly**
(`lucide-react` etc.); names mostly match.

## 4 · Layout rules
- Marketing: centered `--container` (1120px), reading width `--content` (720px), section padding `--space-20`.
- App: fixed sidebar `--sidebar-w` (248px) + sticky topbar `--topbar-h` (64px); content max `--app-max` (1160px), padding `--space-8`.
- Cards: `--r-lg` (14px), `--shadow-sm`, 1px `--border`. Buttons/inputs: 44px height, `--r-md` (10px).

## 5 · Screen specs (mirror these mockups)
| Area | File | Build notes |
|---|---|---|
| Marketing home | `screens/marketing.html` | Hero + chat mock, problem/solution, 3-step, single pricing card (**21-day** trial), compliance trust, CTA band, footer. |
| Product app | `screens/app.html` | Sidebar nav: **Overview** (4 MVP-safe count metrics + new-requests list + number status), **Missed calls** (follow-up status log), **Patient requests** (queue of office-ready cards + detail drawer w/ SMS audit trail; populated **and** empty states), **Settings** (Profile / Login &amp; security / Billing). |
| Onboarding | `screens/onboarding.html` | 4-step: office details → texting number → compliance checklist → go-live. Vertical stepper + progress. **21-day** trial copy. |
| Auth | `screens/auth.html` | Split layout; sign in (+ Google/Apple), forgot, link-sent, create/reset password, done. |
| Compliance | `screens/compliance.html` | Public per-office mini-site: business profile / privacy / SMS terms. |

`design-system.html` is the living spec; `SCREENS.md` has per-screen detail.

## 6 · Production files Claude Code will likely touch (LATER — not in this commit)
Informational map for future implementation, based on the repo structure:
- **Global styles / tokens** — wherever the app defines theme (e.g. a global CSS / Tailwind config / `app/globals.css`). Port `colors_and_type.css` here.
- **Shared UI components** — the app's button/input/card/badge components. Align to `components.css`.
- **Marketing site** — `docs/` (static HTML/CSS/JS): rebuild pages on the new system.
- **Onboarding** — `app/setup/[token]/_components/*`: restyle to the new stepper + cards; enforce 21-day copy.
- **Product app** — net-new surfaces for Overview / Missed calls / **Patient requests** / Settings.
- **Fonts** — add Schibsted Grotesk + Hanken Grotesk + IBM Plex Mono (Google Fonts) to the document head / font loader.
- **Icons** — add Lucide.

## 7 · What must NOT change in Phase 1
- **No backend / behavior changes.** Do not modify SMS sending, billing, auth logic, database, webhooks, or env behavior.
- Do not modify `app/` server logic, `lib/`, `supabase/`, `config/`, `package.json`/lockfile semantics beyond adding font/icon deps, or `.env`.
- **No dark theme.** Light only.
- **No "Recall" in customer-facing UI.**
- Do not invent metrics the backend can't supply (see §9).

## 8 · Recommended phases
1. **Tokens + base** — port `colors_and_type.css` + `components.css`; add fonts; set up Lucide. (Foundation; visual only; unblocks everything.)
2. **Marketing site** — rebuild `docs/` pages (highest external-trust impact, lowest risk; no behavior change).
3. **Auth + onboarding** — restyle the conversion path; wire the 4-step flow &amp; compliance checklist; 21-day copy.
4. **Product app** — Overview, Missed calls, **Patient requests** (queue + drawer + empty state), Settings/Billing.
5. **Compliance mini-site** — per-office generated pages.

Each phase is shippable on its own and none requires backend changes except where
explicitly wiring real data (phases 3–4), which should be done behind existing APIs.

## 9 · Metrics policy (MVP-safe)
**Show as live UI only** counts the backend can prove: missed calls recorded,
recovery texts sent, patient replies received, new patient requests, requests
needing callback, opt-outs, SMS approval status, office texting number status.

**Do NOT present as live** (future concept only): revenue recovered, appointments
created, conversion rate, value recovered, new patients won, average response time.
If shown at all, label clearly as future/illustrative.

Design **both** the real-data state and the **empty state** before the first
missed call (see Patient requests in `screens/app.html`).

## 10 · Risks &amp; open questions
- **Patient requests extraction** — confirm the backend can extract intent (name / request / preferred time / priority) from replies. If partial at launch, show available fields + link the SMS audit trail; never block the card on a missing field.
- **Priority = Urgent** — only from caller-stated pain/emergency wording; never an inferred medical judgment.
- **Assigned-staff / routing** — designed as optional; confirm whether staff accounts exist.
- **Logo** — approved working mark; a higher-fidelity production export may still be desired.
- **Future metrics** — promote to live only when analytics exist.
- **Dark theme** — parked; revisit post-launch if wanted.
