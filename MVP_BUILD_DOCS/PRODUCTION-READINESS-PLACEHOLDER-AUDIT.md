# Production Readiness — Placeholder Audit

Status: Active (audit pass)
Last updated: 2026-06-01
Owner doc: this is the canonical "what is real vs placeholder right now" reference.
When this conflicts with older numbered build-spec docs (`00`–`15`), trust this doc
for current state.

This audit is **read-only on product behavior**. No placeholder features were
implemented in this pass. The only code/doc changes are documentation accuracy
fixes (see "Documentation mismatches"). Goal: order the next implementation tasks
correctly.

---

## 1. Executive summary

The backend foundation, real auth, onboarding capture, and the read+write
workspace outcome flow are genuinely working. The **money and team surfaces are
not**: billing/payment method, staff invitations, in-session password change, and
phone-number assignment are placeholders or blocked on external wiring. Several
primary buttons look active but do nothing real (open a "contact support" /
"will open here" modal), which is the highest-risk category because it implies a
working SaaS.

Most current operational docs are accurately hedged (they already say
"presentational", "shell", "placeholder"). The main doc risk is a stale
`PROJECT-CONTEXT.md` note that says voice testing is trial-blocked (it is now
verified) and the broad numbered build-spec docs that describe the full intended
product.

**Product-billing decision (reaffirmed):** a payment method may be *collected*
during setup, but **do not begin paid billing until automatic SMS recovery is
approved and active**.

---

## 2. Current product readiness status

| Capability | Status |
|---|---|
| Marketing site + Start trial → setup email | working |
| Auth: login / logout / forgot / reset / callback (PKCE + token_hash) | working |
| Setup link validation + idempotency + completed-state | working |
| Onboarding capture (clinic, business profile, SMS-approval data) + owner account creation | working |
| Account dashboard display (real clinic data, trial countdown) | working |
| Workspace: real cards + outcome/note saving; labeled samples | working |
| Public business pages `/business/{slug}` (+ privacy, sms-terms) | working (generated) |
| Twilio voice + inbound SMS webhooks, STOP/START/HELP | working (verified) |
| In-session **Change password** | placeholder |
| **Billing / payment method** (Stripe collect + subscribe) | placeholder + blocked_external |
| **Staff invite / team access** | placeholder |
| **Phone number assignment** (reserve/purchase) | blocked_external (gate off) |
| **A2P / carrier registration** (live patient SMS) | blocked_external (manual/not wired) |

Overall: **working prototype + real onboarding/auth/workspace; not yet a
self-serve paid SaaS.**

---

## 3. Placeholders / gaps inventory

> Risk = user-facing risk of implying the product works. Copy is quoted verbatim.

### 3.1 `placeholder` — active UI that does not perform its function

| # | Area | File(s) | Label / copy | Current behavior | Expected real behavior | Impact | Risk | Next action | Future task title |
|---|---|---|---|---|---|---|---|---|---|
| P1 | Billing | `app/setup/[token]/_components/BillingCard.tsx` | `Add payment method` / `Update payment method`; modal: `Secure payment setup will open here when billing is connected.` | Opens an inert modal; no Stripe call, no card capture | Stripe Checkout/SetupIntent collects a card, sets `stripe_customer_id`, marks payment method on file | Owner believes they added payment; phone/setup can never complete | high | implement_now | Implement Stripe payment-method collection (no charge until SMS active) |
| P2 | Team access | `app/setup/[token]/_components/TeamAccessCard.tsx` | `Send invite`; modal: `Please contact support to add staff access.` | Validates email, then shows support modal; no invite sent | Create invite, email staff, allow password creation + front_desk membership | Owner cannot add front-desk staff; "support" implies a manual process that doesn't exist | high | implement_now (or hide_or_disable short-term) | Build staff invitation + acceptance flow |
| P3 | Account access | `app/setup/[token]/_components/AccountAccessCard.tsx` | `Change password`; modal: `Password change will be available after secure account settings are connected.` | Opens inert modal | In-session password update (reauth + Supabase `updateUser`) | Signed-in users cannot change password (must use forgot-password) | medium | implement_now | In-session change-password flow |
| P4 | Team access | `app/setup/[token]/_components/TeamAccessCard.tsx` | Sample `Remove` / `Restore`; modal: `Please contact support to update staff access.` | Sample-row buttons open support modal | Real member management once invites exist | Lower — rows are in a labeled Sample block | medium | keep_as_sample (until P2) | (covered by P2) |
| P5 | Marketing | `docs/script.js` (~L87) | "Sign-in form (front-end demo: always show inline error)" | Dead/demo handler; `sign-in.html` now redirects to app `/login` | None — remove dead handler | None (page redirects before form shows) | low | backlog (cleanup) | Remove dead marketing sign-in demo handler |

