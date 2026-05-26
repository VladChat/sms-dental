"use client";

import { useEffect, useState } from "react";

type AvailableNumber = {
  phone_number: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
  capabilities: { voice: boolean; sms: boolean };
  recommended: boolean;
};

type Props = {
  token: string;
  mainPhone: string | null;
  clinicName: string;
};

function defaultAreaCode(mainPhone: string | null): string {
  if (!mainPhone) return "";
  if (mainPhone.startsWith("+1") && mainPhone.length >= 5) {
    return mainPhone.slice(2, 5);
  }
  return "";
}

export function NumberSearch({ token, mainPhone, clinicName }: Props) {
  const [areaCode, setAreaCode] = useState<string>(defaultAreaCode(mainPhone));
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [resolvedAreaCode, setResolvedAreaCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(useAreaCode: string) {
    setSearching(true);
    setError(null);
    try {
      const url = new URL(
        `/api/onboarding/${encodeURIComponent(token)}/numbers`,
        window.location.origin,
      );
      if (useAreaCode) url.searchParams.set("area_code", useAreaCode);
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
  }

  useEffect(() => {
    search(areaCode);
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
          await search(areaCode);
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

  return (
    <section style={cardStyle}>
      <p style={eyebrowStyle}>Step 2 of 2 · {clinicName}</p>
      <h2 style={h2Style}>Choose your office texting number</h2>
      <p style={subtitleStyle}>
        This is an additional number for missed-call text follow-ups. It will not replace
        your existing office phone number.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{3}$/.test(areaCode) || areaCode === "") {
            void search(areaCode);
          } else {
            setError("Area code must be a 3-digit US area code.");
          }
        }}
        style={{
          marginTop: 16,
          display: "flex",
          gap: 8,
          alignItems: "end",
        }}
      >
        <div style={{ display: "grid", gap: 6, flex: 1, maxWidth: 260 }}>
          <label htmlFor="area_code" style={labelStyle}>
            Area code
          </label>
          <input
            id="area_code"
            name="area_code"
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="224"
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
          Showing local US numbers for area code {resolvedAreaCode}.
        </p>
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
            No numbers found. Try a different area code.
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
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <strong style={{ fontSize: 17, color: "#111827" }}>
                  {n.phone_number}
                </strong>
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
