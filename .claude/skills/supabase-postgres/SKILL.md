---
name: supabase-postgres
description: Supabase and Postgres design rules for Dental SMS data models, RLS, indexing, and reliable event-driven workflows.
---

# Supabase Postgres

Use this skill for schema design, queries, policies, and performance.

Schema and query rules:
- Model call events, message events, and conversation state explicitly.
- Use appropriate indexes for lookup and reporting paths.
- Keep write paths idempotent for webhook ingestion.
- Prefer transactional updates for related state changes.

Security rules:
- Enable and verify RLS policies on exposed tables.
- Use least-privilege service access.
- Separate privileged server operations from client queries.

Performance rules:
- Avoid N+1 query patterns.
- Use pagination for message and event histories.
- Measure slow queries and optimize with indexes before scaling.

Dental SMS context:
- Prioritize data correctness for missed-call detection and follow-up.
- Keep auditability for Stripe/Twilio/Supabase event reconciliation.
