"use client";

import { useState } from "react";
import { getPasswordValidationError, MIN_PASSWORD_LENGTH } from "../../../lib/auth/password";

type UpdatePasswordResponse = {
  ok?: boolean;
  redirect?: string;
  error?: { message?: string };
};

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password,
          confirmPassword,
        }),
      });
      const data = (await res.json().catch(() => null)) as UpdatePasswordResponse | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? "Could not update password. Please try again.");
        return;
      }
      window.location.assign(data.redirect ?? "/account");
    } catch {
      setError("Could not update password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      style={{ marginTop: "var(--space-6)", display: "grid", gap: "var(--space-5)" }}
    >
      <div className="field">
        <label htmlFor="reset-password">New password</label>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <input
            id="reset-password"
            name="password"
            type={showPassword ? "text" : "password"}
            className="input"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <p className="helper">{`Use at least ${MIN_PASSWORD_LENGTH} characters with one letter and one number.`}</p>
      </div>

      <div className="field">
        <label htmlFor="reset-confirm-password">Confirm password</label>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <input
            id="reset-confirm-password"
            name="confirm_password"
            type={showConfirmPassword ? "text" : "password"}
            className="input"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
          >
            {showConfirmPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{error}</span>
        </div>
      )}

      <div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : "Save new password"}
        </button>
      </div>
    </form>
  );
}

