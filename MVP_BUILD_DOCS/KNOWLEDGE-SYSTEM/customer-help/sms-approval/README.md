# Customer Help — SMS Approval

Status: active (articles ready; not yet published)
Audience: Clinic owners · Visibility: `clinic_owner`
Last updated: 2026-06-09

Help for the SMS approval step that must be completed before the texting service
can go live.

## Terminology rule

- The **customer-facing term is "SMS approval"**. The account UI section is "SMS
  Approval Information".
- **"A2P" / "10DLC" are internal/registration terminology.** Do not use them in
  customer-facing articles unless the customer UI already shows them. Use "A2P"
  only in internal/admin docs
  ([../../platform-admin/a2p-review-and-submission.md](../../platform-admin/a2p-review-and-submission.md)).

## Articles

| Article | Title | Visibility | Status | Notes |
|---|---|---|---|---|
| [what-sms-approval-means.md](what-sms-approval-means.md) | What SMS approval means | clinic_owner | ready | Why texting needs approval before it can send to patients |
| [what-information-is-needed-for-sms-approval.md](what-information-is-needed-for-sms-approval.md) | What information is needed for SMS approval | clinic_owner | ready | Only the customer-entered fields |
| [why-sms-is-not-active-immediately.md](why-sms-is-not-active-immediately.md) | Why SMS is not active immediately | clinic_owner | ready | Texting is a separate step from number setup; cross-listed in getting-started |

## Customer-safe notes

- Explain that texting to patients requires approval first; this protects
  delivery and follows carrier rules. Keep it reassuring and simple.
- **What the customer actually enters** (from `SMS-APPROVAL-FIELD-MAPPING.md`,
  customer-entered fields only): legal business name, business type, EIN,
  authorized representative first/last name, email, phone, and an authorization
  checkbox. Business profile (clinic name, address, etc.) is entered once and
  reused — do not ask for it twice.
- Do **not** describe system-generated fields (use case, sample message, opt-in
  keywords, policy URLs, message volume, etc.) as customer tasks — the system
  generates those. Do not expose internal submission fields, brand/campaign
  mechanics, provider names, or SIDs.
- Set the right expectation about status: saving the SMS approval section marks it
  **Complete**, but a separate **Texting** status shows the real state
  (`Not active` → `Waiting for approval` → `Active`). "Complete" does **not** mean
  texting is live.
- Reinforce compliance basics without jargon: messages are professional, one
  follow-up per missed call, patients can reply STOP to opt out. Link to
  [../missed-calls-and-messages/README.md](../missed-calls-and-messages/README.md).
- Never imply texting is on before approval and per-clinic enablement are
  complete.

## Source of truth

- `MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md` — which fields are customer-entered
- `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md` — approval requirements
  (internal framing; translate to customer-safe wording)

## Need more help?

Contact support: support@missedcallsdental.com
