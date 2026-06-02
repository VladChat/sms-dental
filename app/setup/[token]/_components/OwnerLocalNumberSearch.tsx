"use client";

import { useMemo, useState } from "react";

type Candidate = {
  phone_number: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  address_requirements: string;
  recommended: boolean;
  selectable: boolean;
  type: "local" | "toll_free";
};

type SearchResponse = {
  ok?: boolean;
  count?: number;
  numbers?: Candidate[];
  params?: { area_code: string | null; postal_code: string | null };
  attempt_label?: string | null;
  fallback_message?: string | null;
  empty_reason?: string | null;
  error?: { message?: string };
};

export function OwnerLocalNumberSearch({
  hasPaymentMethod,
  onGoToBilling,
}: {
  hasPaymentMethod: boolean;
  onGoToBilling: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const displayedCandidates = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => locationRank(b) - locationRank(a));
    const localityCount = sorted.filter((c) => Boolean(c.locality)).length;
    return localityCount >= 3
      ? sorted.filter((c) => c.locality || c.region)
      : sorted;
  }, [candidates]);

  const selectedCandidate =
    displayedCandidates.find((c) => c.phone_number === selected) ??
    candidates.find((c) => c.phone_number === selected) ??
    null;

  async function search() {
    setSearching(true);
    setSearched(false);
    setSearchError(null);
    setActionError(null);
    setFallbackMessage(null);
    setSelected(null);
    try {
      const res = await fetch("/api/account/phone-numbers/search", {
        method: "GET",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as SearchResponse | null;
      if (!res.ok || !json?.ok) {
        setSearchError(json?.error?.message ?? "Could not search local numbers.");
        setCandidates([]);
        setSearched(true);
        return;
      }
      setCandidates(json.numbers ?? []);
      setFallbackMessage(json.fallback_message ?? null);
      setSearched(true);
    } catch {
      setSearchError("Could not search local numbers. Please try again.");
      setCandidates([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  function useSelectedNumber() {
    setActionError(
      "Number assignment is not available yet. Our team can finish setup for you.",
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <button type="button" className="btn btn-primary" onClick={() => void search()} disabled={searching}>
        {searching ? "Searching…" : "Search local numbers"}
      </button>

      {searchError && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{searchError}</span>
        </div>
      )}

      {fallbackMessage && !searchError && (
        <p className="t-small" style={{ color: "var(--text-muted)", margin: 0 }}>
          {fallbackMessage}
        </p>
      )}

      {searched && !searchError && candidates.length === 0 && (
        <p className="t-small" style={{ color: "var(--text-muted)", margin: 0 }}>
          No local numbers are available for this area right now. We can still finish setup and assign the best available number manually.
        </p>
      )}

      {displayedCandidates.length > 0 && (
        <fieldset className="acct-cand-list">
          <legend className="t-helper">Choose a number</legend>
          {displayedCandidates.map((c) => {
            const checked = selected === c.phone_number;
            const showRecommended = shouldShowRecommended(c, displayedCandidates);
            return (
              <label
                key={c.phone_number}
                className={`acct-cand${checked ? " is-selected" : ""}${c.selectable ? "" : " is-disabled"}`}
              >
                <input
                  type="radio"
                  name="owner-local-number"
                  value={c.phone_number}
                  checked={checked}
                  disabled={!c.selectable}
                  onChange={() => {
                    setSelected(c.phone_number);
                    setActionError(null);
                  }}
                />
                <span className="acct-cand-body">
                  <span className="acct-cand-top">
                    <span className="acct-cand-num">{c.friendly_name || c.phone_number}</span>
                    {showRecommended && <span className="badge badge-info">Recommended</span>}
                  </span>
                  <span className="acct-cand-meta">
                    <span className="t-mono">{c.phone_number}</span>
                    <span>{locationLabel(c)}</span>
                  </span>
                  <span className="acct-cand-caps">
                    {c.capabilities.voice && <span className="badge badge-success">Voice</span>}
                    {c.capabilities.sms && <span className="badge badge-success">SMS</span>}
                    {!c.selectable && <span className="badge badge-warning">Voice + SMS required</span>}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {selectedCandidate && (
        <div className="acct-number-action">
          <div>
            <span className="t-eyebrow">Selected number</span>
            <p className="t-h4 t-mono" style={{ margin: "var(--space-1) 0 0" }}>
              {selectedCandidate.friendly_name || selectedCandidate.phone_number}
            </p>
            <p className="t-small t-mono" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
              {selectedCandidate.phone_number}
            </p>
          </div>

          {!hasPaymentMethod ? (
            <div className="acct-callout">
              <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>
                Add a payment method to use this number
              </p>
              <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
                You can choose a number now, but a payment method is required before it can be assigned to your clinic. You won’t be charged today. Billing starts only after SMS recovery is active and your trial period ends.
              </p>
              <div style={{ marginTop: "var(--space-2)" }}>
                <button type="button" className="btn btn-primary" onClick={onGoToBilling}>
                  Add payment method
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-2)", justifyItems: "start" }}>
              <button type="button" className="btn btn-primary" onClick={useSelectedNumber}>
                Use this number
              </button>
              {actionError && (
                <div className="alert alert-info" role="status" aria-live="polite">
                  <span>{actionError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function locationRank(c: Candidate): number {
  if (c.locality && c.region) return 3;
  if (c.region) return 2;
  return 1;
}

function locationLabel(c: Candidate): string {
  if (!c.locality) return "Location not specified";
  return [c.locality, c.region].filter(Boolean).join(", ");
}

function shouldShowRecommended(c: Candidate, all: Candidate[]): boolean {
  if (!c.recommended || !c.selectable) return false;
  if (c.locality) return true;
  const betterLocationExists = all.some((other) => locationRank(other) > locationRank(c));
  return !betterLocationExists;
}
