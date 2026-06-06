# Production Readiness - Real vs Blocked Audit

Status: Active canonical readiness reference
Last updated: 2026-06-06

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
- Applying the SMS readiness migration in each target database and running the
  read-only sync before any launch decision.
- Live patient SMS recovery.
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

## 7. Validation

Validation for the 2026-06-06 readiness guard sprint:

- `npm run typecheck` - pass.
- `npm run build` - pass.
- `git diff --check` - pass.

No SMS was sent, no Twilio configuration was changed, no number was purchased,
and `sms_recovery_enabled` remained unchanged.
