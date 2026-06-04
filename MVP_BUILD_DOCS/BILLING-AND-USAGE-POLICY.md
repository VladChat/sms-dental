# Billing & Usage Policy (source of truth)

Plan pricing, included usage, and additional-number consent are defined once in
code at **`config/billing.config.ts`** and rendered everywhere from there (owner
UI, API validation, consent text, DB snapshots). Do not duplicate these amounts.

> Status: **pricing + consent foundation only.** Live Stripe subscription &
> usage billing are NOT enabled yet — see "Remaining milestone" below. Payment
> methods are still collected in Stripe **sandbox/test setup mode** with no charge.

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

- Billing for an additional number starts **only after** it is approved and
  activated by the operator. A **pending request is never charged.**
- The owner must explicitly authorize the additional $20/month **before** an
  additional-number request can be saved. Consent text version:
  `additional-business-number-v1`.
- Exact consent text (rendered from config):
  > "I authorize Missed Calls Dental to add $20/month to my monthly bill when
  > this number is activated."
- The checkbox is unchecked by default, required **only** for an additional
  number, enforced by the **server** (not just the client), and stored as a
  durable audit snapshot on `clinic_number_requests`
  (`billing_class`, `monthly_unit_amount_cents`, `currency`,
  `billing_consent_text_version`, `billing_consent_text`,
  `billing_consent_authorized_at`, `billing_consent_authorized_by_profile_id`,
  `billing_consent_authorized_by_email`).

## Usage above the included monthly limits

- **$0.07** per additional call minute (`overage.callMinuteUnitAmountCents = 7`)
- **$0.06** per additional SMS segment (`overage.smsSegmentUnitAmountCents = 6`)

## Number lifecycle guarantees (non-negotiable)

- A purchased/assigned business number is **never** replaced, cancelled,
  released, or hidden because the owner requests another number.
- "Add number" always means **adding another** number, never replacing.
- Multiple assigned numbers and multiple open requested numbers can coexist and
  are all displayed.
- Requesting a new number does **not** cancel an older different open request.
- The server classifies each request as `included` or `additional` from live DB
  state (active assigned numbers + open requests vs `includedBusinessNumbers`),
  inside a clinic-locked transaction. The client never decides the price.
- Real additional-number **purchase** stays blocked
  (`additional_number_billing_not_ready`) until subscription billing exists.

## Future Stripe catalog (document only — not created yet)

Names chosen so invoices / the Customer Portal read clearly:

- **Missed Calls Dental — Monthly plan** — one base monthly subscription item.
- **Additional business number** — one recurring item with **quantity** = number
  of activated additional numbers.
- **Additional call usage** — usage-based item for call-minute overage.
- **Additional SMS usage** — usage-based item for SMS-segment overage.

Stripe Price IDs (test vs live differ) live in Stripe + non-secret runtime/billing
wiring, **never** hard-coded next to the amounts in `billing.config.ts`.

## Remaining milestone

Live billing activation is a **separate** milestone: create the Stripe products /
prices / subscription, wire activation-time revalidation of the request snapshot,
and turn on usage reporting. Until then: no subscription, invoice, charge,
PaymentIntent, meter, or meter event is created; payment-method collection stays
in sandbox/test setup mode; `sms_recovery_enabled` is unaffected.

---

## v2 — Self-service number purchasing + paid-plan conversion (2026-06-03)

This supersedes the owner "request a number for admin review" workflow. Built on
branch `feat/self-service-numbers` (Stripe **sandbox/test only**;
`TWILIO_NUMBER_PURCHASE_ENABLED` stays false; not yet deployed).

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

**Live rollout (still gated, separate approval):** set `STRIPE_BASE_PLAN_PRICE_ID`
+ `STRIPE_ADDITIONAL_NUMBER_PRICE_ID` (test IDs created), apply migration
`20260603000200_self_service_number_purchasing.sql`, deploy, and only later flip
`TWILIO_NUMBER_PURCHASE_ENABLED` to perform real purchases. Until then the flow is
fully built but no real Twilio number or live charge occurs.
