# Production Readiness - Real vs Blocked Audit

Status: Active canonical readiness reference
Last updated: 2026-06-08

This document is the current "what is real vs blocked" source of truth. When it
conflicts with older numbered build-spec docs, trust this document and the
current source code.

Safety note for this audit: provider checks were read-only. No SMS was sent, no
Twilio number was purchased/released/configured, no Stripe state was changed, no
Vercel env was changed, and no secrets were printed.

---

## 1. Executive Status

| Area | Status | Current truth |
|---|---|---|
| Auth + setup + owner account | Pass | Real Supabase Auth/session flow, owner account, clinic membership, setup completion. |
| Payment method | Pass for Stripe test mode | Real Stripe-hosted setup flow stores safe card metadata. Fairstone has `visa **** 4242`. |
| Paid plan | Pass for Stripe test mode | In-app server-side paid-plan start creates/persists an active Stripe test-mode subscription. It does not return a Checkout URL. |
| Billing UI | Pass | Uses config pricing and entitlement quantity; Fairstone shows base + 1 additional number = current monthly total. |
| Included number purchase | Pass for controlled owner-test clinic | Real Twilio number `+12244009986` assigned as included. Broad live purchase is not enabled. |
| Additional number purchase | Pass for controlled owner-test clinic | Real Twilio number `+12243442685` assigned as additional with $20/month consent and Stripe test-mode quantity sync. |
| Twilio webhooks | Pass | Both audited numbers have the app voice, voice-status, and SMS webhook URLs configured. |
| Emergency address | Pass in Twilio; one DB status needs refresh | Twilio reports both numbers emergency registered. DB still stores pending-registration for the second number from the initial update. |
| Messaging Service attachment | Blocked/reconcile | Code attempts real attachment and fails closed, but read-only Twilio audit did not list either clinic number in the configured Messaging Service. |
| A2P/10DLC | Blocked | No Twilio Brand registrations or service campaigns found. Live patient SMS is not production-safe. |
| SMS readiness tracking | Pass in code; pending operational sync | Additive readiness tables, read-only admin sync, admin launch guard, and live send guard now fail closed when A2P/Messaging Service coverage is missing, stale, or unsynced. |
| A2P approval review workflow | Implemented; real submission OFF by default | Platform-admin-only review package + one-click submit. Real Twilio A2P submission (Trust Hub Customer Profile + A2P Trust Product + Brand + Campaign + sender attachment) is implemented as an idempotent/resumable state machine, but the committed `submissionMode` default is `dry_run`. Real ("live") submission is armed only when mode=live AND the clinic is allowlisted AND a primary Customer Profile SID is configured. Clinic owners cannot submit. |
| SMS recovery | Blocked by design | `sms_recovery_enabled=false`; outbound SMS count is zero. Do not enable until A2P and Messaging Service coverage are confirmed. |
| Usage metering/overages | Not built | Prices are documented; no live metering or overage billing exists. |
| Staff invites/team access | Not built | Workspace exists, real owner membership exists, but staff invitation/acceptance is still disabled/sample-only. |
| Workspace reply workflow | Partial | Workspace displays real conversations and saves outcomes; full operational reply/scheduling workflow is not complete. |

Overall: the app is now a controlled owner-test paid SaaS path for one clinic,
not a broad production SMS recovery launch. Billing and number assignment are no
longer placeholders. Live patient SMS remains intentionally blocked.

---

## 2. Controlled Production/Test Configuration

Current committed runtime config:

- `runtimeConfig.onboarding.twilioNumberPurchaseMode = "owner_test_live"`
- `runtimeConfig.onboarding.twilioPurchaseTestClinicIds` includes only
  `f37f24a1-070f-436b-b803-956f55466093` (Fairstone Dental Smile).
- Broad `live` Twilio purchase mode is off.
- `"mock"` remains local/staging UX only and does not call Twilio purchase APIs.
- `"disabled"` remains the safe default mode to use when testing is complete.

Current Stripe behavior:

- Stripe is test/sandbox mode only.
- Paid-plan start is server-side and in-app.
- `/api/account/billing/start-paid-plan` returns JSON status, not a Stripe URL.
- The Stripe webhook has real billing lifecycle handling and persists
  subscription state idempotently/fail-closed.
- No live Stripe resources or live charges are enabled.

Current SMS behavior:

- `SMS_RECOVERY_MODE` defaults safe.
- `sendRecoverySms()` is guarded by recovery mode, owner-test allowlist/live
  clinic launch flag, `sms_status='active'`, opt-out state, duplicate
  suppression, and confirmed readiness data for live sends.
