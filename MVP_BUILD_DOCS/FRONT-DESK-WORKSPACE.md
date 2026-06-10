# Front Desk Workspace

Status: Active (reply review + outcome recording MVP)
Last updated: 2026-06-10

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

## 2. Current scope

`/workspace` shows existing missed-call SMS conversations as front-desk patient
request cards. It now supports the minimal human follow-up workflow:

- no outbound replies;
- visible latest patient reply without opening the full conversation;
- a normal browser/phone `tel:` link labeled `Call patient` (not a Twilio
  outbound call and not automation);
- status mutations only through the explicit outcome form;
- no new staff invite/onboarding system in this pass;
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
| latestInboundReply     | latest inbound `messages.body` in the conversation | Shown in detail as `Latest patient reply`; not inferred. |
| status                 | derived (see below)                           | |
| createdAt              | `patient_conversations.created_at`            | |
| lastActivityAt         | `patient_conversations.last_message_at`       | falls back to `created_at`. |
| timeline               | `messages` (direction, body, created_at)      | Safe columns only. |

Unknown fields are not repeated as a long list when there is no source data. The
detail view instead says: `Patient details are not collected yet. Use the reply
and phone number to follow up.` No external AI calls, no speculative summaries,
no inferred medical details.

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
- Twilio-powered click-to-call or call automation;
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

## 12. Sample requests + result preview (2026-05-31 follow-up)

To reduce "empty screen" confusion while real data is sparse, `/workspace` now
shows a clearly labeled **Sample requests** section when there are no real
conversation cards.

Sample states included:

- Needs follow-up
- Waiting for patient
- Appointment booked
- No appointment booked
- Could not reach patient

Sample behavior rules:

- each sample card is explicitly labeled `Sample`
- sample cards are UI-only and never written to the database
- sample cards are not real staff outcomes and must not be used as analytics
  inputs
- when real cards exist, real cards remain primary and samples are not shown

Result controls (preview-only in this phase):

- `Result` options:
  - Appointment booked
  - No appointment booked
  - Could not reach patient
- `Note` field (optional short note)

No production mutation is implemented from these controls in this phase.

Future analytics derivation (planned):

- Appointment booked -> follow-up completed + recovered
- No appointment booked -> follow-up completed + not recovered
- Could not reach patient -> follow-up completed + unreachable/not recovered
- no result selected -> still needs follow-up

Sample-domain policy:

- any fake domains/emails in workspace examples must use `example.com` only.

## 13. Workspace copy cleanup follow-up (2026-05-31)

Focused cleanup in this pass:

- sample request copy now uses neutral request types (cleaning appointment,
  appointment question, reschedule request, callback request).
- sample status labels are simplified for staff scanning:
  - Needs follow-up
  - Waiting for patient
  - Appointment booked
  - No appointment booked
  - Closed
- conversation is collapsed by default behind `View conversation`.
- conversation remains message history only (patient/office + timestamps), with
  no inferred outcomes.
- sample result UI is now:
  - `Appointment booked?` -> `Yes` / `No`
  - `Note` (optional short note)
  - `Save result` button

Safety in this pass:

- no workspace result persistence added
- no result write routes added
- no sample data storage
- no analytics ingestion from sample UI

Future analytics mapping (documented only):

- `Yes` -> booked/recovered
- `No` -> not booked/not recovered
- blank -> still needs follow-up

## 11. Outcome saving (implemented 2026-06-01) — supersedes the read-only scope

`/workspace` is no longer read-only for real cards. The front desk can record an
outcome and an optional note per real patient conversation.

- **Schema:** instead of the proposed `patient_requests` table (§8), the minimal
  home was three additive nullable columns on `public.patient_conversations`:
  `front_desk_outcome`, `front_desk_note`, `front_desk_outcome_at`
  (`supabase/migrations/20260601000100_front_desk_outcome.sql`; check constraints
  for the outcome enum and a 300-char note limit). Revisit a dedicated table only
  if first-class request state (assignment, multiple notes, etc.) is needed later.
- **Outcomes:** `appointment_booked`, `no_appointment_booked`,
  `could_not_reach_patient`. A saved outcome is the primary source of the card
  status and advances the conversation lifecycle (`booked` / `lost` / `closed`
  respectively); with no saved outcome the conservative timeline derivation stands.
- **Write path:** `POST /api/workspace/outcome`, authenticated via
  `resolveAuthClinicAccess`, clinic-scoped in SQL, sample IDs rejected, 300-char
  note trimmed/limited client + server, empty note stored as NULL. Read path still
  minimum-necessary (no owner/billing/compliance/Twilio/raw-payload exposure).
- **Samples:** a clearly labeled, non-persistent training layer below real cards,
  with a `Hide` / `Show samples` toggle (local state) that never affects real
  cards. Sample outcome UI is disabled (`Sample preview · not saved`); the previous
  "contact support" modal is gone. Empty state: `No patient replies yet. Replies
  to recovery texts will appear here.`
