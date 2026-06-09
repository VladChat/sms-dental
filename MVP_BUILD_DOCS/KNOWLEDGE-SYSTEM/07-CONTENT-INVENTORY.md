# 07 — Content Inventory

Status: ready (starter inventory; most articles are stubs/planned)
Last updated: 2026-06-09

The working list of current and future Knowledge System articles. Update this
table whenever an article is added, changed, or its status/visibility changes
(see [02-CONTENT-GOVERNANCE.md](02-CONTENT-GOVERNANCE.md)).

Status legend: `draft` = stub / planned-or-unwritten body, `internal` =
internal-only knowledge/runbook, `ready` = accurate & reviewed (not surfaced),
`published` = cleared to surface. Nothing is `published` yet.

## Customer help

| ID | Title | Folder | Visibility | Status | Source of truth | Surface | Notes |
|---|---|---|---|---|---|---|---|
| CH-01 | What Missed Calls Dental does | getting-started | public | draft | PROJECT-CONTEXT.md | public-web, /account | Plain-language product explanation |
| CH-02 | How missed-call SMS recovery works | getting-started | customer_authenticated | draft | PROJECT-CONTEXT.md, OPERATIONS-RUNBOOK.md | /account | Call → missed → text follow-up; supported paths only |
| CH-03 | Why SMS is not active immediately | getting-started, sms-approval | customer_authenticated | draft | A2P-10DLC-COMPLIANCE-READINESS.md | /account | Texting starts after approval/configuration |
| CH-04 | What SMS approval means | sms-approval | clinic_owner | draft | A2P-10DLC-COMPLIANCE-READINESS.md, SMS-APPROVAL-FIELD-MAPPING.md | /account | "SMS approval" customer term; A2P is internal |
| CH-05 | What information is needed for SMS approval | sms-approval | clinic_owner | draft | SMS-APPROVAL-FIELD-MAPPING.md | /account | Only the customer-entered fields |
| CH-06 | Phone number types: toll-free vs local | phone-numbers | clinic_owner | draft | BILLING-AND-USAGE-POLICY.md, config/billing.config.ts | /account | Pricing cited from canonical files, never hard-coded |
| CH-07 | Remove a number | phone-numbers | clinic_owner | draft | AGENTS.md (lifecycle), BILLING-AND-USAGE-POLICY.md | /account | "Remove", never "Release"; stops routing immediately |
| CH-08 | Restore a removed number | phone-numbers | clinic_owner | draft | AGENTS.md (lifecycle), BILLING-AND-USAGE-POLICY.md | /account | Only before permanent removal; no fixed-window promise |
| CH-09 | Understand your bill | billing | clinic_owner | draft | config/billing.config.ts, BILLING-AND-USAGE-POLICY.md | /account | Amounts sourced from canonical billing files |
| CH-10 | Why billing can show current vs next cycle | billing | clinic_owner | draft | BILLING-AND-USAGE-POLICY.md | /account | Next-cycle changes; no immediate refund/credit |
| CH-11 | Patient opt-out: STOP/START | missed-calls-and-messages | customer_authenticated | draft | OPERATIONS-RUNBOOK.md §10 | /account, /workspace | How opt-out works for patients |
| CH-12 | How front desk should handle patient replies | workspace | clinic_staff | draft | FRONT-DESK-WORKSPACE.md | /workspace | Staff-safe only; no billing/legal/approval |
| CH-13 | Change password / account access | account-access | clinic_owner | draft | AUTH-AND-ACCESS-CONTROL.md §16 | /account | In-session change + reset path |
| CH-14 | Contact support | troubleshooting | public | draft | README.md | public-web, /account, /workspace | support@missedcallsdental.com |

## Platform admin

