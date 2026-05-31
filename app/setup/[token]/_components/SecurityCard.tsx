"use client";

import { useState } from "react";
import { StatusRow } from "./AccountUI";

export function SecurityCard({
  loginEmail,
  passwordEnabled,
}: {
  loginEmail: string;
  passwordEnabled: boolean;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <StatusRow label="Login email">
        <span className="t-small t-mono" style={{ color: "var(--text-body)" }}>{loginEmail}</span>
      </StatusRow>
      <StatusRow label="Password">
        <span className="t-small" style={{ color: "var(--text-body)" }}>
          {passwordEnabled ? "Password sign-in enabled" : "Not enabled"}
        </span>
      </StatusRow>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{error}</span>
        </div>
      )}

      <div>
        <button type="button" className="btn btn-secondary" onClick={signOut} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
