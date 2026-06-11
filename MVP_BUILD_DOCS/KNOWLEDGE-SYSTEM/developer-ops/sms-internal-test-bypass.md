---
title: SMS internal test duplicate bypass
slug: sms-internal-test-duplicate-bypass
status: internal
visibility: developer_ops
audience: Engineers / ops
surface: dev
category: sms-operations
owner: engineering
source_of_truth:
  - MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md
  - lib/env.ts
  - lib/twilio/outbound-sms.ts
  - lib/sms-recovery/live-send-evaluation.ts
last_verified: 2026-06-11
related:
  - source-of-truth-map
  - update-knowledge-system-checklist
---

## Summary

Internal production SMS testing can allow selected test caller numbers to bypass
only the missed-call recovery duplicate suppression window.

Configure with:

```txt
SMS_TEST_BYPASS_DUPLICATE_SUPPRESSION_TO=+12245329236
```

The value is a comma-separated list of full E.164 caller phone numbers. Empty or
missing config preserves normal duplicate suppression.

## Safety Contract

The bypass must only skip the duplicate-window check. It must not bypass:

- `SMS_RECOVERY_MODE`.
- Exact-number readiness.
- `clinic.sms_recovery_enabled`.
- Local-number `clinic.sms_status` behavior.
- STOP/opt-out checks.
- Wrong-clinic or wrong-number protections.
- Twilio sender pinning and guarded send path.

The production code logs
`twilio.sms.duplicate_suppression_bypassed_for_test_number` with the caller last
4 only.

## Source Of Truth

- `lib/env.ts`
- `lib/twilio/outbound-sms.ts`
- `app/api/webhooks/twilio/voice/incoming/route.ts`
- `lib/sms-recovery/live-send-evaluation.ts`
- `tests/sms-recovery-send-gate.test.ts`