### 3.2 `blocked_external` — depends on integration/config not enabled

| # | Area | File(s) | Current behavior | Expected real behavior | Impact | Risk | Next action | Future task title |
|---|---|---|---|---|---|---|---|---|
| B1 | Billing | `app/api/webhooks/stripe/route.ts`, `lib/stripe/*` | Verifies signature + records `webhook_events`; **no billing logic**; nothing ever sets `stripe_customer_id`/`billing_status` | Subscription lifecycle handlers; payment-method + trial state | `hasPaymentMethod` is effectively always false in prod | high | implement_now (with P1) | Stripe subscription + webhook billing handlers |
| B2 | Phone number | `app/api/onboarding/[token]/numbers/purchase/route.ts`, `lib/env.ts` (`isTwilioNumberPurchaseEnabled`), `lib/onboarding/local-number.ts` | Purchase gated by `TWILIO_NUMBER_PURCHASE_ENABLED` (default false) → `503 purchase_disabled`; "prepare" is a read-only Twilio search, not a reservation | Controlled reserve/purchase after billing gate passes | No number is actually assigned in production today | high | implement_now (after P1/G1) | Enable controlled number reservation/purchase |
| B3 | SMS approval / compliance | `app/api/account/a2p/route.ts`, `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` | A2P data saved; displayed status → `Waiting for approval`; **nothing submitted to Twilio/carrier** | Submit/track toll-free or 10DLC registration | "Waiting for approval" implies a submission that hasn't happened | high | document_as_known_gap (manual op today) | Wire A2P/toll-free submission + status sync |
| B4 | SMS recovery | `lib/env.ts` (`SMS_RECOVERY_MODE`), `clinics.sms_recovery_enabled` | Disabled / owner_test only; per-clinic flag false | Live patient SMS after approval + owner enable | Intentional safety gate; correct for now | high (intentional) | document_as_known_gap | (gated by B3) |

### 3.3 `partially_working`

| # | Area | File(s) | Current behavior | Gap | Risk | Next action | Future task title |
|---|---|---|---|---|---|---|---|
| PW1 | Phone number | `app/setup/[token]/_components/AssignedNumberCard.tsx`, `BusinessProfile.tsx` (`phoneSectionStatus`) | Shows statuses + `Add a payment method to receive your phone number.` | billing→phone gate is **presentational only** (no server enforcement); and payment can't be added (P1) nor number purchased (B2), so the promise can't be fulfilled | high | implement_now | Server-side billing→phone provisioning gate |
| PW2 | Workspace access | `app/workspace/page.tsx`, `lib/auth/access.ts` | Auth membership + legacy token fallback; `front_desk` role supported | No invite flow exists to create front_desk users → workspace is effectively owner-only today | medium | backlog (after P2) | Front-desk-only workspace access |
| PW3 | SMS approval | `app/api/account/a2p/route.ts` | Real save + status advance | Not connected to carrier submission (see B3) | medium | document_as_known_gap | (gated by B3) |
| PW4 | Account billing block | `app/account/page.tsx` (`hasPaymentMethod` derivation) | Trial countdown real; `hasPaymentMethod` derived from `stripe_customer_id`/`billing_status` | Those fields are never set by any real flow yet (B1) | medium | implement_now (with P1/B1) | (covered by P1/B1) |

