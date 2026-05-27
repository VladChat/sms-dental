"use client";

import { useCallback, useEffect, useState } from "react";

type SearchType = "local" | "toll_free";
type Country = "US" | "CA";

type AvailableNumber = {
  phone_number: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
  capabilities: { voice: boolean; sms: boolean };
  recommended: boolean;
  type: SearchType;
  country: Country;
};

type Props = {
  token: string;
  mainPhone: string | null;
  clinicName: string;
  country: Country;
  preferredAreaCode: string | null;
};

function defaultAreaCode(mainPhone: string | null, preferred: string | null): string {
  if (preferred && /^\d{3}$/.test(preferred)) return preferred;
  if (mainPhone && mainPhone.startsWith("+1") && mainPhone.length >= 5) {
    return mainPhone.slice(2, 5);
  }
  return "";
}

export function NumberSearch({
  token,
  mainPhone,
  clinicName,
  country,
  preferredAreaCode,
}: Props) {
  const [searchType, setSearchType] = useState<SearchType>("local");
  const [areaCode, setAreaCode] = useState<string>(
    defaultAreaCode(mainPhone, preferredAreaCode),
  );
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [resolvedAreaCode, setResolvedAreaCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (type: SearchType, useAreaCode: string) => {
      setSearching(true);
      setError(null);
      try {
        const url = new URL(
          `/api/onboarding/${encodeURIComponent(token)}/numbers`,
          window.location.origin,
        );
        url.searchParams.set("type", type);
        url.searchParams.set("country", country);
        if (type === "local" && useAreaCode) {
          url.searchParams.set("area_code", useAreaCode);
        }
        const res = await fetch(url.toString());
        const data = (await res.json()) as {
          ok?: boolean;
          area_code?: string | null;
          numbers?: AvailableNumber[];
          error?: { message?: string };
        };
        if (!res.ok || !data.ok) {
          setError(data?.error?.message ?? "Could not search numbers. Please try again.");
          setNumbers([]);
          return;
        }
        setNumbers(data.numbers ?? []);
        setResolvedAreaCode(data.area_code ?? null);
      } catch {
        setError("Could not search numbers. Please try again.");
        setNumbers([]);
      } finally {
        setSearching(false);
      }
    },
    [token, country],
  );

  useEffect(() => {
    void search(searchType, areaCode);
    // intentionally empty deps — initial search only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function purchase(number: string) {
    setPurchasing(number);
    setError(null);
    try {
      const res = await fetch(
        `/api/onboarding/${encodeURIComponent(token)}/numbers/purchase`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone_number: number }),
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: { code?: string; message?: string };
      };
      if (!res.ok || !data.ok) {
        if (data.error?.code === "number_no_longer_available") {
          setError("That number is no longer available. Please choose another number.");
          await search(searchType, areaCode);
          return;
        }
        setError(data.error?.message ?? "Could not assign that number. Please try again.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Could not assign that number. Please try again.");
    } finally {
      setPurchasing(null);
    }
  }

  function changeTab(next: SearchType) {
    if (next === searchType) return;
    setSearchType(next);
    setNumbers([]);
    setResolvedAreaCode(null);
    setError(null);
    void search(next, areaCode);
  }

  const countryLabel = country === "CA" ? "Canada" : "United States";
  const stateLabel = country === "CA" ? "province" : "state";

  return (
    <section style={cardStyle}>
      <p style={eyebrowStyle}>Step 2 of 2 · {clinicName}</p>
      <h2 style={h2Style}>Choose your office texting number</h2>
      <p style={subtitleStyle}>
        This is an additional number for missed-call text follow-ups. It will not replace
        your existing office phone number.
      </p>

      <div role="tablist" aria-label="Number type" style={tabsRowStyle}>
        <button
          type="button"
          role="tab"
          aria-selected={searchType === "local"}
          onClick={() => changeTab("local")}
          style={searchType === "local" ? tabActiveStyle : tabStyle}
        >
          Local number
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={searchType === "toll_free"}
          onClick={() => changeTab("toll_free")}
          style={searchType === "toll_free" ? tabActiveStyle : tabStyle}
        >
          Toll-free number
        </button>
      </div>

      {searchType === "local" ? (
        <>
          <p style={tabHelperStyle}>Looks local to patients near your office.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (/^\d{3}$/.test(areaCode) || areaCode === "") {
                void search("local", areaCode);
              } else {
                setError("Area code must be a 3-digit area code.");
              }
            }}
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              alignItems: "end",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 6, flex: 1, maxWidth: 260 }}>
              <label htmlFor="area_code" style={labelStyle}>
                Area code ({countryLabel})
              </label>
              <input
                id="area_code"
                name="area_code"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder={country === "CA" ? "416" : "224"}
                inputMode="numeric"
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              style={{ ...secondaryBtnStyle, height: 44 }}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>

          {resolvedAreaCode && (
            <p style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
              Showing local {countryLabel} numbers for area code {resolvedAreaCode}.
            </p>
          )}
          {!resolvedAreaCode && !searching && (
            <p style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
              Showing available local {countryLabel} numbers. Enter a different area code or{" "}
              {stateLabel} to narrow the search.
            </p>
          )}
        </>
      ) : (
        <>
          <p style={tabHelperStyle}>
            Business-style number. SMS use may require toll-free verification before live
            patient messaging.
          </p>
          <p
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              fontSize: 13,
            }}
          >
            Voice works immediately once assigned. SMS on toll-free numbers in the United
            States and Canada requires Twilio toll-free verification before live patient
            messaging. We&rsquo;ll cover this step with you before go-live.
          </p>
          <p style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
            Showing available toll-free numbers for {countryLabel}.
          </p>
        </>
      )}

      {error && (
        <p
          role="alert"
          aria-live="polite"
          style={{
            margin: "12px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 14,
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {numbers.length === 0 && !searching && (
          <p style={{ color: "#6b7280" }}>
            No numbers found. {searchType === "local"
              ? "Try a different area code."
              : "Try refreshing in a moment."}
          </p>
        )}
        {numbers.map((n) => (
          <article
            key={n.phone_number}
            style={{
              padding: 14,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#f9fafb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 17, color: "#111827" }}>
                  {n.phone_number}
                </strong>
                <span style={typeBadgeStyle(n.type)}>
                  {n.type === "toll_free" ? "Toll-free" : "Local"}
                </span>
                {n.recommended && (
                  <span
                    style={{
                      fontSize: 11,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: "#0d9488",
                      background: "#ccfbf1",
                      border: "1px solid #99f6e4",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    Recommended
                  </span>
                )}
              </div>
              <div style={{ marginTop: 4, color: "#4b5563", fontSize: 13 }}>
                {[n.locality, n.region].filter(Boolean).join(", ") || n.friendly_name}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void purchase(n.phone_number)}
              disabled={purchasing !== null}
              style={primaryBtnStyle}
            >
              {purchasing === n.phone_number ? "Assigning…" : "Use this number"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function typeBadgeStyle(type: SearchType): React.CSSProperties {
  if (type === "toll_free") {
    return {
      fontSize: 11,
      letterSpacing: ".08em",
      textTransform: "uppercase",
      fontWeight: 700,
      color: "#1e3a8a",
      background: "#dbeafe",
      border: "1px solid #bfdbfe",
      padding: "2px 8px",
      borderRadius: 999,
    };
  }
  return {
    fontSize: 11,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    fontWeight: 700,
    color: "#334155",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    padding: "2px 8px",
    borderRadius: 999,
  };
}

const cardStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};
const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#0d9488",
  fontSize: 12,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  fontWeight: 700,
};
const h2Style: React.CSSProperties = {
  margin: "6px 0 8px",
  fontSize: 22,
  color: "#111827",
  letterSpacing: "-.018em",
};
const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#374151",
};
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#111827",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  font: "inherit",
  fontSize: 15,
};
const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid transparent",
  background: "#0d9488",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const secondaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
const tabsRowStyle: React.CSSProperties = {
  display: "inline-flex",
  marginTop: 16,
  padding: 4,
  borderRadius: 999,
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  gap: 4,
};
const tabStyle: React.CSSProperties = {
  appearance: "none",
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid transparent",
  background: "transparent",
  color: "#475569",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
const tabActiveStyle: React.CSSProperties = {
  ...tabStyle,
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15,23,42,.08)",
};
const tabHelperStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#475569",
  fontSize: 14,
};
