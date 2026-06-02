# Platform Admin Console — Architecture & Implementation Plan

Status: v2 PRODUCT DIRECTION UPDATE (2026-06-01) — read-only clinic detail is
deprecated as the target UX. The admin clinic detail page must become an editable
super-admin clinic management console: owner-level controls scoped by clinicId,
plus platform-only controls, diagnostics, audit, internal notes, and launch
operations.
Last updated: 2026-06-01
Scope: architecture/spec plus implemented foundations (platform-admin auth guard,
`/admin/login`, console pages, audit log, safe clinic actions). Cross-tenant admin
auth remains mandatory for all `/admin` pages and `/api/admin/*` routes. Twilio
purchase, A2P submission, and Stripe management remain blocked-with-reason until
their real backends exist.

> Three distinct surfaces — do not mix:
> - `/account` — **clinic owner/admin** setup & account dashboard (per-clinic).
> - `/workspace` — **front-desk staff** operational view (per-clinic).
> - `/admin` — **platform owner/operator** console (cross-tenant). ← this plan.

## Product decision: clinic detail is an editable super-admin management console

- `/account` is the owner-facing dashboard.
- `/admin/clinics/[clinicId]` must expose the same practical owner controls
  directly inside admin, scoped by `clinicId`.
- Platform admins must be able to edit existing Business Profile fields and
  existing A2P/representative fields from admin.
- Platform admins must see and manage phone number state, billing state, SMS
  approval state, SMS behavior state, launch readiness, and operational blockers
  from the same admin page.
- Admin-only tools live in the same console but below/around the owner-level
  management workflow: launch controls, pause/reactivate, diagnostics, audit log,
  internal notes, technical IDs.
- Technical data must be compact and secondary, not the main page experience.
- The page must not become a long read-only database dump.

---

## 1. Executive summary

`/admin` is the platform owner/operator console, and
`/admin/clinics/[clinicId]` is not an inspection page. It is the editable
super-admin clinic management console.

The admin must be able to manage clinics directly from this page using owner-level
editable controls (Business Profile fields and A2P/SMS approval fields) plus
platform-only controls for launch operations, diagnostics, audit history, internal
notes, and compact technical context.

Dangerous integrations remain gated until real backends exist. Twilio number
purchase/provisioning, A2P carrier submission, and Stripe management must stay
disabled with exact blocker reasons; they must never be simulated.

---

## 2. Current-state findings (verified in repo)

### 2.1 Identity / access
- `profiles.is_internal_admin boolean not null default false` exists
  (`supabase/migrations/20260531000100_auth_profiles_memberships.sql`) and is
  surfaced on `ProfileRow` (`lib/db/profiles.ts`) but **read by no guard** today.
- `clinic_memberships.role` ∈ `owner | front_desk | admin` — note `admin` here is
  a **clinic** admin (per-clinic), NOT a platform admin. Platform admin must be a
  separate concept.
- `resolveAuthClinicAccess()` (`lib/auth/access.ts`) requires an **active clinic
  membership** → wrong guard for platform admins (who may have no membership).
- No `app/admin/**`, no `PLATFORM_ADMIN*` env, no `admin_audit*` anything exists.
- Server DB access uses the service-role pooled connection (`lib/db/client.ts`
  `getDb()`), which **bypasses RLS** — correct for cross-tenant admin reads, but
  it means the admin guard is the ONLY thing protecting cross-tenant data.

### 2.2 Data already available (no migration to read)
`clinics` (one row per tenant) already has:
- identity: `id, name, slug, timezone, is_active, created_at, updated_at`
- onboarding/contact: `legal_business_name, main_phone, owner_contact_name,
  owner_contact_email, owner_contact_phone, test_patient_phone, setup_status,
  country, city, state_region, postal_code, address_line2, preferred_area_code`
- business info: `ein_tax_id, business_type, street_address, website,
  business_info_completed`
- A2P: `a2p_rep_first_name, a2p_rep_last_name, a2p_rep_business_title,
  a2p_rep_email, a2p_rep_phone, a2p_authorized, a2p_info_completed`
- status/lifecycle: `local_number_status (preparing|reserved|assigned)`,
  `sms_status (preparing|waiting_for_approval|active)`,
  `billing_status (not_started|trialing|active|past_due|canceled)`,
  `trial_started_at, trial_ends_at, stripe_customer_id, stripe_subscription_id`
- SMS safety gate: `sms_recovery_enabled` (default false), `is_active`

Supporting tables: `clinic_phone_numbers` (phone↔clinic, role, is_active, SID),
`patient_conversations` (+ `front_desk_outcome/note/outcome_at`), `messages`
(direction, body, status, error_code/message, detected_keyword, raw_payload),
`call_events` (from/to, call_status, is_missed, raw_payload), `webhook_events`
(provider, event_type, external_id, **payload jsonb — raw**, received_at),
`opt_outs`, `setup_requests` (status, owner_email, completed_at, email_status),
`clinic_memberships`, `profiles`.

### 2.3 Gaps relevant to admin
- **No audit table** for admin actions.
- **No internal admin note** field (the `owner_contact_*` fields are clinic-facing).
- **No "list all clinics" / cross-tenant query helpers** in `lib/db/clinics.ts`.
- Raw payloads (`webhook_events.payload`, `messages.raw_payload`,
  `call_events.raw_payload`) exist and **must be redacted** in any admin view.
- Billing is inert (Stripe ingress-only), number purchase is gated off, A2P is not
  submitted, live SMS is gated — so several admin actions are blocked by design
  (see audit `PRODUCTION-READINESS-PLACEHOLDER-AUDIT.md`).

---

## 3. Recommended admin access model

**Recommendation: hybrid bootstrap — env allowlist + durable `is_internal_admin`.**

