// Shared front-desk outcome constants. Pure module (no runtime side effects, no
// server/client-only imports) so it is safe to import from the DB layer, the API
// route, the server page, and the client workspace component alike.

export const FRONT_DESK_OUTCOMES = [
  "appointment_booked",
  "no_appointment_booked",
  "could_not_reach_patient",
] as const;

export type FrontDeskOutcome = (typeof FRONT_DESK_OUTCOMES)[number];

export function isFrontDeskOutcome(value: unknown): value is FrontDeskOutcome {
  return (
    typeof value === "string" &&
    (FRONT_DESK_OUTCOMES as readonly string[]).includes(value)
  );
}

export const FRONT_DESK_OUTCOME_LABEL: Record<FrontDeskOutcome, string> = {
  appointment_booked: "Appointment booked",
  no_appointment_booked: "No appointment booked",
  could_not_reach_patient: "Could not reach patient",
};

export const FRONT_DESK_NOTE_MAX = 300;

// Maps a saved outcome to the conversation lifecycle status. The
// patient_conversations.status check constraint is open|closed|booked|lost.
export const FRONT_DESK_OUTCOME_TO_STATUS: Record<
  FrontDeskOutcome,
  "booked" | "lost" | "closed"
> = {
  appointment_booked: "booked",
  no_appointment_booked: "lost",
  could_not_reach_patient: "closed",
};
