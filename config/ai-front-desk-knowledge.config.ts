// AI Front Desk Knowledge — committed recommended-question catalog.
//
// This is the clinic-approved answer library FOUNDATION for a future AI front
// desk assistant (SMS first, voice later). It is account-side data only:
// no AI runtime, no patient-facing replies, no website crawling, and no
// Twilio behavior depend on this file today.
//
// Product rule the future AI must follow:
// - Known and approved -> future AI may answer.
// - Unknown / not approved / risky -> future AI must hand off to front desk.
// - Medical advice -> never.
//
// The catalog is organized by patient question categories (what patients ask),
// not by internal AI concepts. Keys/categories/questions are server-side facts;
// clients can only choose a status/answer for a key that exists here.

export const AI_KNOWLEDGE_STATUSES = [
  "not_found",
  "needs_review",
  "approved",
  "handoff",
  "do_not_answer",
] as const;

export type AiKnowledgeStatus = (typeof AI_KNOWLEDGE_STATUSES)[number];

export const AI_KNOWLEDGE_SOURCE_TYPES = [
  "system_default",
  "business_profile",
  "website_draft",
  "manual",
] as const;

export type AiKnowledgeSourceType = (typeof AI_KNOWLEDGE_SOURCE_TYPES)[number];

// Owner answers stay short and SMS-friendly. Hard server-side cap.
export const AI_KNOWLEDGE_ANSWER_MAX_LENGTH = 700;

export type AiKnowledgeDefaultStatus = "not_found" | "handoff" | "do_not_answer";

export type AiKnowledgeAnswerKind = "fact" | "policy" | "handoff" | "safety";

export const AI_KNOWLEDGE_CATEGORIES = [
  "Hours & Location",
  "Appointments",
  "Insurance",
  "Services",
  "Payment & Policies",
  "Safety & Handoff",
] as const;

export type AiKnowledgeCategory = (typeof AI_KNOWLEDGE_CATEGORIES)[number];

export type AiKnowledgeCatalogItem = {
  key: string;
  category: AiKnowledgeCategory;
  question: string;
  whyRecommended: string;
  defaultStatus: AiKnowledgeDefaultStatus;
  recommended: boolean;
  answerKind: AiKnowledgeAnswerKind;
  // Default short reply for handoff/safety items. Safety items always use this
  // text (it is not editable), so the wording can never drift into medical or
  // diagnostic territory.
  defaultHandoffText?: string;
  // Optional suggested wording the owner can start from for policy items.
  suggestedAnswer?: string;
};

const HANDOFF_DEFAULT = "I’ll pass this to the office and they’ll follow up shortly.";
const HANDOFF_INSURANCE =
  "I’ll pass your insurance question to the office and they’ll follow up shortly.";
const HANDOFF_MEDICAL =
  "I’ll pass this to the office. If this is a medical emergency, call 911.";
const HANDOFF_URGENT = "I’ll alert the office. If this is a medical emergency, call 911.";

