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
  locality?: string | null;
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
  error?: { message?: string };
};

const TYPE_OPTIONS = [
  { value: "local", label: "Local" },
  { value: "toll_free", label: "Toll-free" },
];
const COUNTRY_OPTIONS = [
  { value: "US", label: "United States (US)" },
  { value: "CA", label: "Canada (CA)" },
];
const LIMIT_OPTIONS = [
  { value: "10", label: "10 results" },
  { value: "20", label: "20 results" },
  { value: "50", label: "50 results" },
];

function capsLabel(req: { voice: boolean; sms: boolean; mms: boolean }): string {
  const parts = [req.voice && "Voice", req.sms && "SMS", req.mms && "MMS"].filter(Boolean);
  return parts.length ? parts.join(" + ") : "any capability";
}

function summarize(p: SearchParamsEcho): string {
  const typeLabel = p.type === "toll_free" ? "Toll-free" : "Local";
  const bits: string[] = [`${typeLabel} numbers in ${p.country}`];
  if (p.area_code) bits.push(`area code ${p.area_code}`);
  if (p.region) bits.push(p.region);
  if (p.locality) bits.push(p.locality);
  if (p.postal_code) bits.push(`ZIP ${p.postal_code}`);
  if (p.contains) bits.push(`pattern ${p.contains}`);
  if (p.distance) bits.push(`within ${p.distance} mi`);
  bits.push(capsLabel(p.required));
  return `Showing ${bits.join(", ")}`;
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
  const [country, setCountry] = useState(defaults.country || "US");
  const [areaCode, setAreaCode] = useState(defaults.areaCode);
  const [city, setCity] = useState(defaults.city);
  const [state, setState] = useState(defaults.state);
  const [postal, setPostal] = useState(defaults.postal);
  const [contains, setContains] = useState("");
  const [distance, setDistance] = useState("25");
  const [capVoice, setCapVoice] = useState(true);
  const [capSms, setCapSms] = useState(true);
  const [capMms, setCapMms] = useState(false);
  const [limit, setLimit] = useState("10");

  // Search/result state.
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [summaryParams, setSummaryParams] = useState<SearchParamsEcho | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Purchase state.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  if (hasAssignedNumber) return null;

  function resetDefaults() {
    setType("local");
    setCountry(defaults.country || "US");
    setAreaCode(defaults.areaCode);
    setCity(defaults.city);
    setState(defaults.state);
    setPostal(defaults.postal);
    setContains("");
    setDistance("25");
    setCapVoice(true);
    setCapSms(true);
    setCapMms(false);
    setLimit("10");
  }

  async function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      const p = new URLSearchParams();
      p.set("type", type);
      p.set("country", country.trim().toUpperCase());
      if (type === "local") {
        if (areaCode.trim()) p.set("area_code", areaCode.trim());
        if (city.trim()) p.set("locality", city.trim());
        if (state.trim()) p.set("region", state.trim());
        if (postal.trim()) p.set("postal_code", postal.trim());
        if (distance.trim()) p.set("distance", distance.trim());
      }
      if (contains.trim()) p.set("contains", contains.trim());
      p.set("voice", String(capVoice));
      p.set("sms", String(capSms));
      p.set("mms", String(capMms));
      p.set("limit", limit);

      const res = await fetch(`/api/admin/clinics/${clinicId}/phone-numbers/search?${p.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as SearchResponse | null;
      if (!res.ok || !json?.ok) {
        setSearchError(json?.error?.message ?? "Could not search available numbers.");
        setCandidates([]);
        setSummaryParams(null);
        setSearched(true);
        return;
      }
      setCandidates(json.numbers ?? []);
      setSummaryParams(json.params ?? null);
      setSearched(true);
    } catch {
      setSearchError("Could not search available numbers. Please try again.");
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
          <SelectField label="Country" name="pn_country" value={country} onChange={setCountry} options={COUNTRY_OPTIONS} />
          {isLocal && <Field label="Area code" name="pn_area" value={areaCode} onChange={setAreaCode} optional inputMode="numeric" placeholder="e.g. 312" />}
          {isLocal && <Field label="City / locality" name="pn_city" value={city} onChange={setCity} optional placeholder="e.g. Chicago" />}
          {isLocal && <Field label="State / region" name="pn_state" value={state} onChange={setState} optional placeholder="2-letter, e.g. IL" />}
          {isLocal && <Field label="ZIP / postal" name="pn_zip" value={postal} onChange={setPostal} optional inputMode="numeric" />}
          <Field label="Contains / pattern" name="pn_contains" value={contains} onChange={setContains} optional inputMode="numeric" placeholder="digits or 5*5" helper="Digits and * wildcards." />
          {isLocal && <Field label="Radius (miles)" name="pn_distance" value={distance} onChange={setDistance} optional inputMode="numeric" helper="Used only when area code, city, state and ZIP are all empty." />}
          <SelectField label="Results" name="pn_limit" value={limit} onChange={setLimit} options={LIMIT_OPTIONS} />
        </div>

        <fieldset className="adm-caps">
          <legend className="t-label">Required capabilities</legend>
          <label className="check"><input type="checkbox" checked={capVoice} onChange={(e) => setCapVoice(e.target.checked)} /><span>Voice</span></label>
          <label className="check"><input type="checkbox" checked={capSms} onChange={(e) => setCapSms(e.target.checked)} /><span>SMS</span></label>
          <label className="check"><input type="checkbox" checked={capMms} onChange={(e) => setCapMms(e.target.checked)} /><span>MMS</span></label>
          <span className="t-helper">Purchase requires Voice + SMS.</span>
        </fieldset>

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
        <p className="t-small" style={{ color: "var(--text-secondary)", marginTop: "var(--space-3)" }}>
          {summarize(summaryParams)} · {candidates.length} result{candidates.length === 1 ? "" : "s"}
        </p>
      )}

      {searched && !searchError && candidates.length === 0 && (
        <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
          No numbers found for these filters. Try removing area code, changing city/ZIP, or switching to toll-free.
        </p>
      )}

      {candidates.length > 0 && (
        <fieldset className="adm-cand-list" style={{ marginTop: "var(--space-3)" }}>
          <legend className="t-helper">Available numbers</legend>
          {candidates.map((c) => (
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
                  {(c.locality || c.region || c.postal_code) && (
                    <span> · {[c.locality, c.region, c.postal_code].filter(Boolean).join(", ")}</span>
                  )}
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
