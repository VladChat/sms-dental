# 06 — UI Screens

Project: Missed-Call Recovery SaaS for Dental Clinics  
Version: MVP Build Spec v1  
Stage: 4 — UI Screens  
Primary audience: AI coding agent / technical founder / designer

---

## 1. Purpose of this file

This file defines the MVP user interface.

The product should feel like a small operational dashboard, not like a full CRM. The core job of the UI is to help a small dental clinic see missed-call recovery opportunities and act on them quickly.

The MVP UI should prioritize:

- fast triage;
- clear urgency;
- simple manual outcomes;
- setup visibility;
- minimal navigation;
- reliable operational state.

The UI should not include advanced CRM features, PMS sync, campaign builders, AI chat configuration, or multi-location hierarchy in v0.1.

---

## 2. User roles

| Role | Description | Main UI access |
|---|---|---|
| `owner` | Clinic owner or manager | All clinic screens, billing, settings, dashboard |
| `front_desk` | Clinic staff member who handles patient follow-up | Inbox, opportunity detail, limited dashboard |
| `admin` | Internal SaaS operator / founder | Admin panel, activation checklist, support tools |

---

## 3. Navigation structure

Recommended app navigation:

```txt
/dashboard
/inbox
/opportunities/[id]
/settings
/billing
/admin/clinics
/admin/clinics/[id]
```

MVP navigation labels:

```txt
Overview
Recovery Inbox
Settings
Billing
```

Internal admin navigation:

```txt
Clinics
Activation
Provider Logs
```

---

## 4. Global layout

### 4.1 App shell

The authenticated clinic app should use a simple dashboard layout:

- left sidebar or top navigation;
- clinic selector only if user belongs to more than one clinic;
- main content area;
- status banner when setup is incomplete;
- persistent environment/status indicator in non-production.

### 4.2 Header status

Show clinic operational status in the header or banner:

| Clinic status | UI treatment |
|---|---|
| `signup_started` | Yellow setup banner: “Start clinic setup.” |
| `profile_incomplete` | Yellow setup banner: “Complete clinic profile.” |
| `setup_in_progress` | Yellow setup banner: “Finish setup before going live.” |
| `a2p_pending` | Yellow compliance banner: “Messaging registration pending.” |
| `forwarding_pending` | Yellow phone banner: “Call forwarding not verified.” |
| `qa_pending` | Yellow QA banner: “Live tests not passed yet.” |
| `activation_ready` | Blue/green banner: “Ready for live activation.” |
| `trialing` | Normal app access + trial countdown |
| `active` | Normal app access |
| `past_due` | Red billing banner, keep essential inbox visible if possible |
| `paused` | Automation paused banner |
| `cancelled` | Restricted access / reactivate prompt |

### 4.3 Global empty state pattern

Use simple operational empty states.

Example:

```txt
No missed-call opportunities yet.
Once your recovery number is live, missed calls will appear here automatically.
```

### 4.4 Global error pattern

Provider/API errors should be visible but not scary.

Example:

```txt
We could not load the inbox. Please refresh. If this continues, contact support.
```

For internal admin, show more diagnostic detail.

---

## 5. Screen: Login

### Route

```txt
/login
```

### Purpose

Allow clinic users and internal admins to sign in.

### Visible to

Unauthenticated users.

### Fields

- email;
- password;
- magic link option if using Supabase Auth magic links.

### Actions

- sign in;
- forgot password;
- go to signup.

### Acceptance criteria

- user can log in with valid credentials;
- invalid credentials show a clear error;
- authenticated users are redirected to `/dashboard` or `/admin/clinics` depending on role;
- auth state persists across refresh.

---

## 6. Screen: Signup

### Route

```txt
/signup
```

### Purpose

Allow a clinic owner to start setup.

### Visible to

Unauthenticated clinic owner.

### Fields

Minimum:

- owner name;
- owner email;
- password or magic link;
- clinic name;
- main clinic phone;
- timezone.

Optional in MVP signup, can be completed later:

- website;
- address;
- emergency phone;
- average appointment value.

### Actions

- create account;
- create clinic;
- redirect to onboarding.

### Acceptance criteria

- creates `auth.users` account;
- creates `profiles` row and `clinic_memberships` row with role `owner`;
- creates `clinics` row with status `signup_started`;
- validates phone numbers into E.164 where possible;
- user lands in onboarding/settings after signup.

---

## 7. Screen: Onboarding

### Route

```txt
/onboarding
```

Alternative: integrate this into `/settings` with a setup checklist.

### Purpose

Collect required setup information and guide clinic to activation.

### Visible to

`owner`, `admin`.

### Sections