A request is a **platform admin** iff:
1. there is an authenticated Supabase session (`auth.getUser()`), AND
2. the user's email is in `PLATFORM_ADMIN_EMAILS` (comma-separated, non-secret
   operator allowlist in committed runtime config or Vercel env) **OR** the
   user's `profiles.is_internal_admin = true`.

### Login entry points (REQUIRED product decision — 2026-06-01)

**One underlying auth system, separate role-specific login pages.** All three
audiences authenticate against the **same Supabase Auth** users — there is no
separate admin password store and no second auth system. What differs is the
**entry point** and the **post-login redirect**, each enforced server-side.

| Audience | Login route | Success target | Access requirement |
|---|---|---|---|
| Platform admin | `/admin/login` | `/admin` | authenticated user **+** platform-admin authorization (`PLATFORM_ADMIN_EMAILS` or `profiles.is_internal_admin`) |
| Clinic owner | `/login` (today; the plan permits a later rename to `/account/login` as the clearer long-term owner route) | `/account` | active clinic `owner`/`admin` membership |
| Front desk | `/workspace/login` | `/workspace` | active `front_desk` membership |

**Authorization rules (must be documented + enforced server-side):**
- Platform-admin access is **not** granted by clinic `owner` role.
- Clinic-owner access is **not** granted by platform-admin status.
- Front-desk access is limited to `/workspace`; front-desk users must **not** see
  `/account`, `/admin`, billing, EIN/legal business info, SMS approval controls,
  or platform diagnostics.
- Clinic owners must **not** see `/admin`.
- `/admin` and `/api/admin/*` protected server-side (`resolvePlatformAdmin`).
- `/workspace` and `/api/workspace/*` protected server-side (front-desk/owner
  membership).
- `/account` and `/api/account/*` protected server-side (owner/admin membership).

**Password / reset behavior:**
- Every user has a normal Supabase Auth email/password account; there is **no
  separate "admin password"** outside Supabase Auth.
- The platform admin signs in with their Supabase Auth email via `/admin/login`.
- Password reset stays tied to the Supabase Auth user email (existing
  `/forgot-password` → `/auth/callback` → `/reset-password` flow).
- Each login/reset form must use correct password-manager `autocomplete`
  attributes (`email` / `current-password` / `new-password`) so browsers do not
  confuse the role-specific forms.

> **TO-DO (implementation):** Implement separate role-specific login pages:
> `/admin/login`, `/workspace/login`, and the clinic owner login entry for
> `/account`, all backed by one Supabase Auth system with strict server-side role
> redirects.

### Why this option
- `is_internal_admin` already exists → durable, table-managed source of truth with
  **zero migration** to start.
- An env/config allowlist solves the **bootstrap chicken-and-egg**: the first admin
  must exist before any UI can grant admin. It also gives an instant "break-glass"
  path if the DB flag is wrong.
- Avoids a separate `platform_admins` table for MVP (the flag + allowlist are
  enough). A dedicated table can come later if we need admin roles/scopes.

### Why clinic `owner` is not enough
Owner access is **per-clinic** via `clinic_memberships` and only ever exposes that
clinic's data through `resolveAuthClinicAccess`. Platform admin is **cross-tenant**
and must never be implied by owning one clinic.

### Server-side protection
- New guard `resolvePlatformAdmin()` in `lib/auth/platform-admin.ts` (future):
  `getUser()` → load profile by id → admin iff `is_internal_admin` or email ∈
  allowlist. Returns `{ ok, profileId, email }` or `{ ok:false, reason }`.
- `/admin` uses a **server layout** (`app/admin/layout.tsx`) that calls the guard
  and `redirect("/admin/login")` (or renders a minimal "not authorized" page) when
  not an admin. Every `app/api/admin/**` route calls the same guard first and
  returns `401/403` JSON otherwise. No client-only gating.
- Front-desk users (`is_internal_admin=false`, not in allowlist) and clinic owners
  are rejected by the same checks.

### Bootstrap (no DB write required)
- **First platform admin:** `allyexporter@gmail.com`. **Do not hardcode this email
  in source code.** Provide it via `PLATFORM_ADMIN_EMAILS` in local/Vercel
  environment configuration; `.env.local.example` may carry the variable **name
  only** (no value) when implementation begins.
- Set `PLATFORM_ADMIN_EMAILS` to the operator email(s). Because the app base/admin
  allowlist is **non-secret config**, prefer `config/runtime.config.ts`
  (`platform.adminEmails`) per the project's env-ownership rule; a Vercel env is
  also acceptable. The owner email is not a secret.
- Optionally, later, a one-time `update public.profiles set is_internal_admin=true
  where lower(email)=lower('<owner>')` via Supabase SQL editor (operator action,
  documented — not run in this planning pass).

### Migration for access
**None required to begin.** A future "Manage admins" screen that grants/revokes
`is_internal_admin` is the only thing that writes it (Phase 6).

---

## 4. Proposed routes / pages

All under `app/admin/**`, server components, `force-dynamic`, `runtime=nodejs`,
`robots: noindex`. Guarded by the admin layout. Data via service-role `getDb()`
through `lib/db/admin/*` helpers (cross-tenant), never exposing secrets/raw
payloads.

