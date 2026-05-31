"use client";

import { DocRow } from "./AccountUI";

export function DocumentsCard({
  publicBaseUrl,
  slug,
}: {
  publicBaseUrl: string;
  slug: string | null;
}) {
  const base = slug ? `${publicBaseUrl}/business/${slug}` : null;

  if (!base) {
    return (
      <p className="t-small" style={{ color: "var(--text-muted)" }}>
        Your documents appear here once you save your business profile.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-2)" }}>
      <DocRow label="Business profile" url={base} />
      <DocRow label="Privacy policy" url={`${base}/privacy`} />
      <DocRow label="SMS terms" url={`${base}/sms-terms`} />
    </div>
  );
}
