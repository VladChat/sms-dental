import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_KNOWLEDGE_ANSWER_MAX_LENGTH,
  AI_KNOWLEDGE_CATEGORIES,
  aiFrontDeskKnowledgeCatalog,
  defaultAnswerForCatalogItem,
  findAiKnowledgeCatalogItem,
} from "../config/ai-front-desk-knowledge.config";
import {
  mergeAiKnowledgeEntries,
  validateAiKnowledgeUpdate,
  type AiKnowledgePersistedEntry,
} from "../lib/ai-knowledge/entries";

function persistedRow(overrides: Partial<AiKnowledgePersistedEntry>): AiKnowledgePersistedEntry {
  return {
    question_key: "office_hours",
    status: "approved",
    answer: "Mon–Fri 8am–5pm.",
    source_type: "manual",
    reviewed_at: new Date("2026-06-10T12:00:00Z"),
    updated_at: new Date("2026-06-10T12:00:00Z"),
    ...overrides,
  };
}

// ------------------------------------------------------------ catalog integrity

test("catalog keys are unique and snake_case", () => {
  const keys = aiFrontDeskKnowledgeCatalog.map((item) => item.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) {
    assert.match(key, /^[a-z][a-z0-9_]*$/);
  }
});

test("catalog covers all required categories with no duplicate questions", () => {
  for (const category of AI_KNOWLEDGE_CATEGORIES) {
    assert.ok(
      aiFrontDeskKnowledgeCatalog.some((item) => item.category === category),
      `missing category: ${category}`,
    );
  }
  const questions = aiFrontDeskKnowledgeCatalog.map((item) => item.question);
  assert.equal(new Set(questions).size, questions.length);
});

test("catalog has the full recommended question set", () => {
  assert.ok(aiFrontDeskKnowledgeCatalog.length >= 41);
  assert.ok(aiFrontDeskKnowledgeCatalog.some((item) => item.recommended));
  for (const key of [
    "office_hours",
    "accepting_new_patients",
    "accepted_insurance",
    "cleaning_preventive",
    "pricing_cleaning",
    "unknown_question_handoff",
    "medical_advice_handoff",
    "urgent_symptoms_handoff",
    "human_request_handoff",
  ]) {
    const item = findAiKnowledgeCatalogItem(key);
    assert.ok(item, `missing catalog key: ${key}`);
    assert.equal(item.recommended, true, `${key} should be recommended`);
  }
});

test("every catalog item has valid status/action metadata", () => {
  for (const item of aiFrontDeskKnowledgeCatalog) {
    assert.ok(
      ["not_found", "handoff", "do_not_answer"].includes(item.defaultStatus),
      `${item.key} has invalid defaultStatus`,
    );
    assert.ok(
      ["fact", "policy", "handoff", "safety"].includes(item.answerKind),
      `${item.key} has invalid answerKind`,
    );
    assert.ok(
      (AI_KNOWLEDGE_CATEGORIES as readonly string[]).includes(item.category),
      `${item.key} has unknown category`,
    );
    assert.ok(item.question.trim().length > 0);
    assert.ok(item.whyRecommended.trim().length > 0);
    if (item.answerKind === "handoff" || item.answerKind === "safety") {
      assert.ok(item.defaultHandoffText, `${item.key} needs defaultHandoffText`);
      assert.equal(item.defaultStatus, "handoff", `${item.key} should default to handoff`);
    }
  }
});

// ------------------------------------------------------------------ safety copy

test("medical advice default hands off without diagnosis/treatment advice", () => {
  const item = findAiKnowledgeCatalogItem("medical_advice_handoff");
  assert.ok(item);
  assert.ok(item.defaultHandoffText);
  const text = item.defaultHandoffText.toLowerCase();
  assert.ok(text.includes("911"));
  for (const banned of ["diagnos", "treatment", "prescri", "medication", "dose", "antibiotic"]) {
    assert.ok(!text.includes(banned), `medical default must not mention "${banned}"`);
  }
});

