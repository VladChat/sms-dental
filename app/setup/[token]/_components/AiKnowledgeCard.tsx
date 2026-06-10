"use client";

import { useEffect, useState } from "react";
import { StatusBadge, type StatusKind } from "./AccountUI";
import {
  AI_KNOWLEDGE_ANSWER_MAX_LENGTH,
  AI_KNOWLEDGE_CATEGORIES,
  aiFrontDeskKnowledgeCatalog,
  defaultAnswerForCatalogItem,
  type AiKnowledgeCatalogItem,
  type AiKnowledgeSourceType,
  type AiKnowledgeStatus,
} from "../../../../config/ai-front-desk-knowledge.config";

// AI Front Desk Knowledge (foundation only). Owners review/approve the answers
// a FUTURE AI assistant may use with patients. AI replies are NOT live: nothing
// in this card sends SMS, calls an AI provider, or crawls a website. The
// Website field stays owned by Business profile — this card only reads it.

type EntryState = {
  status: AiKnowledgeStatus;
  answer: string;
  sourceType: AiKnowledgeSourceType;
  persisted: boolean;
  saving: boolean;
  error: string | null;
  justSaved: boolean;
};

type FetchedEntry = {
  questionKey: string;
  status: AiKnowledgeStatus;
  answer: string;
  sourceType: AiKnowledgeSourceType;
  persisted: boolean;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "signin_required" }
  | { kind: "error" }
  | { kind: "ready"; website: string };

const STATUS_BADGE: Record<AiKnowledgeStatus, { kind: StatusKind; label: string }> = {
  approved: { kind: "complete", label: "Approved" },
  needs_review: { kind: "waiting", label: "Needs review" },
  handoff: { kind: "not_active", label: "Handoff to office" },
  do_not_answer: { kind: "not_active", label: "Do not answer" },
  not_found: { kind: "needs_setup", label: "No answer yet" },
};

const SOURCE_LABEL: Record<AiKnowledgeSourceType, string> = {
  system_default: "System default",
  manual: "Manual",
  website_draft: "Website draft",
  business_profile: "Business profile",
};

function initialEntryState(item: AiKnowledgeCatalogItem): EntryState {
  return {
    status: item.defaultStatus,
    answer: defaultAnswerForCatalogItem(item),
    sourceType: "system_default",
    persisted: false,
    saving: false,
    error: null,
    justSaved: false,
  };
}

