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