- Owner-test sends remain limited to explicit `SMS_TEST_ALLOWED_TO` destinations.
- Live patient SMS fails closed when A2P campaign, Messaging Service, or
  per-number coverage is missing, stale, or unsynced.

---

## 3. Read-Only Production Audit - Fairstone Dental Smile

Clinic:

- `clinic_id`: `f37f24a1-070f-436b-b803-956f55466093`
- Name: Fairstone Dental Smile
- Required business/address fields for real purchase: present.
- `owner_contact_phone`: missing; recommended but not purchase-blocking.
- `business_info_completed`: true
- `a2p_info_completed`: true locally saved only; not a Twilio approval.
- `sms_status`: `waiting_for_approval`
- `sms_recovery_enabled`: false
- `billing_status`: active
- Stripe payment method: present (`visa **** 4242`, exp `12/2034`)
- Stripe subscription: present and active in test mode
- Trial started: 2026-06-05
- Paid plan started: 2026-06-05

Assigned numbers:

| Number | PN SID | Billing class | Active | Monthly amount | DB emergency status |
|---|---|---|---|---:|---|
| `+12244009986` | `PNcfa04ebbb3c99d346473979781eb8785` | included | true | 0 | registered |
| `+12243442685` | `PN04b5bd6be9a95f26412c58bafea04512` | additional | true | 2000 cents | pending-registration |

Entitlement counts:

- Total held rows: 2
- Active rows: 2
- Included active: 1
- Additional billed quantity: 1

Purchase attempts:

- `+12244009986`: `assigned`, slot `included`, no error.
- `+12243442685`: `assigned`, slot `additional`, no error.

Patient-message/call safety counts:

- `messages`: 0 total, 0 outbound, 0 inbound.
- `call_events`: 0.
- No patient message bodies or patient phone data were printed.

Stripe test-mode audit:

- Customer present.
- Subscription present and `active`.
- Subscription items found:
  - 9900 cents/month quantity 1.
  - 2000 cents/month quantity 1.
- One saved card payment method found (`visa **** 4242`).

Twilio read-only audit:

| Number | Exists | Voice webhook | Voice status callback | SMS webhook | Emergency status |
|---|---|---|---|---|---|
| `+12244009986` | yes | app voice incoming URL | app voice status URL | app SMS incoming URL | Active / registered |
| `+12243442685` | yes | app voice incoming URL | app voice status URL | app SMS incoming URL | Active / registered |

Twilio Address:

- Both numbers use emergency Address SID `ADe303a7e8801efdff77e94b6bec887a59`.
- Twilio now reports both numbers as emergency registered.
- DB should be refreshed/reconciled for the second number because it still stores
  `pending-registration`.

Messaging Service:

- Configured service: `MG83239dc7dfdf8aa6c9b397e8258f7d93`
- Friendly name: `Missed Call SMS - Dental MVP`
- Read-only service sender list did not show either Fairstone PN SID attached.
- Incoming number records also did not expose a matching `messagingServiceSid`.
- Treat outbound SMS as blocked until service coverage is reconciled and verified.

A2P/10DLC:

- Brand registrations found: 0.
- Service A2P campaigns found: 0.
- Messaging Service is not linked to an A2P campaign.
- Neither audited number is covered by an approved campaign/service.
- Outbound patient SMS is not production-safe.

---

## 4. What Is Real Now

- Real owner login/session authorization.
- Real setup completion and account dashboard.
- Real payment-method setup in Stripe test mode.
- Real saved payment method metadata in `clinics`.
- Real in-app server-side paid-plan subscription start in Stripe test mode.
- Real Stripe webhook subscription/payment-method persistence.
- Real number entitlement calculation from DB state.
- Real first-number assignment for the allowlisted owner-test clinic.
- Real additional-number consent, Stripe test-mode quantity sync, and assignment.
- Real Twilio purchase readiness check before any Twilio purchase call.
- Real Twilio emergency address create/reuse and number update sequence in code.
- Real purchase-attempt reconciliation status when post-purchase configuration
  cannot be completed.
- Real Billing UI current monthly total from `billingConfig` plus entitlement.
- Real default-safe SMS gates; SMS is not enabled automatically by billing or
  number assignment.

---

## 5. What Is Still Blocked

- Broad Twilio live purchase mode.
- Live Stripe billing.
- A2P/10DLC Brand submission/status sync.
- A2P Campaign submission/status sync.
- Running the read-only sync before any launch decision (readiness migration is
  applied in production).
