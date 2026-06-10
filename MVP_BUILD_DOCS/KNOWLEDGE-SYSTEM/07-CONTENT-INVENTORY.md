# 07 — Content Inventory

Status: active (customer-help complete and ready; platform-admin + support-runbooks verified internal)
Last updated: 2026-06-10

The working list of current and future Knowledge System articles. Update this
table whenever an article is added, changed, or its status/visibility changes
(see [02-CONTENT-GOVERNANCE.md](02-CONTENT-GOVERNANCE.md)).

Status legend: `draft` = stub / planned-or-unwritten body, `internal` =
internal-only knowledge/runbook, `ready` = accurate & reviewed (not surfaced),
`published` = cleared to surface. Nothing is `published` yet.

## Customer help

| ID | Title | Folder | Visibility | Status | Source of truth | Surface | Notes |
|---|---|---|---|---|---|---|---|
| CH-01 | What Missed Calls Dental does | customer-help/getting-started | customer_authenticated | ready | PROJECT-CONTEXT.md, START-HERE.md, AGENTS.md | /account | Plain-language product explanation; what it is and is not |
| CH-02 | How missed-call recovery works | customer-help/getting-started | customer_authenticated | ready | PROJECT-CONTEXT.md, START-HERE.md, OPERATIONS-RUNBOOK.md, AGENTS.md | /account | Call → missed → text follow-up; supported connection paths only |
| CH-03 | Why SMS is not active immediately | customer-help/sms-approval | clinic_owner | ready | A2P-10DLC-COMPLIANCE-READINESS.md, BILLING-AND-USAGE-POLICY.md, config/runtime.config.ts, AGENTS.md | /account | Texting is a separate step from number setup; cross-listed in getting-started |
| CH-04 | What SMS approval means | customer-help/sms-approval | clinic_owner | ready | A2P-10DLC-COMPLIANCE-READINESS.md, SMS-APPROVAL-FIELD-MAPPING.md, AGENTS.md | /account | "SMS approval" customer term; A2P kept internal |
| CH-05 | What information is needed for SMS approval | customer-help/sms-approval | clinic_owner | ready | SMS-APPROVAL-FIELD-MAPPING.md, A2P-10DLC-COMPLIANCE-READINESS.md, AGENTS.md | /account | Only customer-entered fields; Business Profile vs SMS Approval Information |
| CH-06 | Toll-free vs local numbers | customer-help/phone-numbers | clinic_owner | ready | AGENTS.md, BILLING-AND-USAGE-POLICY.md, config/billing.config.ts, A2P-10DLC-COMPLIANCE-READINESS.md | /account | Customer-relevant differences; per-number texting readiness with automatic approval-status refresh; prices cited from canonical files |
| CH-07 | Remove a number | customer-help/phone-numbers | clinic_owner | ready | AGENTS.md (lifecycle), BILLING-AND-USAGE-POLICY.md | /account | "Remove", never "Release"; stops service immediately; next-cycle billing |
| CH-08 | Restore a removed number | customer-help/phone-numbers | clinic_owner | ready | AGENTS.md (lifecycle), BILLING-AND-USAGE-POLICY.md | /account | Only before permanent removal; restore alone does not enable texting |
| CH-09 | Understand your bill | customer-help/billing | clinic_owner | ready | config/billing.config.ts, BILLING-AND-USAGE-POLICY.md, AGENTS.md | /account | Base plan + regular/AI/SMS included usage + add-ons; amounts from canonical files |
| CH-10 | Current vs next billing cycle | customer-help/billing | clinic_owner | ready | BILLING-AND-USAGE-POLICY.md, config/billing.config.ts, AGENTS.md | /account | Next-cycle changes; no immediate refund/credit |
| CH-11 | Patient opt-out — STOP and START | customer-help/missed-calls-and-messages | customer_authenticated | ready | OPERATIONS-RUNBOOK.md, A2P-10DLC-COMPLIANCE-READINESS.md, PROJECT-CONTEXT.md | /account, /workspace | How opt-out works; office must respect it; never bypass |
| CH-12 | How front desk should handle patient replies | customer-help/missed-calls-and-messages | clinic_staff | ready | FRONT-DESK-WORKSPACE.md, OPERATIONS-RUNBOOK.md, PROJECT-CONTEXT.md | /workspace | Staff-safe; scheduling follow-up, not medical advice; no outbound reply tool yet |
| CH-13 | Change password and account access | customer-help/account-access | clinic_owner | ready | AUTH-AND-ACCESS-CONTROL.md, FRONT-DESK-WORKSPACE.md | /account | Sign in, reset, in-session change; owner account vs front-desk workspace |
| CH-14 | Contact support | customer-help/troubleshooting | customer_authenticated | ready | README.md, OWNER-SETTINGS.md, config/runtime.config.ts | /account, /workspace | What to include / what not to send; support@missedcallsdental.com |
| CH-15 | Local vs toll-free charges | customer-help/billing | clinic_owner | ready | config/billing.config.ts, BILLING-AND-USAGE-POLICY.md, AGENTS.md | /account | Toll-free vs local billing models; first toll-free included; local fees |
| CH-16 | Front-desk workspace overview | customer-help/workspace | clinic_staff | ready | FRONT-DESK-WORKSPACE.md, AUTH-AND-ACCESS-CONTROL.md | /workspace | What staff can/can't see; request cards; statuses; samples; "not provided yet" |
| CH-17 | My texting isn't working yet | customer-help/troubleshooting | clinic_owner | ready | A2P-10DLC-COMPLIANCE-READINESS.md, SMS-APPROVAL-FIELD-MAPPING.md, BILLING-AND-USAGE-POLICY.md, PROJECT-CONTEXT.md, OPERATIONS-RUNBOOK.md, config/runtime.config.ts | /account | Texting activation is per number and separate from number/billing; automatic status refresh; what to check; no instant activation |
| CH-18 | I can't sign in | customer-help/troubleshooting | customer_authenticated | ready | AUTH-AND-ACCESS-CONTROL.md, FRONT-DESK-WORKSPACE.md, config/runtime.config.ts | /account, /workspace | Right email/area, password reset, staff access via owner; never send password |
| CH-19 | Understanding patient request statuses | customer-help/workspace | clinic_staff | ready | FRONT-DESK-WORKSPACE.md, PROJECT-CONTEXT.md, OPERATIONS-RUNBOOK.md | /workspace | Status meanings; "not provided yet"; what not to assume; no medical advice |
| CH-20 | How AI Call Assistant works | customer-help/ai-call-assistant (planned) | clinic_owner | draft | PROJECT-CONTEXT.md, BILLING-AND-USAGE-POLICY.md | /account | Planned future voice feature; "AI answered calls" wording; not live; body not written |

