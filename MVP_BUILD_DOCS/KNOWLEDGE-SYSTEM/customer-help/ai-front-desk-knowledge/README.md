# Customer Help — AI Front Desk Knowledge

Status: active (articles ready; not yet published)
Audience: Clinic owners · Visibility: `clinic_owner`
Last updated: 2026-06-10

Help for the **AI Front Desk Knowledge** section of the owner account: the
structured clinic facts (hours, services, insurance, appointments, payment,
office policies) a future AI front desk assistant may use.

## Articles

| Article | Title | Visibility | Status | Notes |
|---|---|---|---|---|
| [prepare-ai-front-desk-knowledge.md](prepare-ai-front-desk-knowledge.md) | Prepare answers for future AI | clinic_owner | ready | Structured facts sections; website check suggestions; owner approval required |

## Customer-safe notes

- **Facts, not questionnaires.** Owners set hours, check services/insurance,
  and add short notes — they do not answer long question lists.
- **Approved means allowed.** A future AI assistant may only use facts the
  owner saved/approved. Anything unknown or unapproved goes to the front desk.
- **Medical advice never.** Medical and urgent questions always go to the
  office; that rule is built in and is not a clinic setting. Never describe an
  editable safety setting.
- **Business profile owns address and website.** AI Knowledge reads them and
  never asks the owner to retype them.
- **Website check creates suggestions only.** Scanned facts stay marked
  "Review" until the owner saves the section. The scan never changes the
  Business profile.
- Never describe this as a live AI receptionist, chatbot, or automated patient
  texting feature.

## Source of truth

- `config/ai-front-desk-facts.config.ts` — service/insurance catalogs, limits
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — structured clinic-facts foundation
  scope and future phases

## Need more help?

Contact support: support@missedcallsdental.com
