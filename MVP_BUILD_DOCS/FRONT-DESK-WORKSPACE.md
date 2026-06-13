# Front Desk Workspace

Status: Active (operational patient-request queue)
Last updated: 2026-06-13 (queue-card simplification, section sorting, inbound-only SMS auto-block)

## 0.1 2026-06-13 — Sectioned queue polish (decluttered cards)

- **Layout order.** The queue renders four visible sections in order:
  **Needs follow-up** (warning/yellow), **Handled** (success/green),
  **Archived** (neutral/info blue-gray), and **Blocked** (danger/red). The old
  top filter pills are gone. **Needs follow-up** is expanded by default and can
  be collapsed manually; Handled, Archived, and Blocked are collapsed by
  default. Each header shows the total count (for example,
  `Needs follow-up (4)`). Section priority is blocked > handled > archived >
  needs follow-up.
- **Load more.** Each section shows up to 6 cards at first. If more cards exist,
  a visible `Load more` button reveals the next 6 cards for that section. Header
  counts always show the total section count, not only visible cards.
- **Section sorting.** Needs follow-up is oldest first by last activity so the
  oldest active work stays visible. Handled, Archived, and Blocked are newest
  first by their handled / archived / blocked timestamp when available, falling
  back to last activity.
- **Left queue cards.** Queue cards are intentionally minimal: safe patient name
  when available, phone number, and last activity. If no safe name exists, the
  phone number is the title and is not duplicated. Cards do not show request
  summaries, `Review conversation`, latest-message snippets, Patient/Office
  prefixes, signal chips, or status badges.
- **No repeated status badges.** The section header is the primary status. Cards
  inside a section do not repeat `Needs follow-up`, `Handled`, `Archived`, or
  `Blocked` as per-card badges, and the selected-card header does not repeat the
  same status. The older outbound-waiting label is not staff-facing; active,
  non-handled, non-archived, non-blocked conversations stay under
  **Needs follow-up** whether the latest message is inbound or outbound.
- **Handled flow.** Clicking `Handled` opens a small inline panel
  (`Was appointment booked?`) with Yes / No. Choosing either saves
  immediately: `mark_handled` now REQUIRES `appointmentBooked: boolean` and
  records `front_desk_outcome` (`appointment_booked` / `no_appointment_booked`)
  + `front_desk_outcome_at` + lifecycle status alongside
  `workspace_handled_at`. The card moves to the Handled section.
- **Reopen** (from Handled or Archived) returns the request fully to
  Needs follow-up:
  it clears `workspace_handled_at`, `workspace_archived_at`,
  `front_desk_outcome(_at)`, and resets the lifecycle status to `open`, so no
  stale booked state shows after reopen. Nothing is deleted.
- **Name handling.** Missing names display as `Not provided` (never
  `Unknown`). Stored display names are sanitized through the conservative
  fail-closed extractor (`normalizeWorkspaceDisplayName`): request-like text
  such as "I Need Appointment" is never shown as a name. Staff can inline-edit
  the name (Edit -> input -> Save/Cancel) via the `save_name` action; empty
  clears the name; digits/URLs/emails/phones/keywords/request words are
  rejected server-side.
- **Request summary.** The field table was replaced by one compact card: a
  deterministic one-line headline (`Cleaning appointment · Tomorrow`,
  `Mentions pain/urgent concern · Wants appointment`, `Payment question`,
  fallback `Review conversation`). Request signals such as pain/urgent,
  payment, and insurance are not repeated as chips when the headline already
  says them. The request summary and conversation preview live in the right
  detail panel, not the left queue cards. Visible chips in the detail panel are
  reserved for useful non-redundant system state: `Automation paused` and
  `High volume`. No empty chip rows and no `None detected` rows render.
  `buildWorkspaceRequestSummary` keeps a future `aiSummary` input hook, but
  nothing produces AI today — no provider, no env.
- **Inbound-only SMS auto-block.** The inbound SMS webhook records the inbound
  message first, then for ordinary non-keyword inbound SMS checks whether the
  same clinic has ever sent that phone number a missed-call recovery SMS
  (`message_kind` null legacy rows or `missed_call_recovery`). If not, the
  patient/caller number is clinic-scoped blocked with reason
  `inbound_without_recovery_history`, the conversation is archived, and no
  reply classification, name extraction, or automated reply runs. STOP / START /
  HELP handling is unchanged and is never auto-blocked. Existing contacts who
  have ever received a recovery SMS from that clinic continue through the
  normal reply flow.
- **Action copy.** Exact tooltips on all actions (Call/Handled/Archive/Block/
  Reopen/Unblock). Block copy describes only the phone number: confirmation
  reads `Block this phone number? Automated texts to this number will stop,
  but messages stay saved.` Block is a visually separated danger action.
- **Visual polish.** Token-based `.ws-*` classes: toned queue sections,
  clearer selected card, primary-accent summary card, distinct patient (info
  tone, left accent) vs office bubbles, mobile-wrapping action rows.

## 0. 2026-06-12 — Operational queue redesign

`/workspace` is now a real front-desk queue that answers: who is this patient,
what do they want, what did they say, and what should staff do next.

- **Queue (left column).** Four sections: Needs follow-up, Handled, Archived,
  Blocked. Each card shows only the patient name when a safe name is available,
  the phone number, and last activity. If no safe name exists, the phone number
  is the title and is not duplicated. Cards do not show request summaries,
  latest-message snippets, Patient/Office labels, signal chips, or status
  badges.
