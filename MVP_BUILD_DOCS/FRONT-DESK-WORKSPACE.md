# Front Desk Workspace

Status: Active (read-only foundation)
Last updated: 2026-05-31

The front-desk workspace (`/workspace`) is the operational view where clinic
staff review the results of missed-call SMS recovery — patient replies and
requests. It is deliberately separate from the owner/admin account area.

## 1. Product boundary

| Surface      | Audience      | Purpose                                                                 |
|--------------|---------------|-------------------------------------------------------------------------|
| `/account`   | Owner / admin | Phone number, business profile, SMS approval, billing, future owner-only SMS & conversation settings. |
| `/workspace` | Front desk    | Missed-call replies and patient requests; callback/booked/handled work. |

Front-desk staff use `/workspace`, never `/account`.

The workspace applies **minimum-necessary display**. It must never show:
EIN, legal business details, billing/payment method, SMS approval controls,
approval documents, owner setup settings, Twilio technical details, internal IDs
(including conversation UUIDs), or raw compliance/webhook records.

## 2. Current scope (this pass)

**Read-only foundation.** The first `/workspace` build shows existing
missed-call SMS conversations as front-desk patient request cards. There are no
write actions yet:

- no outbound replies;
- no call actions;
- no status mutations;
- no staff auth;
- no new task-management system;
- no new database tables.

## 3. Access model

Until staff authentication exists, `/workspace` is gated by the same httpOnly
account-context cookie (`mcd_account`) used by `/account`
(`lib/onboarding/account-session.ts`). It is therefore an **owner-accessible
preview** of the future staff workspace.

- `/workspace` is never public.
- With no valid account context, it shows a safe message asking the user to open
  their account/setup link (no data, no token).
- Setup tokens are never placed in the URL and never logged.
- Patient message contents are not logged.

Future: real per-clinic staff accounts/roles (front-desk role) replace the
owner-cookie gate. The page already isolates front-desk-safe data so adding a
staff role does not require reshaping the view.

## 4. Patient request card model

UI shape (`app/workspace/_components/workspace-types.ts` → `PatientRequestCard`):

| Field                  | Source (current)                              | Notes |
|------------------------|-----------------------------------------------|-------|
| id                     | `patient_conversations.id`                    | Opaque selection key only; NOT shown to the user. |
| callerPhone            | `patient_conversations.patient_phone`         | Patient phone (E.164). |
| patientName            | — (no column yet)                             | `Not provided yet`. |
| requestType            | — (no column yet)                             | `Not provided yet`. |
| preferredTime          | — (no column yet)                             | `Not provided yet`. |
| summary                | — (no column yet)                             | `Not provided yet`; never AI-generated. |
| latestMessage          | latest `messages.body` in the conversation    | Snippet on the card. |
| status                 | derived (see below)                           | |
| createdAt              | `patient_conversations.created_at`            | |
| lastActivityAt         | `patient_conversations.last_message_at`       | falls back to `created_at`. |
| timeline               | `messages` (direction, body, created_at)      | Safe columns only. |

Unknown fields always render as `Not provided yet`. No external AI calls, no
speculative summaries, no inferred medical details.

## 5. Status vocabulary

`New`, `Needs reply`, `Waiting for patient`, `Ready to call`, `Booked`,
`Closed`.

Conservative derivation from existing data
(`deriveWorkspaceStatus`):

- `patient_conversations.status = booked` → **Booked**
- `patient_conversations.status = closed | lost` → **Closed**
- open + no messages → **New**
- open + latest message inbound → **Needs reply**
- open + latest message outbound → **Waiting for patient**
- **Ready to call** is in the vocabulary but is not auto-assigned yet (no
  reliable signal in current data).

Calm status colors; red is never used for normal states.

## 6. Data-source mapping

Read-only access lives in `lib/db/front-desk.ts` (`listClinicConversations`).
It reads:

- `public.patient_conversations` — id, patient_phone, status, created_at,
  last_message_at (for the clinic, most-recently-active first).
- `public.messages` — id, conversation_id, direction, body, detected_keyword,
  created_at (safe columns only).

It deliberately does **not** read `raw_payload`, Twilio SIDs, `error_code` /
`error_message`, clinic/owner identity, billing, or compliance/setup fields, and
performs no writes. `call_events` and `opt_outs` exist and may feed future
signals (e.g. missed-call origin, opt-out state) but are not surfaced yet.

## 7. Future actions (not built)

Planned write capabilities for later passes, behind staff auth:

- reply to a patient (outbound SMS) — compliance + opt-out gated;
- call / click-to-call;
- mark booked / mark handled / set status;
- internal notes and tasks;
- assignment/routing between staff.

## 8. Proposed dedicated table (only if needed later)

The current read-only view works from existing tables, so **no migration is
applied in this pass**. If/when front-desk work needs first-class request state
(separate from conversation lifecycle) — e.g. handled-by, internal notes, task
due dates, structured request type / preferred time — add a dedicated table
then, with owner approval:

```
-- PROPOSED (not applied): public.patient_requests
-- id uuid pk, clinic_id uuid fk, conversation_id uuid fk,
-- request_type text, preferred_time text, summary text,
-- status text check (...), handled_by text, internal_notes text,
-- created_at timestamptz, updated_at timestamptz
```

Until that need is real, derive everything from `patient_conversations` +
`messages`.

## 9. Future owner-only "SMS & conversation settings"

This belongs in the **owner/admin** `/account` area, not the front desk, because
it sets messaging policy and workflow. Not built yet. It should later control:

- the first missed-call SMS template;
- allowed follow-up questions;
- reply-handling behavior;
- conversation handoff rules;
- notification routing;
- what information is passed to the front desk.

## 10. Related `/account` cleanup (same pass)

A focused `/account` cleanup shipped alongside this foundation:

- Billing: removed the duplicate `Needs setup` badge under the panel title; the
  single payment-method status now lives only in the `Payment method` row.
- Billing: one no-charge note (removed the repeated idea from the subtitle);
  `Free trial ends in X days` capitalization normalized.
- Dashboard alignment: reserved the scrollbar gutter (`scrollbar-gutter: stable`)
  so the right panel no longer shifts horizontally when switching sections.
- Phone number: removed the redundant panel-header status badge so the clearest
  status emphasis stays in the Voice / Calls and SMS / Texting service rows.

## 11. Auth foundation update (2026-05-31)

Phase 1 real auth is now in place for owners:

- `/login` supports owner email+password sign-in.
- `/account` and `/workspace` now use authenticated session + clinic membership
  as the **primary** access path.
- Legacy `mcd_account` setup-token cookie remains a temporary fallback so
  existing setup-link users are not locked out during rollout.

Staff invites are still not built in this phase:

- no self-service front-desk invite acceptance yet
- no staff-only credentials issued by product flow yet
- workspace remains an owner-accessible preview until invite + front-desk role
  onboarding is implemented

Authoritative auth flow and table model are documented in:
`MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`.
