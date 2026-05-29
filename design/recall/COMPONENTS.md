# Components — Recall design system

Specs for every component. Reference implementation: `components.css` +
`design-system.html` (open it to see live states). Re-implement as framework
components; match these specs. All interactive elements get the focus ring.

---

## Buttons — `.btn`
- Height 44px (`.btn-sm` 36 · `.btn-lg` 52), radius `--r-md` (10px), weight 600, `--font-sans`.
- **Primary** (`.btn-primary`): `--primary` bg, white text, `--shadow-xs`; hover → `--primary-hover` + `--shadow-focus-primary`.
- **Secondary** (`.btn-secondary`): white bg, `--border-strong`, `--text`; hover → `--surface-2`.
- **Ghost** (`.btn-ghost`): transparent, `--text-secondary`; hover → `--surface-2`.
- **Destructive** (`.btn-destructive`): `--error` bg, white; hover → `--error-text`.
- Modifiers: `.btn-block` (full width), leading icon via `svgIcon`. Active nudges 0.5px. Disabled = neutral gray, `not-allowed`.

## Text link — `.link`
`--link` color, weight 600, underline on hover (offset 3px).

## Inputs — `.input` / `.select` / `.textarea`
- 44px height (textarea auto, min 104px), radius `--r-md`, 1px `--border-strong`, white bg.
- Hover → `--n-400` border. Focus → `--focus-border` + `--focus-ring`.
- Error → `.is-error` / `[aria-invalid="true"]`: `--error` border + soft red ring; pair with red helper text.
- `.input-group` adds a leading icon (`.input-icon`). `.select` uses a chevron bg image. Disabled = `--disabled-bg`.
- Labels: `.field > label` / `.label` (`.t-label`). Helper: `.helper-text` (`.t-helper`). Required: `<span class="req">*</span>`.

## Checkbox / radio / switch
- `.check` wraps an `<input type=checkbox|radio>` (20px, custom check/dot) + label. Radio uses a pill + inner dot.
- `.switch` — 44×26 track, white knob, `--primary` when checked, `--shadow-sm` knob. All show focus ring.

## Cards
- `.card` — white, 1px `--border`, radius `--r-lg` (14px), `--shadow-sm`. `.card-pad` = 24px. `.card-hover` lifts on hover (`--shadow-md`, −2px translate).
- **Metric card** `.metric-card` — label + icon tile, big `.metric-value` (Schibsted, tabular-nums), caption. **MVP-safe: caption is a neutral period (e.g. "This week"), not a fabricated %.**

## Status badges — `.badge`
- Pill, 24px, weight 600, 12px; optional leading `.dot` (currentColor).
- Variants: `.badge-neutral / -brand / -success / -warning / -error / -info`.
- **Always color + label** (dot/text). Patient-request statuses map to:
  New → `-info`, Needs callback → `-warning`, Scheduled → `-success`, Completed → `-neutral`, Opted out → `-error`. Priority: Routine → `-neutral`, Urgent → `-error` (with dot).

## Alerts / notices — `.alert`
- Icon + bold title + body, 1px border, radius `--r-md`. Variants `-success / -warning / -error / -info`. Icon required (not color-alone).

## Setup step card / stepper
- Onboarding uses a **vertical stepper** (numbered dots, connector line; done = success check, active = primary, pending = muted) + a `.progress` bar.
- Each step body is a `.card`. See `screens/onboarding.html`.

## Patient request card *(the product's primary object)*
The core UI. A patient's reply is distilled into an **office-ready task** — not a chat.
- **Container:** `.card`-like, left border 3px `--info` when status = New.
- **Header:** `.avatar` (initials) + name + status badge + phone (`.t-mono` helper).
- **Fields (definition list):** Request · Preferred time · Priority. (Full field set: Name, Phone, Request, Preferred time, Priority, Status, Source, Received.)
- **Meta row:** source ("Missed call") + received time, muted with small icons.
- **Actions row** (top-bordered): primary task action by status —
  - New / Needs callback → **Mark scheduled** (primary) + **Needs callback** (secondary) + **Details** (ghost)
  - Scheduled → **Mark completed**
- **Detail drawer** (right slide-over, `screens/app.html`): fields, **Summary**, **Internal note** (textarea), and an **"Activity &amp; SMS audit trail"** timeline (missed call → recovery text → patient reply → request created). The **raw SMS lives here only** — secondary, never the headline.
- **Statuses:** New → Needs callback → Scheduled → Completed.
- **Never** present this as a generic SMS chat thread.

## Dashboard cards
Overview uses metric cards (counts), a "new patient requests" preview list, and an
office texting-number status card (number, forwarding, SMS approval, opt-outs).

## Lists &amp; tables — `.list` / `.list-row` / `.list-head` / `.avatar`
Used for the **missed-calls log** (caller + follow-up status + time). Follow-up
status only ("Reply received / Awaiting reply / Opted out") — no business-result claims.

## Navigation
- **Sidebar** (app): brand, nav buttons (icon + label, active = `--primary-soft`/`--teal-700`, optional count pill), clinic footer. Width `--sidebar-w`.
- **Topbar:** search, notification icon-button (with ping), avatar. Height `--topbar-h`, sticky, blurred.
- **Marketing header:** brand + nav links + primary CTA, sticky, translucent.
- **Tabs** `.tabs/.tab` (underline) and **segmented** `.segment` (pill group) for sub-nav / filters.

## States
- **Empty** `.empty` — icon tile + heading + reassuring copy. Required for Patient requests (before first call) and Missed calls.
- **Loading** `.skeleton` (shimmer; respects `prefers-reduced-motion`) + `.spinner` with a labeled task ("Searching numbers…").
- **Success** — green alert / success-tinted empty state ("Your texting number is live").
- **Error** — red alert, calm + blameless ("We couldn't reach the server. Please try again.").

## Icon tile — `.tile`
44×44, radius `--r-md`, `--primary-soft` bg, `--primary` icon. Houses a 20–22px Lucide-style icon.