1. Clinic basics.
2. Main phone and callback destination.
3. Recovery number status.
4. Messaging compliance status.
5. Business hours.
6. Emergency instructions.
7. Live test checklist.

### Required fields

- clinic display name;
- main phone number;
- callback destination number;
- timezone;
- business hours;
- authorized contact name/email/phone;
- website/privacy/terms URLs if needed for A2P onboarding;
- emergency instruction or emergency phone fallback.

### Setup checklist

| Step | Owner-visible? | Admin-controlled? |
|---|---:|---:|
| Clinic basics completed | yes | no |
| Recovery number assigned | yes | yes |
| Messaging Service created | no or limited | yes |
| A2P submitted | yes | yes |
| A2P approved | yes | yes |
| No-answer forwarding configured | yes | assisted |
| Live missed-call test passed | yes | yes |
| Live SMS test passed | yes | yes |
| Trial activated | yes | yes |

### Acceptance criteria

- owner can save setup information;
- setup state is visible;
- app does not start trial automatically on signup;
- trial can start only after activation is ready;
- admin can update operational setup status.

---

## 8. Screen: Overview Dashboard

### Route

```txt
/dashboard
```

### Purpose

Give owner/front desk a quick view of missed-call recovery performance.

This is not an analytics suite. It should answer:

```txt
How many calls did we miss?
How many patients engaged?
How many opportunities were recovered?
What needs attention now?
```

### Visible to

`owner`, `front_desk`, `admin`.

### Date filter

Default:

```txt
Today
```

Other options:

- last 7 days;
- last 30 days;
- custom range.

### Cards / metrics

| Metric | Definition |
|---|---|
| Missed calls | Count of `missed_calls` detected in selected period |
| Recovery SMS sent | Count of automated first SMS messages sent |
| Reply rate | Inbound SMS replies / first SMS sent |
| Callback rate | Patient callbacks to recovery number / missed calls |
| Urgent incidents | Open or closed urgent opportunities |
| Appointment opportunities | Count of opportunities created |
| Booked appointments | Count marked `booked` |
| Estimated recovered revenue | Sum of booked value or default average value |
| Median first action time | Time from missed call to first front-desk action |
| Open opportunities | Count still requiring action |

### Main sections

1. Metrics cards.
2. “Needs attention” list.
3. Urgent open items.
4. Recent recovered appointments.
5. Setup/billing banner if needed.

### Actions

- open Recovery Inbox;
- open urgent opportunity;
- change date filter;
- go to setup if not live.

### Empty state

```txt
No missed-call data yet.
Complete setup and run a live missed-call test to start tracking recovery opportunities.
```

### Acceptance criteria

- metrics load for current clinic only;
- date filter updates all cards;
- urgent open items are clearly visible;
- clicking a row opens opportunity detail;
- front-desk users do not see billing/admin-only controls.

---

## 9. Screen: Recovery Inbox

### Route

```txt
/inbox
```

### Purpose

Primary working screen for front desk.

This screen shows open missed-call recovery conversations and opportunities.

### Visible to

`owner`, `front_desk`, `admin`.

### Default sort

1. urgent first;
2. awaiting front-desk action;
3. newest missed call;
4. newest message.

### Filters

MVP filters:

- status: open, engaged, handoff pending, booked, lost;
- urgency: urgent, normal;
- intent: new patient, existing patient, cleaning, reschedule, appointment request, unknown;
- date range;
- assigned to me / all.

### List columns

| Column | Source |
|---|---|
| Patient | `patients.phone_e164`, optional name |
| Intent | `conversations.intent` or `appointment_opportunities.intent` |
| Urgency | `conversations.urgency` |
| Status | opportunity/conversation state |
| Last message | latest `messages.body_redacted` |
| Missed at | `missed_calls.detected_at` in clinic timezone |
| Last activity | `conversations.last_message_at` |
| Assigned | `conversations.owner_user_id` |

### Row badges

- `Urgent`;
- `New patient`;
- `No reply`;
- `Callback`;
- `Booked`;
- `Opted out`.

### Row actions

- open opportunity;
- mark contacted;
- mark booked;
- mark lost;
- pause automation.

### Empty state

```txt
No open recovery opportunities.
New missed calls will appear here automatically.
```

### Acceptance criteria

- only records for current clinic are visible;
- urgent items appear at the top;
- row actions update status without full page reload;
- opted-out patients are visibly marked;
- closed items can be filtered but do not clutter the default view.

---

## 10. Screen: Opportunity Detail

### Route

```txt
/opportunities/[id]
```

### Purpose

Show the full context for one missed-call recovery incident.

This is the working detail page for a patient conversation and manual outcome.

### Visible to

`owner`, `front_desk`, `admin`.

### Header

Show:

- patient phone;
- optional patient name;
- intent;
- urgency;
- current status;
- missed-call time;
- assigned user.

