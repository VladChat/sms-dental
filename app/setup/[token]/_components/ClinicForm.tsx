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
  const [businessPhone, setBusinessPhone] = useState(formatUsPhone(initialValues.mainPhone));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        redirect?: string;
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? "Could not save your account setup. Please check your entries.");
        if (data?.error?.code === "owner_user_exists_login_required") {
          setShowLoginLink(true);
        }
        return;
      }
      // Account context is set server-side; move to the clean /account URL.
      window.location.assign(data?.redirect ?? "/account");
    } catch {
      setError("We couldn't reach the server. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card card-pad">
      <form onSubmit={onSubmit} style={{ marginTop: "var(--space-6)", display: "grid", gap: "var(--space-5)" }} noValidate>
        <section aria-labelledby="business-information-title">
          <h3 id="business-information-title" className="t-h4">Business information</h3>
          <div style={{ display: "grid", gap: "var(--space-5)", marginTop: "var(--space-4)" }}>
            <Field
              label="Business name"
              name="name"
              required
              placeholder="Example: Smile Dental"
              defaultValue={initialValues.name}
            />
            <Field
              label="Business phone"
              name="main_phone"
              required
              placeholder="(555) 123-1234"
              inputMode="tel"
              autoComplete="tel"
              value={businessPhone}
              onChange={(v) => setBusinessPhone(formatUsPhone(v))}
            />
            <Field
              label="ZIP code"
              name="postal_code"
              required
              placeholder="60010"
              inputMode="numeric"
              autoComplete="postal-code"
              defaultValue={initialValues.postalCode}
            />
            <Field
              label="Country"
              name="country_display"
              defaultValue="United States"
              readOnly
            />
          </div>
        </section>

        <hr className="divider" />

        <section aria-labelledby="sign-in-title">
          <h3 id="sign-in-title" className="t-h4">Sign-in</h3>
          <div style={{ display: "grid", gap: "var(--space-5)", marginTop: "var(--space-4)" }}>
            <Field
              label="Login email"
              name="login_email"
              required
              defaultValue={loginEmail}
              type="email"
              autoComplete="email"
              readOnly
            />
            <PasswordField
              label="Create password"
              name="password"
              required
              shown={showPassword}
              onToggle={() => setShowPassword((prev) => !prev)}
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirm password"
              name="confirm_password"
              required
              shown={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((prev) => !prev)}
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
  value,
  onChange,
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
  value?: string;
  onChange?: (value: string) => void;
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
        {...(value !== undefined ? { value } : { defaultValue })}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
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

function PasswordField({
  label,
  name,
  required = false,
  autoComplete,
  shown,
  onToggle,
}: {
  label: string;
  name: string;
  required?: boolean;
  autoComplete?: string;
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <input
          id={name}
          name={name}
          type={shown ? "text" : "password"}
          className="input"
          required={required}
          autoComplete={autoComplete ?? "off"}
          spellCheck={false}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onToggle}>
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {name === "password" && (
        <p className="helper">{`Use at least ${MIN_PASSWORD_LENGTH} characters with one letter and one number.`}</p>
      )}
    </div>
  );
}

function formatUsPhone(value: string): string {
  const raw = value.replace(/\D/g, "");
  const digits = (raw.length > 10 && raw.startsWith("1") ? raw.slice(1) : raw).slice(0, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
