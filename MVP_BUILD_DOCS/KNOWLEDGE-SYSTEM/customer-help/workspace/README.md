# Customer Help — Front-Desk Workspace

Status: active (articles ready; not yet published)
Audience: Front-desk staff · Visibility: `clinic_staff`
Last updated: 2026-06-09

Help for front-desk staff using `/workspace` to handle patient replies and
requests after a missed-call follow-up.

## Strict staff-safety boundary

The workspace applies **minimum-necessary display**. Articles here must match it.
Front-desk staff must **never** see (and these articles must never reference as
visible to staff):

- EIN / legal business details
- billing / payment method
- SMS approval controls or approval documents
- owner setup settings
- Twilio technical details
- internal IDs (including conversation UUIDs)
- raw compliance/webhook records

(Source: `FRONT-DESK-WORKSPACE.md`.)

## Articles

| Article | Title | Visibility | Status | Notes |
|---|---|---|---|---|
| [front-desk-workspace-overview.md](front-desk-workspace-overview.md) | Front-desk workspace overview | clinic_staff | ready | What the workspace is; what staff can/can't see; request cards; statuses |
| [../missed-calls-and-messages/how-front-desk-should-handle-patient-replies.md](../missed-calls-and-messages/how-front-desk-should-handle-patient-replies.md) | How front desk should handle patient replies | clinic_staff | ready | Lives in missed-calls-and-messages; cross-listed here |
| [understanding-request-statuses.md](understanding-request-statuses.md) | Understanding patient request statuses | clinic_staff | ready | What each status means; "not provided yet"; what not to assume |

## Staff-safe notes

- Describe the workspace as the place to review missed-call SMS replies and
  patient requests, and to record the outcome of a follow-up.
- **Status vocabulary** (from `FRONT-DESK-WORKSPACE.md`): New, Needs reply,
  Waiting for patient, Ready to call, Booked, Closed. Explain them simply.
- **Outcomes** staff can record per real conversation: appointment booked, no
  appointment booked, could not reach patient (plus an optional short note).
- Reinforce opt-out respect: never message a patient who replied STOP. Link to
  [../missed-calls-and-messages/README.md](../missed-calls-and-messages/README.md).
- Sample cards are clearly labeled "Sample" and are not real patients — note this
  so staff don't act on them.
- Do not describe owner-only features (billing, SMS approval, setup) here, even to
  say staff "can't" use them — keep the workspace scope clean.

## Source of truth

- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` — workspace scope, statuses, outcomes,
  minimum-necessary display

## Need more help?

Front-desk staff should contact their clinic owner first for account questions.
For product issues: support@missedcallsdental.com
