# Developer / Ops Notes

Status: active (governance + maps current; no help-UI/search/AI-support built)
Audience: Engineers · Visibility: `developer_ops`
Last updated: 2026-06-27

Engineering-facing notes for maintaining the Knowledge System and finding
canonical facts. These may reference file paths, implementation detail, and
validation commands — but never secrets or raw private data.

Current Knowledge System maturity (see
[../07-CONTENT-INVENTORY.md](../07-CONTENT-INVENTORY.md)): customer-help articles
are written and `ready` (not surfaced); platform-admin docs and support runbooks
are written and `internal`; a few AI Answering / AI Call Assistant rows remain
`draft`/planned because the patient-facing feature is not broadly live. No help
widget, search index, AI-support retrieval, database table, or admin support
screen is built — this layer is content + governance only.

## Documents

- [source-of-truth-map.md](source-of-truth-map.md) — domain → canonical repo
  files (kept current with each product addition).
- [update-knowledge-system-checklist.md](update-knowledge-system-checklist.md) —
  when and how future agents must update this system.
- [future-implementation-notes.md](future-implementation-notes.md) — notes for the
  eventual help-UI, role-aware search, and AI-support build (all still future).
- [sms-internal-test-bypass.md](sms-internal-test-bypass.md) — internal test-only
  duplicate-suppression bypass env; all other SMS guards remain required.

## Relationship to existing engineering docs

This system **does not replace** the existing operational docs. Continue to use:

- `MVP_BUILD_DOCS/SETUP-LOG.md` — chronological setup/deploy facts.
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` — operate/verify/troubleshoot.
- `MVP_BUILD_DOCS/REPEATABLE-SETUP-CHECKLIST.md` — reusable setup lessons.

The Knowledge System links to those rather than duplicating them.

## Source of truth

- `AGENTS.md` (source priority, update rules)
- `MVP_BUILD_DOCS/MANIFEST.md` (doc index)