- Applying the additive A2P submission-state migration
  (`20260608000100_a2p_submission_state.sql`) — required before LIVE submission.
- Arming real A2P submission: it is implemented but OFF by committed default
  (`submissionMode=dry_run`). Live submission requires mode=live + the per-clinic
  allowlist + a configured `trustHub.primaryCustomerProfileSid`, then a platform
  admin clicking Submit. No real provider mutation happens until then.
- Live patient SMS recovery (remains fail-closed even after A2P approval).
- Messaging Service attachment reconciliation for current production numbers.
- Twilio emergency-status refresh/reconciliation when Twilio moves from pending
  to registered after assignment.
- Usage metering and overage billing.
- Staff invite creation, email delivery, acceptance, and member management.
- Full front-desk reply/scheduling workflow.
- Final onboarding polish for non-test production clinics.

---

## 6. SMS Readiness Guard Sprint

Implemented in code on 2026-06-06:

- Additive readiness model in
  `supabase/migrations/20260606000100_sms_readiness_tracking.sql`.
- Read-only admin sync endpoint:
  `POST /api/admin/clinics/:clinicId/sms-readiness/sync`.
- Admin clinic console shows SMS readiness, Messaging Service coverage, A2P
  Brand/Campaign status, and per-number readiness without changing Twilio.
- Admin `enable_sms` fails closed unless confirmed readiness data is fresh and
  production-safe for every active clinic number.
- Live `sendRecoverySms()` fails closed unless `SMS_RECOVERY_MODE=live`,
  `sms_recovery_enabled=true`, `sms_status='active'`, and the readiness tables
  confirm A2P/Messaging Service/per-number coverage.
- Owner-test sends remain limited to explicit `SMS_TEST_ALLOWED_TO`
  destinations and were not broadened.

Remaining operational steps before live SMS:

1. Apply the additive readiness migration in the approved target environment.
2. Run the read-only readiness sync for Fairstone from the platform admin
   console.
3. Reconcile Messaging Service sender coverage for both Fairstone numbers if
   the read-only sync still reports missing coverage.
4. Complete A2P/10DLC Brand and Campaign approval in Twilio.
5. Re-run readiness sync and verify every active number reports
   `production_safe=true` before Vlad approves `sms_recovery_enabled=true`.

---

## 7. Platform-Admin A2P Approval Review Workflow

Added in code on 2026-06-07 (`feat: add admin A2P approval review workflow`).

Product decision: A2P/10DLC approval is reviewed and submitted by the SYSTEM
OWNER / platform admin only. The clinic owner enters business + SMS/A2P
information; the platform admin reviews the exact clinic/campaign/service-aware
package and decides whether it is ready. Clinic owners have no submit path — the
submit route is `resolvePlatformAdmin`-guarded and lives under `/api/admin`.

What it adds:

- Additive submission-tracking table
  `supabase/migrations/20260607000100_a2p_submission_tracking.sql`
  (`clinic_a2p_submissions`, one row per clinic, RLS on, service-role only).
- Server-side package builder `lib/a2p/review-package.ts` — the single source of
  truth used by both the admin page and the submit endpoint. It collects clinic
  identity/business fields, the saved A2P representative packet, active numbers +
  PN SIDs, current readiness rows, public privacy/SMS-terms URLs, and the
  configured Messaging Service SID; validates required fields; and returns
  warnings, per-number coverage, submit eligibility, and current status.
- Platform-admin-only "A2P review" tab in the clinic console plus the submit
  route `POST /api/admin/clinics/:clinicId/a2p/submit`.
- Future, non-mutating Twilio helper `lib/twilio/a2p-submission.ts` documenting
  the real Customer Profile → Trust Product → Brand → Campaign → Messaging
  Service → sender-attachment order. Every function throws by default.

Per-number coverage meanings (only "covered" is ever shown as approved/covered):

- `covered` — readiness confirms verified service + campaign + per-number
  coverage, fresh and error-free. Shown as "Approved / covered".
- `not_in_messaging_service` — the PN SID is not a sender on the Messaging Service.
- `not_campaign_covered` — sender present but not covered by an approved campaign.
- `readiness_missing` — no readiness row for the number (run the sync).
- `readiness_unavailable` — readiness tables not reachable (migration not applied).
- `stale` — readiness data older than the freshness window.
- `error` — the last readiness sync recorded a provider error.
- `blocked` — present but not production-safe for another reason.

Everything except `covered` renders as "Not approved yet" / "Not covered yet".

