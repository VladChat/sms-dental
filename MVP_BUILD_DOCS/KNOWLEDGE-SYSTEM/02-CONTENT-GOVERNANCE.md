# 02 — Content Governance

Status: ready
Last updated: 2026-06-09

Rules for keeping the Knowledge System accurate, safe, and current as the product
grows. These rules pair with the audience rules in
[01-AUDIENCE-AND-ACCESS-MODEL.md](01-AUDIENCE-AND-ACCESS-MODEL.md).

## 1. Update obligations

- **Every durable customer-facing behavior change** must update the relevant
  `customer-help/` article(s) and/or
  [07-CONTENT-INVENTORY.md](07-CONTENT-INVENTORY.md). (Examples: a new billing
  rule, a new phone-number action, changed SMS-approval copy, a workspace change,
  an account-access change.)
- **Every durable platform-admin workflow change** must update
  `platform-admin/` knowledge. (Examples: a new admin action, a changed gate, a
  new lifecycle state.)
- **Every recurring support issue** must become a new `support-runbooks/` entry
  or update an existing one. A second occurrence of the same ticket type is the
  signal to write/update a runbook.
- **Every backend/provider operational change still follows the existing rules**:
  `SETUP-LOG.md` (chronological facts), `OPERATIONS-RUNBOOK.md` (operate/verify/
  troubleshoot), and `REPEATABLE-SETUP-CHECKLIST.md` (reusable lessons). The
  Knowledge System does not replace those — it links to them.

## 2. Link, don't duplicate

- Link to source-of-truth files rather than copying deep technical facts.
  Pricing → `config/billing.config.ts` + `BILLING-AND-USAGE-POLICY.md`;
  compliance → `A2P-10DLC-COMPLIANCE-READINESS.md`; access →
  `AUTH-AND-ACCESS-CONTROL.md`; admin → `PLATFORM-ADMIN-CONSOLE-PLAN.md`. The
  full map is in
  [developer-ops/source-of-truth-map.md](developer-ops/source-of-truth-map.md).
- If you find yourself restating an amount, a SID format, or a gate condition,
  stop and cite the canonical file instead. Restated facts drift; cited facts do
  not.

## 3. Accuracy and honesty

- **Do not invent behavior.** If a feature is not implemented, mark the article
  `status: draft` (and say "planned" / "not implemented yet" in the body). Do not
  describe planned UI as if it exists.
- Use `status: planned`/`draft` for anything not currently built, and
  `status: internal` for internal-only runbooks/knowledge.
- Update `last_verified` whenever you check an article's facts against code/docs.

## 4. Safety (non-negotiable)

- **Do not document secrets** — no service-role keys, Twilio Auth Token, Stripe
  secret keys, full DB URLs with passwords, raw setup/recovery tokens, or real
  patient message content. (Mirrors `AGENTS.md` security rules.)
- **Do not copy raw logs** or raw provider payloads into articles.
- **Do not put internal content under `docs/`.** `docs/` is the public marketing
  website; keep `docs/CNAME`.
- **Use customer-safe wording** in `customer-help/` articles (see the per-folder
  notes in `customer-help/README.md`).
- Respect the hard visibility rules before marking anything customer-visible.

## 5. Publish gates

- Do not set a customer article to `status: published` unless it is both **safe
  for the target customer band** and **verified** against the source of truth.
- `visibility` controls future publishing/search/AI access; setting it correctly
  is part of writing the article, not an afterthought.
- A `public` article is the only band that may ever be intentionally surfaced
  publicly, and only by a deliberate publishing action — never by default.

## 6. When to update what

| Change type | Update here | Also update |
|---|---|---|
| Customer-facing UI/behavior (billing, phone actions, SMS approval copy, workspace, account access) | relevant `customer-help/` article | `07-CONTENT-INVENTORY.md` |
| New/changed platform-admin action, gate, or lifecycle state | relevant `platform-admin/` doc | `07-CONTENT-INVENTORY.md`, possibly a runbook |
| Recurring support ticket pattern | `support-runbooks/` (new or existing) | `07-CONTENT-INVENTORY.md` |
| Pricing / number policy | (cite only) `customer-help/billing/` + `platform-admin/billing-operations.md` | canonical: `config/billing.config.ts`, `BILLING-AND-USAGE-POLICY.md` |
| SMS/A2P/Twilio compliance behavior | `customer-help/sms-approval/`, `platform-admin/a2p-review-and-submission.md` | canonical: `A2P-10DLC-COMPLIANCE-READINESS.md`, `SMS-APPROVAL-FIELD-MAPPING.md` |
| Auth / access / roles | `customer-help/account-access/`, `platform-admin/support-boundaries.md` | canonical: `AUTH-AND-ACCESS-CONTROL.md` |
| Backend/infra/provider operations | (link only) | canonical: `SETUP-LOG.md`, `OPERATIONS-RUNBOOK.md`, `REPEATABLE-SETUP-CHECKLIST.md` |
| New canonical source file added | `developer-ops/source-of-truth-map.md` | `07-CONTENT-INVENTORY.md` |

## 7. Review checklist before saving an article

See [developer-ops/update-knowledge-system-checklist.md](developer-ops/update-knowledge-system-checklist.md)
for the full agent checklist. Minimum:

1. Correct `visibility` for the audience.
2. No secrets, no raw payloads, no real patient content.
3. Facts cite a `source_of_truth` rather than restating them.
4. `status` honestly reflects implemented vs planned.
5. `07-CONTENT-INVENTORY.md` updated.
