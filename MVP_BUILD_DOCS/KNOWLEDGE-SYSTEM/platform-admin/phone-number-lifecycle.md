---
title: Phone number lifecycle and admin operations
slug: phone-number-lifecycle
status: internal
visibility: platform_admin
audience: Platform operator
surface: /admin
category: lifecycle
owner: ops
source_of_truth:
  - AGENTS.md
  - MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md
  - MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md
last_verified: 2026-06-09
related:
  - clinic-console
  - billing-operations
  - support-boundaries
---

## Summary

The full lifecycle of a clinic business number and the four distinct admin/owner
operations that act on it. **Suspend, remove, restore, and detach are different
operations — do not conflate them.**

## Applies to

Platform operators managing numbers from `/admin/clinics/[clinicId]` → Phone
number, and operators answering number-related support
([../support-runbooks/number-removal-restore-detach.md](../../support-runbooks/number-removal-restore-detach.md)).

## Number types (durable)

Every number has a durable `number_type`: `toll_free` or `local`.

- First toll-free number: **included in plan**. Additional toll-free: paid add-on.
- Local number: **always a paid add-on** (even the first, even during trial)
  because of A2P 10DLC registration/compliance.
- Toll-free uses toll-free verification; local uses A2P 10DLC Brand/Campaign. The
  A2P submission package contains **local numbers only**; toll-free numbers are
  never added to a local A2P campaign.
- Type, slot class (included vs additional), price, Stripe quantity, and fees are
  decided **server-side only**. The client never decides them. Local/toll-free
  billing differences are sourced from `config/billing.config.ts` and
  `BILLING-AND-USAGE-POLICY.md` — never hard-coded.

## Lifecycle states

- **Active** — assigned and routing calls/texts for the clinic.
- **Suspended** — paused by admin within the same clinic; routing inactive, but
  the Twilio number, the Stripe additional-number quantity, and the limit count
  are kept. A suspended number still counts toward the clinic limit and is still
  billed.
- **Scheduled removal** — customer removed the number; routing stopped
  immediately; `removal_status='scheduled'`; the row remains assigned, visible,
  and restorable until `permanent_removal_at`.
- **Permanently removed** — the secured release job released the Twilio
  IncomingPhoneNumber SID and marked the row `permanently_removed`. Not
  restorable.
- **Detached** — admin removed the clinic assignment without releasing the Twilio
  number (see below).

Rows in `clinic_phone_numbers` are **never physically deleted** — lifecycle
history is preserved for audit/reconciliation. If a delayed Twilio release fails,
preserve the existing SID and the release error for reconciliation; do not clear
or overwrite them.

## The four operations

### Suspend number (admin)
- Same-clinic pause. Sets the number inactive.
- **Keeps** the Twilio number, the Stripe additional-number quantity, and the
  limit count. Still billed, still counts toward the limit.
- No Twilio release. Reversible via reactivate.

### Remove number (customer-facing lifecycle removal)
- Customer-facing action text is **"Remove number"**, never "Release number".
- **Immediately** stops calls/texting routing (row inactive,
  `removal_status='scheduled'`).
- Twilio release is **delayed** until permanent removal; removal does not
  immediately release the Twilio number.
- `permanent_removal_at` is an **estimated Twilio billing-window deadline** (next
  estimated monthly Twilio renewal minus a 1-day safety buffer), not a fixed grace
  period and not the Stripe cycle. **Do not promise a fixed restore window** (e.g.
  "30 days").
- Billing changes apply **next cycle only**; no immediate refund/credit/charge
  (`proration_behavior:"none"`).

### Restore number
- Allowed **only** while the row is still scheduled, before `permanent_removal_at`,
  and before Twilio release has completed. After permanent removal, not restorable.

### Detach from clinic (platform-admin operation)
- Removes the **clinic assignment** without releasing the Twilio number and
  without changing Stripe / the Messaging Service.
- Keeps the row and history for audit.
- Returns the eligible number to **assignable inventory** so it can be assigned to
  a clinic later.
- Distinct from remove (which schedules Twilio release) and from suspend (which
  keeps the same-clinic assignment).

## Assign existing Twilio number (admin)

From the Phone number panel: search available numbers → select → confirm → assign
(or assign an already-owned/detached number). Same Twilio architecture as
onboarding (`purchaseNumberAndConfigure` + `upsertOfficeTextingNumber` +
Messaging Service). Gated by `TWILIO_NUMBER_PURCHASE_ENABLED`; when off, the
action returns a disabled/`purchase_disabled` response with no Twilio call and no
DB write. On success it configures Voice/SMS webhooks, attaches the Messaging
Service best-effort, stores the mapping, and writes an audit row. **SMS recovery
is not enabled by assignment.**

## Limits

Default cap is **5 total held** business numbers per clinic
(`defaultSelfServiceBusinessNumberLimit`; stored on `clinics.phone_number_limit`).
Held = assigned (active or suspended) + Twilio-purchased awaiting reconciliation.
A platform admin can raise the limit (1–100, never below the held count).

## Expected result / audit

Every admin number operation writes `admin_audit_events` with redacted metadata
(masked phone, SID tail, area code) — no secrets.

## Escalation

If a Twilio release failed or a number is stuck in `reconciliation_required`,
preserve the SID and error and escalate to engineering. Do not manually clear
reconciliation state.

## Safety notes

No secrets. Mask phones, SID tails only. Real Twilio purchases are gated
(`owner_test_live` is allowlisted to specific clinic ids; broad `live` is off).

## Source of truth

- `AGENTS.md` — "Toll-free vs Local Number Model" and "Phone Number Removal
  Lifecycle"
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` — removal/next-cycle billing,
  suspend behavior
- `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` §21–22 — admin
  purchase/assign/search; detach is the admin assignment-removal operation