## Platform admin

| ID | Title | Folder | Visibility | Status | Source of truth | Surface | Notes |
|---|---|---|---|---|---|---|---|
| PA-01 | Platform admin console overview | platform-admin/README.md | platform_admin | internal | PLATFORM-ADMIN-CONSOLE-PLAN.md, AUTH-AND-ACCESS-CONTROL.md | /admin | Index; roles (admin vs owner vs front desk); redaction; SoT map |
| PA-02 | Clinic console tabs and responsibilities | platform-admin/clinic-console.md | platform_admin | internal | PLATFORM-ADMIN-CONSOLE-PLAN.md §4/§15–22, AUTH-AND-ACCESS-CONTROL.md | /admin | Editable super-admin console; implemented vs blocked/future |
| PA-03 | Phone number lifecycle: active, suspended, scheduled removal, permanently removed, detached | platform-admin/phone-number-lifecycle.md | platform_admin | internal | AGENTS.md, BILLING-AND-USAGE-POLICY.md, OPERATIONS-RUNBOOK.md, PLATFORM-ADMIN-CONSOLE-PLAN.md | /admin | All states + operations table; per-number texting status + provider diagnostics/sync; customer-safe vs internal |
| PA-04 | Suspend vs detach vs remove | platform-admin/phone-number-lifecycle.md | platform_admin | internal | AGENTS.md, BILLING-AND-USAGE-POLICY.md, PLATFORM-ADMIN-CONSOLE-PLAN.md | /admin | Distinct operations; do not conflate (see lifecycle table) |
| PA-05 | A2P review and submission safety gates | platform-admin/a2p-review-and-submission.md | platform_admin | internal | A2P-10DLC-COMPLIANCE-READINESS.md, SMS-APPROVAL-FIELD-MAPPING.md, config/runtime.config.ts, AGENTS.md | /admin | Field split; review package; live submit billable/allowlisted/gated |
| PA-06 | Billing operations and quantity sync | platform-admin/billing-operations.md | platform_admin | internal | BILLING-AND-USAGE-POLICY.md, config/billing.config.ts, AGENTS.md | /admin | Plan/add-on model including regular/AI/SMS usage; no secrets/price IDs |
| PA-07 | Diagnostics and audit boundaries | platform-admin/diagnostics-and-audit.md | platform_admin | internal | PLATFORM-ADMIN-CONSOLE-PLAN.md §10/§15, OPERATIONS-RUNBOOK.md, AUTH-AND-ACCESS-CONTROL.md | /admin | Redaction; can-see vs must-hide; admin_audit_events |
| PA-08 | Assign existing Twilio number | platform-admin/phone-number-lifecycle.md | platform_admin | internal | PLATFORM-ADMIN-CONSOLE-PLAN.md §21–22 | /admin | Search → select → confirm → assign; gated; SMS not auto-enabled |
| PA-09 | Troubleshoot SMS not sending (admin view) | platform-admin/a2p-review-and-submission.md | platform_admin | internal | OPERATIONS-RUNBOOK.md §9, A2P-10DLC-COMPLIANCE-READINESS.md | /admin | Links to runbook RB-01 |
| PA-10 | Troubleshoot billing mismatch (admin view) | platform-admin/billing-operations.md | platform_admin | internal | BILLING-AND-USAGE-POLICY.md, config/billing.config.ts | /admin | Links to runbook RB-03 |
| PA-11 | Support boundaries (what admin may/may not do) | platform-admin/support-boundaries.md | platform_admin | internal | PLATFORM-ADMIN-CONSOLE-PLAN.md §6/§9–10, AUTH-AND-ACCESS-CONTROL.md §17, FRONT-DESK-WORKSPACE.md | /admin | Role boundaries; blocked-by-design; customer-safe vs internal wording |
| PA-12 | AI Call Assistant admin overview | platform-admin/ai-call-assistant.md (planned) | platform_admin | internal | PROJECT-CONTEXT.md, Skills/twilio-dental-sms.md | /admin | Planned future feature; admin can see status/number/transfer/knowledge/test/last call/errors/usage; ConversationRelay etc. internal-only; not live; body not written |