| ID | Title | Folder | Visibility | Status | Source of truth | Surface | Notes |
|---|---|---|---|---|---|---|---|
| PA-01 | Platform admin console overview | platform-admin | platform_admin | internal | PLATFORM-ADMIN-CONSOLE-PLAN.md, AUTH-AND-ACCESS-CONTROL.md | /admin | Cross-tenant; separate from /account & /workspace |
| PA-02 | Clinic console tabs and responsibilities | platform-admin/clinic-console.md | platform_admin | internal | PLATFORM-ADMIN-CONSOLE-PLAN.md §19–22 | /admin | Editable super-admin clinic console |
| PA-03 | Phone number lifecycle: active, suspended, scheduled removal, permanently removed, detached | platform-admin/phone-number-lifecycle.md | platform_admin | internal | AGENTS.md, BILLING-AND-USAGE-POLICY.md, PLATFORM-ADMIN-CONSOLE-PLAN.md | /admin | All lifecycle states |
| PA-04 | Suspend vs detach vs remove | platform-admin/phone-number-lifecycle.md | platform_admin | internal | BILLING-AND-USAGE-POLICY.md, PLATFORM-ADMIN-CONSOLE-PLAN.md | /admin | Distinct operations; do not conflate |
| PA-05 | A2P review and submission safety gates | platform-admin/a2p-review-and-submission.md | platform_admin | internal | A2P-10DLC-COMPLIANCE-READINESS.md, config/runtime.config.ts (a2p) | /admin | Live submit is billable/allowlisted/gated |
| PA-06 | Billing operations and Stripe quantity sync | platform-admin/billing-operations.md | platform_admin | internal | BILLING-AND-USAGE-POLICY.md, config/billing.config.ts | /admin | No secrets/price IDs in articles |
| PA-07 | Diagnostics and audit boundaries | platform-admin/diagnostics-and-audit.md | platform_admin | internal | PLATFORM-ADMIN-CONSOLE-PLAN.md §10 | /admin | Redaction; admin_audit_events |
| PA-08 | Assign existing Twilio number | platform-admin/phone-number-lifecycle.md | platform_admin | internal | PLATFORM-ADMIN-CONSOLE-PLAN.md §21–22 | /admin | Search → select → confirm → assign; gated |
| PA-09 | Troubleshoot SMS not sending (admin view) | platform-admin/a2p-review-and-submission.md | platform_admin | internal | OPERATIONS-RUNBOOK.md §9, A2P-10DLC-COMPLIANCE-READINESS.md | /admin | Links to runbook RB-01 |
| PA-10 | Troubleshoot billing mismatch (admin view) | platform-admin/billing-operations.md | platform_admin | internal | BILLING-AND-USAGE-POLICY.md | /admin | Links to runbook RB-03 |
| PA-11 | Support boundaries (what admin may/may not do) | platform-admin/support-boundaries.md | platform_admin | internal | PLATFORM-ADMIN-CONSOLE-PLAN.md §9–10, AUTH-AND-ACCESS-CONTROL.md | /admin | Blocked-by-design actions; secrets never |

## Support runbooks

| ID | Title | Folder | Visibility | Status | Source of truth | Surface | Notes |
|---|---|---|---|---|---|---|---|
| RB-01 | SMS not sending | support-runbooks/sms-not-sending.md | internal_ops | internal | A2P-10DLC-COMPLIANCE-READINESS.md, OPERATIONS-RUNBOOK.md | support | Gate-by-gate triage |
| RB-02 | Number removal / restore / detach question | support-runbooks/number-removal-restore-detach.md | internal_ops | internal | AGENTS.md, BILLING-AND-USAGE-POLICY.md | support | Customer vs admin operations |
| RB-03 | Billing question | support-runbooks/billing-question.md | internal_ops | internal | BILLING-AND-USAGE-POLICY.md, config/billing.config.ts | support | Current vs next cycle, proration none |
| RB-04 | A2P approval question | support-runbooks/a2p-approval-question.md | internal_ops | internal | A2P-10DLC-COMPLIANCE-READINESS.md, SMS-APPROVAL-FIELD-MAPPING.md | support | "SMS approval" wording to customer |
| RB-05 | Clinic cannot access account | support-runbooks/clinic-cannot-access-account.md | internal_ops | internal | AUTH-AND-ACCESS-CONTROL.md | support | Login/reset/role-mismatch |

## Developer / ops

| ID | Title | Folder | Visibility | Status | Source of truth | Surface | Notes |
|---|---|---|---|---|---|---|---|
| DO-01 | Source-of-truth map | developer-ops/source-of-truth-map.md | developer_ops | internal | AGENTS.md | dev | Domain → canonical file map |
| DO-02 | Knowledge System update checklist | developer-ops/update-knowledge-system-checklist.md | developer_ops | internal | AGENTS.md, 02-CONTENT-GOVERNANCE.md | dev | When/how agents must update |
| DO-03 | Future implementation notes | developer-ops/future-implementation-notes.md | developer_ops | internal | 05-ADMIN-SUPPORT-INTEGRATION-PLAN.md, 06-AI-SUPPORT-BOUNDARIES.md | dev | Search/AI/help-UI build notes |