test("urgent symptoms default includes 911 and stays a handoff", () => {
  const item = findAiKnowledgeCatalogItem("urgent_symptoms_handoff");
  assert.ok(item);
  assert.ok(item.defaultHandoffText);
  assert.ok(item.defaultHandoffText.includes("911"));
  assert.equal(item.answerKind, "safety");
  assert.equal(item.defaultStatus, "handoff");
});

test("unknown-question fallback is short and handoff-oriented", () => {
  const item = findAiKnowledgeCatalogItem("unknown_question_handoff");
  assert.ok(item);
  assert.ok(item.defaultHandoffText);
  assert.ok(item.defaultHandoffText.length <= 120);
  assert.ok(item.defaultHandoffText.toLowerCase().includes("office"));
});

test("handoff defaults are short, calm, and non-clinical", () => {
  for (const item of aiFrontDeskKnowledgeCatalog) {
    if (!item.defaultHandoffText) continue;
    assert.ok(item.defaultHandoffText.length <= 160, `${item.key} handoff text too long`);
    assert.ok(!/guarantee|discount|urgent(ly)? book|act now/i.test(item.defaultHandoffText));
  }
});

// ----------------------------------------------------------------- merge helper

test("merge with no persisted rows returns virtual catalog entries", () => {
  const merged = mergeAiKnowledgeEntries([]);
  assert.equal(merged.length, aiFrontDeskKnowledgeCatalog.length);
  for (const entry of merged) {
    const item = findAiKnowledgeCatalogItem(entry.questionKey);
    assert.ok(item);
    assert.equal(entry.persisted, false);
    assert.equal(entry.status, item.defaultStatus);
    assert.equal(entry.answer, defaultAnswerForCatalogItem(item));
    assert.equal(entry.sourceType, "system_default");
  }
});

test("persisted approved answer overrides the catalog default", () => {
  const merged = mergeAiKnowledgeEntries([
    persistedRow({ question_key: "accepted_insurance", answer: "Delta Dental, Aetna, Cigna." }),
  ]);
  const entry = merged.find((e) => e.questionKey === "accepted_insurance");
  assert.ok(entry);
  assert.equal(entry.persisted, true);
  assert.equal(entry.status, "approved");
  assert.equal(entry.answer, "Delta Dental, Aetna, Cigna.");
  assert.equal(entry.sourceType, "manual");
});

test("unknown persisted keys are ignored", () => {
  const merged = mergeAiKnowledgeEntries([
    persistedRow({ question_key: "retired_question_key" }),
  ]);
  assert.equal(merged.length, aiFrontDeskKnowledgeCatalog.length);
  assert.ok(!merged.some((e) => e.questionKey === "retired_question_key"));
  assert.ok(merged.every((e) => !e.persisted));
});

test("invalid stored status falls back to the catalog default", () => {
  const merged = mergeAiKnowledgeEntries([
    persistedRow({ question_key: "office_hours", status: "totally_bogus" }),
  ]);
  const entry = merged.find((e) => e.questionKey === "office_hours");
  assert.ok(entry);
  assert.equal(entry.status, "not_found");
});

test("merge is pure: one clinic's rows never leak into another merge", () => {
  const clinicA = mergeAiKnowledgeEntries([
    persistedRow({ question_key: "office_hours", answer: "Clinic A hours." }),
  ]);
  const clinicB = mergeAiKnowledgeEntries([]);
  assert.equal(clinicA.find((e) => e.questionKey === "office_hours")?.answer, "Clinic A hours.");
  const entryB = clinicB.find((e) => e.questionKey === "office_hours");
  assert.ok(entryB);
  assert.equal(entryB.persisted, false);
  assert.notEqual(entryB.answer, "Clinic A hours.");
});

// ------------------------------------------------------------------ validation

test("rejects unknown question keys", () => {
  const result = validateAiKnowledgeUpdate({
    questionKey: "made_up_key",
    status: "approved",
    answer: "Yes.",
    sourceType: "manual",
  });
  assert.equal(result.ok, false);
});

test("rejects invalid statuses", () => {
  const result = validateAiKnowledgeUpdate({
    questionKey: "office_hours",
    status: "published",
    answer: "Yes.",
    sourceType: "manual",
  });
  assert.equal(result.ok, false);
});