| Route | Purpose | Data sources | Key UI | Filters | Actions | Access |
|---|---|---|---|---|---|---|
| `/admin/login` | Platform-admin sign-in (Supabase Auth) | Supabase Auth | email + password form, correct `autocomplete`, forgot-password link | — | sign in → `/admin` (only if platform-admin authorized) | public page; non-admins are signed in but not authorized → denied at `/admin` |
| `/admin` | Operations overview | aggregate counts over `clinics`, recent `messages`/`call_events`/`webhook_events` failures | KPI cards (total clinics, needs-action, SMS active/disabled, billing-ready, phone pending, trial ending), recent-errors list | time range | none (links only) | platform admin |
| `/admin/clinics` | All clinics | `clinics` (+ joined latest phone/membership counts) | searchable/sortable table: name, slug, setup_status, sms_status, billing_status, local_number_status, is_active, trial_ends_at | search (name/email/slug), status filters, active/inactive | row → detail | platform admin |
| `/admin/clinics/[clinicId]` | Editable super-admin clinic management console | `clinics`, `clinic_phone_numbers`, `clinic_memberships`+`profiles`, recent `call_events`/`messages`/`opt_outs`, latest `setup_requests` | launch checklist; editable Business Profile; editable A2P/SMS approval data; Phone Number management; Billing management state; SMS behavior/settings state; admin controls; diagnostics; audit; technical details | activity type | edit existing owner-level fields; save audited admin changes; pause/reactivate; launch/pause SMS when gates pass; future gated actions for number purchase, A2P submit, Stripe management | platform admin |
| `/admin/clinics/[clinicId]/events` | Operational diagnostics | `webhook_events` (redacted), `call_events`, `messages` (redacted bodies optional) | event log table with type/status/time, expandable **redacted** detail | provider/type/status/date | none (read) | platform admin |
| `/admin/audit` | Platform admin audit log | `admin_audit_events` (Phase 2) | table: time, actor, action, target, summary | actor/action/clinic/date | none | platform admin |
| `/admin/settings` | Platform settings (reserved) | config + `PLATFORM_ADMIN_EMAILS`; later manage-admins | read-only config view; later: grant/revoke admin | — | (Phase 6) | platform admin |

