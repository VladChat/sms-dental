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
        setError(data?.error?.message ?? "Could not save your office details. Please check your entries.");
        return;
      }
      window.location.reload();
    } catch {
      setError("We couldn't reach the server. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card card-pad">
      <p className="t-eyebrow" style={{ marginBottom: "var(--space-2)" }}>Step 1 of 2</p>
      <h2 className="t-h3">Create office profile</h2>
      <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
        Three quick details to get your office set up. Your main office number stays the same.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: "var(--space-6)", display: "grid", gap: "var(--space-5)" }} noValidate>
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
          helper="We’ll use this ZIP code to find a local number near your office."
          placeholder="60010"
          inputMode="numeric"
          autoComplete="postal-code"
        />

        {error && (
          <div className="alert alert-error" role="alert" aria-live="polite">
            <span>{error}</span>
          </div>
        )}

        <div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create office profile"}
          </button>
        </div>

        <p className="t-helper" style={{ margin: 0 }}>
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
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className="input"
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        inputMode={inputMode}
        autoComplete={autoComplete ?? "off"}
        aria-describedby={helperId}
        spellCheck={false}
      />
      {helper && (
        <p id={helperId} className="helper">{helper}</p>
      )}
    </div>
  );
}
