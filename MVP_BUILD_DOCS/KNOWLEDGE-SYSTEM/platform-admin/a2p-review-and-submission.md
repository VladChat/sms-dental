---
title: A2P review and submission safety gates
slug: a2p-review-and-submission
status: internal
visibility: platform_admin
audience: Platform admin / operator
surface: /admin
category: compliance
owner: ops
source_of_truth:
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md
  - config/runtime.config.ts
  - AGENTS.md
last_verified: 2026-06-11
related:
  - clinic-console
  - support-boundaries
  - diagnostics-and-audit
---

# A2P review and submission safety gates

## Summary

How the platform operator reviews SMS-approval (A2P) data and the safety gates
around real carrier submission. **Live A2P submission is a billable, external,
hard-to-reverse provider mutation and must remain gated and allowlisted. Review is
not a blind action.**

## Terminology

Internally this is **A2P / 10DLC**. Customer-facing, it is **"SMS approval"** —
keep that distinction (see
[../customer-help/sms-approval/README.md](../../customer-help/sms-approval/README.md)).
Do not use "A2P / 10DLC / brand / campaign / TCR" jargon in customer replies.

## Applies to

The platform operator on `/admin/clinics/[clinicId]` → SMS approval, and operators
backing the [a2p-approval-question runbook](../support-runbooks/a2p-approval-question.md)
and the [sms-not-sending runbook](../support-runbooks/sms-not-sending.md).

## Local vs toll-free path

- **Local numbers** → A2P 10DLC Brand + Campaign. The A2P submission package
  contains local numbers only.
- **Toll-free numbers** → toll-free verification, **not** A2P Brand/Campaign. Never
  add toll-free numbers to a local A2P campaign.

## Business Profile vs SMS Approval Information

These are **separate** sections. Business Profile holds the clinic's public
identity + address; SMS Approval Information holds the legal/registration fields and
the authorized representative. The address is entered once (Business Profile) and
reused — never duplicated.

### Customer-entered fields (SMS Approval Information)
Minimal, required-for-approval only (per `SMS-APPROVAL-FIELD-MAPPING.md`):

- Legal business name
- Business type (fixed enum; UI shows a friendly label)
- EIN
- Authorized representative: first name, last name, email, phone
- Authorization checkbox

The **authorization checkbox** is the representative attesting they are authorized
to enable business texting for the clinic. Saving the section sets it complete and
advances the displayed status to "Waiting for approval" — it does **not** submit to
a carrier and does **not** enable live SMS.

### System-generated / internal fields (not customer-editable)
Generated from business data + product context — e.g. representative title
(`Owner`), use-case summary/category, production message sample, opt-in type/keywords,
message volume estimate, generated privacy/SMS-terms URLs, and registration
authority/country values. Do not present these as operator inputs or collect them
from the customer.

## The review package

The operator can **review** the assembled submission package (read-only) before any
submission. Review confirms the customer-entered data is present and sane and that
the generated values look correct — it is a checkpoint, not a rubber stamp. A clinic
whose stored website matches a disallowed host (e.g. the ISV/owner domain) is
**blocked** from submission with a clear reason (minimum-information rule).

## What admin can do

- **Review** the SMS-approval data and the generated submission package.
- **Edit/save** owner-level A2P/representative data from admin (audited). Saving
  **stores data only — it never submits to a carrier**.

## Submission safety gates

A2P submission mode is committed runtime config
(`runtimeConfig.a2p.submissionMode`): `disabled` | `dry_run` | `mock` | `live`.

- `disabled` — submit off; review only.
- `dry_run` — record a local "reviewed / ready for manual submission" status; **no
  provider mutation**.
- `mock` — creates mock A2P resources only; never enables real SMS; safest default
  for test clinics.
- `live` — **real** A2P submission (billable: Brand one-time fee, Campaign recurring
  carrier fees). Even in `live`, real execution additionally requires: the clinic id
  in the per-clinic live allowlist (`runtimeConfig.a2p.liveSubmitClinicIds`), a
  configured primary Customer Profile, and an explicit admin Submit click after
  reviewing the package.

> For general clinics, live carrier submission from the panel **remains a future
> milestone** gated behind the allowlist; do not treat it as broadly available.

## Readiness vs live-send (do not conflate)

- Real SMS readiness must come from the **live submission only**, never from a mock
  brand. A mock brand can read as "approved" while the live brand failed — treat
  mock and live separately.
- For local-number live-send readiness, a live Brand must be explicitly
  `APPROVED`/`VERIFIED`. `REGISTERED` is a Mock A2P lifecycle completion status
  only and must not unlock patient SMS.
- A2P approval is **necessary but not sufficient** for live patient SMS. Live send
  still requires `SMS_RECOVERY_MODE=live` (ops) **and** per-clinic
  `clinics.sms_recovery_enabled=true`, plus opt-out enforcement.

## What to tell customers safely

- Use "SMS approval"; explain it is the approval the texting service needs before
  it can be activated, and that it can take time (no exact-date promise).
- Saving the section shows "Complete," but the separate **Texting** status is the
  real state.
- Do not expose submission mode, allowlists, SIDs, the review package internals, or
  brand/campaign mechanics.

## What blocks submission

- Mode not `live`, or clinic not in the live allowlist.
- Missing primary Customer Profile configuration.
- Disallowed clinic website host.
- Incomplete required customer-entered fields.

## Escalation

If live submission fails, a brand is stuck pending, or readiness looks
mock-contaminated, escalate to engineering. **Do not force-enable SMS** to work
around a failed/pending A2P state.

## Do not

- Do not submit live A2P for a non-allowlisted clinic.
- Do not enable live SMS based on a mock/approved-looking brand.
- Do not encourage spammy messages, fake urgency, medical claims, or opt-out
  bypassing.
- Do not expose secrets, raw provider payloads, or full SIDs.

## Source of truth

- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md`
- `MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md` (customer-entered vs
  system-generated fields)
- `config/runtime.config.ts` (`a2p.submissionMode`, `a2p.liveSubmitClinicIds`,
  trustHub, disallowed website hosts)
- `AGENTS.md` (SMS/compliance rules)
