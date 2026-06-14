# OWNER SETTINGS

Do not paste API secret keys, auth tokens, passwords, or real patient data here.

Current note:

- Use `PROJECT-CONTEXT.md` as the master source of truth for current architecture.
- This file is a lightweight owner settings snapshot. Use `BILLING-AND-USAGE-POLICY.md` for canonical billing, usage, subscription, and number-purchase policy.
- `https://missedcallsdental.com/` is the current public marketing site on GitHub Pages.
- The SaaS app/backend is live on Vercel at `https://app.missedcallsdental.com/`.
- Do not paste secrets here.


## Product

Product name: Missed Calls Dental
Admin email: internal-admin@missedcallsdental.local
Support email: support@missedcallsdental.com
Default timezone: America/Chicago

## Voice Settings Foundation

Default spoken language: en-US
Current default voice: `config/voice-greeting.config.ts` (`defaultVoiceId`)
Future owner/admin voice selection: expose only the curated English US voice list
from `config/voice-greeting.config.ts`, not the full Twilio catalog. The list is
operator-curated for current missed-call greetings, future voice messages, and
future AI Call Assistant / AI answered calls. Old basic voices such as `alice`,
`man`, and `woman` are not customer-selectable defaults.

## Account sections (/account)

Setup group: Phone number, Business profile, SMS approval, Billing.
Account group: Account access, Team access, AI knowledge, **Notification Settings**.

Notification Settings (v1) is settings only: owners/admins choose which account
notifications they want. v1 covers **AI answered call minute alerts at 90% and
100%** (both default on, either can be turned off). No delivery channel exists
yet (no email, no SMS, no jobs) and no AI minute counter runs. Notification types
live in `config/notifications.config.ts`; the included-minutes number derives from
`BILLING-AND-USAGE-POLICY.md` + `config/billing.config.ts`.

## AI Answering direction (planned, not live)

The MVP direction is **AI Answering + SMS Recovery + Workspace**. AI Answering is
a narrow call-capture assistant (not a full AI receptionist), planned but **not
live** — never enabled without explicit owner approval and safety gates. It can be
useful before SMS approval; SMS Recovery still activates later after carrier
approval. See `PROJECT-CONTEXT.md` ("Next MVP Direction — AI Answering").

## Domain

Primary domain: https://missedcallsdental.com/
Production app URL: https://app.missedcallsdental.com/ (live)
Staging app URL: TO_FILL_AFTER_VERCEL_PROJECT_CREATED

## Pricing

Monthly price: $99/month
Trial baseline: 21-day free trial
Pricing/billing source of truth: MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
Current summary: first business number is self-service and included with the $99/month base plan. A saved payment method is required, but there is no charge on first-number purchase. The current backend starts the trial after first successful number assignment. Paid plan starts only through explicit Stripe Checkout and webhook-confirmed active subscription. Additional numbers require an active paid subscription and explicit $20/month consent. SMS recovery enablement is separate and never automatic.

## First test clinic

Use fake/test data first.

Clinic name: Lakeview Family Dental
Clinic main phone: +1 (224) 532-9236
Clinic callback/front-desk phone: +1 (224) 532-9236
Clinic timezone: America/Chicago
Business hours: Monday-Friday 8:00 AM-5:00 PM; Saturday-Sunday closed
Emergency instruction text: If you have swelling, trauma, uncontrolled bleeding, or severe pain, please call the office. If this is life-threatening, call 911.
Average recovered appointment value: $300

## MCP values

Supabase staging project_ref: qfjpvbvfvhbtebwivcdc
Vercel team slug: vladchat-1500s-projects
Vercel project slug: TO_FILL_AFTER_VERCEL_PROJECT_CREATED

Vercel team ID: team_1F2PWbZbJldYTbtZ8HlEVMCm