### 3.4 `sample_demo` (keep only while clearly labeled)

| # | Area | File(s) | Current behavior | Verdict | Risk |
|---|---|---|---|---|---|
| S1 | Workspace | `app/workspace/_components/Workspace.tsx` | Sample cards in a separate labeled `Sample requests` section, Hide/Show, disabled non-persistent outcome preview (`Sample preview · not saved`) | keep_as_sample — properly separated, never writes | low |
| S2 | Team access | `app/setup/[token]/_components/TeamAccessCard.tsx` | `Sample staff examples` (`frontdesk@example.com`, …) labeled `Sample`, Hide/Show | keep_as_sample (until P2 ships real members) | low |
| S3 | Team access | `TeamAccessCard.tsx` (`teamActionLabel`) | Real member rows render action text `Remove`/`—` as **plain text** (not buttons) | Minor: looks actionable but isn't; fold into P2 | low |

---

## 4. Working features inventory

| Area | File(s) | Why it's real |
|---|---|---|
| Marketing handoff | `docs/index.html`, `docs/pricing.html`, `docs/sign-in.html` | Sign in → `app/login`; Start trial → form POST to `/api/setup-requests`; `sign-in.html` redirects to `/login` |
| Setup request + email | `app/api/setup-requests/route.ts`, `lib/email/setup-link-email.ts` | Creates `setup_requests` row, hashed token, sends Resend email |
| Setup link + idempotency | `app/setup/[token]/page.tsx`, `lib/onboarding/verify.ts` | Validates token; completed links show completed-state / redirect; no form re-render |
| Owner account creation | `app/api/onboarding/[token]/clinic/route.ts` | Creates clinic + Supabase auth user + profile + owner membership + session |
| Auth flows | `app/api/auth/{login,logout,forgot-password,update-password}/route.ts`, `app/auth/callback/route.ts`, `app/reset-password/*` | Real Supabase Auth; branded reset email via app-domain `token_hash` link |
| Save: business profile / SMS-approval data | `app/api/account/business-info`, `app/api/account/a2p` (+ token variants) | Persist real clinic fields, clinic-scoped |
| Account dashboard display | `app/account/page.tsx`, `app/setup/[token]/_components/BusinessProfile.tsx` | Real clinic data, trial countdown, assigned-phone display, sign out |
| Workspace outcomes | `app/workspace/*`, `app/api/workspace/outcome/route.ts`, `lib/db/front-desk.ts` | Auth + clinic-scoped outcome/note save; status mapping; persists across refresh |
| Public business pages | `app/business/[slug]/*` | Generated from the clinic row (profile, privacy, SMS terms) |
| Number search | `app/api/onboarding/[token]/numbers/route.ts` | Real read-only Twilio search (purchase is separate/gated) |
| Twilio webhooks | `app/api/webhooks/twilio/**` | Voice + inbound SMS verified; STOP/START/HELP opt-out enforced |
| Health | `app/api/health/route.ts` | Public liveness |
| Stripe webhook (ingress only) | `app/api/webhooks/stripe/route.ts` | Signature verify + idempotent event record (no billing logic — see B1) |

---

## 5. API route inventory

| Route | Method | Classification |
|---|---|---|
| `/api/health` | GET | working |
| `/api/auth/login` `/logout` `/forgot-password` `/update-password` | POST | working |
| `/auth/callback` | GET | working (PKCE + token_hash) |
| `/api/setup-requests` | POST | working (marketing entry; sends email) |
| `/api/onboarding/[token]/clinic` | POST | working (account creation; idempotent) |
| `/api/onboarding/[token]/business-info` `/a2p` | POST | working (token-based save) |
| `/api/account/business-info` `/a2p` | POST | working (auth-based save) |
| `/api/onboarding/[token]/numbers` | GET | working — read-only search |
| `/api/onboarding/[token]/numbers/purchase` | POST | blocked_external (gate off → 503) |
| `/api/account/session` | POST | working — legacy setup-token cookie fallback (intentional during rollout) |
| `/api/workspace/outcome` | POST | working |
| `/api/webhooks/twilio/voice/{incoming,status}` `/messaging/{incoming,status}` | POST | working (verified) |
| `/api/webhooks/stripe` | POST | partially_working — verifies + records; no billing logic |

