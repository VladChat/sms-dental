# Customer Help — Missed Calls and Messages

Status: scaffold (planned articles)
Audience: Clinic owners and staff · Visibility: `customer_authenticated` / `clinic_staff`
Last updated: 2026-06-09

Help for understanding the follow-up text after a missed call, patient replies,
and opt-out.

## Planned articles

| Slug | Title | Visibility | Notes |
|---|---|---|---|
| `patient-opt-out-stop-start` | Patient opt-out: STOP/START | customer_authenticated | How patients opt out and back in |
| `how-front-desk-should-handle-patient-replies` | How front desk should handle patient replies | clinic_staff | Cross-listed in workspace; staff-safe |

## Customer-safe notes

- Describe the recovery text in plain terms: after a missed call, the clinic sends
  one professional follow-up offering to help schedule. One message per missed
  call (not repeated within a 24-hour window). No marketing, no medical advice.
- **Opt-out:** patients can reply **STOP** to stop receiving texts and **START**
  to opt back in. The system records this and respects it automatically. Front
  desk and owners should never try to message a patient who has opted out.
- Keep staff-facing content within the workspace boundaries: front desk sees
  patient replies and requests, not billing, legal, approval, or setup. Internal
  IDs and provider details are never shown.
- Do not expose: message SIDs, delivery error codes, raw payloads, conversation
  UUIDs, or database fields.

## Source of truth

- `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` §9–10 (recovery send timing, STOP/START
  handling) — translate to customer-safe wording
- `MVP_BUILD_DOCS/FRONT-DESK-WORKSPACE.md` (what staff see)
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` §14 (SMS and compliance rules)

## Need more help?

Contact support: support@missedcallsdental.com
