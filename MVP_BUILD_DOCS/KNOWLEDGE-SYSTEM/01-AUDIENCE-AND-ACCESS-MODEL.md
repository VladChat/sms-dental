# 01 — Audience and Access Model

Status: ready
Last updated: 2026-06-09

Every article in the Knowledge System carries a `visibility` value. This document
defines the roles, what each may and may not see, and the hard rules that future
search/UI/AI must enforce **server-side**.

## 1. Visibility values

```text
public
customer_authenticated
clinic_owner
clinic_staff
platform_admin
internal_ops
developer_ops
```

These are an access band, not a strict hierarchy. A `clinic_owner` article is not
automatically visible to `clinic_staff`, and internal bands
(`platform_admin` / `internal_ops` / `developer_ops`) are **never** visible to
any customer band.

## 2. What each role is

- **`public`** — anyone on the internet, signed in or not. Marketing-safe,
  general product explanation. The only band that may ever be mirrored to a
  public surface.
- **`customer_authenticated`** — any signed-in customer (owner or staff).
  General in-app help that is safe for both owner and front desk.
- **`clinic_owner`** — signed-in clinic owner/admin (the `/account` audience).
  May include billing, SMS approval, legal/registration, and account-access
  content scoped to *their own clinic*.
- **`clinic_staff`** — signed-in front-desk staff (the `/workspace` audience).
  Operational, patient-reply content only. Never billing, legal, approval, or
  setup content.
- **`platform_admin`** — platform owner/operator (the cross-tenant `/admin`
  audience). Operational concepts across all clinics; never secrets.
- **`internal_ops`** — internal support/operations staff answering tickets.
  Support runbooks and internal triage; never secrets.
- **`developer_ops`** — engineers maintaining the system. May reference file
  paths, implementation detail, validation commands; never secrets or raw
  private data.

Role and route mapping (from `AUTH-AND-ACCESS-CONTROL.md` §17): one Supabase
Auth system, separate entry points — clinic owner → `/account`, front desk →
`/workspace` (`/workspace/login`), platform admin → `/admin` (`/admin/login`).
Platform-admin access is cross-tenant and is **never** implied by a clinic
`owner`/`admin` membership.

## 3. Hard rules

### Clinic customers (owner or staff) must NOT see

- Twilio SIDs or any provider resource IDs.
- Stripe internals (price IDs, customer/subscription IDs, raw invoice objects).
- Provider raw payloads or raw webhook events.
- Internal workflow details (cron jobs, reconciliation states, queue mechanics).
- SQL, debug instructions, or migration detail.
- Internal allowlists (e.g. `twilioPurchaseTestClinicIds`, `PLATFORM_ADMIN_EMAILS`).
- Admin/internal email addresses.
- Platform-only diagnostics or other clinics' data.

### Front-desk staff (`clinic_staff`) must NOT see

(In addition to all of the above.)

- EIN / legal business details.
- Billing or payment-method information.
- SMS approval controls or approval documents.
- Owner setup settings.
- Twilio technical details.
- Internal IDs (including conversation UUIDs).
- Raw compliance or webhook records.

This mirrors the `/workspace` minimum-necessary rule in `FRONT-DESK-WORKSPACE.md`.

### Platform-admin docs

- May include operational concepts: lifecycle states, gates, diagnostics
  boundaries, audit, redaction rules.
- Must **not** include secrets (service-role keys, Twilio Auth Token, Stripe
  secret keys, full DB URLs with passwords, raw tokens).
- Must describe redaction: phones masked, SIDs shown as a short tail only, no raw
  payloads — matching `PLATFORM-ADMIN-CONSOLE-PLAN.md` §10/§15.

### Developer/ops docs

- May mention file paths, implementation details, validation commands
  (`npm run typecheck`, `npm run build`), and link to operational runbooks.
- Must **not** include secrets or raw private/patient data.

### Future UI / search / AI

- Must filter content **server-side by `visibility`**. The signed-in role
  determines the allowed bands before any content is returned.
- Do **not** rely on hiding UI links, client-side filtering, or "security by
  obscurity."
- A customer request must never be able to retrieve `platform_admin`,
  `internal_ops`, or `developer_ops` content.

## 4. Visibility matrix

| Audience | Can see | Must not see | Examples (article → visibility) |
|---|---|---|---|
| Public visitor | `public` | everything else | "What Missed Calls Dental does" → `public` |
| Clinic owner | `public`, `customer_authenticated`, `clinic_owner` | staff-only? (no — owner can see staff-safe too); all internal bands | "Understand your bill" → `clinic_owner`; "Contact support" → `public` |
| Front-desk staff | `public`, `customer_authenticated`, `clinic_staff` | `clinic_owner` (billing/legal/approval/setup), all internal bands | "How front desk should handle replies" → `clinic_staff`; billing article → blocked |
| Platform admin | all internal bands (`platform_admin`, `internal_ops`) + customer bands for reference + secrets-free | secrets of any kind | "Suspend vs detach vs remove" → `platform_admin` |
| Internal support/ops | `internal_ops`, `platform_admin`, customer bands | secrets | "SMS not sending" runbook → `internal_ops` |
| Developer/ops | `developer_ops` + all others (secrets-free) | secrets, raw patient data | "Source-of-truth map" → `developer_ops` |

> Owners are a superset of staff for *help content* (an owner may read staff-safe
> articles), but staff are **never** a superset of owner content. When in doubt,
> tag the more restrictive band and let the owner surface include it explicitly.

## 5. Applying visibility in practice

- A single topic can have **two articles**: a customer-safe one and an internal
  one. Example: phone-number lifecycle has a `clinic_owner` "Remove / restore"
  article and a `platform_admin` "Suspend vs detach vs remove" article. They link
  to each other but never merge.
- When unsure whether a fact is safe for a customer, check the hard rules above
  and the source-of-truth file's own wording. If the customer UI does not already
  expose a term (e.g. "Twilio"), the customer article must not introduce it.
- See [02-CONTENT-GOVERNANCE.md](02-CONTENT-GOVERNANCE.md) for the
  publish/verify gates that pair with these visibility rules.