No placeholder/unsafe public routes were found. All write routes validate input
and (for account/workspace) enforce clinic-scoped auth.

---

## 6. Documentation mismatches

| # | Doc | Issue | Action taken this pass |
|---|---|---|---|
| D1 | `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` §11 | Says "real voice testing is blocked until Twilio account trial restrictions are resolved" — Twilio was upgraded to Full and voice verified end-to-end (SETUP-LOG 2026-05-26) | **Corrected** (small edit) |
| D2 | `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` §16 | "Current Immediate Next Step" predates auth/workspace/billing audit | **Corrected** to point at this audit |
| D3 | Numbered build-spec docs (`00`–`15`) | Describe the full intended product; can be misread as current state | Noted; this audit is the canonical current-state ref (no rewrite) |
| D4 | `MVP_BUILD_DOCS/MANIFEST.md` | Did not reference current operational docs (auth, front-desk, this audit) | **Added** reference to this audit |
| D5 | `MVP_BUILD_DOCS/SETUP-LOG.md` | No audit entry | **Added** short entry |

Current operational docs (`SETUP-LOG`, `OPERATIONS-RUNBOOK`,
`AUTH-AND-ACCESS-CONTROL`, `FRONT-DESK-WORKSPACE`, `REPEATABLE-SETUP-CHECKLIST`)
are otherwise accurate — they already label billing as presentational, team
access as a shell, and change-password as a placeholder.

---

## 7. Priority implementation sequence

1. **Fix misleading active UI** (P1–P4): wire real flows, or honestly disable /
   relabel until wired. Highest trust risk.
2. **Account/team access basics**: in-session change password (P3); prep team
   access for real members.
3. **Stripe billing / payment method** (P1, B1, PW4): collect a card during
   setup; **do not charge** until SMS recovery active.
4. **Server-side billing → phone provisioning gate** (PW1) + controlled number
   reservation/purchase (B2).
5. **Staff invitation/access flow** (P2, S2, S3, PW2).
6. **Real workspace workflow** beyond outcome saving (reply/call/assignment).
7. **Sample/demo cleanup** once real data paths exist (S1–S3).
8. **Docs/runbook polish** (D3, ongoing).

---

## 8. Recommended next 5 tasks (in order)

1. **Make placeholder actions honest** — convert Change password / Add payment
   method / Send invite / sample actions to either real flows or clearly disabled
   "Coming soon" states (no inert "contact support" modals on primary buttons).
2. **Stripe payment-method collection** — SetupIntent/Checkout to capture a card
   and set `stripe_customer_id`; **no charge yet**; webhook updates billing state.
3. **Server-side billing → phone provisioning gate** — enforce in the API (not
   just UI), then enable controlled number reservation/purchase.
4. **Staff invitation + acceptance** — real front_desk invites, password
   creation, `front_desk` membership; replace sample staff block.
5. **In-session change password** — reauthenticate + Supabase `updateUser`,
   removing the placeholder modal.

---

## 9. Do NOT treat as working yet

- **Billing / payment method** — "Add/Update payment method" is a placeholder; no
  Stripe charge, customer, subscription, or stored card. `hasPaymentMethod` is
  effectively always false in production.
- **Staff invites / team management** — "Send invite" does not send anything;
  sample staff rows are demo-only.
- **In-session change password** — placeholder modal.
- **Phone number assignment** — number purchase is disabled; no real number is
  assigned in production; "prepare" is search-only.
- **A2P / carrier approval** — "Waiting for approval" is a local status only;
  nothing is submitted to a carrier.
