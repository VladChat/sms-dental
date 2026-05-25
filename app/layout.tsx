import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Missed Calls Dental — App",
  description: "Internal application surface for Missed Calls Dental.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: "#111827",
          background: "#f9fafb",
        }}
      >
        {children}
      </body>
    </html>
  );
}
