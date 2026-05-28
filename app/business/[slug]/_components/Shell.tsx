import type { ReactNode } from "react";

// Single, consistent public service name. Do not introduce double naming.
const SERVICE_NAME = "Missed Calls Dental";

type PageKind = "profile" | "privacy" | "terms";

export function PublicShell({
  businessName,
  slug,
  page,
  children,
}: {
  businessName: string;
  slug: string;
  page: PageKind;
  children: ReactNode;
}) {
  const base = `/business/${slug}`;
  const nav: { key: PageKind; label: string; href: string }[] = [
    { key: "profile", label: "Business Profile", href: base },
    { key: "privacy", label: "Privacy Policy", href: `${base}/privacy` },
    { key: "terms", label: "SMS Terms", href: `${base}/sms-terms` },
  ];

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "40px 24px 80px",
        lineHeight: 1.6,
        color: "#1f2937",
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <a href={base} style={businessNameStyle}>
          {businessName}
        </a>
        <nav aria-label="Business pages" style={navStyle}>
          {nav.map((n) => (
            <a
              key={n.key}
              href={n.href}
              aria-current={n.key === page ? "page" : undefined}
              style={{ ...navLinkStyle, ...(n.key === page ? navLinkActiveStyle : null) }}
            >
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      {page !== "profile" && (
        <p style={{ margin: "0 0 16px" }}>
          <a href={base} style={backLinkStyle}>← Back to business profile</a>
        </p>
      )}

      {children}

      <footer style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
        <p style={{ margin: "0 0 8px" }}>
          <a href={base} style={footerLinkStyle}>Business Profile</a>
          <span style={footerSep}> · </span>
          <a href={`${base}/privacy`} style={footerLinkStyle}>Privacy Policy</a>
          <span style={footerSep}> · </span>
          <a href={`${base}/sms-terms`} style={footerLinkStyle}>SMS Terms</a>
        </p>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
          This messaging program is operated for {businessName} by {SERVICE_NAME}, its technology and
          service provider.
        </p>
      </footer>
    </main>
  );
}

export function formatAddress(parts: {
  street: string | null;
  line2?: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}): string {
  const cityState = [parts.city, parts.state].filter(Boolean).join(", ");
  const tail = [cityState, parts.zip].filter(Boolean).join(" ");
  return [parts.street, parts.line2, tail].filter(Boolean).join(", ");
}

const businessNameStyle: React.CSSProperties = {
  display: "inline-block",
  color: "#111827",
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "-.01em",
  textDecoration: "none",
};
const navStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  marginTop: 10,
  paddingBottom: 12,
  borderBottom: "1px solid #e5e7eb",
};
const navLinkStyle: React.CSSProperties = { color: "#6b7280", fontSize: 14, textDecoration: "none" };
const navLinkActiveStyle: React.CSSProperties = { color: "#0d9488", fontWeight: 600 };
const backLinkStyle: React.CSSProperties = { color: "#0d9488", fontWeight: 600, textDecoration: "none" };
const footerLinkStyle: React.CSSProperties = { color: "#0d9488", fontSize: 13, textDecoration: "none" };
const footerSep: React.CSSProperties = { color: "#9ca3af", fontSize: 13 };

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