- **Live patient SMS recovery** — disabled by config + per-clinic flag.

---

## 10. Validation commands run

- `npm run typecheck` — see final report (pass).
- `npm run build` — see final report (pass).
- **Lint/test:** `package.json` defines **no `lint` and no `test` script** (only
  `dev`, `build`, `start`, `typecheck`). None to run.

This pass changed only documentation, so behavior is unchanged.

---

## 11. Files inspected (summary)

- App UI: `app/account/page.tsx`; `app/setup/[token]/_components/*`
  (BusinessProfile, BillingCard, AccountAccessCard, TeamAccessCard,
  AssignedNumberCard, SmsApprovalForm, ClinicForm, SetupInvalid, SetupComplete);
  `app/workspace/*`; `app/business/[slug]/*`.
- API: all routes under `app/api/**` (auth, account, onboarding, workspace,
  setup-requests, webhooks/twilio, webhooks/stripe, health).
- Lib: `lib/onboarding/*`, `lib/auth/access.ts`, `lib/db/*` (front-desk,
  setup-requests, clinics, clinic-memberships, auth-users), `lib/env.ts`,
  `lib/workspace/outcome.ts`, `lib/http/responses.ts`.
- Marketing: `docs/*.html`, `docs/script.js`.
- Schema: `supabase/migrations/*` (status enums, onboarding fields, front-desk
  outcome).
- Docs: `MVP_BUILD_DOCS/{PROJECT-CONTEXT,SETUP-LOG,OPERATIONS-RUNBOOK,AUTH-AND-ACCESS-CONTROL,MANIFEST,REPEATABLE-SETUP-CHECKLIST,FRONT-DESK-WORKSPACE}.md`,
  `package.json`, `AGENTS.md` context.
- Searched terms: `contact support`, `placeholder`, `coming soon`,
  `not implemented`, `not saved`, `will open here`, `after secure`, `sample`,
  `demo`, `TODO`, `FIXME`, `mock`, `stub`, `connected`, `disabled`, `future`.

---

## 12. Commit

Commit hash: `ce401ea` (`docs: audit production readiness placeholders`); pushed to `origin/main`.

---

## 13. Update — trust fix applied (2026-06-01)

First recommended task (§8.1) is done: misleading active placeholder actions were
removed. Status changes to the §3 inventory:

- **P3 Change password — RESOLVED (now real).** `POST /api/account/change-password`
  + real modal. See `AUTH-AND-ACCESS-CONTROL.md` §16.
- **P1 Add/Update payment method — RESOLVED as honest disabled state.** Fake modal
  removed; disabled `Payment setup not connected yet` + helper. Stripe still not
  built (B1 remains open).
- **P2 Send invite — RESOLVED as honest disabled state.** Fake support modal
  removed; disabled `Staff invitations not connected yet` + helper. Invite backend
  still not built.
- **P4 Sample Remove/Restore — RESOLVED.** Modal removed; sample actions are plain
  text; real member actions render `—`.
- **P5 Marketing sign-in demo handler — RESOLVED.** Removed from `docs/script.js`.

Still open (unchanged, future tasks): B1 Stripe billing, B2 phone purchase, B3
A2P/carrier submission, B4 live SMS, PW1 server-side billing→phone gate, P2 real
staff invitations. Next recommended task: **Stripe payment-method collection**
(collect during setup; no charge until SMS recovery is active).

---

## 14. Related plan — platform admin console

Several gaps above (billing readiness, phone provisioning, A2P status, SMS
activation, clinic kill switch) will be **operated** from a future internal
platform-owner console at `/admin`. Its architecture/spec is in
`PLATFORM-ADMIN-CONSOLE-PLAN.md` (separate from clinic `/account` and front-desk
`/workspace`; plan only, not implemented). The admin console does not change these
gaps' status — it is the operator surface that will manage them once their
prerequisites (Stripe, Twilio purchase, A2P) are wired.
