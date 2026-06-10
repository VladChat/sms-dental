// Pure AI Front Desk Knowledge helpers: catalog merge + update validation.
//
// No DB or framework imports so these can be unit-tested directly. The DB
// helper (lib/db/ai-knowledge.ts) and the account API route build on these.
// This is account-side foundation only — nothing here sends SMS, calls an AI
// provider, or changes patient-facing behavior.

import {
  AI_KNOWLEDGE_ANSWER_MAX_LENGTH,
  aiFrontDeskKnowledgeCatalog,
  defaultAnswerForCatalogItem,
  findAiKnowledgeCatalogItem,
  isAiKnowledgeStatus,
  isAiKnowledgeSourceType,
  type AiKnowledgeAnswerKind,
  type AiKnowledgeSourceType,
  type AiKnowledgeStatus,
} from "../../config/ai-front-desk-knowledge.config";

// The persisted-row shape the merge needs (subset of the DB row, snake_case to
// match the table; the DB helper passes rows through unchanged).
export type AiKnowledgePersistedEntry = {
  question_key: string;
  status: string;
  answer: string | null;
  source_type: string;
  reviewed_at: Date | null;
  updated_at: Date | null;
};

// Owner-safe merged entry returned by GET /api/account/ai-knowledge. Catalog
// copy (question/category) is included so the server stays the source of truth;
// the UI joins richer catalog metadata (whyRecommended, answerKind) by key.
export type AiKnowledgeEntryView = {
  questionKey: string;
  category: string;
  question: string;
  status: AiKnowledgeStatus;
  answer: string;
  sourceType: AiKnowledgeSourceType;
  persisted: boolean;
  reviewedAt: string | null;
  updatedAt: string | null;
};

// Merge persisted rows with the committed catalog. The catalog drives the
// output: every catalog question appears exactly once (so new catalog questions
// show up before the owner ever saves them), and persisted rows whose key is no
// longer in the catalog are ignored. Rows must already be clinic-scoped by the
// caller — this function never mixes clinics because it only sees one list.
export function mergeAiKnowledgeEntries(
  persisted: readonly AiKnowledgePersistedEntry[],
): AiKnowledgeEntryView[] {
  const byKey = new Map<string, AiKnowledgePersistedEntry>();
  for (const row of persisted) {
    if (findAiKnowledgeCatalogItem(row.question_key)) byKey.set(row.question_key, row);
  }
  return aiFrontDeskKnowledgeCatalog.map((item) => {
    const row = byKey.get(item.key);
    if (!row) {
      return {
        questionKey: item.key,
        category: item.category,
        question: item.question,
        status: item.defaultStatus,
        answer: defaultAnswerForCatalogItem(item),
        sourceType: "system_default" as const,
        persisted: false,
        reviewedAt: null,
        updatedAt: null,
      };
    }
    return {
      questionKey: item.key,
      category: item.category,
      question: item.question,
      // Defensive: an unexpected stored value falls back to the catalog default
      // rather than leaking an unknown status to the UI.
      status: isAiKnowledgeStatus(row.status) ? row.status : item.defaultStatus,
      answer: row.answer ?? "",
      sourceType: isAiKnowledgeSourceType(row.source_type) ? row.source_type : "manual",
      persisted: true,
      reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    };
  });
}

export type AiKnowledgeUpdateInput = {
  questionKey: unknown;
  status: unknown;
  answer: unknown;
  sourceType: unknown;
};

export type AiKnowledgeValidatedUpdate = {
  questionKey: string;
  category: string;
  question: string;
  answerKind: AiKnowledgeAnswerKind;
  status: AiKnowledgeStatus;
  // null means "no answer stored" (allowed for do_not_answer / not_found).
  answer: string | null;
  sourceType: "manual";
  // True when the status is an explicit owner decision (approve/handoff/
  // do-not-answer) and the row should record reviewed_at/reviewed_by.
  isReviewDecision: boolean;
};

export type AiKnowledgeValidationResult =
  | { ok: true; update: AiKnowledgeValidatedUpdate }
  | { ok: false; message: string };

// Obvious placeholder/demo content that must never be saved as a clinic answer.
const SAMPLE_DATA_PATTERNS = [/example\.com/i, /lorem ipsum/i, /\{\{\s*\w+\s*\}\}/];

// Validate one owner update against the committed catalog and the product
// safety rules. Category/question always come from the catalog item, never
// from the client.
export function validateAiKnowledgeUpdate(
  input: AiKnowledgeUpdateInput,
): AiKnowledgeValidationResult {
  if (typeof input.questionKey !== "string") {
    return { ok: false, message: "Unknown question." };
  }
  const item = findAiKnowledgeCatalogItem(input.questionKey);
  if (!item) {
    return { ok: false, message: "Unknown question." };
  }

  if (typeof input.status !== "string" || !isAiKnowledgeStatus(input.status)) {
    return { ok: false, message: "Choose a valid status for this answer." };
  }
  const status = input.status;

  if (input.sourceType !== undefined && input.sourceType !== "manual") {
    // Owner edits are always manual; website_draft/business_profile/
    // system_default entries are created server-side only (future phases).
    return { ok: false, message: "Invalid answer source." };
  }

  if (input.answer !== undefined && input.answer !== null && typeof input.answer !== "string") {
    return { ok: false, message: "Invalid answer text." };
  }
  let answer = typeof input.answer === "string" ? input.answer.trim() : "";

  if (answer.length > AI_KNOWLEDGE_ANSWER_MAX_LENGTH) {
    return {
      ok: false,
      message: `Keep the answer under ${AI_KNOWLEDGE_ANSWER_MAX_LENGTH} characters.`,
    };
  }
  if (answer.length > 0 && SAMPLE_DATA_PATTERNS.some((re) => re.test(answer))) {
    return { ok: false, message: "Please replace the sample text with your office’s real answer." };
  }

  if (item.answerKind === "safety") {
    // Safety entries always use the standard short reply so the wording can
    // never drift into medical/diagnostic territory. Owners choose handoff or
    // do-not-answer; they do not edit the text and cannot "approve" a custom one.
    if (status !== "handoff" && status !== "do_not_answer") {
      return {
        ok: false,
        message: "This question always goes to your office. Choose handoff or do not answer.",
      };
    }
    answer = item.defaultHandoffText ?? "";
  }

  if (item.answerKind === "handoff" && (status === "approved" || status === "not_found")) {
    // Handoff entries are office-handoff wordings by design — they can be
    // drafted, used as handoff, or turned off, but never "approved" as a
    // direct AI answer.
    return {
      ok: false,
      message: "This question always goes to your office. Choose handoff or do not answer.",
    };
  }

  if (status === "approved" && answer.length === 0) {
    return { ok: false, message: "Add the answer AI may use before approving." };
  }
  if (status === "handoff" && answer.length === 0) {
    // Handoff may fall back to the item default (or the generic short handoff).
    answer = item.defaultHandoffText ?? "I’ll pass this to the office and they’ll follow up shortly.";
  }

  return {
    ok: true,
    update: {
      questionKey: item.key,
      category: item.category,
      question: item.question,
      answerKind: item.answerKind,
      status,
      answer: answer.length > 0 ? answer : null,
      sourceType: "manual",
      isReviewDecision:
        status === "approved" || status === "handoff" || status === "do_not_answer",
    },
  };
}
