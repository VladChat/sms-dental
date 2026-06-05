# Billing & Usage Policy (source of truth)

Plan pricing, included usage, and additional-number consent are defined once in
code at **`config/billing.config.ts`** and rendered everywhere from there (owner
UI, API validation, consent text, DB snapshots). Do not duplicate these amounts.

> Status: **current canonical policy.** Self-service number purchasing and
> server-side paid-plan subscription creation are deployed in production code,
> with Stripe **test-mode only** Price IDs and secret key. Twilio number assignment is gated
> by `runtimeConfig.onboarding.twilioNumberPurchaseMode`, which defaults to
> `"disabled"`. Real Twilio purchases happen only when the mode is `"live"`;
> `"mock"` is for local/staging UX testing and never calls Twilio purchase APIs.

## Plan

**Base plan — $99/month** (`basePlan.monthlyUnitAmountCents = 9900`)

Included each month (shared across **all** business numbers on the account):

- **1** business number (`includedBusinessNumbers`)
- **1,000** call minutes (`includedCallMinutes`)
- **1,000** SMS segments (`includedSmsSegments`)

**SMS segment:** a billing unit. Long messages and some characters can use more
than one segment. The monthly limit is based on segments, not messages. (Surfaced
to owners via an accessible question-mark tooltip in the Billing panel.)

## Additional business numbers — $20/month each

(`additionalBusinessNumber.monthlyUnitAmountCents = 2000`)

- Additional numbers require a webhook-confirmed active paid subscription.
- The owner must explicitly authorize the additional $20/month **before** an
  additional number can be purchased. Consent text version:
  `additional-business-number-v1`.
- Exact consent text (rendered from config):
  > "I authorize Missed Calls Dental to add $20/month to my monthly bill when
  > this number is activated."
- The checkbox is unchecked by default, required **only** for an additional
  number, enforced by the **server** (not just the client), and stored as a
  durable audit snapshot on the phone-number purchase/assignment records
  (`billing_class`, `monthly_unit_amount_cents`, `currency`,
  `billing_consent_text_version`, `billing_consent_text`,
  `billing_consent_authorized_at`, `billing_consent_authorized_by_profile_id`,
  `billing_consent_authorized_by_email`).

## Usage above the included monthly limits

- **$0.07** per additional call minute (`overage.callMinuteUnitAmountCents = 7`)
- **$0.06** per additional SMS segment (`overage.smsSegmentUnitAmountCents = 6`)
- Overage values are documented in config, but usage metering and usage billing
  are not implemented as live billing behavior yet.

## Number lifecycle guarantees (non-negotiable)

- A purchased/assigned business number is **never** replaced, cancelled,
  released, or hidden because the owner requests another number.
- "Add number" always means **adding another** number, never replacing.
- Multiple assigned numbers can coexist and are all displayed.
- Suspended numbers still count toward the account limit and Stripe additional-number quantity.
- The server classifies purchases as `included` or `additional` from live DB
  state and entitlement rules inside a clinic-locked flow. The client never
  decides the price or entitlement.
- Legacy `clinic_number_requests` rows are historical only and are not billable.

## Stripe catalog

Stripe test-mode Price IDs are configured for the deployed flow:

- Base plan $99/month: `price_1TegbY4ZSHLicmejTDngrrYT`
- Additional business number $20/month: `price_1TegbZ4ZSHLicmejnCGGpOEQ`

The current `STRIPE_SECRET_KEY` is test-mode, not live. No live Stripe charge can
occur until a future live billing rollout explicitly replaces test-mode Stripe
configuration with approved live-mode resources.

Product names chosen so invoices / the Customer Portal read clearly:

- **Missed Calls Dental — Monthly plan** — one base monthly subscription item.
- **Additional business number** — one recurring item with **quantity** = number
  of activated additional numbers.
- **Additional call usage** — usage-based item for call-minute overage.
- **Additional SMS usage** — usage-based item for SMS-segment overage.

Stripe Price IDs (test vs live differ) live in Stripe + non-secret runtime/billing
wiring, **never** hard-coded next to the amounts in `billing.config.ts`.

## Current deployed-but-gated reality

- Supabase migration `20260603000200_self_service_number_purchasing.sql` has been applied and verified.
- `STRIPE_BASE_PLAN_PRICE_ID` and `STRIPE_ADDITIONAL_NUMBER_PRICE_ID` are set in Vercel Production with test-mode Price IDs.
- Paid-plan start creates a Stripe test-mode subscription server-side using the
  saved Stripe Customer and saved PaymentMethod.
- Twilio purchase mode defaults to `"disabled"` in committed runtime config.
- Real Twilio purchases are still blocked unless the mode is deliberately changed to `"live"`.
- Mock mode can exercise assignment UX and DB/entitlement behavior in local/staging without buying a Twilio number.
- No live Stripe charge can occur while Stripe remains test-mode.
- SMS recovery enablement is separate and is not changed by payment-method setup, first-number assignment, or subscription status.
- Usage metering/reporting remains a future billing milestone.

---

## Self-service number purchasing + paid-plan conversion (current, 2026-06-03)

This supersedes the old owner "request a number for admin review" workflow.
Production code is deployed, Stripe remains **sandbox/test only**, and
`runtimeConfig.onboarding.twilioNumberPurchaseMode` defaults to `"disabled"`.

