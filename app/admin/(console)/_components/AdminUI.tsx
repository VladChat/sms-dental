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

// Launch-readiness checklist row: a human title, an optional hint, and a status
// badge. Used by the clinic detail "Launch readiness" section. Pure/server-safe.
export type ReadyState =
  | "ready"
  | "needs_action"
  | "missing"
  | "not_connected"
  | "blocked"
  | "launched"
  | "not_launched";

const READY_LABEL: Record<ReadyState, string> = {
  ready: "Ready",
  needs_action: "Needs action",
  missing: "Missing",
  not_connected: "Not connected",
  blocked: "Blocked",
  launched: "Launched",
  not_launched: "Not launched",
};
const READY_TONE: Record<ReadyState, Tone> = {
  ready: "success",
  needs_action: "warning",
  missing: "warning",
  not_connected: "neutral",
  blocked: "neutral",
  launched: "success",
  not_launched: "neutral",
};

export function ReadyBadge({ state }: { state: ReadyState }) {
  return <Badge tone={READY_TONE[state]}>{READY_LABEL[state]}</Badge>;
}

export function CheckRow({
  title,
  hint,
  state,
}: {
  title: string;
  hint?: ReactNode;
  state: ReadyState;
}) {
  return (
    <div className="adm-check">
      <div className="adm-check-main">
        <span className="adm-check-title">{title}</span>
        {hint ? <span className="adm-check-hint">{hint}</span> : null}
      </div>
      <ReadyBadge state={state} />
    </div>
  );
}

// Maps an audit action key to plain operator language for the activity feed.
// Anything unmapped falls back to the raw key (still no JSON, no secrets).
const AUDIT_ACTION_LABELS: Record<string, string> = {
  "clinic.deactivate": "Paused clinic",
  "clinic.reactivate": "Reactivated clinic",
  "clinic.sms_recovery.enable": "Launched service",
  "clinic.sms_recovery.disable": "Paused SMS sending",
  "clinic.note.update": "Updated internal note",
  "clinic.business_profile.update": "Edited business profile",
  "clinic.a2p.update": "Edited SMS approval info",
  "clinic.a2p.submit_dry_run": "Recorded A2P dry-run review",
  "clinic.a2p.submit_attempt": "Started A2P submission",
  "clinic.a2p.submit_live": "Submitted A2P to Twilio",
  "clinic.a2p.submit_failed": "A2P submission failed",
  "clinic.a2p.status_refresh": "Refreshed A2P provider status",
  "clinic.provisioning.update": "Updated provisioning (legacy)",
};

export function describeAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

// ---- human labels for raw status enums (no snake_case in primary UI) ----

const SMS_STATUS_LABELS: Record<string, string> = {
  preparing: "Preparing",
  waiting_for_approval: "Waiting for approval",
  active: "Active",
};
const LOCAL_NUMBER_STATUS_LABELS: Record<string, string> = {
  preparing: "Preparing",
  reserved: "Reserved",
  assigned: "Assigned",
};
const BILLING_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};
const SETUP_STATUS_LABELS: Record<string, string> = {
  setup_pending: "Setup pending",
  clinic_details_completed: "Details completed",
  number_assigned: "Number assigned",
  qa_pending: "QA pending",
  qa_passed: "QA passed",
  ready_for_approval: "Ready for approval",
  active: "Active",
  cancelled: "Cancelled",
  expired: "Expired",
};

// Title-case a snake_case/kebab token as a last-resort human label.
export function humanizeToken(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function smsStatusLabel(s: string): string {
  return SMS_STATUS_LABELS[s] ?? humanizeToken(s);
}
export function localNumberStatusLabel(s: string): string {
  return LOCAL_NUMBER_STATUS_LABELS[s] ?? humanizeToken(s);
}
export function billingStatusLabel(s: string): string {
  return BILLING_STATUS_LABELS[s] ?? humanizeToken(s);
}
export function setupStatusLabel(s: string): string {
  return SETUP_STATUS_LABELS[s] ?? humanizeToken(s);
}
