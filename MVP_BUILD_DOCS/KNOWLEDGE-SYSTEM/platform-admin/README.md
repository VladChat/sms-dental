# Platform Admin Knowledge

Status: active (internal docs verified; internal-only)
Audience: Platform owner/operator · Visibility: `platform_admin`
Last updated: 2026-06-09

Internal knowledge for the platform owner/operator who runs the cross-tenant
`/admin` console. This folder is **internal-only**. It is **never** public and
must **never** be exposed to a clinic owner or front-desk user.

## Roles — platform admin vs clinic owner vs front desk

Three distinct audiences, three distinct surfaces. Do not mix them.

| Role | Surface | Scope | Sees |
|---|---|---|---|
| **Platform admin / operator** | `/admin` | Cross-tenant (all clinics) | Operational state, diagnostics (redacted), audit; never secrets |
| **Clinic owner / admin** | `/account` | One clinic | Their own business profile, numbers, SMS approval, billing |
| **Front desk** | `/workspace` | One clinic | Patient replies/requests only (minimum-necessary) |

Key rules:

- Platform-admin access is **cross-tenant** and is **never** implied by a clinic
  `owner`/`admin` membership. Authorization is `resolvePlatformAdmin()`
  (authenticated email in `PLATFORM_ADMIN_EMAILS` **OR**
  `profiles.is_internal_admin`), independent of clinic membership.
- Front desk must **never** see billing, EIN/legal details, SMS approval
  controls, owner setup settings, provider technical details, internal IDs, or
  raw records. (Source: `FRONT-DESK-WORKSPACE.md`.)
- Platform-admin docs may discuss internal operations, gates, and lifecycle —
  but still **no secrets and no raw private data**.

## Redaction & no-secrets rule (applies to every doc here)

- **No secrets**: service-role keys, Twilio Auth Token, Stripe secret keys, Vercel
  token, Resend API key, full DB URLs with passwords, raw setup/recovery tokens.
- **Redaction standard**: phone numbers masked to last 4; provider SIDs as a short
  tail only; **no raw webhook/message/call payloads**; EIN and A2P representative
  shown as **presence only**.
- **Never bypass** server-side gates: `resolvePlatformAdmin`, SMS approval, opt-out
  (STOP/START), billing authorization, or RBAC.
- Dangerous integrations stay **blocked-with-reason until their real backends
  exist** and are **never simulated**.

## Documents

- [clinic-console.md](clinic-console.md) — `/admin` console structure, the
  `/admin/clinics/[clinicId]` management page, what is editable vs blocked/future.
- [phone-number-lifecycle.md](phone-number-lifecycle.md) — full lifecycle, the
  Remove/Restore/Suspend/Detach/Permanently-removed operations, assign existing
  number, customer-safe vs internal explanation.
- [a2p-review-and-submission.md](a2p-review-and-submission.md) — SMS approval (A2P)
  review, field split, the live-submission safety gates.
- [billing-operations.md](billing-operations.md) — billing state and quantity-sync
  concepts (no secrets, no price IDs); what support can explain vs operator review.
- [diagnostics-and-audit.md](diagnostics-and-audit.md) — diagnostics scope,
  redaction, and the audit log.
- [support-boundaries.md](support-boundaries.md) — what an operator may/may not do;
  blocked-by-design actions; customer-safe vs internal wording.

## Related support runbooks

The [support-runbooks](../support-runbooks/README.md) translate these concepts
into ticket triage (`internal_ops`). Use them when answering a customer; use the
platform-admin docs above to understand the underlying behavior.

## Source-of-truth map

| Topic | Canonical file(s) |
|---|---|
| Admin console / actions / redaction | `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md` |
| Roles / auth / access | `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md` |
| Phone number lifecycle | `AGENTS.md`, `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` |
| Billing / pricing | `config/billing.config.ts`, `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md` |
| SMS approval / A2P | `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md`, `MVP_BUILD_DOCS/SMS-APPROVAL-FIELD-MAPPING.md`, `config/runtime.config.ts` |
| Operations / webhooks / SMS gates | `MVP_BUILD_DOCS/OPERATIONS-RUNBOOK.md` |

Full domain map: [../developer-ops/source-of-truth-map.md](../developer-ops/source-of-truth-map.md).