For each page: **empty states** ("No clinics yet", "No events", "No audit entries
yet"); **error states** (DB read failure → inline "Couldn't load …, retry");
**responsive** (tables collapse to stacked cards < ~860px, same pattern as
`/workspace`); **access** = admin guard on the layout (defense-in-depth on each
data fetch).

---

## 5. Proposed database additions (for future implementation, not this pass)

### 5.1 `admin_audit_events` (NEW) — needed for any write action
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk default gen_random_uuid() | |
| `actor_profile_id` | uuid null references profiles(id) | null when actor authed via env allowlist only |
| `actor_email` | text not null | always captured (lowercased) |
| `action` | text not null | e.g. `clinic.deactivate`, `clinic.sms_recovery.disable`, `clinic.note.update` |
| `target_type` | text not null | e.g. `clinic`, `clinic_phone_number` |
| `target_id` | text null | id of the target |
| `clinic_id` | uuid null references clinics(id) on delete set null | for clinic-scoped filtering |
| `summary` | text null | short human description |
| `metadata` | jsonb not null default '{}' | **non-secret, redacted** before/after values only |
| `created_at` | timestamptz not null default now() | |

Indexes: `(created_at desc)`, `(clinic_id, created_at desc)`, `(action)`.
Constraints: RLS enabled; no policies (service-role only).
Sensitivity: medium — never store secrets/tokens/raw payloads/patient bodies in
`metadata`. **In the historical v1 implementation**, this table was only required
once write actions were introduced. Append-only by convention
(no update/delete from app).

### 5.2 `clinics.admin_internal_note` (NEW field) — category B (small)
- `add column if not exists admin_internal_note text;`
- `add column if not exists admin_internal_note_updated_at timestamptz;`
- Purpose: operator notes not visible to the clinic. Sensitivity: low/medium (not
  customer-facing). Needed for the "update internal admin note" action. In the
  historical v1 implementation, it was not required for pure read paths.

### 5.3 Optional `clinics.provisioning_review boolean default false` — category B
- Flags "phone provisioning needs review". Optional; can also be expressed as an
  audit event + filter. Not blocking.

> No other tables/fields are required. Everything else is read from existing
> columns. **Prefer creating 5.1 + 5.2 together in one migration when Phase 2
> starts.**

---

## 6. Admin action matrix

Categories: **A** ready in v1 on current schema · **B** small migration/helper
first · **C** blocked on Stripe · **D** blocked on Twilio purchase flow · **E**
blocked on A2P/carrier submission · **F** keep manual.

> All write actions require: admin guard → preconditions → idempotency → explicit
> confirmation (typed confirmation for destructive) → `admin_audit_events` row →
> documented rollback. Read actions require the guard + redaction only.
> Owner-level data edits from admin are real management actions and must be
> audited.

| Action | Category | Purpose | Preconditions | Server validation | Idempotency | Confirm | Audit event | Rollback | Customer effect | In v1? |
|---|---|---|---|---|---|---|---|---|---|---|
| View clinic diagnostics (calls/SMS/webhooks) | A | Triage | admin | read-only, redact payloads/bodies | n/a | no | optional `*.viewed` | n/a | none | **Yes (read)** |
| View public business/compliance pages | A | Verify pages | admin; clinic has slug | link to `/business/{slug}` | n/a | no | none | n/a | none | **Yes** |
| Update business profile from admin | B | Real clinic management from `/admin/clinics/[clinicId]` | admin; clinic exists | validate against existing owner field rules; update existing `clinics` business/profile columns only unless a later migration is explicitly approved | no-op if payload is unchanged | yes | `clinic.business_profile.update` | restore previous values from audit metadata | updates owner-facing profile data | Next milestone |
| Update A2P/representative data from admin | B | Real compliance-data management from `/admin/clinics/[clinicId]` | admin; clinic exists | validate against existing owner field rules; update existing A2P/representative columns only unless a later migration is explicitly approved | no-op if payload is unchanged | yes | `clinic.a2p_profile.update` | restore previous values from audit metadata | updates owner-facing A2P data | Next milestone |
| Update internal admin note | B | Ops memory | admin; note col exists | trim, length cap | last-write-wins; no-op if unchanged | no | `clinic.note.update` | restore previous (in audit metadata) | none | Phase 2 |
| Mark phone provisioning review | B | Flag for follow-up | admin; flag col | boolean set | idempotent set | no | `clinic.provisioning_review.set` | unset | none | Phase 2 (optional) |
| Deactivate clinic (`is_active=false`) | B | Kill switch (stops lookups/SMS) | admin; currently active | set false; safe-direction | no-op if already inactive | **yes (typed)** | `clinic.deactivate` | reactivate | recovery stops immediately | Phase 2 |
| Reactivate clinic (`is_active=true`) | B | Restore | admin; currently inactive | set true | no-op if already active | yes | `clinic.reactivate` | deactivate | lookups resume (SMS still gated) | Phase 2 |
| Disable SMS recovery (`sms_recovery_enabled=false`) | B | Safe stop of texting | admin | set false (always safe) | no-op if already false | yes | `clinic.sms_recovery.disable` | enable | outbound recovery stops | Phase 2 |
| Enable SMS recovery (`sms_recovery_enabled=true`) | B+E | Turn texting on | admin; `sms_status='active'`; A2P/carrier approved; `SMS_RECOVERY_MODE=live` (ops); number assigned | block unless all preconditions; never bypass opt-outs/gates | no-op if already true | **yes (typed)** | `clinic.sms_recovery.enable` | disable | live patient SMS becomes possible | **No** (after E) |
| Assign existing Twilio number to clinic | B | Map an already-owned number | admin; number owned in Twilio; no active mapping | upsert `clinic_phone_numbers`; verify ownership | unique phone; no-op if same | yes | `clinic.number.assign` | unassign | clinic shows assigned number | Phase 2 (mapping only) / D for real provisioning |
| Purchase Twilio number for clinic | D | Buy + configure number | admin; billing-ready; purchase flow enabled | reuse `purchaseNumberAndConfigure`; `TWILIO_NUMBER_PURCHASE_ENABLED` | clinic-level idempotent (existing) | **yes (typed)** | `clinic.number.purchase` | release (manual) | new number + webhooks | **No** (after D) |
| Release/unassign number | B (unassign) / D (release in Twilio) | Remove mapping / free number | admin; mapping exists | unassign = set `is_active=false`; release = Twilio API | idempotent | **yes (typed)** | `clinic.number.release` | reassign | number no longer used | Phase 2 (unassign) / D (release) |
| Mark A2P submitted / approved / rejected | E (real) / B (manual flag) | Track compliance | admin | set `sms_status`/flags; operator-asserted until carrier sync | idempotent | yes | `clinic.a2p.mark_*` | revert status | status display changes | **No** for true sync (after E); manual mark possible Phase 2 |
| Start billing (after SMS active) | C | Begin paid subscription | admin; Stripe wired; SMS active; payment method on file | create/activate subscription via Stripe | idempotent on subscription id | **yes (typed)** | `clinic.billing.start` | pause/cancel | customer billed per terms | **No** (after C) |
| Pause billing | C | Stop charges | admin; subscription exists | Stripe pause/cancel | idempotent | yes | `clinic.billing.pause` | resume | charges stop | **No** (after C) |
| Resend setup link | B | Re-send onboarding email | admin; setup_request exists; rate-limited | reuse Resend sender; new token; never log token | rate-limit per clinic | yes | `clinic.setup_link.resend` | n/a (link expires) | owner gets a new email | Phase 2 (with rate limit) |

> **Product-billing rule (reaffirmed):** never start paid billing before automatic
> SMS recovery is active. The "Enable SMS recovery" and "Start billing" actions
> encode that ordering.

---

## 7. Production-near scope

Production-near admin clinic detail must become a real management console before
Twilio purchase, A2P submission, and Stripe billing are connected. The next admin
UX milestone is editable owner-level management inside
`/admin/clinics/[clinicId]`.

Implement now in production-near scope:
- keep strict platform-admin guard for `/admin` and all `/api/admin/*`;
- keep `/admin/clinics/[clinicId]` as the direct management surface;
- add audited admin save paths for existing owner-level editable fields
  (Business Profile + A2P/representative) using existing columns/validation;
- keep diagnostics, audit, internal notes, launch controls, and compact technical
  context in the same page.

Remain blocked (disabled with explicit blockers, never faked):
- Twilio number purchase/provisioning actions stay blocked until the real backend
  exists.
- A2P carrier submission/sync actions stay blocked until the real backend exists.
- Stripe billing management actions stay blocked until the real backend exists.

Rule: if the owner can edit a field in `/account` today and the backend path
already exists, admin clinic detail should not remain read-only for that field.

---

## 8. Blocked dependencies (and the prerequisite that unblocks each)
- **Billing actions** ← Stripe payment-method collection + subscription/webhook
  handlers (audit B1).
- **Purchase/release number** ← Twilio purchase flow + `TWILIO_NUMBER_PURCHASE_ENABLED`
  (audit B2).
- **Enable live SMS / real A2P status** ← A2P/toll-free submission + carrier
  approval + `SMS_RECOVERY_MODE=live` (audit B3/B4).
- **All write actions** ← `admin_audit_events` migration (Phase 2).

---

## 9. Existing-feature protection plan

`/admin` is **purely additive** (new `app/admin/**` tree + new `app/api/admin/**`
+ new `lib/db/admin/*` + new guard). It must not modify shared product code paths.

| Area | How it stays safe | QA before merge |
|---|---|---|
| `/account` (owner) | Untouched; admin guard is separate from `resolveAuthClinicAccess` | Owner can still sign in, view/save profile, see correct data |
| `/workspace` (front desk) | Untouched | Front-desk cannot reach `/admin` (redirected); workspace still loads |
| Setup/onboarding | Untouched; "resend setup link" reuses existing sender without changing token logic | New setup link still works; idempotency intact |
| Login/reset password | Untouched | Login/forgot/reset still work |
| Twilio webhooks | Read-only in admin; webhook routes unchanged | Voice/SMS webhooks still 200; events still recorded |
| SMS opt-out logic | Admin never bypasses `opt_outs`; enabling SMS still respects all gates | STOP/START still enforced |
| owner-test/live SMS gates | Admin "enable" action keeps `SMS_RECOVERY_MODE` + `sms_recovery_enabled` + opt-out checks | No SMS sent without all gates |
| Public business/compliance pages | Admin only links to them | Pages still render |
| Marketing handoff | Untouched | Sign in / Start trial still hand off to app |

Cross-cutting QA: confirm a clinic **owner** and a **front-desk** user both get
denied at `/admin` and every `/api/admin/*` route (server-side), and that a
platform admin with **no** clinic membership is allowed.

---

## 10. Security & privacy plan
- Admin data via service-role `getDb()` (bypasses RLS) **only** behind
  `resolvePlatformAdmin`; the guard is the sole cross-tenant gate, so it is
  mandatory on the layout AND every admin API route.
- **No secrets in UI** (no service-role key, Twilio/Stripe keys, DB URLs).
- **No raw tokens** (setup tokens, recovery tokens) ever displayed or logged.
- **No raw webhook/message payloads**: `webhook_events.payload`,
  `messages.raw_payload`, `call_events.raw_payload` are redacted to safe fields
  (type, status, timestamp, masked numbers). Phone numbers masked where feasible.
- **Patient message bodies**: shown to platform admin only for diagnostics, kept
  minimal; prefer status/keyword over full body where the task allows; treat as
  sensitive. (Open question §13 on exact policy.)
- **Audit logging** for every write (`admin_audit_events`); consider logging
  high-value reads.
- **Confirmations**: destructive/irreversible-ish actions require a typed
  confirmation (e.g., type the clinic slug); reversible toggles require a simple
  confirm dialog.
- **Idempotency**: every mutation is a safe no-op when already in the target state.
- **Rate limiting / abuse prevention**: throttle admin mutation endpoints
  (especially "resend setup link" → email) per actor/clinic; log repeated denials.
- **Separation of roles**: platform admin ≠ clinic owner ≠ front desk; identity
  comes from `is_internal_admin`/allowlist, never from clinic membership.
- Consider (open questions): admin 2FA, separate admin host, audit retention.

---

## 11. UI/UX plan
- Reuse the existing design system (`.card`, `.badge`, `.btn`, status tones,
  `.acct-*`/table patterns). No new framework.
- **Status badges** mirror the account vocabulary: `Complete`, `Active`,
  `Waiting for approval`, `Needs setup`, `Needs action`, `Not started`,
  `Not active`, `Error`. Red only for real errors/destructive.
- **Action groups**: separate "Safe" (note, view) from "Caution" (deactivate,
  disable SMS) from "Blocked" (billing/purchase/enable-SMS until prerequisites).
- **Destructive styling**: red outline/solid only for deactivate / release /
  enable-live-SMS; confirmation dialog with a typed token for these.
- **Disabled/blocked states only when truly blocked**, each with a one-line reason
  ("Connect Stripe to enable", "Blocked until A2P approved") — never a fake modal.
- **Feedback**: inline success/error alerts (toasts optional); optimistic UI only
  after server confirms.
- **Empty/error states** per page (§4).
- **Responsive**: tables → stacked cards on narrow screens.
- **Accessibility**: dialogs are focus-trapped, ESC-closable, labeled; all actions
  keyboard-reachable; status conveyed by text+icon, not color alone.
- Concise copy examples: "Deactivate clinic", "Disable SMS recovery",
  "Payment actions available after Stripe is connected", "No clinics need action."

---

## 12. Implementation roadmap

| Phase | Title | Objective | Files likely touched | Migration | Validation | Manual QA | Risk | Commit message |
|---|---|---|---|---|---|---|---|---|
| 1 | Platform admin console foundation + `/admin/login` | Cross-tenant visibility + server-side platform-admin auth baseline | `lib/auth/platform-admin.ts`, `app/admin/{layout,page}.tsx`, `app/admin/login/*`, `app/admin/clinics/*`, `lib/db/admin/*`, `config/runtime.config.ts` (adminEmails), `app/globals.css` | none | typecheck, build | owner/front-desk denied at `/admin`; admin (no membership) allowed; `/admin/login` signs in then authorizes; data correct; redaction verified | medium | `feat: add platform admin console foundation` |
| 2 | Audit log + safe clinic actions | Note, deactivate/reactivate, disable SMS, resend link, assign-owned-number | `supabase/migrations/<ts>_admin_audit_and_notes.sql`, `lib/db/admin/*`, `app/api/admin/clinics/[id]/*`, `app/admin/audit/page.tsx` | **yes** (5.1+5.2) | typecheck, build; apply migration in staging first | each action: precondition block, confirm, audit row, idempotent no-op, rollback | high | `feat: add admin audit log and safe clinic actions` |
| 3 | Billing admin (after Stripe) | Billing-ready views; start/pause | `app/admin/clinics/[id]/*`, `app/api/admin/.../billing`, `lib/stripe/*` | maybe | typecheck, build | no charge before SMS active | high | `feat: add admin billing controls` |
| 4 | Number provisioning admin (after Twilio purchase) | Purchase/release | `app/api/admin/.../number`, `lib/twilio/*` | maybe | typecheck, build | idempotent purchase; webhooks set | high | `feat: add admin number provisioning` |
| 5 | A2P + enable live SMS (after carrier) | Real status sync; enable SMS | `app/api/admin/.../a2p`, `.../sms-recovery` | maybe | typecheck, build | all gates enforced; opt-out respected | high | `feat: add admin A2P and SMS activation` |
| 6 | Settings + manage admins | Grant/revoke `is_internal_admin` | `app/admin/settings/*`, `app/api/admin/admins/*` | none | typecheck, build | cannot self-lockout; audited | medium | `feat: add admin settings and admin management` |

---

## 13. Validation / QA plan
- Each phase: `npm run typecheck` + `npm run build` (no lint/test scripts exist).
- Access matrix test (manual): platform admin (allowlist), platform admin
  (`is_internal_admin`), clinic owner, front-desk, signed-out → expected
  allow/deny on `/admin` and a sample `/api/admin/*` route.
- Write actions: verify precondition blocks, confirmation, audit row written,
  idempotent re-run, and rollback for each.
- Redaction: confirm no secret/raw payload/token rendered in any admin view.
- Regression: the §9 existing-feature checklist.

### Open questions for the project owner
1. Operator email(s) for `PLATFORM_ADMIN_EMAILS`? Put in committed config or Vercel env?
2. Should env-allowlisted admins be auto-persisted to `is_internal_admin`, or kept as bootstrap-only?
3. How much patient message **content** may a platform admin see (full body vs status/keyword only)?
4. Log admin **reads**, or only writes?
5. Require **2FA** for platform admins / a separate admin host (e.g. `admin.…`) vs `/admin` path?
6. Audit-log **retention** policy?
7. Is a dedicated `platform_admins` table wanted later (roles/scopes), or is the flag+allowlist sufficient long-term?

### Recommended next implementation prompt title
**"feat: rebuild /admin/clinics/[clinicId] as editable super-admin management console"**
— implement owner-level editable controls (Business Profile + A2P/representative)
inside admin with audited save paths scoped by `clinicId`; keep Twilio purchase,
A2P carrier submission, and Stripe management disabled with exact blockers until
their real backends exist.

---

## 14. Commit
Commit hash: `214b70f` (`docs: plan platform admin console`); pushed to `origin/main`.

---

## 15. Implemented — admin console v1 (2026-06-01)

Phase 1 + the first safe write actions are built (production-near, real — not a shell):

- **Access:** `lib/auth/platform-admin.ts` `resolvePlatformAdmin()` — authorized iff
  authenticated email ∈ `PLATFORM_ADMIN_EMAILS` (env) OR `profiles.is_internal_admin`.
  Separate from `resolveAuthClinicAccess` (no clinic membership required). Guarded
  route group `app/admin/(console)/*` (layout guard); `/admin/login` lives outside
  the group so it is never guard-looped.
- **Pages:** `/admin/login`, `/admin` (live KPIs), `/admin/clinics`
  (server-side search + active/SMS/phone filters), `/admin/clinics/[clinicId]`
  (detail + action panel), `/admin/clinics/[clinicId]/events` (redacted
  call/message diagnostics), `/admin/audit`.
- **Real actions (audited):** deactivate / reactivate clinic; disable / enable SMS
  recovery (enable gated on `is_active` + assigned number + `a2p_info_completed`);
  update internal note (≤1000); set provisioning status/note. All via
  `POST /api/admin/clinics/[clinicId]/action`, each writing `admin_audit_events`.
- **Blocked (shown disabled with reason — never fake):** Stripe billing (collect/
  start/pause), Twilio number purchase/release/reassign, A2P/carrier submission,
  live SMS mode.
- **Migration `20260601000200_admin_console.sql`** applied (admin_audit_events +
  `clinics.admin_internal_note/admin_provisioning_status/admin_provisioning_note`).
- **Redaction:** phones masked to last 4; Twilio SIDs shown as a short tail; no raw
  payloads/tokens/secrets; EIN + A2P rep shown as presence only.
- **Operator step status (2026-06-01): complete.**
  `PLATFORM_ADMIN_EMAILS=allyexporter@gmail.com` was set in Vercel Production and
  production was redeployed. `/admin` authorization now works for the first
  platform admin account.
- **Next:** `/workspace/login` role-specific login (front desk).

## 16. Clinic detail page simplified — operator workflow (2026-06-01)

> Historical implementation snapshot. Superseded as target UX by §18 product
> correction (editable super-admin management console).

`/admin/clinics/[clinicId]` was rebuilt around the real launch workflow instead of a
status dump. The page is now a single ordered flow: **A** Clinic summary → **B**
Launch readiness → **C** Phone numbers → **D** Billing → **E** A2P / SMS approval →
**F** Admin controls → **G** Diagnostics → **H** Recent admin activity.

Removed (confusing / duplicated UI):
- The separate primary **Enable/Disable SMS recovery** toggle that sat next to clinic
  active/inactive. Clinic on/off is now **one** control: **Clinic status** (Active /
  Paused) → `clinics.is_active`. SMS recovery (`clinics.sms_recovery_enabled`) is now
  surfaced **only** as the single final **Service launch** control / launch-readiness
  state, never as a duplicate always-on toggle.
- **Provisioning review** dropdown, **Provisioning note**, and **Save provisioning**.
  Readiness is now derived from real data (business / phone / A2P / billing rows), so a
  second manual status was redundant. DB columns `admin_provisioning_status` /
  `admin_provisioning_note` are kept (additive, no data touched); the
  `set_provisioning` API action and its UI were removed.
- **Audit** from the top admin nav. The `/admin/audit` route stays available; each
  clinic page now shows its own **Recent admin activity** (last 5, human-readable).

Single internal note retained: **Internal note** → `clinics.admin_internal_note`
(plain text, ≤1000 chars, internal-only, never shown to clinic owner/front desk).

### Evidence map — every clinic detail UI item

| UI item | Source table/API/helper | Purpose | Action/effect | Keep/remove |
|---|---|---|---|---|
| Clinic name | `clinics.name` | Identify clinic | read-only | keep |
| Owner email | `clinics.owner_contact_email` / `clinic_memberships`+`profiles` | Contact / identity | read-only | keep |
| Clinic status (Active/Paused) | `clinics.is_active` | Master on/off | read-only badge | keep |
| Service state (Launched/Not launched/Blocked/Paused) | derived: `is_active`, `sms_recovery_enabled`, launch gate | One-glance answer | read-only | keep |
| Launch readiness › Business profile | `clinics.business_info_completed` (+ legal name/type/EIN/address) | Compliance/identity | read-only status | keep |
| Launch readiness › Billing | `clinics.billing_status` + `stripe_customer_id` presence | Payment readiness | read-only status | keep (not a launch gate in MVP) |
| Launch readiness › Phone numbers | `clinic_phone_numbers` (active) | Voice/SMS needs a number | read-only status | keep |
| Launch readiness › A2P / SMS approval | `clinics.a2p_info_completed`, `a2p_authorized` | Carrier compliance | read-only status | keep |
| Launch readiness › Service launch | derived from rows + `is_active`/`sms_recovery_enabled` | Can it launch? | status; action in §F | keep |
| Phone numbers list | `clinic_phone_numbers` (id, masked number, role, is_active, SID tail) | Show assigned numbers | read-only (masked) | keep |
| Add phone number (disabled) | n/a — Twilio purchase not wired | Future buy/assign | disabled, reason shown | keep as honest placeholder |
| Billing rows | `clinics.billing_status`, `stripe_customer_id`/`stripe_subscription_id` presence, `trial_ends_at` | Billing state | read-only (presence only) | keep |
| Manage billing (disabled) | n/a — Stripe not wired | Future billing mgmt | disabled, reason shown | keep as honest placeholder |
| A2P rows | `clinics.sms_status`, `a2p_info_completed`, `a2p_authorized`, `a2p_rep_email` presence | Approval readiness | read-only | keep |
| Submit SMS approval (disabled) | n/a — A2P submission not wired | Future carrier submit | disabled, reason shown | keep as honest placeholder |
| Pause / Reactivate clinic | `POST …/action` `deactivate`/`reactivate` → `clinics.is_active` | Clinic on/off | **working**, audited | keep |
| Launch service / Pause SMS sending | `POST …/action` `enable_sms` (gated: active+number+A2P) / `disable_sms` → `clinics.sms_recovery_enabled` | Single launch control | **working**, audited | keep |
| Internal note | `POST …/action` `update_note` → `clinics.admin_internal_note` | Operator note | **working**, audited | keep |
| Diagnostics (opt-outs, setup status, link) | `opt_outs`, `clinics.setup_status`, `/events` (`call_events`+`messages`) | Secondary troubleshooting | read-only (masked) | keep |
| Recent admin activity | `admin_audit_events` (clinic-scoped, last 5) | Black-box change history | read-only, human-readable | keep |
| Provisioning review/note | (removed) | duplicated readiness | — | **removed from UI** |
| Separate SMS recovery toggle | (removed) | duplicated launch/status | — | **removed from UI** |

The **Launch service** action mirrors the server preconditions exactly
(`is_active` + at least one assigned number + `a2p_info_completed`); it is disabled
with the precise blocking reason until the gate clears, and writes `admin_audit_events`
on success. Billing is shown as a readiness row but is **not** a hard launch gate in
this MVP (Stripe backend not connected), so launch is never permanently impossible.

## 17. Status de-dup + in-app confirmations (live-QA polish, 2026-06-01)

Live QA after §16 surfaced two presentation issues; both fixed without any API,
auth, or schema change.

**Status de-duplication.** Clinic and launch status were appearing in three places at
once (top badges + summary rows + controls), reading as contradictory (e.g. "Active"
and "Blocked" together). Now there are exactly **two separate axes, each shown once**:

- **Clinic status** — `clinics.is_active` → Active / Paused. Shown once in Clinic
  summary. Action: Pause / Reactivate.
- **Launch status** — derived → **Launched** / **Ready to launch** / **Blocked**.
  Shown once as the **Launch readiness** headline badge with a one-line reason. The
  prerequisite checklist rows below explain it; they no longer repeat a launch-status
  badge.

Removed (de-dup): the two top-of-page badges, the summary "Service state" row, and the
readiness "Service launch" row. Admin controls now carry only action buttons — the
disabled Launch button points to "launch readiness above" instead of re-printing the
blocker. Human labels only; no technical status strings as primary UI.

**In-app confirmations.** The native `window.confirm()` in `AdminClinicActions` was
replaced by a reusable `AdminConfirmDialog` (`_components/AdminConfirmDialog.tsx`):
`role="dialog"` + `aria-modal`, focus moved in on open and restored on close, Escape /
Cancel / backdrop close, Tab trapped between Cancel and Confirm, error rendered inside
the dialog (stays open on failure). Confirm calls the existing
`POST /api/admin/clinics/[clinicId]/action` (audit logging unchanged). Required for
state-changing actions only — Pause clinic, Reactivate clinic, Launch service, Pause
SMS sending — not for Save note.

## 18. Clinic detail product correction: editable super-admin console (2026-06-01)

The prior "owner-dashboard superset" read-only direction was useful as a data
audit step, but it is deprecated as the target admin UX.

Correct product direction:
- `/admin/clinics/[clinicId]` is an editable super-admin clinic management console.
- The platform admin manages the clinic directly from this page.
- This is not an impersonation flow and not a separate "manage as owner" button.
- The main experience must not be a long passive report.

Direct management actions required from admin:
- edit/save Business Profile fields
- edit/save A2P/SMS approval data
- manage Phone Number state when backend exists
- manage Billing state when backend exists
- manage SMS behavior/settings when backend exists
- use admin-only launch, diagnostics, audit, and internal-note controls

Presentation rule:
- technical details remain available but must move into compact/collapsible
  admin-only areas so management workflows stay primary.

Next implementation step: rebuild /admin/clinics/[clinicId] as an editable super-admin clinic management console using the owner /account controls and validation as the functional baseline, scoped by clinicId, with audited admin save paths for existing editable fields. Keep Twilio purchase, A2P carrier submission, and Stripe management as disabled gated actions until their real backends exist.

## 19. Implemented — editable management console v1 (2026-06-01)

`/admin/clinics/[clinicId]` is now an **editable super-admin management console**
(milestone 1 of §18). No impersonation, no "manage as owner" — the admin page is the
console. No migration, no auth change, no new external side effects.

### Editable owner-level sections (new)
- **Business profile** — `AdminBusinessProfileForm` (same fields + client validation as
  owner `BusinessProfileForm`) → `POST /api/admin/clinics/[clinicId]/business-profile`.
- **A2P / SMS approval** — `AdminA2pForm` (same fields as owner `SmsApprovalForm`) →
  `POST /api/admin/clinics/[clinicId]/a2p`. Saving stores data only; never submits to a
  carrier.

Both new API routes: `resolvePlatformAdmin(req)` guard → mirror the owner Zod schema +
`normalizePhone`/`isValidE164`/`isSafeHttpsUrl`/`BUSINESS_TYPES` → reuse the existing
`updateBusinessInformation` / `updateA2pInformation` helpers (existing columns only,
scoped to the one `clinicId`) → write `admin_audit_events`
(`clinic.business_profile.update` / `clinic.a2p.update`). **No-op detection**: when no
field changed and the section is already complete, the route skips the DB write and the
audit row. Audit metadata stores **changed field names only** + completion flags — never
raw EIN/phone/email values. Forms show loading/success/error and `router.refresh()` on
save so the checklist/state update.

### Page structure (management console)
Header (clinic + launch state + short blocker + compact metadata) · **Launch checklist**
(Business profile / Phone number / A2P / Billing / SMS launch — status + reason + jump
action) · editable **Business profile** · editable **A2P / SMS approval** (+ carrier
submission "Not submitted/Not available", compliance links, disabled `Submit SMS
approval`) · **Phone number** (state + disabled `Purchase and assign number`) · **Billing**
(state + disabled `Manage billing`) · **SMS behavior** (read-only "not editable yet") ·
admin-only: **Admin controls** (Pause/Reactivate/Launch/Pause SMS/Internal note via the
accessible confirm dialog) · **Diagnostics** (masked) · **Recent admin activity** ·
collapsible **Technical details** (IDs/SIDs/timestamps).

### Still blocked (disabled, exact reason — never simulated)
`Purchase and assign number` → "Twilio purchase/assign backend required"; `Manage billing`
→ "Stripe billing backend required"; `Submit SMS approval` → "A2P submission backend
required". Per-clinic SMS settings remain read-only (no settings backend).

### Next production step
Wire the first real gated backend action — **Twilio number purchase/assign** — behind the
existing platform-admin guard + audit, replacing that disabled placeholder.

## 20. Console layout — owner-dashboard IA (2026-06-01)

Layout-only restructure of `/admin/clinics/[clinicId]` (no backend change). The long
linear page became an owner-`/account`-style dashboard: compact header (no status
pills), one launch banner, left section nav, and a single focused panel.

- New client component `AdminClinicConsole` renders the tabbed dashboard; `page.tsx`
  is now a thin server data-loader that fetches (detail, audit, events, SMS mode, app
  base URL) and passes serializable props.
- Sections (default **Phone number**, the current blocker): Phone number · Business
  profile · SMS approval · Billing · SMS behavior · Admin tools. Nav reuses the owner
  `.acct-layout`/`.acct-nav` visuals with a small per-section status word
  (Missing/Complete/Ready/Waiting/Not connected/Read-only).
- Accessible tabs: `role="tablist"`/`tab`/`tabpanel`, roving `tabIndex`, Arrow/Home/End
  keys, `aria-selected`. **Panels stay mounted**; inactive ones use the `hidden`
  attribute so the editable Business Profile / SMS Approval forms keep unsaved input.
- Removed the header `Active`/`Blocked` pills (redundant). Launch state is conveyed
  once by the banner.
- Admin tools panel holds the existing `AdminClinicActions` (confirm dialog preserved)
  plus collapsible **Recent admin activity**, **Diagnostics** (masked), and **Technical
  details** (collapsed) — these are no longer full-width standalone sections.
- Editable forms, save routes, validation, and audit behavior are unchanged.

## 21. Implemented — admin Twilio number purchase/assign (2026-06-01)

First real gated Twilio admin action. The Phone number panel's disabled placeholder is
replaced by a search → select → confirm → purchase/assign workflow. Same Twilio
architecture as onboarding (`purchaseNumberAndConfigure` + `upsertOfficeTextingNumber` +
Messaging Service) — not a second one. **No migration** (`clinic_phone_numbers` already
stores E.164 + IncomingPhoneNumber SID + role + active).

Routes (platform-admin guarded, `resolvePlatformAdmin(req)`):
- `GET …/phone-numbers/search` — read-only available-number lookup; returns only
  Voice+SMS-capable numbers. Hint order: query `area_code` → `preferred_area_code` →
  area code from `main_phone` → none; region/postal from clinic. No hardcoded area codes.
- `POST …/phone-numbers/purchase` `{ phone_number }` — purchases + assigns.

Hard gate `TWILIO_NUMBER_PURCHASE_ENABLED` (committed `false`): disabled →
**503 `purchase_disabled`** "Twilio number purchase is disabled by environment flag.";
no Twilio call, no DB write, no bypass. Preconditions: auth → clinic exists → not already
assigned (409, one-number rule) → flag on → app base URL present → purchase.

On success: configures Voice/SMS incoming + status webhooks on the number, best-effort
attaches the Messaging Service, stores the mapping, writes `admin_audit_events`
(`clinic.phone_number.purchase_assign`; after-state `{ phone_number, twilio_sid,
area_code }`; no secrets), and the console refreshes so Phone number flips Missing →
Assigned. **SMS recovery is not enabled**; `setup_status` unchanged.

UI: `AdminPhoneNumberManager` (client) — "Search available numbers", candidate radio
list (E.164 + friendly + locality/region + Voice/SMS/MMS + Local/Toll-free label,
unusable numbers disabled), "Purchase and assign selected number" via the existing
accessible `AdminConfirmDialog` (no `window.confirm`), loading/success/error states.

Remaining blockers after assignment: A2P/SMS approval + the launch action. Next: wire
A2P submission (or Stripe billing) behind the same guard+audit pattern.
