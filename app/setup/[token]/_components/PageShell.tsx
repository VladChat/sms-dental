import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        maxWidth: "var(--content)",
        margin: "0 auto",
        padding: "var(--space-12) var(--space-6) var(--space-20)",
      }}
    >
      <header style={{ marginBottom: "var(--space-8)" }}>
        <p className="t-eyebrow">Missed Calls Dental</p>
        <h1 className="t-h2" style={{ marginTop: "var(--space-2)" }}>Account setup</h1>
      </header>
      {children}
    </main>
  );
}
