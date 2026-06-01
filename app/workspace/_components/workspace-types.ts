// Shared types + pure helpers for the front-desk workspace. No runtime side
// effects, so both the server page and the client component import these.

export type WorkspaceStatus =
  | "new"
  | "needs_follow_up"
  | "waiting_for_patient"
  | "ready_to_call"
  | "booked"
  | "closed"
  | "no_appointment_booked"
  | "could_not_reach_patient";

export type WorkspaceTimelineItem = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  at: string; // ISO timestamp
};

// The front-desk-safe view of a patient request. Fields that have no source in
// the current schema (name, request type, preferred time, summary) are null and
// rendered as "Not provided yet" — never invented or AI-generated.
export type PatientRequestCard = {
  // Opaque key for React/selection only. Not an internal ID shown to the user.
  id: string;
  callerPhone: string;
  patientName: string | null;
  requestType: string | null;
  preferredTime: string | null;
  summary: string | null;
  latestMessage: string | null;
  latestMessageDirection: "inbound" | "outbound" | null;
  status: WorkspaceStatus;
  createdAt: string; // ISO
  lastActivityAt: string; // ISO
  timeline: WorkspaceTimelineItem[];
  // True only for UI-only demo cards rendered when no real conversations exist.
  isSample?: boolean;
  // Optional sample note shown in the detail view.
  sampleNote?: string | null;
};

// Conservative status derivation from existing data only. We never guess beyond
// what the messages/lifecycle clearly support. `ready_to_call` is part of the
// vocabulary but is intentionally not auto-assigned yet (no reliable signal).
export function deriveWorkspaceStatus(
  dbStatus: string,
  timeline: { direction: "inbound" | "outbound" }[],
): WorkspaceStatus {
  if (dbStatus === "booked") return "booked";
  if (dbStatus === "closed" || dbStatus === "lost") return "closed";

  if (timeline.length === 0) return "needs_follow_up";
  const latest = timeline[timeline.length - 1];
  if (latest.direction === "inbound") return "needs_follow_up";
  return "waiting_for_patient";
}

export const WORKSPACE_STATUS_META: Record<
  WorkspaceStatus,
  { label: string; badge: string }
> = {
  new: { label: "Needs follow-up", badge: "badge-warning" },
  needs_follow_up: { label: "Needs follow-up", badge: "badge-warning" },
  waiting_for_patient: { label: "Waiting for patient", badge: "badge-neutral" },
  ready_to_call: { label: "Ready to call", badge: "badge-brand" },
  booked: { label: "Appointment booked", badge: "badge-success" },
  closed: { label: "Closed", badge: "badge-neutral" },
  no_appointment_booked: { label: "No appointment booked", badge: "badge-neutral" },
  could_not_reach_patient: { label: "Closed", badge: "badge-neutral" },
};

export const NOT_PROVIDED = "Not provided yet";

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NOT_PROVIDED;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
