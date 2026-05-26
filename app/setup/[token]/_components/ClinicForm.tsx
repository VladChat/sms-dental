"use client";

import { useState } from "react";

type Props = {
  token: string;
  ownerName: string;
  ownerEmail: string;
};

export function ClinicForm({ token, ownerName, ownerEmail }: Props) {
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
      // Refresh to advance to the next step.
      window.location.reload();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section style={cardStyle}>
      <p style={eyebrowStyle}>Step 1 of 2</p>
      <h2 style={h2Style}>Tell us about your clinic</h2>
      <p style={helperStyle}>
        Your main office number stays the same. We will help you choose an additional office
        texting number for missed-call follow-ups.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 20 }} noValidate>
        <input type="hidden" name="owner_email_readonly" value={ownerEmail} />

        <Field label="Public-facing clinic name" name="name" required defaultValue="" />
        <Field
          label="Legal/business name"
          name="legal_business_name"
          required
          defaultValue=""
        />
        <Field
          label="Main office phone number (E.164, e.g. +12245551234)"
          name="main_phone"
          required
          placeholder="+12245551234"
          inputMode="tel"
        />
        <Field
          label="Timezone (IANA, e.g. America/Chicago)"
          name="timezone"
          required
          defaultValue="America/Chicago"
        />
        <Field
          label="Owner / admin contact name"
          name="owner_contact_name"
          required
          defaultValue={ownerName}
        />
        <Field
          label="Owner / admin email"
          name="owner_contact_email"
          type="email"
          required
          defaultValue={ownerEmail}
        />
        <Field
          label="Owner / admin phone (E.164)"
          name="owner_contact_phone"
          required
          placeholder="+12245551234"
          inputMode="tel"
        />
        <Field
          label="Test patient phone for QA (E.164)"
          name="test_patient_phone"
          required
          placeholder="+12245551234"
          inputMode="tel"
        />

        <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
          <label htmlFor="setup_mode" style={labelStyle}>
            Setup mode
          </label>
          <select
            id="setup_mode"
            name="setup_mode"
            required
            defaultValue="conditional_forwarding"
            style={inputStyle}
          >
            <option value="conditional_forwarding">Conditional forwarding</option>
            <option value="tracking_number">Tracking number</option>
            <option value="google_voice_forwarding_test">Google Voice forwarding test</option>
          </select>
        </div>

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
          {submitting ? "Saving…" : "Continue"}
        </button>
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  inputMode?: "text" | "tel" | "email";
}) {
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
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
        autoComplete="off"
        spellCheck={false}
        style={inputStyle}
      />
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
