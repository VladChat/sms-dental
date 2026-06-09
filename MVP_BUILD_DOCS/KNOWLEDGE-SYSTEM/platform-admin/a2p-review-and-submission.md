---
title: A2P review and submission safety gates
slug: a2p-review-and-submission
status: internal
visibility: platform_admin
audience: Platform operator
surface: /admin
category: compliance
owner: ops
source_of_truth:
  - MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md
  - MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md
  - config/runtime.config.ts
last_verified: 2026-06-09
related:
  - clinic-console
  - support-boundaries
  - diagnostics-and-audit
---

## Summary

How the platform operator reviews SMS-approval (A2P) data and the safety gates
around real carrier submission. **Live A2P submission is a billable, external,
hard-to-reverse provider mutation and must remain gated and allowlisted.**

## Terminology

Internally this is **A2P / 10DLC**. Customer-facing, it is **"SMS approval"** —
keep that distinction (see
[../customer-help/sms-approval/README.md](../../customer-help/sms-approval/README.md)).

## Applies to

The platform operator on `/admin/clinics/[clinicId]` → SMS approval, and anyone
triaging why texting is not live ([sms-not-sending runbook](../../support-runbooks/sms-not-sending.md)).

## Local vs toll-free path

- **Local numbers** → A2P 10DLC Brand + Campaign (TCR). The A2P submission package
  contains local numbers only.
- **Toll-free numbers** → toll-free verification (Twilio), **not** A2P
  Brand/Campaign. Never add toll-free numbers to a local A2P campaign.

## What admin can do

- **Review** the SMS-approval data and the generated submission package
  (read-only).
- **Edit/save** owner-level A2P/representative data from admin (audited). Saving
  **stores data only — it never submits to a carrier**.
- Customer-entered fields vs system-generated fields are defined in
  `SMS-APPROVAL-FIELD-MAPPING.md`. Do not collect or display system-generated
  fields as if they were operator inputs.

## Submission safety gates

The A2P submission mode is committed runtime config
(`runtimeConfig.a2p.submissionMode`): `disabled` | `dry_run` | `mock` | `live`.

- `disabled` — submit off; review only.
- `dry_run` — record a local "reviewed / ready for manual submission" status; **no
  Twilio mutation**.
- `mock` — creates mock Twilio A2P resources only; never enables real SMS traffic;
  safest default for test clinics.
- `live` — **real** Twilio A2P submission (billable: Brand one-time fee, Campaign
  recurring carrier fees). Even in `live`, real execution additionally requires:
  the clinic id in the per-clinic live allowlist
  (`runtimeConfig.a2p.liveSubmitClinicIds`), a configured primary Customer Profile
  SID, and an explicit admin Submit click after reviewing the package.

A clinic whose stored website matches a disallowed host (e.g. the ISV/owner
domain) is **blocked** from submission with a clear reason, to avoid sending
unrelated data to Twilio (minimum-information rule).

## Readiness vs live-send (do not conflate)

- Real SMS readiness must come from the **live submission only**, never from a
  mock brand SID. A mock brand can read as "approved" while the live brand failed;
  treat mock and live separately when judging readiness.
- A2P approval is **necessary but not sufficient** for live patient SMS. Live send
  still requires `SMS_RECOVERY_MODE=live` (ops env) **and** per-clinic
  `clinics.sms_recovery_enabled=true`, plus opt-out enforcement.

## Expected result / audit

A2P data saves write `admin_audit_events` (changed field names + completion flags
only — never raw EIN/phone/email). Carrier submission, when performed, is the only
path that changes external provider state.

## Escalation

If live submission fails, the brand is stuck pending, or readiness looks
contaminated by a mock SID, escalate to engineering. Do not force-enable SMS to
"work around" a failed/pending A2P state.

## Do not

- Do not submit live A2P for a non-allowlisted clinic.
- Do not enable live SMS based on a mock/approved-looking brand.
- Do not expose secrets, raw provider payloads, or full SIDs.

## Source of truth

- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md`
- `MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md`
- `config/runtime.config.ts` (`a2p.submissionMode`, `a2p.liveSubmitClinicIds`,
  trustHub, disallowed website hosts)