- **Patient header (right panel).** Name or `Not provided`, the phone once,
  primary **Call patient** (a normal `tel:` link), and
  secondary actions: **Mark handled**, **Archive**, **Block number** (or
  **Reopen** when archived / **Unblock number** when blocked).
- **Request summary.** One deterministic, human-readable headline from
  `lib/workspace/request-summary.ts`, based on INBOUND text plus conversation
  state. No AI, no invented facts, no large field table, no duplicated phone,
  and no empty chip rows.
- **Conversation preview.** The last 2 messages render immediately with
  Patient / Your office labels and timestamps; **Show full conversation**
  toggles the full timeline. The old "Latest patient reply" block is gone.
- **Internal note.** Staff-only note saved independently via
  `/api/workspace/conversation-action` (`save_note`) — no outcome required.
  The big Outcome radio form was removed from the layout; the legacy
  `/api/workspace/outcome` route remains for compatibility only.
- **Sections.** Membership priority: Blocked > Handled > Archived >
  Needs follow-up. Needs follow-up sorts oldest first by last activity. Handled,
  Archived, and Blocked sort newest first by their action timestamp when
  available, falling back to last activity. The section header is the
  staff-facing status.

### Block number vs Archive (terminology)

- **Block number** blocks the PATIENT/CALLER phone number for THIS clinic. It
  never releases or changes the clinic's own Twilio business number, never
  mutates Twilio, and never deletes history. A block suppresses future
  automation (initial recovery SMS, follow-ups, thanks courtesy, safety
  prefix — skip/return reason `patient_number_blocked`) while inbound messages
  keep being recorded for audit. Blocks live in
  `public.clinic_blocked_patient_numbers` (unique per clinic + phone,
  RLS-enabled, service-role only) and are an operator action separate from
  carrier opt-outs. STOP/START/HELP handling is unchanged. Blocking archives
  the conversation; **Unblock number** clears the block, sends nothing, and
  leaves the conversation archived until reopened. Ordinary inbound SMS from a
  phone number that has never received a recovery SMS from that clinic is
  auto-blocked with no AI/text analysis after the inbound message is recorded,
  so it appears under Blocked instead of Needs follow-up. The UI requires an
  inline confirmation that names the patient number explicitly for manual
  blocks.
- **Archive** moves a conversation to the Archived section
  (`workspace_archived_at`). It deletes nothing and is reversible with
  **Reopen**. **Mark handled** stamps `workspace_handled_at` without implying
  booked/no-booked.
- Samples use the same four sections as real cards. They show when no real
  conversations exist; with real conversations they collapse behind a
  "Show samples" strip.

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
- selected-card conversation preview with a full-timeline toggle;
- a normal browser/phone `tel:` link labeled `Call patient` (not a Twilio
  outbound call and not automation);
- explicit queue actions: Handled, Archive, Reopen, Block number, Unblock number,
  save_name, and save_note;
- no new staff invite/onboarding system in this pass;
- no new task-management system;
- no new database tables in this follow-up (the existing
  `clinic_blocked_patient_numbers` table and workspace state columns are reused).

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
| patientName            | `patient_conversations.patient_display_name`  | Sanitized; unsafe/request-like text renders as `Not provided`. |
| summaryHeadline        | deterministic request summary helper          | One line in the right detail panel; never AI-generated today. |
| summaryChips           | conversation system state                     | Only non-redundant system chips such as Automation paused / High volume; shown in the right detail panel. |
| latestMessage          | latest `messages.body` in the conversation    | Used for detail context, not shown on the left card. |
| status / section       | workspace state + derived flags               | Shown as the section header, not a repeated card badge. |
| createdAt              | `patient_conversations.created_at`            | |
| lastActivityAt         | `patient_conversations.last_message_at`       | falls back to `created_at`. |
| workspaceHandledAt / workspaceArchivedAt / blockedAt | workspace state + block join | Used for section sorting; falls back to last activity when absent. |
| timeline               | `messages` (direction, body, created_at)      | Safe columns only. |

Unknown or unsafe names render as `Not provided`. Unknown request details are not
expanded into a field table; the deterministic summary falls back to
`Review conversation`. No external AI calls, no speculative summaries, no
inferred medical details.

## 5. Queue sections

The visible queue sections are:

- **Needs follow-up** — active work, expanded by default. This includes active
  conversations whether the latest message is inbound or outbound.
- **Handled** — front desk marked the request handled and recorded whether an
  appointment was booked.
- **Archived** — staff moved the request out of the active work area; messages
  stay saved and the request can be reopened.
- **Blocked** — staff blocked the patient/caller phone number for this clinic;
  automated texts to that number stop, while inbound messages still record. The
  system also auto-blocks ordinary inbound-only SMS when that clinic has no
  prior missed-call recovery outbound to that phone number.

Membership priority:

```txt
blocked > handled > archived > needs follow-up
```

The older outbound-waiting lifecycle value remains internal logic only; it is not
a staff-facing label in the Workspace UI.

Sorting:

```txt
Needs follow-up: oldest first by last activity
Handled: newest first by handled timestamp, else last activity
Archived: newest first by archived timestamp, else last activity
Blocked: newest first by blocked timestamp, else last activity
```

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

Current sample sections included:

- Needs follow-up
- Handled
- Archived
- Blocked

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
  appointment question, insurance question, review conversation).
- sample section labels are simplified for staff scanning:
  - Needs follow-up
  - Handled
  - Archived
  - Blocked
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
