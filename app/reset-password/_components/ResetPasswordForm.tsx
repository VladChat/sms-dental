"use client";

import { useState } from "react";
import { getPasswordValidationError, MIN_PASSWORD_LENGTH } from "../../../lib/auth/password";

type UpdatePasswordResponse = {
  ok?: boolean;
  redirect?: string;
  error?: { message?: string };
};

export function ResetPasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
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
      {/* Read-only account email. Gives the browser password manager a username to
          pair with the new password ("Save password?" → email + new password).
          Read-only: password reset must never change the account email. */}
      <div className="field">
        <label htmlFor="reset-email">Email</label>
        <input
          id="reset-email"
          name="username"
          type="email"
          className="input"
          autoComplete="username"
          value={email}
          readOnly
          aria-readonly="true"
          spellCheck={false}
          style={{ background: "var(--disabled-bg)", color: "var(--text-secondary)" }}
        />
      </div>

      <div className="field">
        <label htmlFor="reset-password">New password</label>
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowPasswords((prev) => !prev)}
              aria-pressed={showPasswords}
            >
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>
          </div>
          <input
            id="reset-password"
            name="password"
            type={showPasswords ? "text" : "password"}
            className="input"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            spellCheck={false}
          />
        </div>
        <p className="helper">{`Use at least ${MIN_PASSWORD_LENGTH} characters with one letter and one number.`}</p>
      </div>

      <div className="field">
        <label htmlFor="reset-confirm-password">Confirm password</label>
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <input
            id="reset-confirm-password"
            name="confirm_password"
            type={showPasswords ? "text" : "password"}
            className="input"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            spellCheck={false}
          />
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
