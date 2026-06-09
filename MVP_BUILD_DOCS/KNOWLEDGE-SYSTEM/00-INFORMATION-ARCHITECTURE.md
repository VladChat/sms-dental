# 00 — Information Architecture

Status: ready
Last updated: 2026-06-09

This document defines how knowledge is organized across Missed Calls Dental. It
covers the layers of content, the difference between content types, the future UI
surfaces that will consume each layer, and the product topics the Knowledge
System must cover.

> **This pass does not implement any UI.** No help widget, search index, AI
> chatbot, database table, or admin support screen is built here. This document
> is the architecture those future surfaces will follow.

## 1. The four content layers

| Layer | Folder | Primary audience | Visibility band |
|---|---|---|---|
| Customer help | `customer-help/` | Clinic owners and front-desk staff | `public` / `customer_authenticated` / `clinic_owner` / `clinic_staff` |
| Platform-admin knowledge | `platform-admin/` | Platform owner/operator | `platform_admin` / `internal_ops` |
| Support runbooks | `support-runbooks/` | Support/operator answering a ticket | `internal_ops` |
| Developer/ops notes | `developer-ops/` | Engineers maintaining the system | `developer_ops` |

Role definitions and the full can-see / must-not-see matrix live in
[01-AUDIENCE-AND-ACCESS-MODEL.md](01-AUDIENCE-AND-ACCESS-MODEL.md).

## 2. Where knowledge lives across the repo

There are four distinct knowledge homes. Do not blur them.

1. **Public website help** — `docs/` (GitHub Pages, `missedcallsdental.com`).
   Marketing and public-facing pages only. Internal-only Knowledge System
   articles must **never** be placed here. Only content explicitly marked
   `visibility: public` and intentionally published may ever be mirrored to a
   public surface, and even then publishing is a deliberate act, not a default.

2. **Authenticated in-app help** — future contextual help inside `/account`
   (owner) and `/workspace` (front desk). Sourced from `customer-help/`.

3. **Internal platform-admin docs** — future contextual help inside `/admin`.
   Sourced from `platform-admin/` and `support-runbooks/`.

4. **Developer/ops docs** — `MVP_BUILD_DOCS/` (specs, runbooks, setup log) and
   `developer-ops/` here. For engineers and operators, never customer-facing.

## 3. Content types (do not confuse these)

- **Documentation** — explains what something is / how it works. Reference
  material. Lives close to its audience layer.
- **Help center article** — a customer-safe, task-focused answer ("How do I
  change my password?"). Customer vocabulary, no internal detail. Lives in
  `customer-help/`.
- **Support runbook** — an internal triage script the operator uses to diagnose
  and resolve a recurring ticket (symptom → likely causes → safe checks →
  escalation → customer-safe reply). Lives in `support-runbooks/`.
- **Operational runbook** — how to operate/verify/troubleshoot the *system*
  (deploys, DNS, webhooks, migrations). This stays in
  `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`; the Knowledge System links to it, it
  does not duplicate it.
- **AI-support grounding content** — the subset of the above that a future
  AI-support assistant is allowed to retrieve and cite, filtered by the user's
  role. Governed by [06-AI-SUPPORT-BOUNDARIES.md](06-AI-SUPPORT-BOUNDARIES.md).

## 4. Recommended future UI surfaces (planned — not built)

| Surface | Audience | Help layer it draws from | Example |
|---|---|---|---|
| `/account` contextual help | Clinic owner | `customer-help/` (owner-visible) | Billing panel → "Understand your bill" |
| `/workspace` contextual help | Front-desk staff | `customer-help/` (staff-safe) | Inbox → "How front desk should handle replies" |
| `/admin` contextual help | Platform admin | `platform-admin/` + `support-runbooks/` | Clinic console → "Suspend vs detach vs remove" |
| Public support / FAQ pages | Public visitors | `customer-help/` (`public` only) | "What Missed Calls Dental does" — only when intentionally published |

Each surface must filter content **server-side by `visibility`** (see
[05-ADMIN-SUPPORT-INTEGRATION-PLAN.md](05-ADMIN-SUPPORT-INTEGRATION-PLAN.md)).
Hiding a UI link is never sufficient access control.

## 5. Product topic map (based on current repo state)

The Knowledge System is organized around the product as it actually exists today.
Source-of-truth files are listed so articles cite them rather than restating
facts.

| Topic | Customer-help home | Platform-admin / internal home | Source of truth |
|---|---|---|---|
| What the product does / missed-call recovery | `customer-help/getting-started/` | — | `PROJECT-CONTEXT.md` |
| Conditional forwarding mode | `customer-help/getting-started/`, `customer-help/phone-numbers/` | `platform-admin/phone-number-lifecycle.md` | `PROJECT-CONTEXT.md` §4, `OPERATIONS-RUNBOOK.md` |
| Local number path | `customer-help/phone-numbers/` | `platform-admin/phone-number-lifecycle.md` | `START-HERE.md`, `BILLING-AND-USAGE-POLICY.md` |
| Toll-free vs local distinction | `customer-help/phone-numbers/` | `platform-admin/phone-number-lifecycle.md` | `BILLING-AND-USAGE-POLICY.md`, `config/billing.config.ts`, `AGENTS.md` |
| Phone number lifecycle (remove/restore/detach/suspend) | `customer-help/phone-numbers/` (remove/restore only) | `platform-admin/phone-number-lifecycle.md` (all) | `AGENTS.md` (lifecycle rule), `BILLING-AND-USAGE-POLICY.md` |
| SMS approval (A2P internally) | `customer-help/sms-approval/` | `platform-admin/a2p-review-and-submission.md` | `A2P-10DLC-COMPLIANCE-READINESS.md`, `SMS-APPROVAL-FIELD-MAPPING.md` |
| Billing | `customer-help/billing/` | `platform-admin/billing-operations.md` | `BILLING-AND-USAGE-POLICY.md`, `config/billing.config.ts` |
| Missed calls & messages, opt-out | `customer-help/missed-calls-and-messages/` | `platform-admin/diagnostics-and-audit.md` | `OPERATIONS-RUNBOOK.md` §9–10, `PROJECT-CONTEXT.md` §14 |
| Owner account access | `customer-help/account-access/` | `platform-admin/support-boundaries.md` | `AUTH-AND-ACCESS-CONTROL.md` |
| Front-desk workspace | `customer-help/workspace/` | — | `FRONT-DESK-WORKSPACE.md` |
| Platform admin console | — | `platform-admin/clinic-console.md` | `PLATFORM-ADMIN-CONSOLE-PLAN.md`, `AUTH-AND-ACCESS-CONTROL.md` |
| Twilio/SMS compliance | `customer-help/sms-approval/` (customer-safe only) | `platform-admin/a2p-review-and-submission.md` | `A2P-10DLC-COMPLIANCE-READINESS.md` |
| Troubleshooting & escalation | `customer-help/troubleshooting/` | `support-runbooks/` | per runbook |

## 6. Naming and structure conventions

- Folder `README.md` files are **indexes**: they list planned/existing articles
  and carry the audience-safety notes for that folder. They are not deep
  articles.
- Article filenames are kebab-case and describe the task or topic
  (`change-password.md`, `phone-number-lifecycle.md`).
- Every article carries frontmatter per
  [03-ARTICLE-METADATA-SCHEMA.md](03-ARTICLE-METADATA-SCHEMA.md).
- Cross-link with relative markdown links; cite canonical files in
  `source_of_truth`.
