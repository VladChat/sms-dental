"use client";

import { useState } from "react";
import { StatusRow } from "./AccountUI";

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
        <div className="acct-modal-backdrop" role="presentation" onClick={() => setShowPasswordModal(false)}>
          <div
            className="acct-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="acct-password-placeholder-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="acct-password-placeholder-title" className="t-h4">Change password</h3>
            <p className="t-small" style={{ margin: 0 }}>
              Password change will be available after secure account settings are connected.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
