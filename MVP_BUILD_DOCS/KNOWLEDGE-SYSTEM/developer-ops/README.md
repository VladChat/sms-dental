# Developer / Ops Notes

Status: scaffold
Audience: Engineers · Visibility: `developer_ops`
Last updated: 2026-06-09

Engineering-facing notes for maintaining the Knowledge System and finding
canonical facts. These may reference file paths, implementation detail, and
validation commands — but never secrets or raw private data.

## Documents

- [source-of-truth-map.md](source-of-truth-map.md) — domain → canonical repo
  files.
- [update-knowledge-system-checklist.md](update-knowledge-system-checklist.md) —
  when and how future agents must update this system.
- [future-implementation-notes.md](future-implementation-notes.md) — notes for the
  eventual help-UI, role-aware search, and AI-support build.

## Relationship to existing engineering docs

This system **does not replace** the existing operational docs. Continue to use:

- `MVP_BUILD_DOCS/SETUP-LOG.md` — chronological setup/deploy facts.
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — operate/verify/troubleshoot.
- `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md` — reusable setup lessons.

The Knowledge System links to those rather than duplicating them.

## Source of truth

- `AGENTS.md` (source priority, update rules)
- `MVP_BUILD_DOCS/MANIFEST.md` (doc index)
