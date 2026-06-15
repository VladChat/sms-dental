# Support Runbooks

Status: active (runbooks verified; internal-only — two AI answered call runbooks draft/planned)
Audience: Internal support / operator · Visibility: `internal_ops`
Last updated: 2026-06-27

Internal triage scripts for recurring support scenarios. They translate the
[platform-admin docs](../platform-admin/README.md) into ticket-handling steps. They
are **internal-only** (`visibility: internal_ops`) — never paste raw internal
content to a customer; use each runbook's customer-safe wording instead.

## Standard runbook structure

Each runbook follows this structure:

1. Frontmatter
2. H1 title
3. Purpose
4. Audience / visibility
5. Symptom
6. Customer-safe explanation
7. Internal triage checklist
8. What not to expose to the customer
9. Safe resolution paths
10. Escalation criteria
11. Related platform-admin docs
12. Source of truth

## Rules for runbooks

- Prefer **"check the relevant admin diagnostics"** over raw SQL. Only include a
  query if it is clearly internal-only, safe, and exposes no private data.
- Never expose secrets, raw payloads, full SIDs/EIN, tokens, internal flags,
  allowlists, or other clinics' data — to the customer or in a ticket.
- Respect product rules: never promise a refund/credit from a lifecycle action,
  never bypass SMS/opt-out/billing gates, never force a blocked provider action,
  never reveal whether a specific email has an account.
- When a scenario recurs or behavior changes, update the matching runbook (see
  [../02-CONTENT-GOVERNANCE.md](../02-CONTENT-GOVERNANCE.md)).

## Runbooks

- [sms-not-sending.md](sms-not-sending.md) — texting not reaching patients.
- [number-removal-restore-detach.md](number-removal-restore-detach.md) — number
  remove/restore/detach questions.
- [billing-question.md](billing-question.md) — charges, current vs next cycle.
- [a2p-approval-question.md](a2p-approval-question.md) — SMS approval status.
- [clinic-cannot-access-account.md](clinic-cannot-access-account.md) — sign-in /
  reset / access issues.
- [ai-answered-calls-question.md](ai-answered-calls-question.md) — **draft** AI
  answered calls (planned, not broadly live); customer-safe wording + escalation.
- [ai-call-billing-question.md](ai-call-billing-question.md) — **draft** AI
  answered call time billing (not metered/billed yet); cite config, no invented
  prices.

## Source of truth

Per runbook. Cross-cutting: `OPERATIONS-RUNBOOK.md`,
`A2P-10DLC-COMPLIANCE-READINESS.md`, `BILLING-AND-USAGE-POLICY.md`,
`AUTH-AND-ACCESS-CONTROL.md`, and the platform-admin docs.