### Main panels

#### 10.1 Conversation timeline

Show chronological events:

- missed call detected;
- first SMS sent;
- delivery status;
- inbound patient reply;
- follow-up sent/skipped/cancelled;
- callback attempt;
- front-desk actions;
- booked/lost outcome.

#### 10.2 Message history

Show SMS messages:

- outbound automated;
- inbound patient;
- delivery status;
- opt-out indicators.

For MVP, manual outbound texting is optional. If included, it must respect opt-out.

#### 10.3 Call log

Show:

- original forwarded missed call;
- callback bridge attempts;
- child call status;
- answered/completed timestamps;
- duration if available.

#### 10.4 Opportunity outcome

Fields:

- status;
- booked/lost;
- booked date/time;
- booked value;
- front desk notes;
- lost reason.

#### 10.5 Follow-up schedule

Show upcoming follow-ups:

- step key;
- scheduled time;
- job status;
- cancellation reason.

### Actions

- mark contacted;
- mark booked;
- mark lost;
- add note;
- assign owner;
- pause automation;
- resume automation if allowed;
- copy patient phone;
- call patient manually outside app if needed.

### Mark booked modal

Fields:

- booked date/time optional;
- estimated or actual booked value;
- note optional.

Default booked value:

```txt
clinics.avg_recovered_value_cents
```

### Mark lost modal

Fields:

- reason:
  - no response;
  - not interested;
  - wrong number;
  - already handled;
  - duplicate;
  - other;
- note optional.

### Acceptance criteria

- page loads all related incident data;
- marking booked updates opportunity, missed_call, conversation and dashboard metrics;
- marking lost closes the opportunity and cancels follow-ups;
- notes are saved with actor and timestamp;
- front desk cannot access another clinic's opportunity.

---

## 11. Screen: Settings

### Route

```txt
/settings
```

### Purpose

Allow clinic owner/admin to configure operational settings.

### Visible to

`owner`, `admin`.  
`front_desk` may have read-only or limited access.

### Sections

#### 11.1 Clinic profile

Fields:

- clinic name;
- display name for SMS;
- timezone;
- website;
- address optional.

#### 11.2 Phone setup

Fields:

- main clinic phone;
- callback destination phone;
- recovery phone number read-only for clinic users;
- forwarding instructions;
- test status.

Actions:

- copy recovery number;
- send test SMS;
- run missed-call test checklist;
- update callback destination.

#### 11.3 Business hours

Fields:

- open/closed per weekday;
- opening time;
- closing time;
- holiday override later, not required in MVP.

#### 11.4 Emergency / urgent instructions

Fields:

- urgent dental instruction text;
- emergency phone;
- 911 disclaimer for life-threatening emergencies.

MVP should not generate diagnosis or medical advice.

#### 11.5 SMS templates

Show default templates.

MVP options:

- read-only templates for clinic users; or
- admin-editable only.

For first pilots, keep admin approval required before patient-facing template changes go live.

#### 11.6 Automation settings

Fields:

- automation enabled;
- first SMS delay seconds;
- follow-up 1 delay minutes;
- follow-up 2 next business day time;
- callback timeout seconds.

Recommended MVP default:

```txt
first SMS delay: 15 seconds
follow-up 1: 15 minutes
follow-up 2: next business day at 9:00 AM
callback timeout: 15 seconds
```

### Acceptance criteria

- owner can update allowed settings;
- changes are audit logged;
- phone fields are normalized to E.164;
- dangerous template changes are not allowed without admin review;
- business hours save and drive after-hours SMS behavior.

---

## 12. Screen: Billing

### Route

```txt
/billing
```

### Purpose

Show subscription and provide Stripe Customer Portal access.

### Visible to

`owner`, `admin`.

### Data shown

- subscription status;
- trial status;
- trial end date;
- current plan;
- next invoice date if available;
- payment status.

### Actions

- start trial if clinic is `activation_ready`;
- open Stripe Checkout;
- open Stripe Customer Portal;
- update payment method through Stripe;
- cancel through Stripe portal.

### Important rule

Do not start free trial at signup.

Trial starts only after:

- recovery number assigned;
- messaging setup ready;
- forwarding test passed;
- live SMS test passed;
- admin/ops marks clinic activation-ready.

### Acceptance criteria

- billing page reflects local `subscriptions` table state;
- Stripe Checkout only appears when clinic is eligible;
- Customer Portal opens for existing Stripe customer;
- past due status shows a clear banner.

---

## 13. Screen: Internal Admin Clinic List

### Route

```txt
/admin/clinics
```

### Purpose

Give internal operators/founder a concierge-control panel for the first 5–10 clinics.

### Visible to

`admin` only.

