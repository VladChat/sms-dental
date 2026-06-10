import { getDb } from "./client";
import {
  mergeAiKnowledgeEntries,
  type AiKnowledgeEntryView,
  type AiKnowledgePersistedEntry,
  type AiKnowledgeValidatedUpdate,
} from "../ai-knowledge/entries";

// Clinic-scoped AI Front Desk Knowledge entries (foundation only — no AI
// runtime reads this yet). Rows store owner-reviewed answers; the committed
// catalog in config/ai-front-desk-knowledge.config.ts supplies every question,
// so unsaved questions are returned as virtual (persisted: false) entries.

const ENTRY_COLS = [
  "question_key",
  "status",
  "answer",
  "source_type",
  "reviewed_at",
  "updated_at",
] as const;

// List the merged knowledge entries for one clinic: persisted rows override
// catalog defaults; catalog questions without a row appear as virtual entries.
export async function listClinicAiKnowledgeEntries(
  clinicId: string,
): Promise<AiKnowledgeEntryView[]> {
  const sql = getDb();
  const rows = await sql<AiKnowledgePersistedEntry[]>`
    select ${sql(ENTRY_COLS)}
    from public.clinic_ai_knowledge_entries
    where clinic_id = ${clinicId}
  `;
  return mergeAiKnowledgeEntries(rows);
}

// Upsert one validated owner update. Category/question are re-written from the
// validated catalog copy so stored rows always match the committed catalog.
// reviewed_at/reviewed_by are set only for explicit decisions (approve /
// handoff / do-not-answer) and cleared again when the entry returns to draft.
export async function upsertClinicAiKnowledgeEntry(params: {
  clinicId: string;
  update: AiKnowledgeValidatedUpdate;
  reviewedByProfileId: string | null;
}): Promise<AiKnowledgeEntryView> {
  const { clinicId, update } = params;
  const sql = getDb();
  const reviewedAt = update.isReviewDecision ? new Date() : null;
  const reviewedBy = update.isReviewDecision ? params.reviewedByProfileId : null;
  const rows = await sql<AiKnowledgePersistedEntry[]>`
    insert into public.clinic_ai_knowledge_entries (
      clinic_id, question_key, category, question,
      status, answer, source_type, reviewed_at, reviewed_by_profile_id
    ) values (
      ${clinicId}, ${update.questionKey}, ${update.category}, ${update.question},
      ${update.status}, ${update.answer}, ${update.sourceType}, ${reviewedAt}, ${reviewedBy}
    )
    on conflict (clinic_id, question_key) do update set
      category = excluded.category,
      question = excluded.question,
      status = excluded.status,
      answer = excluded.answer,
      source_type = excluded.source_type,
      reviewed_at = excluded.reviewed_at,
      reviewed_by_profile_id = excluded.reviewed_by_profile_id
    returning ${sql(ENTRY_COLS)}
  `;
  const entry = mergeAiKnowledgeEntries(rows).find(
    (e) => e.questionKey === update.questionKey,
  );
  if (!entry) {
    // Unreachable for validated updates (the key came from the catalog).
    throw new Error("ai knowledge upsert returned no catalog entry");
  }
  return entry;
}
