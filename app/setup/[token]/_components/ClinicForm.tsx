"use client";

import { useState } from "react";
import { getPasswordValidationError, MIN_PASSWORD_LENGTH } from "../../../../lib/auth/password";

type Props = {
  token: string;
  loginEmail: string;
  initialValues: {
    name: string;
    mainPhone: string;
    postalCode: string;
  };
};

export function ClinicForm({ token, loginEmail, initialValues }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showLoginLink, setShowLoginLink] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPasswordError(null);
    setShowLoginLink(false);
    setSubmitting(true);
    try {
      const form = event.currentTarget;
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      const password = String(payload.password ?? "");
      const confirmPassword = String(payload.confirm_password ?? "");

      if (password !== confirmPassword) {
        setPasswordError("Passwords do not match.");
        return;
      }
      const pwdError = getPasswordValidationError(password);
      if (pwdError) {
        setPasswordError(pwdError);
        return;
      }

      const res = await fetch(`/api/onboarding/${encodeURIComponent(token)}/clinic`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        redirect?: string;
        error?: { code?: string; message?: string };
      };
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Could not save your office details. Please check your entries.");
        if (data?.error?.code === "owner_user_exists_login_required") {
          setShowLoginLink(true);
        }
        return;
      }
      // Account context is set server-side; move to the clean /account URL.
      window.location.assign(data.redirect ?? "/account");
    } catch {
      setError("We couldn't reach the server. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card card-pad">
      <h2 className="t-h3">Account setup</h2>
      <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
        Finish your clinic details and account access.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: "var(--space-6)", display: "grid", gap: "var(--space-5)" }} noValidate>
        <section className="acct-card-subsection" aria-labelledby="account-details-title">
          <h3 id="account-details-title" className="t-h4">Account details</h3>
          <div style={{ display: "grid", gap: "var(--space-5)", marginTop: "var(--space-4)" }}>
            <Field
              label="Clinic name"
              name="name"
              required
              placeholder="Bright Smile Dental"
              defaultValue={initialValues.name}
            />
            <Field
              label="Main office phone"
              name="main_phone"
              required
              placeholder="(224) 555-1234"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={initialValues.mainPhone}
            />
            <Field
              label="ZIP code"
              name="postal_code"
              required
              helper="We’ll use this ZIP code to prepare a local number near your office."
              placeholder="60010"
              inputMode="numeric"
              autoComplete="postal-code"
              defaultValue={initialValues.postalCode}
            />
          </div>
        </section>

        <section className="acct-card-subsection" aria-labelledby="account-access-title">
          <h3 id="account-access-title" className="t-h4">Account access</h3>
          <div style={{ display: "grid", gap: "var(--space-5)", marginTop: "var(--space-4)" }}>
            <Field
              label="Login email"
              name="login_email"
              required
              helper="This is the email your setup link was sent to."
              defaultValue={loginEmail}
              type="email"
              autoComplete="email"
              readOnly
            />
            <Field
              label="Create password"
              name="password"
              required
              helper={`Use at least ${MIN_PASSWORD_LENGTH} characters with one letter and one number.`}
              type="password"
              autoComplete="new-password"
            />
            <Field
              label="Confirm password"
              name="confirm_password"
              required
              type="password"
              autoComplete="new-password"
            />
          </div>
        </section>

        {passwordError && (
          <p className="helper" role="alert" style={{ margin: 0, color: "var(--error-text)" }}>
            {passwordError}
          </p>
        )}

        {error && (
          <div className="alert alert-error" role="alert" aria-live="polite">
            <div>
              <span>{error}</span>
              {showLoginLink && (
                <p style={{ margin: "var(--space-2) 0 0" }}>
                  <a className="link" href="/login">Go to sign in →</a>
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Continuing…" : "Continue setup"}
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
  readOnly = false,
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
  readOnly?: boolean;
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
        className={`input${readOnly ? " acct-readonly" : ""}`}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        inputMode={inputMode}
        autoComplete={autoComplete ?? "off"}
        aria-describedby={helperId}
        spellCheck={false}
        readOnly={readOnly}
        aria-readonly={readOnly ? true : undefined}
      />
      {helper && (
        <p id={helperId} className="helper">{helper}</p>
      )}
    </div>
  );
}
