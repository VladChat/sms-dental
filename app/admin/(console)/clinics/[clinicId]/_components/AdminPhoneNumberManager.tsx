"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import { Field, SelectField } from "../../../../../setup/[token]/_components/AccountUI";
import type { PhoneSearchDefaults } from "./AdminClinicConsole";

// Serializable candidate (JSON copy of lib/twilio AvailableNumber). Declared
// locally so the Twilio SDK is never pulled into the browser bundle.
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

type SearchParamsEcho = {
  type: string;
  country: string;
  area_code?: string | null;
  locality_filter_used?: boolean;
  region?: string | null;
  postal_code?: string | null;
  contains?: string | null;
  distance?: number | null;
  required: { voice: boolean; sms: boolean; mms: boolean };
  limit: number;
};

type SearchResponse = {
  ok?: boolean;
  count?: number;
  numbers?: Candidate[];
  params?: SearchParamsEcho;
  search_mode?: "smart_fallback" | string;
  attempt_label?: string | null;
  attempted_labels?: string[];
  fallback_used?: boolean;
  fallback_message?: string | null;
  error?: { message?: string };
};

const TYPE_OPTIONS = [
  { value: "local", label: "Local" },
  { value: "toll_free", label: "Toll-free" },
];
function summarize(p: SearchParamsEcho): string {
  const typeLabel = p.type === "toll_free" ? "Toll-free" : "Local";
  if (p.type === "local") {
    const bits: string[] = [];
    if (p.area_code) bits.push(`area code ${p.area_code}`);
    if (p.postal_code) bits.push(`ZIP ${p.postal_code}`);
    if (!p.area_code && !p.postal_code && p.region) bits.push(p.region);
    if (p.contains) bits.push(`pattern ${p.contains}`);
    const suffix = bits.length > 0 ? ` for ${bits.join(" / ")}` : "";
    return `Showing best available local numbers${suffix}`;
  }

  const bits: string[] = [`${typeLabel} numbers in ${p.country}`];
  return `Showing ${bits.join(", ")}`;
}

function locationLabel(c: Candidate): string {
  if (!c.locality) return "Location not specified by Twilio";
  return [c.locality, c.region].filter(Boolean).join(", ");
}

