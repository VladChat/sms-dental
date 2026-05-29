# Recall Design System — Handoff Package

This folder is the **approved design handoff** for the Missed Calls Dental
redesign. It is **design documentation and reference artifacts only** — it is
**not** production code and changes nothing about how the live app behaves.

> **"Recall" is an internal design-system codename only.** The public,
> customer-facing product name is **Missed Calls Dental**. Never ship "Recall"
> as a visible brand (no "Powered by Recall", "Recall app", footer badges, etc.).

---

## What this folder is

A complete, self-contained spec a developer (or Claude Code) can read to implement
the approved visual system safely and later. It contains:

```
design/recall/
├── README.md            ← you are here
├── HANDOFF.md           ← implementation plan, phases, what to touch / not touch
├── DESIGN-DIRECTIONS.md ← critique, directions explored, chosen direction, rationale
├── UX-WRITING.md        ← voice, microcopy, Patient Requests + metrics wording
├── TOKENS.md            ← every design token (color/type/space/radius/shadow/focus)
├── COMPONENTS.md        ← component specs (buttons … patient request cards … states)
├── SCREENS.md           ← per-screen implementation guidance
├── colors_and_type.css  ← tokens as CSS custom properties (source of truth)
├── components.css        ← reference component classes
├── icons.js             ← Lucide-style icon helper (use Lucide in production)
├── design-system.html   ← living spec / showcase (open in a browser)
├── screens/             ← hi-fi interactive mockups to mirror
│   ├── marketing.html · app.html · onboarding.html · auth.html · compliance.html
└── reference/           ← HISTORICAL ONLY — the original repo recreation, not approved
```

## Approved owner decisions (locked 2026-05-29)

- ✅ **Recall visual direction** — approved.
- ✅ **Logo / mark** — the proposed "returning call" mark is approved as the working logo.
- ✅ **Background / visual foundation** — approved.
- ✅ **Free webfonts** — Schibsted Grotesk (display) + Hanken Grotesk (body) + IBM Plex Mono (numbers). Approved.
- ✅ **Trial length: 21 days.** No "14-day" anywhere in copy, pricing, onboarding, or implementation.
- ✅ **Light theme only** for current scope. Dark theme is a **future note only — do not ship.**
- ✅ **"Recall" is internal-only.** Public name = Missed Calls Dental.
- ✅ **"Patient requests"** replaces the raw replies/SMS-inbox concept (see below).
- ✅ **MVP-safe metrics only** — counts the backend can support; no fabricated business-result rates.

## How Claude Code should use this folder

1. **Read `HANDOFF.md` first** — it defines phases and exactly which production files
   each phase is likely to touch, and what must NOT change in Phase 1.
2. **Treat `colors_and_type.css` + `components.css` as the source of truth** for
   tokens and component visuals. Port them into the app's styling layer
   (Tailwind theme / CSS vars / CSS-in-JS) — keep the token names.
3. **Mirror the `screens/` mockups** for layout and interaction structure. They are
   cosmetic prototypes (no real data wiring) — match the look, wire to real data.
4. **Follow `UX-WRITING.md`** for all copy, especially Patient Requests + metrics rules.
5. **Use Lucide** for icons in production (the `icons.js` set is Lucide-style; names mostly match).

## Design-only vs production implementation

| This folder (design-only) | Production (later, separate work) |
|---|---|
| Tokens, component specs, screen mockups, copy rules | Real React/Next components wired to data |
| Static HTML showcase | The live `app/`, `docs/`, `lib/` code |
| "Here's how it should look &amp; read" | "Here's the working feature" |

**Do not** use this commit to change `app/`, `docs/`, `lib/`, `supabase/`,
`config/`, `package.json`, env files, or any production behavior. This is a
documentation commit under `design/recall/` only.

## The "Patient requests" model (important)

The product is **not** a chat app. A patient's SMS reply is distilled into an
**office-ready request card** (name · phone · request · preferred time · priority ·
status · source · received). The front desk works a lightweight queue of tasks
with statuses **New → Needs callback → Scheduled → Completed**. The raw SMS
conversation exists only as a **secondary audit trail** in a detail drawer — never
the primary UI. See `COMPONENTS.md` (Patient request card) and `SCREENS.md`.
