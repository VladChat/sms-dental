# Customer Help — Getting Started

Status: scaffold (planned articles)
Audience: Clinic owners and staff · Visibility: `public` / `customer_authenticated`
Last updated: 2026-06-09

Introductory help that explains what Missed Calls Dental does and what to expect.

## Planned articles

| Slug | Title | Visibility | Notes |
|---|---|---|---|
| `what-missed-calls-dental-does` | What Missed Calls Dental does | public | Plain explanation: recovers missed patient calls with a safe text follow-up |
| `how-missed-call-sms-recovery-works` | How missed-call SMS recovery works | customer_authenticated | The flow at a customer level; supported call paths only |
| `why-sms-is-not-active-immediately` | Why SMS is not active immediately | customer_authenticated | Texting starts after SMS approval and setup, not at signup |

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