export const aiFrontDeskKnowledgeCatalog: readonly AiKnowledgeCatalogItem[] = [
  // ------------------------------------------------------- Hours & Location
  {
    key: "office_hours",
    category: "Hours & Location",
    question: "What are your hours?",
    whyRecommended: "One of the most common patient questions, day and night.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "saturday_hours",
    category: "Hours & Location",
    question: "Are you open Saturday?",
    whyRecommended: "Weekend availability is a frequent deciding question for new patients.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "location_address",
    category: "Hours & Location",
    question: "Where are you located?",
    whyRecommended:
      "Patients ask for the address before booking. A future update can suggest this from your Business profile address.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "parking_location_notes",
    category: "Hours & Location",
    question: "Where should patients park or enter?",
    whyRecommended: "Helpful for first visits, especially in shared buildings.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },

  // ------------------------------------------------------------ Appointments
  {
    key: "accepting_new_patients",
    category: "Appointments",
    question: "Are you accepting new patients?",
    whyRecommended: "New patients ask this first. A clear yes/no saves calls.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "book_cleaning",
    category: "Appointments",
    question: "Can I book a cleaning?",
    whyRecommended: "Cleanings are the most requested appointment type.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "policy",
  },
  {
    key: "same_day_appointments",
    category: "Appointments",
    question: "Do you offer same-day appointments?",
    whyRecommended: "Patients with sudden needs ask this often.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "policy",
  },
  {
    key: "emergency_appointments",
    category: "Appointments",
    question: "Do you have emergency dental appointments?",
    whyRecommended: "Urgent callers want to know if your office can see them quickly.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "policy",
  },
  {
    key: "reschedule_cancel",
    category: "Appointments",
    question: "Can I reschedule or cancel my appointment?",
    whyRecommended: "A common request that otherwise lands on your front desk phone.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "policy",
  },
  {
    key: "preferred_time_intake",
    category: "Appointments",
    question: "How should AI ask for name and preferred time?",
    whyRecommended:
      "When a patient wants to book, a short intake question keeps the conversation moving.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "policy",
    suggestedAnswer: "What name should we use, and what day or time works best?",
  },

  // --------------------------------------------------------------- Insurance
  {
    key: "accepted_insurance",
    category: "Insurance",
    question: "What insurance do you accept?",
    whyRecommended: "Insurance is a top reason patients call before booking.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "medicaid",
    category: "Insurance",
    question: "Do you accept Medicaid?",
    whyRecommended: "A frequent question that deserves a clear yes/no.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "medicare",
    category: "Insurance",
    question: "Do you accept Medicare or Medicare Advantage dental plans?",
    whyRecommended: "Common for older patients comparing offices.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },
  {
    key: "ppo_hmo_notes",
    category: "Insurance",
    question: "Do you accept PPO or HMO plans?",
    whyRecommended: "Plan-type questions come up when patients compare coverage.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },
  {
    key: "insurance_unclear",
    category: "Insurance",
    question: "What should AI say when insurance is not listed?",
    whyRecommended:
      "Insurance details get complicated fast. A short handoff keeps answers accurate.",
    defaultStatus: "handoff",
    recommended: true,
    answerKind: "handoff",
    defaultHandoffText: HANDOFF_INSURANCE,
  },

  // ---------------------------------------------------------------- Services
  {
    key: "cleaning_preventive",
    category: "Services",
    question: "Do you offer cleanings and preventive care?",
    whyRecommended: "Core service almost every caller expects.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "exam_xrays",
    category: "Services",
    question: "Do you offer exams and X-rays?",
    whyRecommended: "Standard first-visit question.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "fillings",
    category: "Services",
    question: "Do you do fillings?",
    whyRecommended: "Common treatment patients confirm before booking.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "crowns_bridges",
    category: "Services",
    question: "Do you do crowns or bridges?",
    whyRecommended: "Frequently asked by patients with existing treatment plans.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "dentures",
    category: "Services",
    question: "Do you do dentures?",
    whyRecommended: "Common for patients seeking replacement options.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },
  {
    key: "root_canals",
    category: "Services",
    question: "Do you do root canals?",
    whyRecommended: "Patients in pain often ask this directly.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "extractions",
    category: "Services",
    question: "Do you do extractions?",
    whyRecommended: "A frequent urgent-need question.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "fact",
  },
  {
    key: "deep_cleaning_gum_treatment",
    category: "Services",
    question: "Do you offer deep cleanings or gum treatment?",
    whyRecommended: "Asked by patients referred for periodontal care.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },
  {
    key: "whitening",
    category: "Services",
    question: "Do you offer whitening?",
    whyRecommended: "Popular cosmetic request.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },
  {
    key: "veneers",
    category: "Services",
    question: "Do you do veneers?",
    whyRecommended: "Common cosmetic question.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },
  {
    key: "invisalign_clear_aligners",
    category: "Services",
    question: "Do you offer Invisalign or clear aligners?",
    whyRecommended: "Frequently asked by adults considering orthodontics.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },
  {
    key: "implants",
    category: "Services",
    question: "Do you do dental implants?",
    whyRecommended: "High-value question patients compare offices on.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },
  {
    key: "pediatric_dentistry",
    category: "Services",
    question: "Do you see children?",
    whyRecommended: "Families want to know if the whole household can come.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },
  {
    key: "wisdom_teeth",
    category: "Services",
    question: "Do you remove wisdom teeth?",
    whyRecommended: "Common question from younger patients and parents.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },
  {
    key: "sedation_dentistry",
    category: "Services",
    question: "Do you offer sedation dentistry?",
    whyRecommended: "Anxious patients often ask before booking.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },

  // ------------------------------------------------------ Payment & Policies
  {
    key: "pricing_cleaning",
    category: "Payment & Policies",
    question: "How much is a cleaning?",
    whyRecommended:
      "Price questions are common, but exact pricing varies. Handoff is the safe default unless you approve a precise answer.",
    defaultStatus: "handoff",
    recommended: true,
    answerKind: "policy",
    defaultHandoffText: HANDOFF_DEFAULT,
  },
  {
    key: "payment_plans_financing",
    category: "Payment & Policies",
    question: "Do you offer payment plans or financing?",
    whyRecommended: "Cost flexibility is a frequent deciding factor.",
    defaultStatus: "not_found",
    recommended: true,
    answerKind: "policy",
  },
  {
    key: "new_patient_forms",
    category: "Payment & Policies",
    question: "Do new patients need forms?",
    whyRecommended: "Saves a call before the first visit.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "policy",
  },
  {
    key: "what_to_bring",
    category: "Payment & Policies",
    question: "What should I bring to my first appointment?",
    whyRecommended: "Helps first visits start on time.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "policy",
  },
  {
    key: "cancellation_policy",
    category: "Payment & Policies",
    question: "What is your cancellation policy?",
    whyRecommended: "Clear policy wording avoids misunderstandings.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "policy",
  },
  {
    key: "languages_spoken",
    category: "Payment & Policies",
    question: "What languages does your office speak?",
    whyRecommended: "Helps patients who prefer another language feel welcome.",
    defaultStatus: "not_found",
    recommended: false,
    answerKind: "fact",
  },

  // -------------------------------------------------------- Safety & Handoff
  {
    key: "unknown_question_handoff",
    category: "Safety & Handoff",
    question: "What should AI say when it is not sure?",
    whyRecommended:
      "When AI doesn’t know the answer, it should hand the patient to your office instead of guessing.",
    defaultStatus: "handoff",
    recommended: true,
    answerKind: "handoff",
    defaultHandoffText: HANDOFF_DEFAULT,
  },
  {
    key: "medical_advice_handoff",
    category: "Safety & Handoff",
    question: "Medical advice or treatment questions",
    whyRecommended:
      "AI never gives medical or treatment advice. These questions always go to your office.",
    defaultStatus: "handoff",
    recommended: true,
    answerKind: "safety",
    defaultHandoffText: HANDOFF_MEDICAL,
  },
  {
    key: "urgent_symptoms_handoff",
    category: "Safety & Handoff",
    question: "Pain, swelling, bleeding, or urgent dental symptoms",
    whyRecommended:
      "Urgent symptoms are alerted to your office right away, never assessed by AI.",
    defaultStatus: "handoff",
    recommended: true,
    answerKind: "safety",
    defaultHandoffText: HANDOFF_URGENT,
  },
  {
    key: "complaint_handoff",
    category: "Safety & Handoff",
    question: "Complaints or unhappy patients",
    whyRecommended: "Complaints deserve a person, not an automated reply.",
    defaultStatus: "handoff",
    recommended: false,
    answerKind: "handoff",
    defaultHandoffText: HANDOFF_DEFAULT,
  },
  {
    key: "human_request_handoff",
    category: "Safety & Handoff",
    question: "Patient asks for a person",
    whyRecommended: "When a patient asks for a person, AI should step aside immediately.",
    defaultStatus: "handoff",
    recommended: true,
    answerKind: "handoff",
    defaultHandoffText: HANDOFF_DEFAULT,
  },
];

const catalogByKey = new Map(aiFrontDeskKnowledgeCatalog.map((item) => [item.key, item]));

export function findAiKnowledgeCatalogItem(key: string): AiKnowledgeCatalogItem | null {
  return catalogByKey.get(key) ?? null;
}

export function isAiKnowledgeStatus(value: string): value is AiKnowledgeStatus {
  return (AI_KNOWLEDGE_STATUSES as readonly string[]).includes(value);
}

export function isAiKnowledgeSourceType(value: string): value is AiKnowledgeSourceType {
  return (AI_KNOWLEDGE_SOURCE_TYPES as readonly string[]).includes(value);
}

// The answer a brand-new (unsaved) entry starts with: the handoff default for
// handoff/safety items, the suggested wording for policy items, otherwise empty.
export function defaultAnswerForCatalogItem(item: AiKnowledgeCatalogItem): string {
  return item.defaultHandoffText ?? item.suggestedAnswer ?? "";
}
