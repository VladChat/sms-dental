"use client";

import { useRef, useState } from "react";

import type { AssignedBusinessNumberSummary } from "./account-types";
import { NumberBreakdown } from "./NumberTypeChooser";
import {
  additionalNumberConsentText,
  billingConfig,
  formatUsdFromCents,
  localNumberBreakdown,
} from "../../../../config/billing.config";

const ADDITIONAL_MONTHLY = formatUsdFromCents(
  billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);

type NumberType = "toll_free" | "local";

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
  type: NumberType;
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
    numberType: NumberType;
    role: string;
    isActive: boolean;
    billingClass: "legacy" | "included" | "additional";
    createdAt: string;
  };
  error?: { message?: string; code?: string };
};

const LOCAL_BILLING_CONSENT =
  "I authorize Missed Calls Dental to bill the local number fees shown here.";

// Step 2 of the add-number flow: search + assign a number of the chosen type.
// Rendered by AssignedNumberCard after the type chooser. The server purchase API
// remains the final authority on price/classification and is the only place that
// can actually buy/assign a number.
//
//  - toll_free: no area code / ZIP. Voice + SMS only. The first toll-free number
//    is included; an additional toll-free number needs the $20/month consent.
//  - local: area code / ZIP search with smart fallback. Local assignment requires
//    explicit authorization for the config-driven local fees.
export function OwnerNumberSearch({
  numberType,
  tollFreeSlotClass,
  purchaseEnabled,
  localNotice,
  initialAreaCode,
  initialPostalCode,
  onPurchased,
  onBack,
}: {
  numberType: NumberType;
  tollFreeSlotClass: "included" | "additional";
  purchaseEnabled: boolean;
  localNotice: string | null;
  initialAreaCode?: string | null;
  initialPostalCode?: string | null;
  onPurchased: (n: AssignedBusinessNumberSummary) => void;
  onBack: () => void;
}) {
  const runId = useRef(0);
  const [areaCode, setAreaCode] = useState(initialAreaCode ?? "");
  const [postalCode, setPostalCode] = useState(initialPostalCode ?? "");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isTollFree = numberType === "toll_free";
  const isLocal = numberType === "local";
  const isAdditionalTollFree = isTollFree && tollFreeSlotClass === "additional";
  const typeBadgeClass = isTollFree ? "badge-info" : "badge-neutral";
  const typeBadgeLabel = isTollFree ? "Toll-free" : "Local";

  function resetSelection() {
    setSelected(null);
    setConsentChecked(false);
    setActionError(null);
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
      params.set("type", numberType);
      if (!isTollFree) {
        if (areaCode.trim()) params.set("area_code", areaCode.trim());
        if (postalCode.trim()) params.set("postal_code", postalCode.trim());
      }
      const res = await fetch(`/api/account/phone-numbers/search?${params.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as SearchResponse | null;
      if (runId.current !== id) return;
      if (!res.ok || !json?.ok) {
        setSearchError(json?.error?.message ?? "Could not search numbers.");
        setCandidates([]);
        setSearched(true);
        return;
      }
      setCandidates(json.numbers ?? []);
      setFallbackMessage(json.fallback_message ?? null);
      setSearched(true);
    } catch {
      setSearchError("Could not search numbers. Please try again.");
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
          type: numberType,
          additional_billing_authorized: isAdditionalTollFree ? consentChecked : undefined,
          local_billing_authorized: isLocal ? consentChecked : undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as PurchaseResponse | null;
      if (!res.ok || !json?.ok || !json.assignedNumber) {
        setActionError(json?.error?.message ?? "Could not assign this number. Please try again.");
        return;
      }
      const a = json.assignedNumber;
      onPurchased({
        id: a.id,
        phoneNumber: a.phoneNumber,
        numberType: a.numberType,
        role: a.role,
        isActive: a.isActive,
        billingClass: a.billingClass,
        createdAt: a.createdAt,
        removalStatus: "active",
        removalRequestedAt: null,
        removalRequestedByEmail: null,
        permanentRemovalAt: null,
        restoredAt: null,
        twilioReleasedAt: null,
        twilioReleaseStatus: "not_required",
      });
      onBack();
    } catch {
      setActionError("Could not assign this number. Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  const displayed = sortByLocation(candidates);

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div className="acct-search-form">
        <div className="acct-search-head">
          <h3 className="t-h4">
            {isTollFree ? "Search toll-free numbers" : "Search local numbers"}
          </h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            Back
          </button>
        </div>

        {!isTollFree && (
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
        )}

        <button type="button" className="btn btn-primary acct-primary-action"
          onClick={() => void search()} disabled={searching}>
          {searching ? "Searching…" : isTollFree ? "Search toll-free numbers" : "Search number"}
        </button>
      </div>

      {!isTollFree && localNotice && (
        <div className="alert alert-info" role="status" aria-live="polite"><span>{localNotice}</span></div>
      )}

      {searchError && (
        <div className="alert alert-error" role="alert" aria-live="polite"><span>{searchError}</span></div>
      )}
      {fallbackMessage && !searchError && (
        <p className="t-small" style={{ color: "var(--text-muted)", margin: 0 }}>{fallbackMessage}</p>
      )}
      {searched && !searchError && candidates.length === 0 && (
        <p className="t-small" style={{ color: "var(--text-muted)", margin: 0 }}>
          {isTollFree
            ? "No toll-free numbers are available right now. Please try again shortly."
            : "No local numbers are available for this area right now. Try a different area code or ZIP."}
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
                    onChange={() => { setSelected(c.phone_number); setConsentChecked(false); setActionError(null); }} />
                  <span className="acct-cand-body">
                    <span className="acct-cand-top">
                      <span className="acct-cand-num">{c.friendly_name || c.phone_number}</span>
                      <span className={`badge ${typeBadgeClass}`}>{typeBadgeLabel}</span>
                      {c.recommended && c.selectable && <span className="badge badge-info">Recommended</span>}
                    </span>
                    {!isTollFree && (
                      <span className="acct-cand-meta">
                        <span>{locationLabel(c)}</span>
                      </span>
                    )}
                    <span className="acct-cand-caps">
                      {c.capabilities.voice && <span className="badge badge-success">Voice</span>}
                      {c.capabilities.sms && <span className="badge badge-success">SMS</span>}
                      {!c.selectable && <span className="badge badge-warning">Voice + SMS required</span>}
                    </span>
                  </span>
                </label>

                {checked && (
                  <div className="acct-cand-actions">
                    {!purchaseEnabled ? (
                      <div className="alert alert-info" role="status">
                        <span>
                          {localNotice ??
                            "This number can't be assigned yet. You can browse availability now."}
                        </span>
                      </div>
                    ) : (
                      <>
                        {isAdditionalTollFree && (
                          <div className="acct-consent">
                            <div>
                              <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>Additional toll-free number</p>
                              <p className="t-h4" style={{ margin: "var(--space-1) 0 0" }}>{ADDITIONAL_MONTHLY}/month</p>
                              <p className="t-small" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
                                This adds to your monthly paid plan.
                              </p>
                            </div>
                            <label className="check">
                              <input type="checkbox" checked={consentChecked}
                                onChange={(e) => setConsentChecked(e.target.checked)} />
                              <span>{additionalNumberConsentText()}</span>
                            </label>
                          </div>
                        )}

                        {isLocal && (
                          <div className="acct-consent">
                            <div style={{ display: "grid", gap: "var(--space-2)" }}>
                              <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>Local number fees</p>
                              <NumberBreakdown groups={localNumberBreakdown()} />
                            </div>
                            <label className="check">
                              <input type="checkbox" checked={consentChecked}
                                onChange={(e) => setConsentChecked(e.target.checked)} />
                              <span>{LOCAL_BILLING_CONSENT}</span>
                            </label>
                          </div>
                        )}

                        <button type="button" className="btn btn-primary acct-primary-action"
                          onClick={() => void confirmPurchase()}
                          disabled={((isAdditionalTollFree || isLocal) && !consentChecked) || purchasing}
                          aria-busy={purchasing}>
                          {purchasing
                            ? "Assigning…"
                            : isLocal
                              ? "Authorize and assign local number"
                              : isAdditionalTollFree
                              ? "Purchase this number"
                              : "Assign this number"}
                        </button>
                      </>
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
