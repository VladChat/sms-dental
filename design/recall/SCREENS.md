# Screens — Recall design system

Per-screen implementation guidance. Each has a hi-fi interactive mockup in
`screens/` (and the full showcase in `design-system.html`). Mockups are cosmetic
prototypes — match the look &amp; structure, wire to real data in production. Public
name is **Missed Calls Dental** throughout; trial is **21 days**.

---

## Marketing site — `screens/marketing.html`
Single-page light marketing site.
- **Header** — brand + "How it works" / "Pricing" / "Sign in" + primary "Start trial".
- **Hero** — eyebrow pill, benefit H1, one-sentence subhead, primary "Start 21-day free trial" + secondary "See how it works", trust line; right side = a small SMS recovery mock ending in a "front desk notified" confirmation.
- **Problem / solution** — "a missed call is a missed patient", 3 feature cards.
- **How it works** — 3 numbered steps (missed call → text → front desk follows up).
- **Pricing** — single card: 21-day free trial badge, $99/mo, included list, CTA. "Billing starts only after SMS recovery is live."
- **Trust / compliance** — STOP/HELP honored, consent page generated, no medical advice; a status list (carrier registration, opt-out handling, consent page).
- **CTA band** (ink bg) + **footer** (links to compliance pages). No "Recall" anywhere.

## Auth — `screens/auth.html`
Split layout: ink "pitch" aside + form panel. Single file, multiple states:
- **Sign in** — Google + Apple buttons, divider, email + password, "Forgot password?", primary "Sign in", link to start trial.
- **Forgot password** — email → "Send reset link".
- **Link sent** — confirmation + resend.
- **Create / reset password** — new password with a strength bar + confirm.
- **Done** — success, go to dashboard.
Future Google/Apple sign-in shown as buttons (brand-color glyphs are the only multi-color icon exception).

## Onboarding / account setup — `screens/onboarding.html`
4-step wizard, vertical stepper + progress bar:
1. **Office details** — clinic name, main phone, ZIP. Reassure: "Your main office number stays exactly the same." Each field explains *why*.
2. **Texting number** — Local / Toll-free segment; selectable number results with "Recommended" badge.
3. **Compliance &amp; approval** — checklist: consent page generated (✓), carrier (A2P/toll-free) registration submitted (in review), owner approval (todo). Info alert: "SMS stays off until approval completes. You're not billed during this step."
4. **Go live** — texting number ready; final call-forwarding instructions; warning alert: "Add a card to go live. Trial: **21 days**, then $99/mo." → dashboard.

Production note: maps to `app/setup/[token]/_components/*`. Restyle only; keep the
real data model (clinic → number → compliance → live).

## Dashboard — `screens/app.html` → Overview
- **MVP-safe metric cards (counts only):** Missed calls recorded · Recovery texts sent · Patient replies received · New patient requests. Caption "This week". **No** revenue/appointments/conversion/avg-response as live UI.
- **New patient requests** preview list (opens the request drawer).
- **Office texting number** status card: number, forwarding, SMS approval, opt-outs.
- **Needs callback** quick card → Patient requests.

## Patient Requests — `screens/app.html` → Patient requests *(core surface)*
The product's main operational area. **Not** a chat inbox.
- A **queue of office-ready request cards** (see `COMPONENTS.md`). Filter segment: All / New / Needs callback / Scheduled / Completed.
- Each card: name, phone, request, preferred time, priority, status, source, received + task actions (Mark scheduled / Needs callback / Mark completed / Details).
- **Detail drawer** (slide-over): fields, summary, internal note, and the **"Activity &amp; SMS audit trail"** — the raw SMS lives here only, as secondary history.
- **Two states designed:** populated (real-data) and **empty** (before the first missed call) — toggle in the mockup. Empty copy: "No patient requests yet. When a missed caller replies to your follow-up text, we'll turn it into a ready-to-action request here."
- **Priority = Urgent** only from caller-stated pain/emergency wording; never inferred medically.

## Missed calls — `screens/app.html` → Missed calls
A log/table of unanswered calls with **follow-up status only** (Reply received /
Awaiting reply / Opted out) + time. No business-result claims.

## Settings — `screens/app.html` → Settings
Tabs:
- **Clinic profile** — name, main phone (never changes), office texting number (active).
- **Login &amp; security** — password (change), connected sign-in methods (Email connected; Google / Apple connect — future).
- **Billing** — trial state ("Trial active — N days left", 21-day basis), plan ($99/mo), payment method (add card before trial ends). Billing pending state supported.

## Public compliance mini-site — `screens/compliance.html`
Per-office, publishable, light pages with a tabbed switch:
- **Business profile** — who the office is, when they text (only after a missed call you placed), consent &amp; choices (STOP/HELP), rates may apply.
- **Privacy policy** — info handled, how used, what they don't do, retention &amp; requests.
- **SMS terms** — program terms (transactional, not marketing), opting out, getting help, carrier note.
Footer: "Powered by Missed Calls Dental" (the real product name — **not** "Recall").
Copy is plain and factual; **never** claims "HIPAA compliant".
