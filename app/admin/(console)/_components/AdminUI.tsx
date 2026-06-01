import type { ReactNode } from "react";

// Server-safe presentational helpers for the admin console (no client runtime).

type Tone = "success" | "neutral" | "warning" | "info" | "brand";

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function BoolBadge({
  value,
  yes,
  no,
  yesTone = "success",
  noTone = "neutral",
}: {
  value: boolean;
  yes: string;
  no: string;
  yesTone?: Tone;
  noTone?: Tone;
}) {
  return <Badge tone={value ? yesTone : noTone}>{value ? yes : no}</Badge>;
}

export function Kpi({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="adm-kpi">
      <span className="adm-kpi-value">{value}</span>
      <span className="adm-kpi-label">{label}</span>
      {hint && <span className="adm-kpi-hint">{hint}</span>}
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="adm-row">
      <span className="adm-row-label">{label}</span>
      <span className="adm-row-value">{children}</span>
    </div>
  );
}

const SMS_STATUS_TONE: Record<string, Tone> = {
  active: "success",
  waiting_for_approval: "warning",
  preparing: "neutral",
};
const BILLING_TONE: Record<string, Tone> = {
  active: "success",
  trialing: "info",
  past_due: "warning",
  canceled: "neutral",
  not_started: "neutral",
};

export function smsStatusTone(status: string): Tone {
  return SMS_STATUS_TONE[status] ?? "neutral";
}
export function billingTone(status: string): Tone {
  return BILLING_TONE[status] ?? "neutral";
}
