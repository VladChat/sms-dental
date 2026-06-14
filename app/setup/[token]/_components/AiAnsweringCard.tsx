"use client";

import { includedAiAnsweredMinutesLabel } from "../../../../config/notifications.config";

// AI Answering — account section (NON-LIVE foundation).
//
// Honest, read-only status ONLY. AI Answering is being prepared and is NOT
// active. There is intentionally no enable toggle, no activation button, no
// usage/delivery charts, and no promise that anything is working. The included-
// minutes number comes from billing config via the shared helper (never a second
// source).
export function AiAnsweringCard() {
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <p className="t-body">AI Answering is being prepared for missed, busy, and after-hours calls.</p>
      <p className="t-small">
        It will use approved AI Front Desk Knowledge only.
      </p>
      <p className="t-small">
        Your plan includes {includedAiAnsweredMinutesLabel()} AI answered call minutes.
      </p>
    </div>
  );
}