export function AiKnowledgeCard({
  website,
  onGoToBusinessProfile,
}: {
  // Business profile website (initial server value). The GET response value
  // wins once loaded so the card always shows the saved website.
  website: string;
  onGoToBusinessProfile: () => void;
}) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [entries, setEntries] = useState<Record<string, EntryState>>(() =>
    Object.fromEntries(
      aiFrontDeskKnowledgeCatalog.map((item) => [item.key, initialEntryState(item)]),
    ),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/ai-knowledge", { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setLoad({ kind: "signin_required" });
          return;
        }
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; website?: string; entries?: FetchedEntry[] }
          | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok || !Array.isArray(json.entries)) {
          setLoad({ kind: "error" });
          return;
        }
        setEntries((prev) => {
          const next = { ...prev };
          for (const e of json.entries ?? []) {
            if (!next[e.questionKey]) continue;
            next[e.questionKey] = {
              ...next[e.questionKey],
              status: e.status,
              answer: e.answer,
              sourceType: e.sourceType,
              persisted: e.persisted,
            };
          }
          return next;
        });
        setLoad({ kind: "ready", website: json.website ?? "" });
      } catch {
        if (!cancelled) setLoad({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function patchEntry(key: string, patch: Partial<EntryState>) {
    setEntries((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function saveEntry(item: AiKnowledgeCatalogItem, status: AiKnowledgeStatus) {
    const current = entries[item.key];
    if (!current || current.saving) return;
    patchEntry(item.key, { saving: true, error: null, justSaved: false });
    // For fact/policy questions, switching to handoff/do-not-answer is a status
    // decision — the server fills the standard short handoff wording itself.
    const sendsAnswer =
      status === "approved" ||
      status === "needs_review" ||
      (status === "handoff" && (item.answerKind === "handoff" || item.answerKind === "safety"));
    try {
      const res = await fetch("/api/account/ai-knowledge", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionKey: item.key,
          status,
          answer: sendsAnswer ? current.answer : "",
          sourceType: "manual",
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; entry?: FetchedEntry; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok || !json.entry) {
        patchEntry(item.key, {
          saving: false,
          error: json?.error?.message ?? "Could not save this answer. Please try again.",
        });
        return;
      }
      patchEntry(item.key, {
        saving: false,
        status: json.entry.status,
        answer: json.entry.answer,
        sourceType: json.entry.sourceType,
        persisted: json.entry.persisted,
        justSaved: true,
      });
    } catch {
      patchEntry(item.key, {
        saving: false,
        error: "Could not save this answer. Please try again.",
      });
    }
  }

  const allStates = Object.values(entries);
  const approvedCount = allStates.filter((e) => e.status === "approved").length;
  const needsReviewCount = allStates.filter(
    (e) => e.status === "needs_review" || e.status === "not_found",
  ).length;
  const handoffCount = allStates.filter(
    (e) => e.status === "handoff" || e.status === "do_not_answer",
  ).length;

  const effectiveWebsite = (load.kind === "ready" ? load.website : website).trim();

  if (load.kind === "signin_required") {
    return (
      <div className="alert alert-info" role="status">
        <span>Please sign in with your owner or admin account to manage AI knowledge.</span>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <div className="alert alert-info" role="status">
        <span>
          <strong>AI replies are off.</strong>
          These answers are saved for future SMS and voice AI. Patients will not receive
          AI-generated replies from this screen.
        </span>
      </div>

      <section className="acct-callout" aria-labelledby="aik-website-title">
        <h3 id="aik-website-title" className="t-h4">Website source</h3>
        {effectiveWebsite ? (
          <>
            <p className="t-body" style={{ overflowWrap: "anywhere", fontWeight: 600 }}>
              {effectiveWebsite}
            </p>
            <p className="t-small">
              Future website scan will use this Business profile website to suggest common
              answers. Website scanning is not live in this step.
            </p>
            <p style={{ marginTop: "var(--space-2)" }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onGoToBusinessProfile}>
                Edit Business profile
              </button>
            </p>
          </>
        ) : (
          <>
            <p className="t-body" style={{ fontWeight: 600 }}>No website added yet.</p>
            <p className="t-small">
              Add your website in Business profile so future AI setup can suggest common
              answers automatically.
            </p>
            <p style={{ marginTop: "var(--space-2)" }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onGoToBusinessProfile}>
                Go to Business profile
              </button>
            </p>
          </>
        )}
      </section>

      {load.kind === "error" && (
        <div className="alert alert-error" role="alert">
          <span>We couldn’t load your saved answers. Please refresh and try again.</span>
        </div>
      )}

      {load.kind === "loading" ? (
        <p className="t-small" role="status" aria-live="polite">Loading your answer library…</p>
      ) : (
        <>
          <div className="acct-grid-3" role="group" aria-label="Answer library summary">
            <SummaryStat label="Approved answers" value={approvedCount} />
            <SummaryStat label="Needs review" value={needsReviewCount} />
            <SummaryStat label="Handoff / do not answer" value={handoffCount} />
          </div>

          {AI_KNOWLEDGE_CATEGORIES.map((category) => {
            const items = aiFrontDeskKnowledgeCatalog.filter((i) => i.category === category);
            if (items.length === 0) return null;
            const headingId = `aik-cat-${category.replace(/[^a-z]+/gi, "-").toLowerCase()}`;
            return (
              <section key={category} aria-labelledby={headingId} style={{ display: "grid", gap: "var(--space-4)" }}>
                <h3 id={headingId} className="t-h4">{category}</h3>
                {items.map((item) => (
                  <QuestionCard
                    key={item.key}
                    item={item}
                    entry={entries[item.key]}
                    onAnswerChange={(v) => patchEntry(item.key, { answer: v, justSaved: false })}
                    onAction={(status) => saveEntry(item, status)}
                  />
                ))}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="acct-number" style={{ display: "grid", gap: "var(--space-1)" }}>
      <p className="t-metric">{value}</p>
      <p className="t-small">{label}</p>
    </div>
  );
}

function QuestionCard({
  item,
  entry,
  onAnswerChange,
  onAction,
}: {
  item: AiKnowledgeCatalogItem;
  entry: EntryState;
  onAnswerChange: (value: string) => void;
  onAction: (status: AiKnowledgeStatus) => void;
}) {
  const badge = STATUS_BADGE[entry.status];
  const isSafety = item.answerKind === "safety";
  const isHandoffKind = item.answerKind === "handoff";
  const answerId = `aik-answer-${item.key}`;
  const answerLabel = isHandoffKind ? "Reply AI may use before handing off" : "Answer AI may use";

  return (
    <article className="acct-number" aria-labelledby={`aik-q-${item.key}`} style={{ display: "grid", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <h4 id={`aik-q-${item.key}`} className="t-body" style={{ fontWeight: 700, margin: 0 }}>
          {item.question}
        </h4>
        <span style={{ display: "inline-flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {item.recommended && <span className="badge badge-brand">Recommended</span>}
          <StatusBadge kind={badge.kind} label={badge.label} />
        </span>
      </div>

      <p className="t-helper" style={{ margin: 0 }}>{item.whyRecommended}</p>

      {isSafety ? (
        <div className="field">
          <label htmlFor={answerId}>Standard reply (not editable)</label>
          <textarea
            id={answerId}
            className="textarea acct-readonly"
            value={item.defaultHandoffText ?? ""}
            readOnly
            aria-readonly="true"
            rows={2}
          />
          <p className="helper">
            This safety reply always hands the patient to your office and is never changed
            into medical advice.
          </p>
        </div>
      ) : (
        <div className="field">
          <label htmlFor={answerId}>{answerLabel}</label>
          <textarea
            id={answerId}
            className="textarea"
            value={entry.answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            rows={3}
            maxLength={AI_KNOWLEDGE_ANSWER_MAX_LENGTH}
            disabled={entry.saving}
            placeholder="Patients often ask this. Add the answer AI may use, or choose handoff."
          />
          <p className="helper">Source: {SOURCE_LABEL[entry.sourceType]}</p>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
        {!isSafety && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={entry.saving}
            onClick={() => onAction("needs_review")}
          >
            Save draft
          </button>
        )}
        {!isSafety && !isHandoffKind && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={entry.saving}
            onClick={() => onAction("approved")}
          >
            Approve answer
          </button>
        )}
        <button
          type="button"
          className={isSafety || isHandoffKind ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
          disabled={entry.saving}
          onClick={() => onAction("handoff")}
        >
          Use handoff
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={entry.saving}
          onClick={() => onAction("do_not_answer")}
        >
          Do not answer automatically
        </button>
        {entry.saving && (
          <span className="t-small" role="status" aria-live="polite">Saving…</span>
        )}
        {!entry.saving && entry.justSaved && (
          <span className="t-small acct-savebar-status" role="status" aria-live="polite">Saved</span>
        )}
      </div>

      {entry.error && (
        <p className="helper" role="alert" style={{ color: "var(--error-text)", margin: 0 }}>
          {entry.error}
        </p>
      )}
    </article>
  );
}
