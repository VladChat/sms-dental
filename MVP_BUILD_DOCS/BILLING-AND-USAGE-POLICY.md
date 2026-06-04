# Billing & Usage Policy (source of truth)

Plan pricing, included usage, and additional-number consent are defined once in
code at **`config/billing.config.ts`** and rendered everywhere from there (owner
UI, API validation, consent text, DB snapshots). Do not duplicate these amounts.

> Status: **current canonical policy.** Self-service number purchasing and
> Stripe-hosted subscription Checkout are deployed in production code, with Stripe
> **test-mode only** Price IDs and secret key. Real Twilio purchases remain gated
> by `TWILIO_NUMBER_PURCHASE_ENABLED=false`, so production is safe to test but is
> not live for real number purchases or live Stripe charges.

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
- Stripe subscription Checkout exists in test mode.
- Real Twilio purchases are still blocked by `TWILIO_NUMBER_PURCHASE_ENABLED=false`.
- No live Stripe charge can occur while Stripe remains test-mode.
- SMS recovery enablement is separate and is not changed by payment-method setup, first-number assignment, or subscription status.
- Usage metering/reporting remains a future billing milestone.

---

## Self-service number purchasing + paid-plan conversion (current, 2026-06-03)

This supersedes the old owner "request a number for admin review" workflow.
Production code is deployed, Stripe remains **sandbox/test only**, and
`TWILIO_NUMBER_PURCHASE_ENABLED` stays false.

**First number (included).** When an owner selects their first number, the app
**purchases and assigns the real Twilio number automatically** — no admin
approval. A saved payment method is required. The number is included with the
$99/month base plan, the owner is **not** charged that day, and the **21-day trial
starts only after the first number is assigned** (`clinics.trial_started_at` /
`trial_ends_at`; `billing_status='trialing'`). SMS recovery is **not** auto-enabled.

**Trial source of truth** = `clinics.trial_started_at` / `trial_ends_at` (no longer
derived from the setup-request date).

**Starting the paid plan** is an explicit owner action: Stripe-hosted Checkout in
`mode:"subscription"` charging the $99/month base plan via the **server-side**
Price ID (`STRIPE_BASE_PLAN_PRICE_ID`; never client-supplied). Paid entitlement is
granted **only** after the webhook confirms an active subscription — never from the
`?paid_plan=success` query param. Natural trial end does not silently charge.

**Additional numbers** ($20/month each) are available **only** with a
webhook-confirmed active paid subscription, require the explicit $20/month consent
text, and are purchased + assigned automatically: purchase Twilio → set the Stripe
additional-number subscription-item **quantity** (`STRIPE_ADDITIONAL_NUMBER_PRICE_ID`;
proration to next invoice) → activate **only if the quantity sync succeeds**. If
sync fails the attempt is `reconciliation_required`, the number is **not activated
and not released**, and the Twilio SID is preserved.

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
future change to `TWILIO_NUMBER_PURCHASE_ENABLED=true` permits real Twilio
purchases. Live Stripe billing requires a separate approved live-mode rollout.
Until then the flow is fully built and deployed for safe testing, but no real
Twilio number or live Stripe charge occurs.

## Historical note

The earlier 2026-06-02 request/consent foundation stored owner number preferences
in `clinic_number_requests` for operator review. That workflow is retired for new
owner actions: `POST /api/account/phone-numbers/request` now returns 410. Existing
rows remain visible as legacy data for admin view/dismiss only and are never
auto-purchased, billed, cancelled, or treated as current entitlement.
