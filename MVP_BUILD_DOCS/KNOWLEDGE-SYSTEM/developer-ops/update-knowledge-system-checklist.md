---
title: Knowledge System update checklist
slug: update-knowledge-system-checklist
status: internal
visibility: developer_ops
audience: Engineers / AI agents
surface: dev
category: process
owner: engineering
source_of_truth:
  - AGENTS.md
  - ../02-CONTENT-GOVERNANCE.md
last_verified: 2026-06-09
related:
  - source-of-truth-map
  - future-implementation-notes
---

## Summary

When a future task must update the Knowledge System, and the step-by-step
checklist for doing it safely. Pairs with the "Knowledge System Update Rule" in
`AGENTS.md` and the governance rules in
[../02-CONTENT-GOVERNANCE.md](../02-CONTENT-GOVERNANCE.md).

## When you MUST consider updating the Knowledge System

If a task changes durable:

- **Customer-facing behavior** (UI/flows the customer sees),
- **Support workflows**,
- **Admin actions**,
- **Billing explanations**,
- **SMS / A2P behavior**,
- **Phone-number lifecycle**,
- **Workspace behavior**, or
- **Account access**,

then decide whether `MVP_BUILD_DOCS/KNOWLEDGE-SYSTEM/` needs an update.

If no update is needed, the final report must say:

```
Knowledge System update needed: no
```

Otherwise update the relevant content and say `yes`.

## What maps to what

| Change | Update |
|---|---|
| Customer-visible behavior | the matching `customer-help/` article + `07-CONTENT-INVENTORY.md` |
| Admin action / gate / lifecycle state | the matching `platform-admin/` doc + inventory |
| Recurring support issue | a `support-runbooks/` entry + inventory |
| New canonical source file | `developer-ops/source-of-truth-map.md` + `MANIFEST.md` |
| Pricing / compliance / auth facts | cite the canonical file; do not restate it |

This is **in addition to** the existing Operational Documentation Update Rule
(`SETUP-LOG.md` / `OPERATIONS-RUNBOOK.md` / `REPEATABLE-SETUP-CHECKLIST.md`),
which still applies to backend/infra/provider work.

## Step-by-step checklist

1. Identify the affected layer(s): customer-help, platform-admin, support-runbooks,
   developer-ops.
2. Determine correct `visibility` per
   [../01-AUDIENCE-AND-ACCESS-MODEL.md](../01-AUDIENCE-AND-ACCESS-MODEL.md).
3. Update or create the article using
   [../04-ARTICLE-TEMPLATE.md](../04-ARTICLE-TEMPLATE.md) and frontmatter from
   [../03-ARTICLE-METADATA-SCHEMA.md](../03-ARTICLE-METADATA-SCHEMA.md).
4. Set `source_of_truth` to canonical files (see
   [source-of-truth-map.md](source-of-truth-map.md)); do not restate canonical
   facts.
5. Use customer-safe wording in `customer-help/`; precise internal wording
   elsewhere.
6. Update `last_verified` and set `status` honestly (`draft` for planned/unbuilt).
7. Update [../07-CONTENT-INVENTORY.md](../07-CONTENT-INVENTORY.md).
8. Safety pass: no secrets, no raw payloads, no real patient content, nothing
   internal placed under `docs/`.
9. State `Knowledge System update needed: yes` (or `no`) in the final report.

## Validation

Docs-only changes don't require `npm run typecheck` unless TS/JS/TSX files were
touched. Always run:

```bash
git status --short
git diff --check
git diff --name-only
```

Expected changed paths for Knowledge System work:
`MVP_BUILD_DOCS/KNOWLEDGE-SYSTEM/**`, and (if cross-referencing)
`MVP_BUILD_DOCS/MANIFEST.md` / `AGENTS.md`. Nothing under `docs/`, `.env*`,
`.local-agent/`, `app/`, `lib/`, `config/`, or `supabase/`.

## Source of truth

- `AGENTS.md` ("Knowledge System Update Rule", "Operational Documentation Update
  Rule", source priority)
- [../02-CONTENT-GOVERNANCE.md](../02-CONTENT-GOVERNANCE.md)