### List columns

| Column | Source |
|---|---|
| Clinic | `clinics.name` |
| Status | `clinics.status` |
| Main phone | `clinics.main_phone_e164` |
| Recovery phone | `clinics.recovery_phone_e164` / `phone_numbers.e164` |
| A2P status | admin/status field |
| Subscription | `subscriptions.status` |
| Open urgent | count from opportunities |
| Last missed call | latest `missed_calls.detected_at` |
| Created | `clinics.created_at` |

### Filters

- status;
- A2P pending;
- activation ready;
- live clinics;
- past due.

### Actions

- open clinic admin detail;
- copy setup info;
- mark status;
- view provider logs.

### Acceptance criteria

- only admins can access;
- list loads quickly;
- filters help identify blocked clinics;
- no patient PHI/details are exposed unnecessarily in the list.

---

## 14. Screen: Internal Admin Clinic Detail

### Route

```txt
/admin/clinics/[id]
```

### Purpose

Operate concierge onboarding, Twilio setup, activation QA and support.

### Visible to

`admin` only.

### Sections

1. Clinic profile.
2. Phone configuration.
3. Twilio configuration.
4. Messaging/A2P status.
5. Activation checklist.
6. Recent calls/messages.
7. Provider logs.
8. Manual notes.
9. Subscription status.

### Admin fields

- recovery number;
- Twilio phone number SID;
- Messaging Service SID;
- A2P campaign SID;
- A2P status;
- activation checklist booleans;
- internal notes.

### Admin actions

- assign recovery number;
- update provider IDs;
- send test SMS;
- mark A2P submitted;
- mark A2P approved;
- mark forwarding test passed;
- mark live SMS test passed;
- mark activation ready;
- start/trigger trial flow if eligible;
- disable clinic in emergency.

### Acceptance criteria

- admin can complete first-clinic setup without direct DB editing;
- every status change creates audit log;
- test SMS cannot be sent to opted-out patients;
- activation cannot be marked ready until required checklist items are complete.

---

## 15. Component inventory

MVP components:

| Component | Used in |
|---|---|
| `MetricCard` | Dashboard |
| `StatusBadge` | Dashboard, Inbox, Detail, Admin |
| `UrgencyBadge` | Inbox, Detail |
| `IntentBadge` | Inbox, Detail |
| `ConversationList` | Inbox |
| `ConversationTimeline` | Opportunity Detail |
| `MessageBubble` | Opportunity Detail |
| `CallEventRow` | Opportunity Detail |
| `OpportunityActions` | Inbox, Detail |
| `MarkBookedDialog` | Detail |
| `MarkLostDialog` | Detail |
| `SetupChecklist` | Onboarding, Admin Detail |
| `BusinessHoursEditor` | Settings |
| `PhoneNumberInput` | Signup, Settings |
| `TemplatePreview` | Settings |
| `BillingStatusCard` | Billing, Dashboard |
| `AdminClinicTable` | Admin List |

---

## 16. Data loading notes

### 16.1 Clinic scoping

Every app query must be scoped to the current clinic.

Do not rely only on frontend filters. Use Supabase RLS and server-side checks.

### 16.2 Realtime updates

Realtime is useful but optional for v0.1.

Recommended MVP:

- use polling or refresh for dashboard;
- use short polling or Supabase realtime for inbox if easy;
- do not block launch on realtime.

### 16.3 Optimistic updates

Allowed for simple actions:

- mark contacted;
- mark booked;
- mark lost;
- pause automation.

If API fails, revert and show error toast.

---

## 17. UX rules

### 17.1 Urgent items

Urgent conversations must be visually obvious and sorted above normal conversations.

Use direct language:

```txt
Urgent dental issue — front desk action needed.
```

Do not display medical diagnosis language.

### 17.2 Opt-out items

If patient opted out:

- show `Opted out` badge;
- disable automated/manual SMS sending;
- allow call/manual note/outcome actions.

### 17.3 Closed items

Default inbox should show open items only.

Booked/lost items are visible through filters and dashboard recent activity.

### 17.4 No CRM creep

Avoid fields such as:

- insurance;
- treatment plan;
- dental chart;
- medical history;
- X-rays;
- prescriptions;
- PMS appointment IDs.

Those are intentionally out of MVP scope.

---

## 18. MVP screen acceptance checklist

The UI is MVP-ready when:

- owner can sign up and create clinic;
- clinic setup state is visible;
- missed calls appear in inbox;
- patient replies appear in opportunity detail;
- urgent opportunities are prioritized;
- front desk can mark booked/lost;
- dashboard reflects outcomes;
- owner can update settings;
- billing/trial status is visible;
- admin can manage concierge activation;
- no full CRM/PMS/AI receptionist features are included.