export function AdminPhoneNumberManager({
  clinicId,
  hasAssignedNumber,
  purchaseEnabled,
  defaults,
}: {
  clinicId: string;
  hasAssignedNumber: boolean;
  purchaseEnabled: boolean;
  defaults: PhoneSearchDefaults;
}) {
  const router = useRouter();

  // Filter form state (prefilled from clinic defaults).
  const [type, setType] = useState<"local" | "toll_free">("local");
  const [areaCode, setAreaCode] = useState(defaults.areaCode);
  const [postal, setPostal] = useState(defaults.postal);

  // Search/result state.
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [summaryParams, setSummaryParams] = useState<SearchParamsEcho | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Purchase state.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  if (hasAssignedNumber) return null;

  function resetDefaults() {
    setType("local");
    setAreaCode(defaults.areaCode);
    setPostal(defaults.postal);
  }

  async function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    setFallbackMessage(null);
    setSelected(null);
    try {
      const p = new URLSearchParams();
      p.set("type", type);
      if (type === "local") {
        if (areaCode.trim()) p.set("area_code", areaCode.trim());
        if (postal.trim()) p.set("postal_code", postal.trim());
      }

      const res = await fetch(`/api/admin/clinics/${clinicId}/phone-numbers/search?${p.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as SearchResponse | null;
      if (!res.ok || !json?.ok) {
        setSearchError(json?.error?.message ?? "Could not search available numbers.");
        setCandidates([]);
        setSummaryParams(null);
        setFallbackMessage(null);
        setSearched(true);
        return;
      }
      setCandidates(json.numbers ?? []);
      setSummaryParams(json.params ?? null);
      setFallbackMessage(json.fallback_message ?? null);
      setSearched(true);
    } catch {
      setSearchError("Could not search available numbers. Please try again.");
      setFallbackMessage(null);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function confirmPurchase() {
    if (!selected) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/phone-numbers/purchase`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone_number: selected }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setPurchaseError(json?.error?.message ?? "Could not purchase this number.");
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    } catch {
      setPurchaseError("Could not purchase this number. Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  const isLocal = type === "local";
  const localityCount = candidates.filter((c) => c.locality).length;
  const displayedCandidates =
    isLocal && localityCount >= 3
      ? candidates.filter((c) => c.locality)
      : candidates;

  return (
    <div style={{ marginTop: "var(--space-4)" }}>
      <h3 className="adm-subhead">Assign a number</h3>
      {!purchaseEnabled && (
        <div className="adm-banner tone-warning" role="note" style={{ marginTop: "var(--space-2)" }}>
          <div className="adm-banner-main">
            <span className="adm-banner-title">Twilio number purchase is disabled by environment flag.</span>
            <span className="adm-banner-body">Search works; purchase is blocked until the operator enables it.</span>
          </div>
        </div>
      )}

      {/* B. Search filters */}
      <form className="adm-filter" onSubmit={onSearch}>
        <div className="adm-filter-grid">
          <SelectField label="Number type" name="pn_type" value={type} onChange={(v) => setType(v === "toll_free" ? "toll_free" : "local")} options={TYPE_OPTIONS} />
          {isLocal && <Field label="Area code" name="pn_area" value={areaCode} onChange={setAreaCode} optional inputMode="numeric" placeholder="e.g. 312" />}
          {isLocal && <Field label="ZIP code" name="pn_zip" value={postal} onChange={setPostal} optional inputMode="numeric" />}
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={searching}>
            {searching ? "Searching…" : "Search numbers"}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetDefaults} disabled={searching}>
            Reset to clinic defaults
          </button>
        </div>
      </form>

      {/* C. Results */}
      {searchError && (
        <div className="alert alert-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
          <span>{searchError}</span>
        </div>
      )}

      {searched && !searchError && summaryParams && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <p className="t-small" style={{ color: "var(--text-secondary)", margin: 0 }}>
            {summarize(summaryParams)} · {displayedCandidates.length} result{displayedCandidates.length === 1 ? "" : "s"}
          </p>
          {fallbackMessage && (
            <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-1) 0 0" }}>
              {fallbackMessage}
            </p>
          )}
        </div>
      )}

      {searched && !searchError && candidates.length === 0 && (
        <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
          No local numbers found after the smart fallback search. Try a broader area code, check the ZIP, or switch to toll-free.
        </p>
      )}

      {candidates.length > 0 && (
        <fieldset className="adm-cand-list" style={{ marginTop: "var(--space-3)" }}>
          <legend className="t-helper">Available numbers</legend>
          {displayedCandidates.map((c) => (
            <label key={c.phone_number} className={`adm-cand${selected === c.phone_number ? " is-selected" : ""}${c.selectable ? "" : " is-disabled"}`}>
              <input
                type="radio"
                name="adm-cand"
                value={c.phone_number}
                checked={selected === c.phone_number}
                disabled={!c.selectable}
                onChange={() => setSelected(c.phone_number)}
              />
              <span className="adm-cand-body">
                <span className="adm-cand-top">
                  <span className="adm-cand-num">{c.friendly_name || c.phone_number}</span>
                  <span className="badge badge-neutral">{c.type === "toll_free" ? "Toll-free" : "Local number"}</span>
                  {c.recommended && c.selectable && <span className="badge badge-info">Recommended</span>}
                </span>
                <span className="adm-cand-meta">
                  <span className="t-mono">{c.phone_number}</span>
                  <span> · {locationLabel(c)}</span>
                </span>
                <span className="adm-cand-caps">
                  {c.capabilities.voice && <span className="badge badge-success">Voice</span>}
                  {c.capabilities.sms && <span className="badge badge-success">SMS</span>}
                  {c.capabilities.mms && <span className="badge badge-neutral">MMS</span>}
                  {c.address_requirements && c.address_requirements !== "none" && (
                    <span className="badge badge-warning">Address: {c.address_requirements}</span>
                  )}
                  {!c.selectable && <span className="badge badge-warning">Voice + SMS required</span>}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {/* D. Purchase */}
      {candidates.length > 0 && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => { setPurchaseError(null); setConfirmOpen(true); }}
          >
            Purchase and assign selected number
          </button>
          {!purchaseEnabled && (
            <p className="t-small" style={{ color: "var(--text-muted)", margin: "var(--space-2) 0 0" }}>
              Purchase is disabled by environment flag — the request will be safely blocked.
            </p>
          )}
        </div>
      )}

      <AdminConfirmDialog
        open={confirmOpen}
        title="Purchase and assign number?"
        body={`This purchases ${selected ?? "the selected number"} from Twilio, assigns it to this clinic, and configures its webhooks. It does not enable SMS recovery.`}
        confirmLabel="Purchase and assign"
        confirmTone="primary"
        busy={purchasing}
        error={purchaseError}
        onConfirm={confirmPurchase}
        onCancel={() => { if (!purchasing) { setConfirmOpen(false); setPurchaseError(null); } }}
      />
    </div>
  );
}