## Support runbooks

| ID | Title | Folder | Visibility | Status | Source of truth | Surface | Notes |
|---|---|---|---|---|---|---|---|
| RB-01 | SMS not sending | support-runbooks/sms-not-sending.md | internal_ops | internal | A2P-10DLC-COMPLIANCE-READINESS.md, OPERATIONS-RUNBOOK.md, AGENTS.md | support | Gate-by-gate triage including per-number texting status, Messaging Service sender coverage (both number types), read-only sync, provider diagnostics, persisted delivery status; customer-safe summary |
| RB-02 | Number removal / restore / detach question | support-runbooks/number-removal-restore-detach.md | internal_ops | internal | AGENTS.md, BILLING-AND-USAGE-POLICY.md, OPERATIONS-RUNBOOK.md | support | 12-section; customer vs admin operations; next-cycle billing |
| RB-03 | Billing question | support-runbooks/billing-question.md | internal_ops | internal | BILLING-AND-USAGE-POLICY.md, config/billing.config.ts, AGENTS.md | support | 12-section; regular/AI/SMS plan terms; current vs next cycle; no refund promise |
| RB-04 | A2P approval question | support-runbooks/a2p-approval-question.md | internal_ops | internal | A2P-10DLC-COMPLIANCE-READINESS.md, SMS-APPROVAL-FIELD-MAPPING.md, config/runtime.config.ts | support | 12-section; "SMS approval" wording; no exact-date promise |
| RB-05 | Clinic cannot access account | support-runbooks/clinic-cannot-access-account.md | internal_ops | internal | AUTH-AND-ACCESS-CONTROL.md, FRONT-DESK-WORKSPACE.md | support | 12-section; login/reset/role; never request password |
| RB-06 | AI assistant not answering | support-runbooks/ai-assistant-not-answering.md (planned) | internal_ops | draft | PROJECT-CONTEXT.md, Skills/twilio-dental-sms.md | support | Planned future feature (AI Call Assistant); forwarding/status/gating triage; not live; body not written |
| RB-07 | AI answered call billing question | support-runbooks/ai-answered-call-billing-question.md (planned) | internal_ops | draft | BILLING-AND-USAGE-POLICY.md, config/billing.config.ts | support | Planned future feature; "AI answered call time"; amounts from config; not live; body not written |

## Developer / ops

| ID | Title | Folder | Visibility | Status | Source of truth | Surface | Notes |
|---|---|---|---|---|---|---|---|
| DO-01 | Source-of-truth map | developer-ops/source-of-truth-map.md | developer_ops | internal | AGENTS.md | dev | Domain → canonical file map |
| DO-02 | Knowledge System update checklist | developer-ops/update-knowledge-system-checklist.md | developer_ops | internal | AGENTS.md, 02-CONTENT-GOVERNANCE.md | dev | When/how agents must update |
| DO-03 | Future implementation notes | developer-ops/future-implementation-notes.md | developer_ops | internal | 05-ADMIN-SUPPORT-INTEGRATION-PLAN.md, 06-AI-SUPPORT-BOUNDARIES.md | dev | Search/AI/help-UI build notes |
