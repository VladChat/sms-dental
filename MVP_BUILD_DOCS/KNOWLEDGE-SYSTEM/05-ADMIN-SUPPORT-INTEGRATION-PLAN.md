# 05 — Admin / Support Integration Plan

Status: planned (no UI implemented in this pass)
Last updated: 2026-06-09

This document plans how the Knowledge System will be surfaced as contextual help
and support across the product. **Nothing here is implemented in this pass.** It
defines the intended behavior so future work stays consistent and safe.

## 1. Contextual help by surface

The three product surfaces (`AUTH-AND-ACCESS-CONTROL.md`,
`PLATFORM-ADMIN-CONSOLE-PLAN.md`) each get role-appropriate contextual help.

### `/account` (clinic owner)

- A help affordance per section (Phone number, Business profile, SMS approval,
  Billing, Account access, Team access).
- Draws only from `customer-help/` articles with `visibility` ∈
  {`public`, `customer_authenticated`, `clinic_owner`}.
- Never shows `clinic_staff`-only operational reply content as the primary owner
  help, and never internal bands.

### `/workspace` (front-desk staff)

- Help affordance on the inbox / patient request views.
- Draws only from `customer-help/` articles with `visibility` ∈
  {`public`, `customer_authenticated`, `clinic_staff`}.
- Must respect the workspace minimum-necessary rule: no billing, legal/EIN, SMS
  approval, owner setup, Twilio detail, or internal IDs
  (`FRONT-DESK-WORKSPACE.md`).

### `/admin` (platform admin)

- Help/runbook affordance on the clinic console and diagnostics.
- Draws from `platform-admin/` and `support-runbooks/`
  (`visibility` ∈ {`platform_admin`, `internal_ops`}).
- May reference operational concepts and gates; never secrets; redaction rules
  still apply to any data shown.

## 2. Suggested article mapping by surface

| Surface / page | Help content it should surface | Knowledge source |
|---|---|---|
| `/account` → Phone number | Toll-free vs local, remove a number, restore a number | `customer-help/phone-numbers/` |
| `/account` → Billing | Understand your bill, current vs next cycle | `customer-help/billing/` |
| `/account` → SMS approval | What SMS approval means, what info is needed | `customer-help/sms-approval/` |
| `/account` → Account access | Change password, account access | `customer-help/account-access/` |
| `/workspace` (inbox) | How front desk should handle patient replies, opt-out basics | `customer-help/workspace/`, `customer-help/missed-calls-and-messages/` |
| `/admin` → Clinic console | Clinic console tabs, suspend vs detach vs remove | `platform-admin/clinic-console.md`, `platform-admin/phone-number-lifecycle.md` |
| `/admin` → Phone number panel | Phone number lifecycle, assign existing number, detach | `platform-admin/phone-number-lifecycle.md` |
| `/admin` → SMS approval panel | A2P review and submission safety gates | `platform-admin/a2p-review-and-submission.md` |
| `/admin` → Billing panel | Billing operations, Stripe quantity sync | `platform-admin/billing-operations.md` |
| `/admin` → Diagnostics/events | Diagnostics and audit boundaries | `platform-admin/diagnostics-and-audit.md` |
| Support ticket tooling | All runbooks | `support-runbooks/` |

## 3. Future search behavior (planned)

- **Server-side filtering by `visibility`.** The signed-in role resolves to a set
  of allowed bands; the query is filtered to those bands before results are
  returned.
- **Role-aware article index.** The index is partitioned (or filtered) so a
  customer query physically cannot match internal articles.
- **No internal docs to clinic customers.** A clinic owner/staff search must
  never return `platform_admin`, `internal_ops`, or `developer_ops` content, even
  if keywords match.
- Client-side hiding is never the access control.

## 4. Future AI-support behavior (planned)

Governed in detail by
[06-AI-SUPPORT-BOUNDARIES.md](06-AI-SUPPORT-BOUNDARIES.md). Summary:

- **Cite/link the source article** in every answer.
- **Refuse to answer from internal docs when the user role is a customer.**
  Retrieval is role-filtered first; the model never sees out-of-band content.
- **Escalate when uncertain.** If the allowed content does not answer the
  question, say what is unknown and route to support — do not guess.
- **No secrets / no raw provider payloads** in any answer.

## 5. Non-goals for this pass

- No help widget, no search box, no AI assistant, no support inbox, no database
  table, no admin support screen.
- No change to `/account`, `/workspace`, or `/admin` code.
- No change to the public `docs/` website.
