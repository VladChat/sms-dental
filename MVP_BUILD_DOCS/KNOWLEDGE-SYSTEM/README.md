# Knowledge System

Status: scaffold (structure + governance + starter content; no UI in this pass)
Last updated: 2026-06-09

This folder is the **source-controlled Knowledge System** for Missed Calls Dental.
It is the structured help/support layer that future customer help, platform-admin
support, developer/ops documentation, and AI-support grounding will read from.

This pass creates the **architecture, rules, templates, and starter content
only**. It does **not** build a help widget, search, AI chatbot, database table,
or admin support UI. Those are future surfaces that will consume this content.

## What the Knowledge System is

A growing, layered library of help and support knowledge, organized by **who is
allowed to see it** and **what surface it serves**:

1. **Customer help** — public/customer-safe articles for clinic owners and
   front-desk staff (`customer-help/`).
2. **Platform-admin knowledge** — cross-tenant operator knowledge for the
   `/admin` console (`platform-admin/`).
3. **Support runbooks** — internal triage scripts for recurring support
   scenarios (`support-runbooks/`).
4. **Developer/ops notes** — where to find canonical facts and how to keep this
   system current (`developer-ops/`).

## Why it exists

The product has strong source-of-truth specs (`PROJECT-CONTEXT.md`,
`BILLING-AND-USAGE-POLICY.md`, `A2P-10DLC-COMPLIANCE-READINESS.md`, etc.), but
those are written for engineers and operators. They are not safe to hand to a
clinic owner, and they are not organized by audience or visibility.

The Knowledge System closes that gap. It turns canonical engineering facts into
**audience-scoped, visibility-tagged** help and support content, with one set of
governance rules so the right person sees the right answer and **no one sees
secrets or internal-only details they should not**.

## How it differs from other docs

| Location | Audience | Purpose | Public? |
|---|---|---|---|
| `docs/` | Public web visitors | Marketing website (GitHub Pages, `missedcallsdental.com`) | **Yes — published** |
| `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` | Engineers / operators | How to operate, verify, troubleshoot infrastructure | No |
| `MVP_BUILD_DOCS/SETUP-LOG.md` | Engineers / operators | Chronological record of what changed and when | No |
| `MVP_BUILD_DOCS/KNOWLEDGE-SYSTEM/` | Customers, staff, operators, AI-support | Structured, visibility-scoped help/support layer | **No (mixed; per-article `visibility`)** |

Key boundaries:

- **`docs/` is the public marketing website.** Never put internal-only or
  customer-help articles there. Keep `docs/CNAME`. Do not modify `docs/` for
  Knowledge System work.
- The Knowledge System **links to** source-of-truth files rather than copying
  deep technical facts. Pricing, compliance, and access facts stay canonical in
  their existing files; articles cite them via `source_of_truth`.
- `OPERATIONS-RUNBOOK.md` / `SETUP-LOG.md` / `REPEATABLE-SETUP-CHECKLIST.md`
  remain the home for operational/chronological/repeatable engineering facts.
  The Knowledge System does **not** replace them — see
  [02-CONTENT-GOVERNANCE.md](02-CONTENT-GOVERNANCE.md).

## How future agents should update it

When a task changes durable **customer-facing behavior, support workflows, admin
actions, billing explanations, SMS/A2P behavior, phone-number lifecycle,
workspace behavior, or account access**, the agent must decide whether to update
this Knowledge System (see the "Knowledge System Update Rule" in `AGENTS.md`).

Concretely:

1. Read [02-CONTENT-GOVERNANCE.md](02-CONTENT-GOVERNANCE.md) ("when to update what").
2. Update or add the relevant article(s), respecting the visibility rules in
   [01-AUDIENCE-AND-ACCESS-MODEL.md](01-AUDIENCE-AND-ACCESS-MODEL.md).
3. Use [04-ARTICLE-TEMPLATE.md](04-ARTICLE-TEMPLATE.md) and the frontmatter from
   [03-ARTICLE-METADATA-SCHEMA.md](03-ARTICLE-METADATA-SCHEMA.md).
4. Update [07-CONTENT-INVENTORY.md](07-CONTENT-INVENTORY.md).
5. In the final report, state `Knowledge System update needed: yes` or `no`.

## Map of this folder

- [00-INFORMATION-ARCHITECTURE.md](00-INFORMATION-ARCHITECTURE.md) — the full IA.
- [01-AUDIENCE-AND-ACCESS-MODEL.md](01-AUDIENCE-AND-ACCESS-MODEL.md) — roles and visibility.
- [02-CONTENT-GOVERNANCE.md](02-CONTENT-GOVERNANCE.md) — maintenance rules.
- [03-ARTICLE-METADATA-SCHEMA.md](03-ARTICLE-METADATA-SCHEMA.md) — article frontmatter.
- [04-ARTICLE-TEMPLATE.md](04-ARTICLE-TEMPLATE.md) — reusable templates.
- [05-ADMIN-SUPPORT-INTEGRATION-PLAN.md](05-ADMIN-SUPPORT-INTEGRATION-PLAN.md) — future help/support UI plan.
- [06-AI-SUPPORT-BOUNDARIES.md](06-AI-SUPPORT-BOUNDARIES.md) — AI-support rules.
- [07-CONTENT-INVENTORY.md](07-CONTENT-INVENTORY.md) — article inventory.
- [customer-help/](customer-help/README.md) — customer/staff help.
- [platform-admin/](platform-admin/README.md) — operator knowledge.
- [support-runbooks/](support-runbooks/README.md) — support triage scripts.
- [developer-ops/](developer-ops/README.md) — source-of-truth map + maintenance.
