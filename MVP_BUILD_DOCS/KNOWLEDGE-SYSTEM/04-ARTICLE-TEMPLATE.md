# 04 — Article Templates

Status: ready
Last updated: 2026-06-09

Copy the relevant template when creating a new article. Fill the frontmatter per
[03-ARTICLE-METADATA-SCHEMA.md](03-ARTICLE-METADATA-SCHEMA.md) and follow the
visibility rules in
[01-AUDIENCE-AND-ACCESS-MODEL.md](01-AUDIENCE-AND-ACCESS-MODEL.md).

Common required sections (all templates): summary, applies to, when to use, steps
or explanation, expected result, escalation / contact support path, related
articles, source of truth, safety notes.

---

## 1. Customer help article template

```markdown
---
title: <customer-facing title>
slug: <kebab-case>
status: draft
visibility: public | customer_authenticated | clinic_owner | clinic_staff
audience: <e.g. Clinic owners>
surface: <e.g. /account>
category: <e.g. billing>
owner: product
source_of_truth:
  - <canonical file>
last_verified: <YYYY-MM-DD>
related:
  - <slug>
---

## Summary
One or two plain-language sentences answering the question.

## Applies to
Who this is for / when it is relevant (e.g. "Clinic owners with an assigned
business number").

## When to use
The situation that brings a customer here.

## Steps / explanation
Customer-safe, task-focused. Use product vocabulary ("business number", "texting
service", "SMS approval"). No provider SIDs, raw errors, cron jobs, database
fields, or Stripe internals.

## Expected result
What the customer should see when it works.

## Need more help?
How to reach support: support@missedcallsdental.com. (Contact path is always
present in customer articles.)

## Related articles
- <link>

## Source of truth
- <canonical file(s)> — facts in this article must match these.

## Safety notes
Customer-safe vocabulary only. Confirm nothing here exposes internal details
(see 01-AUDIENCE-AND-ACCESS-MODEL.md hard rules).
```

---

## 2. Platform admin article template

```markdown
---
title: <internal-precise title>
slug: <kebab-case>
status: internal
visibility: platform_admin
audience: Platform operator
surface: /admin
category: <e.g. lifecycle>
owner: ops
source_of_truth:
  - <canonical file>
last_verified: <YYYY-MM-DD>
related:
  - <slug>
---

## Summary
What this operational concept/action is, in operator terms.

## Applies to
Which clinics/states/console areas this concerns.

## When to use
The operator situation that brings you here.

## Steps / explanation
Precise internal vocabulary. May reference console actions, gates, lifecycle
states, and diagnostics — but never secrets, and redact per the admin redaction
rules (mask phones, SID tails only, no raw payloads).

## Expected result
The intended outcome and what the audit log should show.

## Escalation
When to escalate to engineering / when an action is blocked-by-design and must
not be forced.

## Related articles
- <link>

## Source of truth
- <canonical file(s)>

## Safety notes
No secrets. Confirm redaction. Note any action that is gated/allowlisted/billable
or that triggers an external provider mutation.
```

---

## 3. Support runbook template

```markdown
---
title: <symptom-oriented title>
slug: <kebab-case>
status: internal
visibility: internal_ops
audience: Support / platform operator
surface: support
category: runbook
owner: support
source_of_truth:
  - <canonical file>
last_verified: <YYYY-MM-DD>
related:
  - <slug>
---

## Symptom
What the customer reports / what is observed.

## Likely causes
Ordered most-to-least common, grounded in current product behavior.

## Triage questions
Questions to ask the customer to narrow it down (customer-safe phrasing).

## Safe checks
Internal checks the operator may run. Prefer "check the relevant admin
diagnostics" over raw SQL. Only include a query if it is clearly internal-only,
safe, and exposes no private data.

## Do not do
Actions that would be unsafe, premature, or against product rules (e.g. forcing a
gated provider action, promising a refund, exposing internal IDs to the
customer).

## Escalation
When and to whom to escalate (platform admin / engineering), and what info to
include (no secrets).

## Customer-safe response summary
A short, copy-pasteable, customer-safe reply that does not leak internal detail.

## Related articles
- <link>

## Source of truth
- <canonical file(s)>
```

---

## 4. Developer/ops note template

```markdown
---
title: <dev/ops title>
slug: <kebab-case>
status: internal
visibility: developer_ops
audience: Engineers
surface: dev
category: <e.g. reference>
owner: engineering
source_of_truth:
  - <canonical file>
last_verified: <YYYY-MM-DD>
related:
  - <slug>
---

## Summary
What this note covers.

## Applies to
Which part of the system / which tasks.

## Explanation
May reference file paths, implementation detail, and validation commands
(`npm run typecheck`, `npm run build`). No secrets, no raw private data.

## Expected result
What "done/correct" looks like (e.g. validation passes).

## Escalation / ownership
Who owns this area; where to go if blocked.

## Related articles
- <link>

## Source of truth
- <canonical file(s)>

## Safety notes
No secrets, no raw patient data, no full DB URLs with passwords.
```
