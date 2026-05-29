# Tokens — Recall design system

Every design token, as defined in `colors_and_type.css` (the source of truth).
Port these into the app's styling layer and **keep the names**. Light theme only.

---

## Color — brand scales

### Teal (brand + action) — `--teal-50…900`
| Token | Hex | Use |
|---|---|---|
| `--teal-50` | `#E9F7F5` | `--primary-soft` surfaces, tiles |
| `--teal-100` | `#C8ECE8` | soft fills |
| `--teal-200` | `#97DBD4` | soft borders |
| `--teal-300` | `#5DC3BA` | logo dot, accents |
| `--teal-400` | `#2BA69B` | focus border |
| `--teal-500` | `#0E8A80` | — |
| `--teal-600` | `#0B6F67` | **primary action** (AA on white) |
| `--teal-700` | `#095852` | primary hover, link, badge text |
| `--teal-800` | `#07433F` | — |
| `--teal-900` | `#063531` | deepest |

### Neutrals (warm-cool slate) — `--n-0…900`
`#FFFFFF · #FBFCFC · #F6F8F7 · #F1F4F3 · #E2E8E6 · #CDD6D3 · #A7B2AF · #7C8784 · #586462 · #3D4845 · #2A3331 · #18201F`
(0 / 25 / 50 / 100 / 200 / 300 / 400 / 500 / 600 / 700 / 800 / 900)

### Ink (deep teal-charcoal) — `--ink-700/800/900`
`#1E4A47 · #143A38 · #0C2B2A` — headings, dark surfaces (CTA band, auth aside).

### Accent (apricot, used sparingly) — `--accent-300/400/500`
`#F8C794 · #F2A65A · #E08A2B` — warmth in marketing/illustration only; never a button.

---

## Color — semantic (light theme)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F6F8F7` (n-50) | app / page background |
| `--surface` | `#FFFFFF` | cards, panels |
| `--surface-2` | `#F1F4F3` (n-100) | insets, hover rows |
| `--border` | `#E2E8E6` (n-200) | default hairline |
| `--border-strong` | `#CDD6D3` (n-300) | inputs, dividers |
| `--text` | `#0C2B2A` (ink-900) | headings / primary |
| `--text-body` | `#2E3B39` | paragraph body |
| `--text-secondary` | `#586462` (n-600) | secondary |
| `--text-muted` | `#7C8784` (n-500) | helper / meta |
| `--primary` | `#0B6F67` | action color |
| `--primary-hover` | `#095852` | hover |
| `--primary-soft` | `#E9F7F5` | soft brand surface |
| `--primary-soft-border` | `#97DBD4` | soft brand border |
| `--link` | `#095852` | links |

## Status colors (distinct from brand)
| Status | base / text / bg / border |
|---|---|
| Success | `#1E9E54` / `#15803D` / `#EAF7EF` / `#BBE6CB` |
| Warning | `#E08A2B` / `#B45309` / `#FDF3E5` / `#F6D9AC` |
| Error | `#D9483B` / `#C13B30` / `#FBEDEB` / `#F3C7C1` |
| Info | `#1488C2` / `#0E6FA3` / `#E9F4FB` / `#BFE0F1` |

**Rule:** status is **never color-alone** — always pair with a dot + label (badges)
or icon + text (alerts).

## Focus &amp; disabled
- `--focus-ring`: `0 0 0 3px rgba(43,166,155,.40)` — on every interactive element.
- `--focus-border`: `--teal-500` `#0E8A80`.
- `--disabled-bg` `#F1F4F3` · `--disabled-text` `#A7B2AF` · `--disabled-border` `#E2E8E6`.

---

## Typography
- **Display / headings:** Schibsted Grotesk (`--font-display`).
- **Body / UI:** Hanken Grotesk (`--font-sans`).
- **Numbers / phone / code:** IBM Plex Mono (`--font-mono`), tabular.
- All free / Google Fonts.

| Class / var | Spec |
|---|---|
| `.t-display-xl` | Schibsted 700 · clamp 44–60px · −.022em · marketing hero |
| `.t-display-l` | Schibsted 700 · clamp 36–48px · −.02em |
| `.t-h1 / .t-h2 / .t-h3 / .t-h4` | Schibsted 700/650/600 · −.02→0em · 1.1–1.35 |
| `.t-body-lg` | Hanken 400 · 18px / 1.6 |
| `.t-body` | Hanken 400 · 16px / 1.6 · `--text-body` |
| `.t-small` | Hanken 400 · 15px / 1.55 · `--text-secondary` |
| `.t-label` | Hanken 600 · 14px · field labels, table headers |
| `.t-helper` | Hanken 400 · 13px · `--text-muted` |
| `.t-eyebrow` | Hanken 600 · 12px · UPPERCASE · +.10em · `--primary` |
| `.t-metric` | Schibsted 700 · clamp 32–40px · tabular-nums |
| `.t-mono` | IBM Plex Mono · tabular-nums |

---

## Spacing — 4px base (`--space-1…32`)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128`
(tokens: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32). Use tokens, not arbitrary px.

## Radius (`--r-*`)
`xs 6 · sm 8 · md 10 (buttons/inputs) · lg 14 (cards) · xl 20 · 2xl 28 (media) · pill 999 (badges/chips only)`.

## Elevation (neutral — no colored glows)
- `--shadow-xs` `0 1px 2px rgba(12,43,42,.06)`
- `--shadow-sm` cards · `--shadow-md` hover · `--shadow-lg` popover · `--shadow-xl` modal/drawer
- `--shadow-focus-primary` — primary button hover.

## Layout
`--container 1120` · `--content 720` · `--app-max 1160` · `--sidebar-w 248` ·
`--topbar-h 64` · `--header-h 68`. Breakpoints: sm 640 / md 768 / lg 1024 / xl 1280.

## Dark theme
A `[data-theme="dark"]` block exists in the CSS but is **future-only — do not ship
in current scope.** No theme toggle in Phase 1.
