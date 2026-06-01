"use client";

import { useState } from "react";

// Reuses the existing logout endpoint, then returns to the admin login page
// (not the clinic-owner /login).
export function AdminSignOut() {
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — navigate regardless
    } finally {
      window.location.assign("/admin/login");
    }
  }
  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={onClick} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
