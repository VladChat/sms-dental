# 03 — Article Metadata Schema

Status: ready
Last updated: 2026-06-09

Every Knowledge System article begins with YAML frontmatter. The schema makes
content machine-filterable for future role-aware search and AI-support grounding.

## Schema

```yaml
---
title:
slug:
status: draft | ready | published | internal
visibility: public | customer_authenticated | clinic_owner | clinic_staff | platform_admin | internal_ops | developer_ops
audience:
surface:
category:
owner:
source_of_truth:
last_verified:
related:
---
```

## Field definitions

- **`title`** — human-readable article title. Customer-facing for customer
  articles; precise/internal for admin/dev articles.
- **`slug`** — kebab-case identifier, unique within its folder; matches the
  filename without extension (e.g. `change-password`).
- **`status`** — lifecycle of the article itself:
  - `draft` — stub or describes planned/unbuilt behavior. Not safe to publish.
  - `ready` — accurate and reviewed, but not yet exposed on any surface.
  - `published` — exposed (or cleared to be exposed) on its intended surface.
    Only allowed when safe for the audience **and** verified.
  - `internal` — internal-only content (admin/ops/runbooks/dev) that is never
    customer-published by design.
- **`visibility`** — the access band that may retrieve this article. Controls
  future publishing/search/AI access. Values defined in
  [01-AUDIENCE-AND-ACCESS-MODEL.md](01-AUDIENCE-AND-ACCESS-MODEL.md).
- **`audience`** — short human description of who this is for (e.g.
  "Clinic owners", "Front-desk staff", "Platform operator"). Complements
  `visibility`.
- **`surface`** — the UI surface(s) this article is meant for, planned or live:
  `public-web`, `/account`, `/workspace`, `/admin`, `support`, `dev`. Use `none`
  for pure governance/dev docs.
- **`category`** — topic grouping that matches the folder/topic map (e.g.
  `phone-numbers`, `billing`, `sms-approval`, `account-access`, `lifecycle`,
  `runbook`).
- **`owner`** — the role responsible for keeping it accurate (e.g. `product`,
  `ops`, `engineering`, `support`). Not a person's name.
- **`source_of_truth`** — one or more canonical repo files this article is
  derived from and must stay consistent with. **Required.** See conventions
  below.
- **`last_verified`** — ISO date (`YYYY-MM-DD`) the facts were last checked
  against the source of truth. Update when you verify.
- **`related`** — other Knowledge System articles to cross-link (slugs or
  relative paths).

## Required conventions

### `source_of_truth` must point to canonical files

Cite the real canonical files, for example:

- Pricing/number policy → `config/billing.config.ts`,
  `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`
- SMS/A2P → `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md`,
  `MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md`
- Auth/access → `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`
- Platform admin → `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md`
- Front desk → `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md`
- Product identity → `MVP_BUILD_DOCS/PROJECT-CONTEXT.md`
- Runtime settings → `config/runtime.config.ts`

An article with no `source_of_truth` is incomplete. The full domain→file map is
in [developer-ops/source-of-truth-map.md](developer-ops/source-of-truth-map.md).

### `last_verified` discipline

Update `last_verified` whenever you confirm the article still matches the source
of truth. A stale `last_verified` is a signal to re-check before relying on the
article (especially for billing/compliance/access content).

### `visibility` is access control, not styling

`visibility` decides who can retrieve the article in any future search/UI/AI
surface, enforced server-side. Choose the most restrictive band that still serves
the audience.

### Publish safety

Never set a customer article to `published` unless it is safe for that customer
band (per the hard rules) and verified against the source of truth.

## Example (customer article)

```yaml
---
title: Understand your bill
slug: understand-your-bill
status: draft
visibility: clinic_owner
audience: Clinic owners
surface: /account
category: billing
owner: product
source_of_truth:
  - config/billing.config.ts
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
last_verified: 2026-06-09
related:
  - why-billing-shows-current-vs-next-cycle
---
```

## Example (internal runbook)

```yaml
---
title: SMS not sending
slug: sms-not-sending
status: internal
visibility: internal_ops
audience: Support / platform operator
surface: support
category: runbook
owner: support
source_of_truth:
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
last_verified: 2026-06-09
related:
  - a2p-review-and-submission
---
```
