---
name: react-next
description: Use for Next.js and React implementation work in Missed Calls Dental, including App Router routes, server/client component choices, API routes, build/typecheck validation, and behavior-preserving UI or backend changes.
---

# React Next

Use this skill for Next.js, React, App Router pages, layouts, components, API
routes, server actions, route handlers, data loading, and build/typecheck work.

## Implementation Rules

- Inspect existing patterns before editing.
- Prefer server components where appropriate.
- Avoid unnecessary client components.
- Preserve route behavior and URL semantics.
- Keep changes narrow and behavior-preserving unless Vlad requests a redesign or
  refactor.
- Reuse existing helpers, config, auth resolution, database access, and UI
  classes before adding new abstractions.
- Do not move the SaaS app/backend out of the existing `app/` direction unless
  Vlad explicitly changes the architecture.

## Forms and Data

- Ask only for fields required for the next immediate step.
- Explain why required fields are needed.
- Derive tenant/clinic identity server-side.
- Keep provider payloads minimum-necessary.
- Do not put secrets or privileged provider details in browser code.

## Validation

Run the most relevant available commands from `package.json`, usually:

```powershell
npm run typecheck
npm run build
```

Run focused tests when the touched area has a matching script.
