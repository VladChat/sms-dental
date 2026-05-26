import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px 80px",
        lineHeight: 1.55,
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <p
          style={{
            margin: 0,
            color: "#6b7280",
            fontSize: 13,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Missed Calls Dental
        </p>
        <h1
          style={{
            margin: "8px 0 0",
            fontSize: 26,
            color: "#111827",
            letterSpacing: "-.018em",
          }}
        >
          Office setup
        </h1>
      </header>
      {children}
    </main>
  );
}
