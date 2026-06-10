# Customer Help — Billing

Status: active (articles ready; not yet published)
Audience: Clinic owners · Visibility: `clinic_owner`
Last updated: 2026-06-10

Help for understanding the plan, the monthly bill, and how changes are billed.

## Critical rule: prices come from the canonical billing files

Do **not** hard-code prices in any billing article. All amounts come from
`config/billing.config.ts` (the breakdown builders) and the policy in
`MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`. If an article mentions a price, it
must say the price is sourced from the canonical billing files, and the figure
must match them exactly. This prevents drift and conflicting numbers.

At time of writing the canonical files define a **$99/month** base plan that
includes 1 business number, 1,000 regular call minutes, 100 minutes of AI
answered calls, and 1,000 SMS segments (shared across all of the clinic's
numbers); additional toll-free numbers are a paid add-on; local numbers carry
separate regulatory + service fees; and overage rates apply above the included
limits. **Always re-verify against
`config/billing.config.ts` before publishing** — treat the file as truth, not
this paragraph.

## Articles

| Article | Title | Visibility | Status | Notes |
|---|---|---|---|---|
| [understand-your-bill.md](understand-your-bill.md) | Understand your bill | clinic_owner | ready | Base plan + included usage + add-ons, all sourced from canonical files |
| [current-vs-next-cycle.md](current-vs-next-cycle.md) | Current vs next billing cycle | clinic_owner | ready | Changes apply next cycle; no immediate refund/credit |
| [local-vs-toll-free-charges.md](local-vs-toll-free-charges.md) | Local vs toll-free charges | clinic_owner | ready | Toll-free vs local billing models; first toll-free included; local fees |

## Customer-safe notes

- Explain the plan in plain terms: a base monthly plan that includes a set amount
  of regular calling, AI answered call time, and texting, with paid add-ons for
  extra numbers and usage above the included limits. Source every figure from the
  canonical files.
- Explain an **SMS segment** simply (a billing unit; long messages can use more
  than one segment) — matching the in-app tooltip wording.
- **Current vs next cycle:** when a number is removed or changed, the current
  cycle may still show it as billed/held, while the next cycle reflects the
  change. Removing or restoring a number does not create an immediate refund,
  credit, or charge — changes apply next cycle.
- Do not expose Stripe internals: no price IDs, customer/subscription IDs, raw
  invoice objects, proration mechanics, or webhook detail. Keep it to what the
  owner sees on their bill.
- The free trial starts after the first business number is assigned; do not state
  trial-start rules that contradict `BILLING-AND-USAGE-POLICY.md`.

## Source of truth

- `config/billing.config.ts` — canonical amounts, included usage, breakdown
  builders (single source of truth for prices)
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — plan policy, add-ons, next-cycle
  billing, trial behavior

## Need more help?

Contact support: support@missedcallsdental.com
