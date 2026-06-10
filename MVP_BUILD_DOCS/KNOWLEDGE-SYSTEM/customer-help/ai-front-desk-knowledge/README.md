# Customer Help — AI Front Desk Knowledge

Status: active (articles ready; not yet published)
Audience: Clinic owners · Visibility: `clinic_owner`
Last updated: 2026-06-10

Help for the **AI Front Desk Knowledge** section of the owner account: the
clinic-approved answer library a future AI front desk assistant may use.

## Articles

| Article | Title | Visibility | Status | Notes |
|---|---|---|---|---|
| [prepare-ai-front-desk-knowledge.md](prepare-ai-front-desk-knowledge.md) | Prepare answers for future AI | clinic_owner | ready | Foundation only; AI replies are not live |

## Customer-safe notes

- **AI replies are off.** This section saves answers for future SMS/voice AI.
  Patients never receive AI-generated replies from this screen today.
- **Approved means allowed.** A future AI assistant may only use answers the
  owner explicitly approved. Anything unknown, unapproved, or risky hands off to
  the front desk.
- **Medical advice never.** Medical/urgent questions always use a standard
  handoff reply that cannot be edited into clinical advice.
- **Website stays in Business profile.** AI Knowledge reads the Business profile
  website; it never asks the owner to retype it. A future website scan will use
  it to suggest answers — scanning is not live.
- Never describe this as a live AI receptionist, chatbot, or automated patient
  texting feature.

## Source of truth

- `config/ai-front-desk-knowledge.config.ts` — recommended question catalog,
  statuses, safety defaults
- `MVP_BUILD_DOCS/PROJECT-CONTEXT.md` — AI Front Desk Knowledge foundation scope
  and future phases

## Need more help?

Contact support: support@missedcallsdental.com
