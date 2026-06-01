"use client";

import { useState } from "react";

type ForgotPasswordResponse = {
  ok?: boolean;
  message?: string;
  error?: { message?: string };
};

const GENERIC_SUCCESS_MESSAGE = "If an account exists for this email, we'll send a password reset link.";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as ForgotPasswordResponse | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? "Could not process this request. Please try again.");
        return;
      }
      setSuccess(data.message ?? GENERIC_SUCCESS_MESSAGE);
    } catch {
      setError("Could not process this request. Please try again.");
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
        <label htmlFor="forgot-password-email">Email</label>
        <input
          id="forgot-password-email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          spellCheck={false}
        />
      </div>

      {success && (
        <div className="alert alert-success" role="status" aria-live="polite">
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Sending..." : "Send reset link"}
        </button>
        <a className="link" href="/login">Back to sign in</a>
      </div>
    </form>
  );
}

