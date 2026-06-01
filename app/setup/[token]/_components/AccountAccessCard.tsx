"use client";

import { useState } from "react";
import { StatusRow } from "./AccountUI";
import { getPasswordValidationError, MIN_PASSWORD_LENGTH } from "../../../../lib/auth/password";

export function AccountAccessCard({
  loginEmail,
  passwordEnabled,
}: {
  loginEmail: string;
  passwordEnabled: boolean;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setError(null);
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        redirect?: string;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Could not sign out. Please try again.");
        return;
      }
      window.location.assign(json.redirect ?? "/login");
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div className="field">
        <label>Login email</label>
        <input
          className="input acct-readonly t-mono"
          value={loginEmail}
          readOnly
          aria-readonly="true"
          tabIndex={-1}
        />
      </div>
      <StatusRow label="Password">
        <span className="t-small" style={{ color: "var(--text-body)" }}>
          {passwordEnabled ? "Password is set" : "Not enabled"}
        </span>
      </StatusRow>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={() => setShowPasswordModal(true)}>
          Change password
        </button>
        <button type="button" className="btn btn-secondary" onClick={signOut} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    const passwordError = getPasswordValidationError(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message ?? "Could not update password. Please try again.");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Could not update password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="acct-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="acct-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="acct-change-password-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <h3 id="acct-change-password-title" className="t-h4">Change password</h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowPasswords((prev) => !prev)}
          >
            {showPasswords ? "Hide" : "Show"}
          </button>
        </div>

        {success ? (
          <>
            <p className="t-small" role="status" style={{ margin: 0, color: "var(--success-text)" }}>
              Password updated.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate style={{ display: "grid", gap: "var(--space-4)" }}>
            <div className="field">
              <label htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                name="current-password"
                type={showPasswords ? "text" : "password"}
                className="input"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                spellCheck={false}
              />
            </div>
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                name="new-password"
                type={showPasswords ? "text" : "password"}
                className="input"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                spellCheck={false}
              />
              <p className="helper">{`Use at least ${MIN_PASSWORD_LENGTH} characters with one letter and one number.`}</p>
            </div>
            <div className="field">
              <label htmlFor="confirm-new-password">Confirm new password</label>
              <input
                id="confirm-new-password"
                name="confirm-new-password"
                type={showPasswords ? "text" : "password"}
                className="input"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                spellCheck={false}
              />
            </div>

            {error && (
              <div className="alert alert-error" role="alert" aria-live="polite">
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Saving…" : "Save password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
