import type { Metadata } from "next";
import { readAccountSessionToken } from "../../lib/onboarding/account-session";
import { lookupSetupRequestByRawToken } from "../../lib/onboarding/verify";
import { findClinicById } from "../../lib/db/clinics";
import {
  listClinicConversations,
  type FrontDeskConversation,
} from "../../lib/db/front-desk";
import { resolveAuthClinicAccess } from "../../lib/auth/access";
import { Workspace } from "./_components/Workspace";
import {
  deriveWorkspaceStatus,
  workspaceStatusForOutcome,
  type PatientRequestCard,
} from "./_components/workspace-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Front desk workspace — Missed Calls Dental",
  description: "Review missed-call replies and patient requests.",
  robots: { index: false, follow: false },
};

// Map a front-desk-safe conversation into a UI card. A saved front-desk outcome
// is the primary source of the card's status; otherwise we fall back to the
// conservative timeline/lifecycle derivation. Name/request-type/preferred-time/
// summary have no source columns yet, so they stay null ("Not provided yet").
function toCard(c: FrontDeskConversation): PatientRequestCard {
  const timeline = c.messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    at: m.createdAt.toISOString(),
  }));
  const latest = timeline.length > 0 ? timeline[timeline.length - 1] : null;
  return {
    id: c.id,
    callerPhone: c.patientPhone,
    patientName: null,
    requestType: null,
    preferredTime: null,
    summary: null,
    latestMessage: latest?.body ?? null,
    latestMessageDirection: latest?.direction ?? null,
    status:
      workspaceStatusForOutcome(c.frontDeskOutcome) ??
      deriveWorkspaceStatus(c.dbStatus, timeline),
    createdAt: c.createdAt.toISOString(),
    lastActivityAt: (c.lastMessageAt ?? c.createdAt).toISOString(),
    timeline,
    frontDeskOutcome: c.frontDeskOutcome,
    frontDeskNote: c.frontDeskNote,
    frontDeskOutcomeAt: c.frontDeskOutcomeAt ? c.frontDeskOutcomeAt.toISOString() : null,
  };
}

// `/workspace` is the front-desk operational view. It shows only front-desk-safe
// patient-request data — never owner/admin setup, billing, compliance, or Twilio
// details. Access prefers real authenticated session + clinic membership, with a
// temporary setup-token fallback kept only to avoid lockouts during auth rollout.
export default async function WorkspacePage() {
  // Primary access path: authenticated owner/front-desk membership.
  const access = await resolveAuthClinicAccess();
  if (access.ok) {
    const conversations = await listClinicConversations(access.clinic.id).catch(() => []);
    return <Workspace cards={conversations.map(toCard)} />;
  }

  // Temporary legacy fallback: setup-token cookie for existing preview users.
  const token = await readAccountSessionToken();
  if (!token) return <WorkspaceGate signedOut />;

  const lookup = await lookupSetupRequestByRawToken(token);
  if (!lookup.ok) return <WorkspaceGate signedOut />;

  const setupRequest = lookup.setupRequest;
  if (!setupRequest.clinic_id) return <WorkspaceGate needsSetup />;

  const clinic = await findClinicById(setupRequest.clinic_id);
  if (!clinic) return <WorkspaceGate />;

  const conversations = await listClinicConversations(clinic.id).catch(() => []);
  return <Workspace cards={conversations.map(toCard)} />;
}

function WorkspaceGate({
  needsSetup = false,
  signedOut = false,
}: {
  needsSetup?: boolean;
  signedOut?: boolean;
}) {
  return (
    <main className="ws-page">
      <section className="card card-pad" style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 className="t-h3">Front desk workspace</h1>
        <p className="t-body" style={{ marginTop: "var(--space-3)" }}>
          {needsSetup
            ? "Finish your account setup to start receiving patient requests."
            : signedOut
              ? "Please sign in to access the workspace."
              : "Please open your account link to access the workspace."}
        </p>
        <p style={{ marginTop: "var(--space-5)" }}>
          <a
            className="link"
            href={needsSetup ? "/account" : signedOut ? "/login" : "https://missedcallsdental.com/"}
          >
            {needsSetup ? "Go to your account →" : signedOut ? "Go to sign in →" : "Request a new setup link →"}
          </a>
        </p>
      </section>
    </main>
  );
}
