# MANIFEST

Files in this package:

Current reading priority:

1. `PROJECT-CONTEXT.md`
2. `START-HERE.md`
3. `AGENT-RULES.md`
4. `OPERATIONS-RUNBOOK.md`
5. `SETUP-LOG.md`
6. `REPEATABLE-SETUP-CHECKLIST.md`
7. task-specific numbered docs

Operational documentation:

- `OPERATIONS-RUNBOOK.md` — how to operate, verify, and troubleshoot the project.
- `SETUP-LOG.md` — chronological record of completed infrastructure/backend setup.
- `REPEATABLE-SETUP-CHECKLIST.md` — reusable checklist for repeating this setup pattern.
- `FIRST-CLINIC-ONBOARDING.md` — step-by-step procedure for safely onboarding the first real clinic.
- `A2P-10DLC-COMPLIANCE-READINESS.md` — A2P/toll-free compliance requirements before live patient SMS.
- `TWILIO-TOLL-FREE-VERIFICATION-SUBMISSION.md` — copy-ready Twilio Toll-Free Verification submission packet.
- `ONBOARDING-WORKFLOW-BUILD-GUIDE.md` — source of truth for the automated clinic onboarding workflow (`/setup/[token]`, office texting number selection, Twilio purchase, webhooks).
- `../AGENTS.md` — repository-wide standing agent instructions, including the project-wide Form and Onboarding Scope Rule.

Onboarding workflow scope (MVP):

- Automated onboarding is currently **United States only**. Other countries are not offered in the UI; submitted non-US payloads are rejected with a clear message.
- Step 1 collects only **clinic name, main office phone, ZIP code** — the three fields needed to advance to number search. Everything else (legal name, owner contact details, timezone, test patient phone, setup mode, etc.) is deferred to later steps. See `AGENTS.md` → "Form and Onboarding Scope Rule".
- Number search is split into separate Local and Toll-free choices; toll-free SMS requires Twilio toll-free verification before live patient messaging.
- Number purchase remains gated by `TWILIO_NUMBER_PURCHASE_ENABLED=true`; onboarding never enables live SMS automatically.
- Schema migrations under `supabase/migrations/`:
  - `20260526000300_onboarding_setup_requests.sql` — `setup_requests` table + clinic onboarding fields.
  - `20260527000100_clinic_location.sql` — clinic country / city / state_region / postal_code / preferred_area_code.

Core package files:

- `00-product-brief.md`
- `01-user-flows.md`
- `02-technical-architecture.md`
- `03-database-schema.md`
- `04-api-and-webhooks.md`
- `05-sms-rules-and-templates.md`
- `06-ui-screens.md`
- `07-build-plan-and-tasks.md`
- `08-compliance-and-onboarding.md`
- `09-test-plan.md`
- `10-env-and-deploy.md`
- `11-access-and-secrets-handoff.md`
- `12-production-launch-checklist.md`
- `13-hosting-decision-no-fly.md`
- `14-ai-codex-vscode-workflow.md`
- `15-mcp-setup.md`
- `PROJECT-CONTEXT.md`
- `AGENT-RULES.md`
- `MVP-Build-Spec-v1.md`
- `OWNER-FILL-THIS-OUT.md`
- `OWNER-SETTINGS.md`
- `QA-AUDIT-SUMMARY.md`
- `README-build-docs-roadmap.md`
- `REVIEW-NOTES.md`
- `START-HERE.md`
- `backend-foundation-handoff.md`
- `backend-foundation-v1.md`
- `config/runtime.config.example.ts`
- `env/.env.secrets.example`
- `mcp/mcp.config.example.json`