test("rejects overlong answers", () => {
  const result = validateAiKnowledgeUpdate({
    questionKey: "office_hours",
    status: "approved",
    answer: "x".repeat(AI_KNOWLEDGE_ANSWER_MAX_LENGTH + 1),
    sourceType: "manual",
  });
  assert.equal(result.ok, false);
});

test("rejects approved with an empty answer", () => {
  const result = validateAiKnowledgeUpdate({
    questionKey: "office_hours",
    status: "approved",
    answer: "   ",
    sourceType: "manual",
  });
  assert.equal(result.ok, false);
});

test("accepts do_not_answer without an answer", () => {
  const result = validateAiKnowledgeUpdate({
    questionKey: "office_hours",
    status: "do_not_answer",
    answer: "",
    sourceType: "manual",
  });
  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.equal(result.update.answer, null);
  assert.equal(result.update.isReviewDecision, true);
});

test("handoff with empty answer falls back to the default handoff text", () => {
  const result = validateAiKnowledgeUpdate({
    questionKey: "insurance_unclear",
    status: "handoff",
    answer: "",
    sourceType: "manual",
  });
  assert.ok(result.ok);
  const item = findAiKnowledgeCatalogItem("insurance_unclear");
  assert.equal(result.update.answer, item?.defaultHandoffText);
});

test("safety entries cannot be approved and always keep the standard reply", () => {
  const approved = validateAiKnowledgeUpdate({
    questionKey: "medical_advice_handoff",
    status: "approved",
    answer: "Take two aspirin.",
    sourceType: "manual",
  });
  assert.equal(approved.ok, false);

  const handoff = validateAiKnowledgeUpdate({
    questionKey: "medical_advice_handoff",
    status: "handoff",
    answer: "Custom wording that should be ignored.",
    sourceType: "manual",
  });
  assert.ok(handoff.ok);
  const item = findAiKnowledgeCatalogItem("medical_advice_handoff");
  assert.equal(handoff.update.answer, item?.defaultHandoffText);
});

test("handoff-kind entries cannot be approved as direct answers", () => {
  const result = validateAiKnowledgeUpdate({
    questionKey: "unknown_question_handoff",
    status: "approved",
    answer: "I can answer anything!",
    sourceType: "manual",
  });
  assert.equal(result.ok, false);
});

test("rejects sample/demo data", () => {
  for (const sample of [
    "Visit us at https://example.com for details.",
    "Lorem ipsum dolor sit amet.",
    "Hi {{patient_name}}, yes we do!",
  ]) {
    const result = validateAiKnowledgeUpdate({
      questionKey: "office_hours",
      status: "approved",
      answer: sample,
      sourceType: "manual",
    });
    assert.equal(result.ok, false, `should reject sample data: ${sample}`);
  }
});

test("rejects non-manual source types from clients", () => {
  for (const sourceType of ["website_draft", "business_profile", "system_default", "robot"]) {
    const result = validateAiKnowledgeUpdate({
      questionKey: "office_hours",
      status: "approved",
      answer: "Mon–Fri 8am–5pm.",
      sourceType,
    });
    assert.equal(result.ok, false, `should reject sourceType: ${sourceType}`);
  }
});

test("save draft is not a review decision; approve uses server catalog copy", () => {
  const draft = validateAiKnowledgeUpdate({
    questionKey: "office_hours",
    status: "needs_review",
    answer: "Draft hours.",
    sourceType: "manual",
  });
  assert.ok(draft.ok);
  assert.equal(draft.update.isReviewDecision, false);

  const approved = validateAiKnowledgeUpdate({
    questionKey: "office_hours",
    status: "approved",
    answer: "Mon–Fri 8am–5pm.",
    sourceType: "manual",
  });
  assert.ok(approved.ok);
  assert.equal(approved.update.isReviewDecision, true);
  const item = findAiKnowledgeCatalogItem("office_hours");
  assert.equal(approved.update.category, item?.category);
  assert.equal(approved.update.question, item?.question);
});