**First number (included).** When an owner selects their first number, the app
assigns it through the shared provisioning flow — no admin approval. A saved
payment method is required. In `"mock"` mode this uses a fake `PN_mock_*` SID and
does not call Twilio purchase APIs; in `"live"` mode it purchases/configures the
real Twilio number. The number is included with the $99/month base plan, the
owner is **not** charged that day, and the **21-day trial starts only after the
first number is assigned** (`clinics.trial_started_at` / `trial_ends_at`;
`billing_status='trialing'`). SMS recovery is **not** auto-enabled.

**Trial source of truth** = `clinics.trial_started_at` / `trial_ends_at` (no longer
derived from the setup-request date).

**Starting the paid plan** is an explicit owner action that stays in-app. The
server creates a Stripe test-mode subscription using the saved Stripe Customer,
saved PaymentMethod, and the **server-side** base Price ID
(`STRIPE_BASE_PLAN_PRICE_ID`; never client-supplied). The API uses
`collection_method='charge_automatically'`, the saved `default_payment_method`,
and `payment_behavior='error_if_incomplete'`; payment failure or required card
action returns an in-app error rather than redirecting to Stripe Checkout. After
successful server-side subscription creation, the API immediately persists the
returned Stripe subscription state using the same conservative status mapping as
the webhook so the owner UI does not wait indefinitely on webhook delivery. The
webhook remains idempotent ongoing truth and can later confirm/update the same
state. Paid entitlement is never granted from a client-supplied value or legacy
`?paid_plan=success` query param. Natural trial end does not silently charge.

**Additional numbers** ($20/month each) are available **only** with a
webhook-confirmed active paid subscription, require the explicit $20/month consent
text, and are assigned through the same provisioning flow: Twilio mock/live
purchase step → set the Stripe additional-number subscription-item **quantity**
(`STRIPE_ADDITIONAL_NUMBER_PRICE_ID`; proration to next invoice) → activate
**only if the quantity sync succeeds**. If sync fails the attempt is
`reconciliation_required`, the number is **not activated and not released**, and
the Twilio SID is preserved.

**Default limit** = **5 total held** business numbers per clinic
(`billingConfig.productPolicy.defaultSelfServiceBusinessNumberLimit`; stored on
`clinics.phone_number_limit`). Held = assigned (active **or suspended**) +
Twilio-purchased numbers awaiting reconciliation. A platform admin can raise the
limit (1–100, never below the held count).

**Suspend** (admin) sets a number inactive but **keeps** the Twilio number and the
Stripe additional-number quantity — a suspended number still counts toward the
limit and is still billed. **No automatic Twilio release** anywhere in this
milestone. **Revoke** blocks *new* purchases at the account level only.

**Admin controls:** allow/revoke purchasing, view/change the limit, suspend /
reactivate numbers, and view assigned numbers, billing class/quantity, purchase
attempts, and reconciliation issues. Legacy `clinic_number_requests` remain visible
under "Legacy number requests" (retired; never auto-purchased/billed/cancelled;
optional admin Dismiss).

**Real-purchase go-live (still gated, separate approval):** only a deliberate
future change to `runtimeConfig.onboarding.twilioNumberPurchaseMode = "live"`
permits real Twilio purchases. Live Stripe billing requires a separate approved
live-mode rollout. Until then the flow is fully built and deployed for safe
testing, but no real Twilio number or live Stripe charge occurs.

## Controlled real-purchase test mode (`owner_test_live`)

`runtimeConfig.onboarding.twilioNumberPurchaseMode` now has four values:
`disabled` (no purchase), `mock` (staging UX only — a fabricated `PN_mock_…` SID,
no Twilio call), **`owner_test_live`** (a **real** Twilio purchase, but ONLY for
clinic ids in the non-secret `runtimeConfig.onboarding.twilioPurchaseTestClinicIds`
allowlist), and `live` (real purchase for all eligible clinics — deliberate
go-live). In `owner_test_live`, any clinic not on the allowlist is treated exactly
like `disabled`. The allowlist holds clinic UUIDs (not secrets), so it lives in
committed runtime config. `live` (broad real purchasing) remains off.

## FUTURE MILESTONE — Monthly usage metering + billing breakdown (NOT yet built)

This is **deferred and not implemented**. The UI must **never** show fabricated
usage numbers until this lands. Tracked here so it is not forgotten.

Acceptance criteria for the future milestone:

- Aggregate usage **per clinic billing period** (the Stripe subscription cycle).
- **Total call minutes** summed across all of the clinic's phone numbers.
- **Total SMS segments** summed across all of the clinic's phone numbers.
- Included limits applied to the account total: **1,000 call minutes** and
  **1,000 SMS segments** (shared across all numbers; from `billing.config.ts`).
- Overage: **$0.07 / additional call minute** and **$0.06 / additional SMS
  segment** (from `billing.config.ts`).
- Additional phone numbers: **quantity × $20/month** (from the Stripe additional-
  number subscription item quantity).
- An **estimated monthly total** = base $99 + (additional numbers × $20) + overage.
- **Stripe billing synchronization rules:** call-minute and SMS-segment overage
  are reported as usage-based subscription items; reporting must be idempotent and
  reconciled against the billing period, and never double-count across webhook
  retries.
- **No live overage billing** (no real charge for usage) until this milestone is
  implemented AND explicitly approved — i.e. no usage meter/meter-event is created
  before then.

## Historical note

The earlier 2026-06-02 request/consent foundation stored owner number preferences
in `clinic_number_requests` for operator review. That workflow is retired for new
owner actions: `POST /api/account/phone-numbers/request` now returns 410. Existing
rows remain visible as legacy data for admin view/dismiss only and are never
auto-purchased, billed, cancelled, or treated as current entitlement.
