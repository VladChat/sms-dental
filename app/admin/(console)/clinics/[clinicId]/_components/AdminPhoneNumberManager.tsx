"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminConfirmDialog } from "./AdminConfirmDialog";

// Serializable candidate shape returned by the admin search route (a JSON copy
// of lib/twilio AvailableNumber). Declared locally so the Twilio SDK is never
// pulled into the browser bundle.
type Candidate = {
  phone_number: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
  postal_code: string | null;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  type: "local" | "toll_free";
  recommended: boolean;
};

type SearchResponse = {
  ok?: boolean;
  type?: string;
  country?: string;
  area_code?: string | null;
  numbers?: Candidate[];
  error?: { message?: string };
};

export function AdminPhoneNumberManager({
  clinicId,
  hasAssignedNumber,
  purchaseEnabled,
}: {
  clinicId: string;
  hasAssignedNumber: boolean;
  purchaseEnabled: boolean;
}) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [areaCode, setAreaCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // When a number is already assigned, the parent panel shows it — no workflow.
  if (hasAssignedNumber) return null;

  async function search() {
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/phone-numbers/search?type=local`, {
        method: "GET",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as SearchResponse | null;
      if (!res.ok || !json?.ok) {
        setSearchError(json?.error?.message ?? "Could not search available numbers.");
        setCandidates([]);
        setSearched(true);
        return;
      }
      setCandidates(json.numbers ?? []);
      setAreaCode(json.area_code ?? null);
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

  return (
    <div style={{ marginTop: "var(--space-4)" }}>
      <h3 className="adm-subhead">Assign a number</h3>
      {!purchaseEnabled && (
        <div className="adm-banner tone-warning" role="note" style={{ marginTop: "var(--space-2)" }}>
          <div className="adm-banner-main">
            <span className="adm-banner-title">Twilio number purchase is disabled by environment flag.</span>
            <span className="adm-banner-body">You can search candidates; purchase is blocked until the operator enables it.</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-3)" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={search} disabled={searching}>
          {searching ? "Searching…" : searched ? "Search again" : "Search available numbers"}
        </button>
        {searched && !searchError && (
          <span className="t-small" style={{ color: "var(--text-muted)", alignSelf: "center" }}>
            {candidates.length > 0
              ? `${candidates.length} local number${candidates.length === 1 ? "" : "s"}${areaCode ? ` near area code ${areaCode}` : ""}`
              : "No matching numbers"}
          </span>
        )}
      </div>

      {searchError && (
        <div className="alert alert-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
          <span>{searchError}</span>
        </div>
      )}

      {searched && !searchError && candidates.length === 0 && (
        <p className="t-small" style={{ color: "var(--text-muted)", marginTop: "var(--space-3)" }}>
          No available numbers matched this clinic’s area. Try searching again, or broaden the search once the
          helper supports region/area overrides.
        </p>
      )}

      {candidates.length > 0 && (
        <fieldset className="adm-cand-list" style={{ marginTop: "var(--space-3)" }}>
          <legend className="t-helper">Available numbers (Voice + SMS)</legend>
          {candidates.map((c) => {
            const usable = c.capabilities.voice && c.capabilities.sms;
            return (
              <label key={c.phone_number} className={`adm-cand${selected === c.phone_number ? " is-selected" : ""}${usable ? "" : " is-disabled"}`}>
                <input
                  type="radio"
                  name="adm-cand"
                  value={c.phone_number}
                  checked={selected === c.phone_number}
                  disabled={!usable}
                  onChange={() => setSelected(c.phone_number)}
                />
                <span className="adm-cand-body">
                  <span className="adm-cand-top">
                    <span className="adm-cand-num">{c.friendly_name || c.phone_number}</span>
                    <span className="badge badge-neutral">{c.type === "toll_free" ? "Toll-free" : "Local number"}</span>
                  </span>
                  <span className="adm-cand-meta">
                    <span className="t-mono">{c.phone_number}</span>
                    {(c.locality || c.region) && <span> · {[c.locality, c.region].filter(Boolean).join(", ")}</span>}
                  </span>
                  <span className="adm-cand-caps">
                    {c.capabilities.voice && <span className="badge badge-success">Voice</span>}
                    {c.capabilities.sms && <span className="badge badge-success">SMS</span>}
                    {c.capabilities.mms && <span className="badge badge-neutral">MMS</span>}
                    {!usable && <span className="badge badge-warning">Voice + SMS required</span>}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

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
