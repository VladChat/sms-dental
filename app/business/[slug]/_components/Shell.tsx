import type { ReactNode } from "react";

export function PublicShell({
  businessName,
  children,
}: {
  businessName: string;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 24px 80px",
        lineHeight: 1.6,
        color: "#1f2937",
      }}
    >
      <header style={{ marginBottom: 28 }}>
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
          {businessName}
        </p>
      </header>
      {children}
      <footer style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
          This messaging program is operated with Missed Calls Dental (Dental SMS) acting as
          the technology and service provider on behalf of {businessName}.
        </p>
      </footer>
    </main>
  );
}

export function formatAddress(parts: {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}): string {
  const line2 = [parts.city, parts.state].filter(Boolean).join(", ");
  const tail = [line2, parts.zip].filter(Boolean).join(" ");
  return [parts.street, tail].filter(Boolean).join(", ");
}

export const h1Style: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 26,
  color: "#111827",
  letterSpacing: "-.02em",
};
export const h2Style: React.CSSProperties = {
  margin: "28px 0 8px",
  fontSize: 18,
  color: "#111827",
};
export const pStyle: React.CSSProperties = { margin: "0 0 12px", color: "#374151" };
export const linkStyle: React.CSSProperties = { color: "#0d9488", fontWeight: 600 };
