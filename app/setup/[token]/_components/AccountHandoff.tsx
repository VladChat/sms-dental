"use client";

import { useEffect } from "react";
import { PageShell } from "./PageShell";

// Shown when a returning customer opens an email setup link whose clinic
// already exists. It establishes account context server-side (httpOnly cookie
// via /api/account/session) and then navigates to the clean `/account` URL, so
// the long setup token does not remain in the address bar.
export function AccountHandoff({ token }: { token: string }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetch("/api/account/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
      } catch {
        // Even if this fails, send the customer to /account, which will show a
        // clear "open your setup link" message rather than the token URL.
      }
      if (!cancelled) window.location.replace("/account");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <PageShell>
      <section className="card card-pad" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        <p className="t-small" style={{ marginTop: "var(--space-3)" }}>Opening your account…</p>
      </section>
    </PageShell>
  );
}
