# Customer Help — Getting Started

Status: active (articles ready; not yet published)
Audience: Clinic owners · Visibility: `customer_authenticated`
Last updated: 2026-06-09

Introductory help that explains what Missed Calls Dental does and what to expect.

## Articles

| Article | Title | Visibility | Status | Notes |
|---|---|---|---|---|
| [what-missed-calls-dental-does.md](what-missed-calls-dental-does.md) | What Missed Calls Dental does | customer_authenticated | ready | Plain explanation; what it is and is not |
| [how-missed-call-recovery-works.md](how-missed-call-recovery-works.md) | How missed-call recovery works | customer_authenticated | ready | The flow + supported connection paths |
| [../sms-approval/why-sms-is-not-active-immediately.md](../sms-approval/why-sms-is-not-active-immediately.md) | Why SMS is not active immediately | clinic_owner | ready | Lives in sms-approval; cross-listed here |

## Customer-safe notes

- Describe the value simply: a patient calls, the call is missed, and the clinic
  sends one professional text offering to help schedule.
- Be accurate about limits (from `PROJECT-CONTEXT.md`): the product cannot detect
  calls to an unrelated clinic number. A call reaches the system only through a
  supported path — keeping the main number and forwarding missed/no-answer calls,
  or using an assigned business number. Describe these in customer terms; do not
  expose webhook/provider mechanics.
- Set expectations: texting does not turn on at signup. It starts after SMS
  approval and configuration. Link to
  [../sms-approval/README.md](../sms-approval/README.md).
- Do not promise appointments, delivery guarantees, or medical outcomes.

## Source of truth

- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` (product identity, core solution, phone
  event strategy)
- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` (recovery flow, at a customer-safe level)

## Need more help?

Contact support: support@missedcallsdental.com
