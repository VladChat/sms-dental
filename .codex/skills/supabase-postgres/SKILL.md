---
name: supabase-postgres
description: Use for Supabase/Postgres migrations, queries, RLS, schema changes, indexes, performance, data integrity, production database checks, and database-backed workflow reliability in Missed Calls Dental.
---

# Supabase Postgres

Use this skill for schema design, migrations, SQL, RLS, indexes, query
performance, data integrity, tenant isolation, and database-backed webhook or
billing workflows.

## Safety Rules

- Inspect existing migrations before adding or changing schema.
- Prefer additive migrations for production systems.
- Do not run destructive DB actions without explicit owner instruction for the
  exact scope.
- Do not print database URLs, passwords, service-role values, or raw sensitive
  data.
- Verify project identity before any production DB work.
- Keep tenant isolation server-side; never rely on client-side filtering for
  security.
- Keep webhook and provider event writes idempotent.

## Implementation Rules

- Use migrations for schema changes.
- Preserve RLS and verify policies where exposed tables are involved.
- Add indexes for real lookup paths, not speculative future queries.
- Prefer constraints and transactions for correctness-critical state.
- Store only the minimum necessary data for the workflow.
- Keep provider diagnostics separate from customer-facing status when possible.

## Validation

Run generated SQL checks, type checks, and relevant tests where available. For
production-like DB work, follow `MVP_BUILD_DOCS/AGENT-RULES.md` section 5 and
update operations docs only when durable operational knowledge changes.

## Source Priority

Start with `Skills/supabase-postgres-best-practices.md`,
`MVP_BUILD_DOCS/PROJECT-CONTEXT.md`, `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md`,
and existing migrations under `supabase/migrations/`.
