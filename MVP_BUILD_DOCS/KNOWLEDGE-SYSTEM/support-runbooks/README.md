# Support Runbooks

Status: scaffold (starter triage content)
Audience: Support / platform operator · Visibility: `internal_ops`
Last updated: 2026-06-09

Internal triage scripts for recurring support scenarios. Each runbook walks an
operator from symptom → likely causes → safe checks → escalation, and ends with a
**customer-safe response summary** that does not leak internal detail.

These are **internal-only** (`visibility: internal_ops`). Never paste raw internal
content to a customer; use the customer-safe summary instead.

## Rules for runbooks

- Prefer **"check the relevant admin diagnostics"** over raw SQL. Only include a
  query if it is clearly internal-only, safe, and exposes no private data. Use
  read-only safe patterns from `OPERATIONS-RUNBOOK.md` if one already exists.
- Never expose secrets, raw payloads, full SIDs/EIN, tokens, or other clinics'
  data to the customer.
- Respect product rules: never promise a refund/credit from a lifecycle action,
  never bypass SMS/opt-out gates, never force a blocked provider action.
- When a scenario recurs, update the matching runbook (see
  [../02-CONTENT-GOVERNANCE.md](../02-CONTENT-GOVERNANCE.md)).

## Runbooks

- [sms-not-sending.md](sms-not-sending.md) — texting not reaching patients.
- [number-removal-restore-detach.md](number-removal-restore-detach.md) — number
  remove/restore/detach questions.
- [billing-question.md](billing-question.md) — charges, current vs next cycle.
- [a2p-approval-question.md](a2p-approval-question.md) — SMS approval status.
- [clinic-cannot-access-account.md](clinic-cannot-access-account.md) — sign-in /
  reset / access issues.

## Source of truth

Per runbook. Cross-cutting: `OPERATIONS-RUNBOOK.md`,
`A2P-10DLC-COMPLIANCE-READINESS.md`, `BILLING-AND-USAGE-POLICY.md`,
`AUTH-AND-ACCESS-CONTROL.md`.
