"use client";

import { useRef, useState } from "react";

import type { AssignedBusinessNumberSummary } from "./account-types";
import {
  additionalNumberConsentText,
  billingConfig,
  formatInteger,
  formatUsdFromCents,
} from "../../../../config/billing.config";

const ADDITIONAL_MONTHLY = formatUsdFromCents(
  billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);
const INCLUDED_PLAN_SUMMARY = `Included in your plan: ${formatInteger(
  billingConfig.basePlan.includedCallMinutes,
)} call minutes, and ${formatInteger(
  billingConfig.basePlan.includedSmsSegments,
)} SMS segments each month.`;

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
  numbers?: Candidate[];
  fallback_message?: string | null;
  error?: { message?: string };
};

type PurchaseResponse = {
  ok?: boolean;
  assignedNumber?: {
    id: string;
    phoneNumber: string;
    role: string;
    isActive: boolean;
    billingClass: "legacy" | "included" | "additional";
    createdAt: string;
  };
  error?: { message?: string; code?: string };
};

// Search + purchase a business number. Rendered by AssignedNumberCard ONLY when a
// purchase is actually allowed (mode = the server-classified next slot). The
// owner purchase API remains the final authority on price/classification.
export function OwnerLocalNumberSearch({
  initialAreaCode,
  initialPostalCode,
  mode,
  onPurchased,
}: {
  initialAreaCode?: string | null;
  initialPostalCode?: string | null;
  mode: "included" | "additional";
  onPurchased: (n: AssignedBusinessNumberSummary) => void;
}) {
  const runId = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const [areaCode, setAreaCode] = useState(initialAreaCode ?? "");
  const [postalCode, setPostalCode] = useState(initialPostalCode ?? "");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAdditional = mode === "additional";

  function resetSelection() {
    setSelected(null);
    setConsentChecked(false);
    setConfirming(false);
    setActionError(null);
  }

  function clearAll(collapse: boolean) {
    runId.current += 1;
    if (collapse) setExpanded(false);
    setSearching(false);
    setSearched(false);
    setSearchError(null);
    setCandidates([]);
    setFallbackMessage(null);
    resetSelection();
  }

  async function search() {
    const id = runId.current + 1;
    runId.current = id;
    setSearching(true);
    setSearched(false);
    setSearchError(null);
    setFallbackMessage(null);
    resetSelection();
    try {
      const params = new URLSearchParams();
      if (areaCode.trim()) params.set("area_code", areaCode.trim());
      if (postalCode.trim()) params.set("postal_code", postalCode.trim());
      const q = params.toString();
      const res = await fetch(`/api/account/phone-numbers/search${q ? `?${q}` : ""}`, {
        method: "GET",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as SearchResponse | null;
      if (runId.current !== id) return;
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
      if (runId.current === id) setSearching(false);
    }
  }

  async function confirmPurchase() {
    const candidate = candidates.find((c) => c.phone_number === selected) ?? null;
    if (!candidate) return;
    setPurchasing(true);
    setActionError(null);
    try {
      const res = await fetch("/api/account/phone-numbers/purchase", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone_number: candidate.phone_number,
          friendly_name: candidate.friendly_name,
          locality: candidate.locality,
          region: candidate.region,
          postal_code: candidate.postal_code,
          capabilities: candidate.capabilities,
          type: candidate.type,
          additional_billing_authorized: isAdditional ? consentChecked : undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as PurchaseResponse | null;
      if (!res.ok || !json?.ok || !json.assignedNumber) {
        setActionError(json?.error?.message ?? "Could not purchase this number. Please try again.");
        setConfirming(false);
        return;
      }
      const a = json.assignedNumber;
      onPurchased({
        id: a.id,
        phoneNumber: a.phoneNumber,
        role: a.role,
        isActive: a.isActive,
        billingClass: a.billingClass,
        createdAt: a.createdAt,
      });
      clearAll(true);
    } catch {
      setActionError("Could not purchase this number. Please try again.");
      setConfirming(false);
    } finally {
      setPurchasing(false);
    }
  }

  const displayed = sortByLocation(candidates);

  if (!expanded) {
    return (
      <button type="button" className="btn btn-primary acct-primary-action" onClick={() => setExpanded(true)}>
        {isAdditional ? "Add another number" : "Add number"}
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div className="acct-search-form">
        <div className="acct-search-head">
          <h3 className="t-h4">Search number</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearAll(true)}>Hide</button>
        </div>
        <div className="acct-grid-2">
          <div className="field">
            <label htmlFor="owner-area-code">Area code</label>
            <input id="owner-area-code" className="input t-mono" value={areaCode}
              onChange={(e) => setAreaCode(digits(e.target.value).slice(0, 3))}
              inputMode="numeric" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="owner-zip">ZIP code</label>
            <input id="owner-zip" className="input t-mono" value={postalCode}
              onChange={(e) => setPostalCode(digits(e.target.value).slice(0, 5))}
              inputMode="numeric" autoComplete="postal-code" />
          </div>
        </div>
        <button type="button" className="btn btn-primary acct-primary-action"
          onClick={() => void search()} disabled={searching}>
          {searching ? "Searching…" : "Search number"}
        </button>
      </div>

      {searchError && (
        <div className="alert alert-error" role="alert" aria-live="polite"><span>{searchError}</span></div>
      )}
      {fallbackMessage && !searchError && (
        <p className="t-small" style={{ color: "var(--text-muted)", margin: 0 }}>{fallbackMessage}</p>
      )}
      {searched && !searchError && candidates.length === 0 && (
        <p className="t-small" style={{ color: "var(--text-muted)", margin: 0 }}>
          No local numbers are available for this area right now. Try a different area code or ZIP.
        </p>
      )}

      {displayed.length > 0 && (
        <fieldset className="acct-cand-list">
          <legend className="t-helper">Choose a number</legend>
          {displayed.map((c) => {
            const checked = selected === c.phone_number;
            return (
              <div key={c.phone_number} className={`acct-cand${checked ? " is-selected" : ""}${c.selectable ? "" : " is-disabled"}`}>
                <label className="acct-cand-choice">
                  <input type="radio" name="owner-number" value={c.phone_number} checked={checked}
                    disabled={!c.selectable}
                    onChange={() => { setSelected(c.phone_number); setConsentChecked(false); setConfirming(false); setActionError(null); }} />
                  <span className="acct-cand-body">
                    <span className="acct-cand-top">
                      <span className="acct-cand-num">{c.friendly_name || c.phone_number}</span>
                      {c.recommended && c.selectable && <span className="badge badge-info">Recommended</span>}
                    </span>
                    <span className="acct-cand-meta">
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
                    {isAdditional && (
                      <div className="acct-consent">
                        <div>
                          <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>Additional number</p>
                          <p className="t-h4" style={{ margin: "var(--space-1) 0 0" }}>{ADDITIONAL_MONTHLY}/month</p>
                          <p className="t-small" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
                            This adds to your monthly paid plan.
                          </p>
                        </div>
                        <label className="check">
                          <input type="checkbox" checked={consentChecked}
                            onChange={(e) => { setConsentChecked(e.target.checked); setConfirming(false); }} />
                          <span>{additionalNumberConsentText()}</span>
                        </label>
                      </div>
                    )}

                    {!confirming ? (
                      <button type="button" className="btn btn-primary acct-primary-action"
                        onClick={() => setConfirming(true)}
                        disabled={isAdditional && !consentChecked}>
                        {isAdditional ? "Purchase additional number" : "Assign this number"}
                      </button>
                    ) : (
                      <div className="acct-callout">
                        <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>
                          {isAdditional ? "Purchase additional number?" : "Assign this number?"}
                        </p>
                        <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
                          {isAdditional
                            ? `This will add ${ADDITIONAL_MONTHLY}/month to your monthly plan.`
                            : INCLUDED_PLAN_SUMMARY}
                        </p>
                        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
                          <button type="button" className="btn btn-primary acct-primary-action"
                            onClick={() => void confirmPurchase()} disabled={purchasing} aria-busy={purchasing}>
                            Confirm
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm"
                            onClick={() => setConfirming(false)} disabled={purchasing}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {actionError && (
                      <div className="alert alert-error" role="alert" aria-live="polite"><span>{actionError}</span></div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}

function sortByLocation(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => rank(b) - rank(a));
}
function rank(c: Candidate): number {
  if (c.locality && c.region) return 3;
  if (c.locality || c.region) return 2;
  return 1;
}
function locationLabel(c: Candidate): string {
  const location = [c.locality, c.region].filter(Boolean).join(", ");
  return `Location: ${location || "Not specified"}`;
}
function digits(v: string): string {
  return v.replace(/\D/g, "");
}
