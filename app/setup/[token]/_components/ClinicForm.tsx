"use client";

import { useState } from "react";

type Props = {
  token: string;
};

export function ClinicForm({ token }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = event.currentTarget;
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      const res = await fetch(`/api/onboarding/${encodeURIComponent(token)}/clinic`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Could not save clinic details. Please check your entries.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section style={cardStyle}>
      <h2 style={h2Style}>Create office profile</h2>
      <p style={helperStyle}>
        Three quick details to get your office set up. Your main office number stays the same.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 20 }} noValidate>
        <Field
          label="Clinic name"
          name="name"
          required
          helper="Enter the public name patients know your office by."
          placeholder="Bright Smile Dental"
        />
        <Field
          label="Main office phone"
          name="main_phone"
          required
          helper="Enter the phone number patients currently call."
          placeholder="(224) 555-1234"
          inputMode="tel"
          autoComplete="tel"
        />
        <Field
          label="ZIP code"
          name="postal_code"
          required
          helper="We’ll use this ZIP code to prepare a local number for your office."
          placeholder="60010"
          inputMode="numeric"
          autoComplete="postal-code"
        />

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

        <button type="submit" disabled={submitting} style={primaryBtnStyle}>
          {submitting ? "Creating…" : "Create office profile"}
        </button>

        <p style={footnoteStyle}>
          Automated setup is currently available for U.S. clinics only.
        </p>
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
  inputMode,
  autoComplete,
  helper,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
  helper?: string;
}) {
  const helperId = helper ? `${name}-helper` : undefined;
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
      <label htmlFor={name} style={labelStyle}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        inputMode={inputMode}
        autoComplete={autoComplete ?? "off"}
        aria-describedby={helperId}
        spellCheck={false}
        style={inputStyle}
      />
      {helper && (
        <p id={helperId} style={helperLineStyle}>
          {helper}
        </p>
      )}
    </div>
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
const helperStyle: React.CSSProperties = {
  margin: 0,
  color: "#374151",
};
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#111827",
};
const helperLineStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b7280",
  fontSize: 12,
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
  marginTop: 8,
  padding: "12px 20px",
  borderRadius: 999,
  border: "1px solid transparent",
  background: "#0d9488",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};
const footnoteStyle: React.CSSProperties = {
  margin: "14px 0 0",
  color: "#6b7280",
  fontSize: 12,
};
