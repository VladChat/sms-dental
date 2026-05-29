# UX writing &amp; microcopy — "Recall" (internal codename)

The voice that pairs with the visual system. It builds on the original repo's
content rules (which were genuinely good) and extends them across the product.

> **Public product name is "Missed Calls Dental."** "Recall" is an internal
> design-system codename — never write it in customer-facing copy (no "Powered
> by Recall," "Recall app," etc.).

## Voice in one line
**Calm, clear, and on your side.** We talk like a competent colleague who handles
the messy parts so the front desk doesn't have to — never a hype-y salesperson,
never a scary compliance lawyer.

## Principles
- **Clear over clever.** Short sentences, plain words, one idea per line.
- **Second person.** "you / your office / your front desk." The product is "we," used sparingly.
- **Calm, not pushy.** State value plainly; no urgency theatre, no fake scarcity.
- **Confidence-building, not overpromising.** Describe what happens; never guarantee outcomes.
- **Sentence case everywhere** except UPPERCASE tracked eyebrows.
- **No emoji.** Use icons.
- **Real punctuation** — em dashes, curly quotes, hyphenated "21-day."

## Patterns by element

| Element | Rule | Example |
|---|---|---|
| **Headline** | A clear benefit or plain truth. ≤ 9 words ideal. | "Every missed call is a patient you can still win back." |
| **Subhead** | Explain the mechanism in one sentence. | "When your office can't pick up, the caller gets a professional text in seconds." |
| **Eyebrow** | 1–3 words, UPPERCASE, categorize the section. | "HOW IT WORKS" · "PRICING" |
| **Primary CTA** | Verb + specific outcome. Approved: "Start free trial", "Start trial", "Continue", "Use this number", "Send setup link", "Save changes". | "Start 21-day free trial" |
| **Secondary CTA** | Low-commitment. | "See how it works" · "Email me the instructions" |
| **Helper text** | Say *why* a field is needed. | "We'll use this ZIP to find a local number near your office." |
| **Field label** | Sentence case noun. Mark required with `*`. | "Main office phone *" |
| **Error** | What happened + how to fix. Calm, blameless. | "Enter a valid work email address." / "We couldn't reach the server. Please try again in a moment." |
| **Success** | Confirm + what's now true. | "Your texting number is live. Missed calls now receive an automatic follow-up." |
| **Empty state** | Reassure + tell them what will appear. | "No missed calls yet. When a patient call goes unanswered, it'll show up here." |
| **Compliance** | Plain, factual, transparent. No legalese where avoidable; never claim "HIPAA compliant." | "SMS stays off until approval completes. You're not billed during this step." |
| **Onboarding** | Reduce anxiety; reassure about what won't change. | "Your main office number stays exactly the same." |
| **Loading** | Name the task. | "Searching numbers…" · "Assigning your number…" |

## Forbidden / use-instead
- ❌ "Get Started", "Book Demo", "Start Free Trial" (title case), "Create Account", "Register", "Sign Up Now!"
- ✅ "Start trial", "Start free trial", "Continue", "Sign in", "View pricing"
- ❌ Fake stats, testimonials you don't have, "#1", "guaranteed."
- ❌ "HIPAA Compliant", "100% secure", "fully compliant." → ✅ describe the actual mechanism ("STOP/HELP are honored", "a consent page is generated").
- ❌ Medical advice in any automated SMS example.

## Patient Requests wording
The product turns a patient's reply into an **office-ready request**, not a chat to read.
- Call the area **"Patient requests"** (sentence case). Never "Replies," "Inbox," or "Messages" as the primary label.
- A single item is a **"request."** It has a clear **action**, not a conversation.
- **Statuses** (these exact words): **New** · **Needs callback** · **Scheduled** · **Completed**. Plus **Opted out** where relevant.
- **Priority**: **Routine** / **Urgent** (Urgent only for caller-stated pain/emergency language — never inferred medically).
- **Actions** read as front-desk tasks: "Mark scheduled," "Needs callback," "Mark completed," "Call patient," "Add a note."
- The raw SMS is a **secondary audit trail** ("Activity & SMS audit trail"), shown in a detail drawer — never the headline UI.
- Request fields use plain labels: Name · Phone · Request · Preferred time · Priority · Status · Source · Received.
- Empty state: "No patient requests yet. When a missed caller replies to your follow-up text, we'll turn it into a ready-to-action request here."

## Metrics wording (MVP-safe)
Name only what the backend can prove — counts, not outcomes.
- ✅ "Missed calls recorded," "Recovery texts sent," "Patient replies received," "New patient requests," "Requests needing callback," "Opt-outs," "SMS approval status," "Office texting number status."
- ❌ Don't present as live: "Revenue recovered," "Appointments created," "Conversion rate," "Value recovered," "New patients won," "Avg. response time." These are **future concepts only**.
- Caption counts with a neutral period ("This week") — avoid fabricated up/down percentages.

## Tone calibration
- Marketing → confident + warm. Onboarding → reassuring + concrete. Dashboard → quiet + factual. Compliance → transparent + neutral. Errors → calm + helpful, never alarmist.
