# Customer Help — Front-Desk Workspace

Status: active (articles ready; not yet published)
Audience: Front-desk staff · Visibility: `clinic_staff`
Last updated: 2026-06-27

Help for front-desk staff using `/workspace` (**Patient requests**) to handle
patient replies and requests after a missed-call follow-up.

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
| [front-desk-workspace-overview.md](front-desk-workspace-overview.md) | Front-desk workspace overview | clinic_staff | ready | What the workspace is; what staff can/can't see; sectioned request cards |
| [../missed-calls-and-messages/how-front-desk-should-handle-patient-replies.md](../missed-calls-and-messages/how-front-desk-should-handle-patient-replies.md) | How front desk should handle patient replies | clinic_staff | ready | Lives in missed-calls-and-messages; cross-listed here |
| [understanding-request-statuses.md](understanding-request-statuses.md) | Understanding patient request statuses | clinic_staff | ready | What each queue section means; Not provided; what not to assume |

## Staff-safe notes

- Describe the workspace as **Patient requests**: the place to review missed-call
  SMS replies as request cards, and to record the outcome of a follow-up.
- **Queue sections** (from `FRONT-DESK-WORKSPACE.md`): Needs follow-up, Handled,
  Blocked. Explain them simply. Do not describe Archive as a staff-facing action
  or visible section.
- **Handled outcome** staff records per real conversation: appointment booked
  yes/no, plus an optional short internal note.
- Reinforce opt-out respect: never message a patient who replied STOP. Link to
  [../missed-calls-and-messages/README.md](../missed-calls-and-messages/README.md).
- The Sample requests section is clearly separated from real requests — note this
  so staff don't act on examples.
- Workspace articles may mention a request **Source** label, including **Source:
  AI answered call** (with a short call summary), as the way a request arrived.
  Describe it as a source label only: AI answered calls are not available for
  every clinic yet, front-desk staff do **not** configure or turn on AI answered
  calls, and a request is handled the same regardless of source. Keep it
  staff-safe — no runtime/provider/test terms.
- Do not describe owner-only features (billing, SMS approval, setup) here, even to
  say staff "can't" use them — keep the workspace scope clean.

## Source of truth

- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` — workspace scope, queue sections, outcomes,
  minimum-necessary display

## Need more help?

Front-desk staff should contact their clinic owner first for account questions.
For product issues: support@missedcallsdental.com
