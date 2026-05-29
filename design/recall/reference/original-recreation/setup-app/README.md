# Setup app — UI kit

Hi-fi, interactive recreation of the **Missed Calls Dental** self-serve
onboarding flow (`app/setup/[token]/` in the source repo). This surface is
deliberately **light and utilitarian** — white cards, deep-teal `#0d9488`
primary, slate-gray text — distinct from the dark marketing site.

## Run
Open `index.html`. A 3-step wizard:
1. **Office profile** — clinic name, main phone, ZIP (the form-scope rule: only
   what the next step needs, each field explains why).
2. **Texting number** — Local / Toll-free tabs, area-code search, selectable
   number results with "Recommended" / type badges.
3. **Ready** — assigned number, SMS-off-by-default status, forwarding
   instructions, and the QA checklist.

A "Restart demo" link loops back to step 1.

## Files
- `index.html` — mounts the wizard, owns step + collected data.
- `components.jsx` — `PageShell`, `Stepper`, `Field`, `ClinicForm`, `NumberSearch`, `SetupStatusReady`.
- Styling is inline-object based (mirroring the source `*.tsx` components) and
  pulls the font stack from the root `colors_and_type.css`.

## Coverage
Page shell + kicker header, progress stepper, labeled fields with helper text,
primary/secondary buttons, segmented tabs, search input, number-result rows with
badges, alert/error block, info blocks, and the success ("ready") surface.

## Notes
- The `Stepper` is an additive convenience component (the source flow is
  server-routed per step); everything else mirrors the real components 1:1.
- Sample phone numbers are placeholders for demo only.
