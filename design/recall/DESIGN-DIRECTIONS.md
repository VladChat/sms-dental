# Design directions — critique &amp; the chosen path

This document covers Steps 1–3 of the redesign brief: a critique of the original
draft, the directions explored, and why **"Recall"** was chosen.

> **Note:** "Recall" is the **internal design-system codename** only. The public
> product name remains **Missed Calls Dental**. Locked decisions (2026-05-29):
> light theme only, 21-day trial, "Patient requests" (not a raw replies inbox),
> MVP-safe metrics. See `README.md` / `HANDOFF.md`.

---

## 1 · Critique of the original draft system

The first-pass system was a faithful *recreation* of the repository, which is
exactly why it carried the repository's amateur decisions forward. Reforming it
meant treating those as problems to solve, not constraints to honor.

**Brand identity**
- No real identity — just the repo's app-icon logo and a borrowed color scheme. Nothing said "calm healthcare." The dark navy read more like a developer tool or crypto product than a dental front-desk aid.
- The name "Missed Calls Dental" is descriptive but the system gave it no personality or memorability.

**Color**
- **Dark-by-default for marketing** is the biggest misfire. A B2B healthcare tool sold to office managers and dentists needs to feel clean, clinical, and bright. Dark navy + electric teal + glow reads consumer/tech, not trustworthy-medical.
- **Two disconnected palettes** (dark navy marketing vs. a separate gray Tailwind-ish app) meant the product felt like two different companies. No shared token system.
- Electric teal `#20D3C2` on near-black with teal *glows* is a tech-marketing trope, not a calm healthcare cue.
- Semantic colors were thin and partly overlapped the brand teal, so "success" didn't clearly read as success.

**Typography**
- Relied on **Aptos** (a Microsoft system font, not on Google Fonts, not redistributable) → inconsistent rendering off Windows and a forced substitution. No deliberate display/body pairing; headings and body were the same family at different weights.

**Spacing, hierarchy, components**
- Inconsistent radii (10/12/14/18/22/24/999 all in play with no rationale) and pill-everything chrome that felt soft and consumer-ish.
- Colored teal *glow* shadows on buttons — again, tech, not clinical.
- Components existed but as one-offs per surface; no reusable button/input/badge/card layer shared across marketing and app.

**What was actually missing (not just weak)**
- **No product UI at all.** The repo is a marketing site + a 3-step setup wizard. There was **no dashboard, no missed-calls list, no replies inbox, no settings, no billing** — i.e. no actual SaaS product to design. A design system for a SaaS that never shows the SaaS is incomplete.
- **No auth design** beyond a single sign-in page; no reset/forgot/social.
- **Compliance pages** were referenced but never designed, despite being central to SMS trust.

**Accessibility & conversion**
- Dark theme + muted blue-grays risked low contrast for older office staff.
- Conversion copy was decent (the repo's content rules are genuinely good and worth keeping), but the dark, glowy presentation undercut credibility.

**Worth keeping (and carried forward)**
- The **content/voice rules** — sentence case, no emoji, forbidden hype CTAs, STOP/HELP in examples, "explain why each field is needed." These are strong and survive into the new system's UX-writing rules.
- The **product narrative** — missed call → SMS → front-desk-ready details. Clear and correct.
- The **SMS-off-until-approved, no-charge-until-live** trust mechanic — excellent and now featured prominently.

---

## 2 · Directions explored

### Direction A — "Clinic" · Clean clinical operations *(chosen → renamed "Recall")*
- **Personality:** calm, precise, trustworthy medical-software. Think a modern practice-management tool, not a startup.
- **Color:** light-first; a single **clinical teal** as brand+action; warm-cool slate neutrals; true, distinct semantic colors; an apricot accent for human warmth.
- **Type:** Schibsted Grotesk (display) + Hanken Grotesk (body) — humanist, friendly-but-serious, both free/Google.
- **Components:** rounded-rect (10–14px), neutral layered shadows, borders carry structure, pills only for status.
- **Emotion:** "this is safe, organized, and made for healthcare."
- **Strengths:** maximal trust + accessibility; one unified system; ages well. **Weakness:** could feel safe/expected if executed timidly — mitigated with confident type and generous space.
- **Fit:** ★★★★★ — exactly what dental office staff and owners trust.

### Direction B — "Front Desk" · Warm patient-recovery
- **Personality:** warm, human, reassuring; the friendly side of getting patients back.
- **Color:** cream/sand backgrounds, soft apricot + sage, deep brown ink.
- **Type:** a warm serif display (e.g. Fraunces) + humanist sans.
- **Emotion:** approachable, caring, boutique-practice.
- **Strengths:** distinctive, human, stands out from blue B2B SaaS. **Weaknesses:** warm cream + serif can read *spa/lifestyle*, undercutting the operational credibility a dashboard needs; harder to keep crisp at data density; serif display is an overused AI trope to avoid.
- **Fit:** ★★★☆☆ — lovely for marketing, weaker for the product UI.

### Direction C — "Operations" · Premium healthcare platform
- **Personality:** dense, powerful, enterprise — like a clinical operations console.
- **Color:** deep slate/indigo, cool grays, sharp accents; optional dark UI.
- **Type:** a tight grotesk (e.g. Inter/IBM Plex) at small sizes, data-dense.
- **Emotion:** capable, serious, "big system."
- **Strengths:** scales to lots of data; feels premium. **Weaknesses:** overkill and intimidating for a **single-purpose MVP** sold to small offices; higher cognitive load for non-technical front-desk staff; risks the same cold-tech feel as the original.
- **Fit:** ★★★☆☆ — right for a future enterprise tier, wrong for now.

---

## 3 · Chosen direction — "Recall"

**Direction A**, refined and named **Recall** (a dental double meaning: recovering
lost callers *and* the dental "recall" appointment that brings patients back).

**Why it wins**
- **Trust first.** Light, clean, clinical-teal + true semantic colors is the visual language office managers already associate with safe healthcare software. It removes every "consumer tech" cue from the old draft.
- **Fits dental offices.** Calm, legible, high-contrast — works for a range of ages and a busy front desk glancing between calls. The tooth/recall metaphor ties the brand to the domain.
- **Improves onboarding clarity.** A unified component system + a real stepper + plain status badges make the multi-step, compliance-gated setup understandable. The "SMS off until approved, no charge until live" mechanic is surfaced as reassuring UI, not buried.
- **Improves perceived quality.** One coherent system across marketing → onboarding → dashboard makes a small MVP feel like a finished, credible product.
- **Better than the draft** on every axis: identity, contrast/accessibility, semantic clarity, component reuse, and — critically — it actually designs the product, not just the brochure.

**Tradeoffs**
- Light-first means we deprioritize a dark marketing site (a dark *app* theme is provided but optional). Acceptable: trust > flair here.
- Schibsted + Hanken are deliberate but not famous; they must be loaded as webfonts (done via Google Fonts).
- "Safe" aesthetics demand discipline — the impact comes from space, type scale, and restraint rather than decoration.
