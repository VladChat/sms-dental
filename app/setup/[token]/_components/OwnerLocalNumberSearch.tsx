"use client";

import { useMemo, useRef, useState } from "react";

import type { RequestedNumberSummary } from "./account-types";
import {
  additionalNumberConsentText,
  billingConfig,
  formatUsdFromCents,
} from "../../../../config/billing.config";

const ADDITIONAL_MONTHLY = formatUsdFromCents(
  billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);

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

type RequestNumberResponse = {
  ok?: boolean;
  requestedNumber?: {
    id: string;
    phoneNumber: string;
    friendlyName: string | null;
    locality: string | null;
    region: string | null;
    status: string;
    billingClass: "included" | "additional";
    monthlyUnitAmountCents: number;
    currency: string;
    billingConsentAuthorizedAt: string | null;
  };
  error?: { message?: string; code?: string };
};

export function OwnerLocalNumberSearch({
  hasPaymentMethod,
  onGoToBilling,
  initialAreaCode,
  initialPostalCode,
  nextNumberIsAdditional,
  existingRequestedNumbers,
  onRequestedNumberSaved,
}: {
  hasPaymentMethod: boolean;
  onGoToBilling: () => void;
  initialAreaCode?: string | null;
  initialPostalCode?: string | null;
  // Presentation hint: is the next requested number likely an additional ($20/mo)
  // number? The server remains the final authority on classification + price.
  nextNumberIsAdditional: boolean;
  // E.164 numbers already open as requests (to avoid duplicate submits).
  existingRequestedNumbers: string[];
  onRequestedNumberSaved: (requestedNumber: RequestedNumberSummary) => void;
}) {
  const searchRunId = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const [areaCode, setAreaCode] = useState(initialAreaCode ?? "");
  const [postalCode, setPostalCode] = useState(initialPostalCode ?? "");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  // Additional-number authorization. Unchecked by default; reset on any change of
  // selection / new search / hide.
  const [consentChecked, setConsentChecked] = useState(false);

  const alreadyRequested = useMemo(
    () => new Set(existingRequestedNumbers),
    [existingRequestedNumbers],
  );

  const displayedCandidates = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => locationRank(b) - locationRank(a));
    const localityCount = sorted.filter((c) => Boolean(c.locality)).length;
    return localityCount >= 3
      ? sorted.filter((c) => c.locality || c.region)
      : sorted;
  }, [candidates]);

  function clearSearchUi(collapse: boolean) {
    searchRunId.current += 1;
    if (collapse) setExpanded(false);
    setSearching(false);
    setSearched(false);
    setSearchError(null);
    setCandidates([]);
    setSelected(null);
    setFallbackMessage(null);
    setActionError(null);
    setConsentChecked(false);
  }

  function hideSearch() {
    clearSearchUi(true);
  }

  async function search() {
    const runId = searchRunId.current + 1;
    searchRunId.current = runId;
    setSearching(true);
    setSearched(false);
    setSearchError(null);
    setActionError(null);
    setFallbackMessage(null);
    setSelected(null);
    setConsentChecked(false);
    try {
      const params = new URLSearchParams();
      const cleanAreaCode = areaCode.trim();
      const cleanPostalCode = postalCode.trim();
      if (cleanAreaCode) params.set("area_code", cleanAreaCode);
      if (cleanPostalCode) params.set("postal_code", cleanPostalCode);
      const query = params.toString();
      const res = await fetch(`/api/account/phone-numbers/search${query ? `?${query}` : ""}`, {
        method: "GET",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as SearchResponse | null;
      if (searchRunId.current !== runId) return;
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
      if (searchRunId.current === runId) setSearching(false);
    }
  }

  // Save the selected candidate as a pending owner request for admin review. This
  // never purchases, reserves, or assigns a number. The server classifies billing
  // and enforces additional-number consent.
  async function requestSelectedNumber() {
    const selectedCandidate =
      displayedCandidates.find((c) => c.phone_number === selected) ??
      candidates.find((c) => c.phone_number === selected) ??
      null;
    if (!selectedCandidate) return;
    setRequesting(true);
    setActionError(null);
    try {
      const res = await fetch("/api/account/phone-numbers/request", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone_number: selectedCandidate.phone_number,
          friendly_name: selectedCandidate.friendly_name,
          locality: selectedCandidate.locality,
          region: selectedCandidate.region,
          postal_code: selectedCandidate.postal_code,
          capabilities: selectedCandidate.capabilities,
          type: selectedCandidate.type,
          additional_billing_authorized: consentChecked,
        }),
      });
      const json = (await res.json().catch(() => null)) as RequestNumberResponse | null;
      if (!res.ok || !json?.ok) {
        setActionError(
          json?.error?.message ?? "Could not save your requested number. Please try again.",
        );
        return;
      }
      onRequestedNumberSaved(normalizeRequestedNumberResponse(json.requestedNumber, selectedCandidate));
      clearSearchUi(true);
    } catch {
      setActionError("Could not save your requested number. Please try again.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      {!expanded ? (
        <button type="button" className="btn btn-primary acct-primary-action" onClick={() => setExpanded(true)}>
          Add number
        </button>
      ) : (
        <>
          <div className="acct-search-form">
            <div className="acct-search-head">
              <h3 className="t-h4">Search number</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={hideSearch}>
                Hide
              </button>
            </div>
            <div className="acct-grid-2">
              <div className="field">
                <label htmlFor="owner-local-area-code">Area code</label>
                <input
                  id="owner-local-area-code"
                  name="area_code"
                  className="input t-mono"
                  value={areaCode}
                  onChange={(e) => setAreaCode(digitsOnly(e.target.value).slice(0, 3))}
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{3}"
                />
              </div>
              <div className="field">
                <label htmlFor="owner-local-postal-code">ZIP code</label>
                <input
                  id="owner-local-postal-code"
                  name="postal_code"
                  className="input t-mono"
                  value={postalCode}
                  onChange={(e) => setPostalCode(digitsOnly(e.target.value).slice(0, 5))}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  pattern="[0-9]{5}"
                />
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary acct-primary-action"
              onClick={() => void search()}
              disabled={searching}
            >
              {searching ? "Searching…" : "Search number"}
            </button>
          </div>

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
                const isAlreadyRequested = alreadyRequested.has(c.phone_number);
                return (
                  <div
                    key={c.phone_number}
                    className={`acct-cand${checked ? " is-selected" : ""}${c.selectable ? "" : " is-disabled"}`}
                  >
                    <label className="acct-cand-choice">
                      <input
                        type="radio"
                        name="owner-local-number"
                        value={c.phone_number}
                        checked={checked}
                        disabled={!c.selectable}
                        onChange={() => {
                          setSelected(c.phone_number);
                          setActionError(null);
                          setConsentChecked(false);
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
                    {checked && (
                      <div className="acct-cand-actions">
                        {!hasPaymentMethod ? (
                          <div className="acct-callout">
                            <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>
                              Add a payment method to use this number
                            </p>
                            <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
                              You can choose a number now, but a payment method is required before it can be assigned to your clinic. You won’t be charged today.
                            </p>
                            <div style={{ marginTop: "var(--space-2)" }}>
                              <button type="button" className="btn btn-primary acct-primary-action" onClick={onGoToBilling}>
                                Add payment method
                              </button>
                            </div>
                          </div>
                        ) : isAlreadyRequested ? (
                          <div className="alert alert-info" role="status" aria-live="polite">
                            <span>This number is already requested and pending review.</span>
                          </div>
                        ) : (
                          <>
                            {nextNumberIsAdditional && (
                              <div className="acct-consent">
                                <div>
                                  <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>
                                    Additional business number
                                  </p>
                                  <p className="t-h4" style={{ margin: "var(--space-1) 0 0" }}>
                                    {ADDITIONAL_MONTHLY}/month
                                  </p>
                                  <p className="t-small" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
                                    Billing starts after this number is approved and activated.
                                  </p>
                                </div>
                                <label className="check">
                                  <input
                                    type="checkbox"
                                    checked={consentChecked}
                                    onChange={(e) => setConsentChecked(e.target.checked)}
                                  />
                                  <span>{additionalNumberConsentText()}</span>
                                </label>
                              </div>
                            )}
                            <button
                              type="button"
                              className="btn btn-primary acct-primary-action"
                              onClick={() => void requestSelectedNumber()}
                              disabled={requesting || (nextNumberIsAdditional && !consentChecked)}
                              aria-busy={requesting}
                            >
                              {requesting
                                ? "Saving…"
                                : nextNumberIsAdditional
                                  ? "Request additional number"
                                  : "Request this number"}
                            </button>
                            {actionError && (
                              <div className="alert alert-error" role="alert" aria-live="polite">
                                <span>{actionError}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}

function normalizeRequestedNumberResponse(
  requestedNumber: RequestNumberResponse["requestedNumber"] | undefined,
  selectedCandidate: Candidate,
): RequestedNumberSummary {
  return {
    id: requestedNumber?.id ?? selectedCandidate.phone_number,
    phoneNumber: requestedNumber?.phoneNumber ?? selectedCandidate.phone_number,
    friendlyName: requestedNumber?.friendlyName ?? selectedCandidate.friendly_name ?? null,
    locality: requestedNumber?.locality ?? selectedCandidate.locality,
    region: requestedNumber?.region ?? selectedCandidate.region,
    status: requestedNumber?.status ?? "pending",
    createdAt: null,
    billingClass: requestedNumber?.billingClass ?? "included",
    monthlyUnitAmountCents: requestedNumber?.monthlyUnitAmountCents ?? 0,
    currency: requestedNumber?.currency ?? billingConfig.currency,
    billingConsentAuthorizedAt: requestedNumber?.billingConsentAuthorizedAt ?? null,
  };
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
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
