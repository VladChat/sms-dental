# Platform Admin Knowledge

Status: scaffold (starter internal content)
Audience: Platform owner/operator · Visibility: `platform_admin` / `internal_ops`
Last updated: 2026-06-09

Internal knowledge for the platform owner/operator who runs the cross-tenant
`/admin` console. This is **not** customer content and must never be exposed to a
clinic owner or front-desk user.

## Hard boundaries (apply to every doc here)

- `/admin` is the **platform-owner/operator console**, separate from `/account`
  (clinic owner) and `/workspace` (front desk).
- `/admin/clinics/[clinicId]` is the **editable super-admin clinic management
  console**.
- Platform-admin access is **cross-tenant** and is **never** implied by a clinic
  `owner`/`admin` membership. Authorization is `resolvePlatformAdmin()`
  (allowlist `PLATFORM_ADMIN_EMAILS` OR `profiles.is_internal_admin`).
- Admin docs may discuss operational guardrails, diagnostics, lifecycle states,
  and provider concepts — but **never secrets** (service-role keys, Twilio Auth
  Token, Stripe secret keys, full DB URLs, raw tokens).
- Apply the console **redaction rules** to anything shown: phones masked to last
  4, Twilio SIDs as a short tail only, no raw webhook/message payloads, EIN and
  A2P representative shown as presence only.
- Dangerous integrations stay **blocked-with-reason until their real backends
  exist** and must never be simulated.

## Documents

- [clinic-console.md](clinic-console.md) — console structure, tabs, and the
  super-admin clinic management page.
- [phone-number-lifecycle.md](phone-number-lifecycle.md) — active, suspended,
  scheduled removal, permanently removed, detached; suspend vs detach vs remove;
  assign existing number.
- [a2p-review-and-submission.md](a2p-review-and-submission.md) — SMS approval
  review and the live-submission safety gates.
- [billing-operations.md](billing-operations.md) — billing state and Stripe
  quantity sync (concepts only, no secrets).
- [diagnostics-and-audit.md](diagnostics-and-audit.md) — what diagnostics expose,
  redaction, and the audit log.
- [support-boundaries.md](support-boundaries.md) — what an operator may/may not
  do; blocked-by-design actions.

## Source of truth

- `MVP_BUILD_DOCS/PLATFORM-ADMIN-CONSOLE-PLAN.md`
- `MVP_BUILD_DOCS/AUTH-AND-ACCESS-CONTROL.md`
- `MVP_BUILD_DOCS/BILLING-AND-USAGE-POLICY.md`,
  `MVP_BUILD_DOCS/A2P-10DLC-COMPLIANCE-READINESS.md`