The two Fairstone numbers (`f37f24a1-070f-436b-b803-956f55466093`):

- `+12244009986` / `PNcfa04ebbb3c99d346473979781eb8785` (included)
- `+12243442685` / `PN04b5bd6be9a95f26412c58bafea04512` (additional)

Both are active office-texting numbers. As of this sprint the readiness tables
are not applied in production and no Brand/Campaign exists, so both display as
"Not covered yet". The admin UI never implies approval until readiness confirms it.

Dry-run vs real submission:

- Mode is committed config `runtimeConfig.a2p.submissionMode` (default
  `"dry_run"`). `"disabled"` hides/refuses submit; `"dry_run"` records a local
  `dry_run_reviewed` status (ready for manual submission) without touching
  Twilio; `"live"` is reserved and is refused by the endpoint — real submission
  is not implemented (`isRealA2pSubmissionEnabled()` is hard false).
- Submit is hidden/disabled when info is missing, readiness tables are
  unavailable, the clinic is already submitted/pending/approved, a prior
  submission was rejected, or the mode is disabled. The endpoint re-validates all
  of this server-side and refuses duplicates.

Real one-click submission (implemented 2026-06-08): when armed, a single Submit
click runs the real, idempotent, resumable Twilio Trust Hub flow in
`lib/twilio/a2p-submission.ts` — business + representative EndUsers, Address +
SupportingDocument, Secondary Customer Profile (assign + evaluate + submit), A2P
Trust Product (assign + evaluate + submit), Brand Registration, A2P Campaign, and
adding the clinic's PN SIDs as Messaging Service senders. Created SIDs are
persisted after each step and reused on retry, so re-clicking resumes after async
brand/campaign approval without creating duplicates. The full EIN is sent to
Twilio but never logged or stored.

Exact steps required to ARM real A2P submission (deliberately not armed by default):

1. Apply the additive state migration `20260608000100_a2p_submission_state.sql`
   in the target DB (the readiness + submission-tracking migrations are already
   applied in production).
2. Set `runtimeConfig.a2p.trustHub.primaryCustomerProfileSid` to the account's
   primary Customer Profile SID, and confirm the Trust Hub policy SIDs, brand
   constants, and campaign use case are correct for the Twilio account.
3. Set `runtimeConfig.a2p.submissionMode = "live"` and ensure the clinic is in
   `liveSubmitClinicIds` (Fairstone is). Redeploy.
4. Confirm fees/risks (one-time Brand fee, recurring Campaign fees, external
   vetting that cannot be undone) and obtain owner approval.
5. A platform admin reviews the package and clicks Submit. No real mutation
   occurs before that click.

Exact steps required AFTER approval before live SMS:

1. Re-run the read-only readiness sync.
2. Confirm Messaging Service verified, Brand + Campaign approved, and every active
   number reports `messaging_service_sender_status='covered'`,
   `a2p_campaign_coverage_status='covered'`, `production_safe=true`, and fresh.
3. Only then, with Vlad's approval, use the admin launch action to set
   `sms_recovery_enabled=true`. Live send still fails closed otherwise.

Production migration status: ALL three migrations are applied in production
(readiness `20260606000100`, submission-tracking `20260607000100`, and state
`20260608000100_a2p_submission_state.sql`, applied 2026-06-08).

Arming status (2026-06-08): `trustHub.primaryCustomerProfileSid` is configured to
the account's approved primary profile (`BUaeab21…`, AllyExporter LLC), discovered
via read-only Twilio. `submissionMode` is STILL `dry_run` — live is NOT armed.
Open verification before arming: the account already has an approved A2P Trust
Product on a different policy SID than configured, plus a draft platform Customer
Profile; confirm the brand model (per-clinic vs shared) and the A2P policy match
the account so a real submit does not create duplicate/wrong billable resources.

---

## 8. Validation

Validation for the 2026-06-06 readiness guard sprint:

- `npm run typecheck` - pass.
- `npm run build` - pass.
- `git diff --check` - pass.

Validation for the 2026-06-07 A2P approval review workflow:

- `npm run typecheck` - pass.
- `npm run build` - pass.
- `git diff --check` - pass.

Validation for the 2026-06-08 real A2P submission workflow:

- `npm run typecheck` - pass.
- `npm run build` - pass.
- `git diff --check` - pass.

No SMS was sent, no Twilio configuration was changed, no number was purchased,
NO real A2P registration was submitted (live mode stays off by committed
default; no real submit was run during development), and `sms_recovery_enabled`
remained unchanged.
