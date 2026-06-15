---
title: Future implementation notes
slug: future-implementation-notes
status: internal
visibility: developer_ops
audience: Engineers
surface: dev
category: planning
owner: engineering
source_of_truth:
  - ../05-ADMIN-SUPPORT-INTEGRATION-PLAN.md
  - ../06-AI-SUPPORT-BOUNDARIES.md
last_verified: 2026-06-27
related:
  - source-of-truth-map
  - update-knowledge-system-checklist
---

## Summary

Engineering notes for the eventual surfaces that will consume this Knowledge
System: contextual help UI, role-aware search, and AI-support grounding. **None of
this is built in this pass.** This is guidance so the future build stays
consistent with the architecture and access model.

## Not built yet

- No help widget, no search index, no AI-support retrieval, no support inbox, no
  Knowledge System database table, and no admin support screen.
- This layer is content + governance only. Article **bodies** are now written:
  customer-help is `ready`, platform-admin and support runbooks are `internal`;
  only the patient-facing AI Answering / AI Call Assistant rows stay `draft`
  because that channel is not broadly live.

## Five distinct future tracks (do not conflate)

These are separate future efforts. The first four are help-system surfaces that
would *consume* this Knowledge System; the fifth is a product channel that is
*documented by* this Knowledge System, not part of it.

1. **Docs-only Knowledge System work (this layer).** Writing/reconciling
   articles, inventory, source-of-truth map, governance. Markdown only; no
   `app/` / `lib/` / `config/` / `supabase/` changes. This reconciliation pass is
   this track.
2. **Future contextual help UI.** Surfacing `status: published`,
   audience-appropriate articles inside `/account`, `/workspace`, `/admin` per
   [../05-ADMIN-SUPPORT-INTEGRATION-PLAN.md](../05-ADMIN-SUPPORT-INTEGRATION-PLAN.md).
   Server-side role→visibility filtering before render.
3. **Future role-filtered search.** A role-partitioned index over article
   frontmatter + body; a customer query must never reach internal content.
4. **Future AI-support retrieval.** Role-filtered, source-cited grounding that
   strictly follows [../06-AI-SUPPORT-BOUNDARIES.md](../06-AI-SUPPORT-BOUNDARIES.md):
   retrieval filtered server-side before the model, no secrets/raw payloads, no
   invented behavior, escalate on uncertainty.
5. **Future AI Answering runtime (a product channel, NOT a help surface).** The
   live patient-facing AI voice answering runtime. A non-live foundation exists
   today (data model, Workspace representation, platform-admin mock sessions, a
   fail-closed runtime gate, and a gated test-only ConversationRelay path) — see
   `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` and
   [../platform-admin/ai-answering-foundation.md](../platform-admin/ai-answering-foundation.md).
   Building the broad runtime is product/app work (provider/runtime, billing
   metering, owner enablement) under the normal app rules — it is out of scope
   for this Knowledge System layer, which only documents it.

## Frontmatter is the contract

Future search/UI/AI must read article frontmatter
([../03-ARTICLE-METADATA-SCHEMA.md](../03-ARTICLE-METADATA-SCHEMA.md)) —
especially `visibility`, `status`, `surface`, `category`, and `source_of_truth`.
Keep the schema stable; extend additively if needed.

## Access control is server-side

- Resolve the requesting role first (owner / staff / platform admin / ops / dev),
  map it to allowed `visibility` bands
  ([../01-AUDIENCE-AND-ACCESS-MODEL.md](../01-AUDIENCE-AND-ACCESS-MODEL.md)), then
  filter content to those bands **before** returning anything.
- A customer request must never be able to retrieve `platform_admin`,
  `internal_ops`, or `developer_ops` content. Do not rely on hidden UI links or
  client filtering.
- Reuse existing guards: `resolveAuthClinicAccess` (owner/staff) and
  `resolvePlatformAdmin` (platform admin). Front-desk vs owner banding must respect
  the workspace minimum-necessary rule.

## Contextual help surfaces (planned)

Map each surface to its allowed bands and article categories per
[../05-ADMIN-SUPPORT-INTEGRATION-PLAN.md](../05-ADMIN-SUPPORT-INTEGRATION-PLAN.md):
`/account` (owner bands), `/workspace` (staff bands), `/admin` (internal bands).
Only `status: published` (and audience-appropriate) articles should appear on a
live surface.

## Role-aware search (planned)

- Partition or filter the index by `visibility`; never co-mingle internal and
  customer results in a way that a customer query can reach internal content.
- Index `title`, body, `category`, and `related`; rank within the allowed bands.

## AI-support grounding (planned)

- Strictly follow [../06-AI-SUPPORT-BOUNDARIES.md](../06-AI-SUPPORT-BOUNDARIES.md):
  role-filtered retrieval, cite the source article, escalate on uncertainty, no
  secrets/raw payloads, no invented behavior, respect SMS/A2P compliance wording,
  and prefer source-of-truth files in the `AGENTS.md` priority order.
- Retrieval must be filtered server-side before the model sees content — the model
  must never receive out-of-band articles.

## Build/validation expectations

- Content changes are docs-only and don't need `npm run typecheck` unless code is
  touched.
- When the help-UI/search/AI is actually built, that work touches `app/` / `lib/`
  and must follow the normal app rules (RLS, guards, no secrets, typecheck/build),
  plus update this Knowledge System per
  [update-knowledge-system-checklist.md](update-knowledge-system-checklist.md).

## Source of truth

- [../05-ADMIN-SUPPORT-INTEGRATION-PLAN.md](../05-ADMIN-SUPPORT-INTEGRATION-PLAN.md)
- [../06-AI-SUPPORT-BOUNDARIES.md](../06-AI-SUPPORT-BOUNDARIES.md)
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`,
  `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` (guards)
