import type { Metadata } from "next";
import { readAccountSessionToken } from "../../lib/onboarding/account-session";
import { lookupSetupRequestByRawToken } from "../../lib/onboarding/verify";
import { findClinicById } from "../../lib/db/clinics";
import { listClinicConversations } from "../../lib/db/front-desk";
import { resolveAuthClinicAccess } from "../../lib/auth/access";
import { toPatientRequestCard } from "../../lib/workspace/patient-request-card";
import { Workspace } from "./_components/Workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Patient requests — Missed Calls Dental",
  description: "Review office-ready patient requests built from missed-call replies.",
  robots: { index: false, follow: false },
};

// `/workspace` is the front-desk operational view. It shows only front-desk-safe
// patient-request data — never owner/admin setup, billing, compliance, or Twilio
// details. Access prefers real authenticated session + clinic membership, with a
// temporary setup-token fallback kept only to avoid lockouts during auth rollout.
export default async function WorkspacePage() {
  // Primary access path: authenticated owner/front-desk membership.
  const access = await resolveAuthClinicAccess();
  if (access.ok) {
    const conversations = await listClinicConversations(access.clinic.id).catch(() => []);
    return <Workspace cards={conversations.map(toPatientRequestCard)} />;
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
  return <Workspace cards={conversations.map(toPatientRequestCard)} />;
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
        <h1 className="t-h3">Patient requests</h1>
        <p className="t-body" style={{ marginTop: "var(--space-3)" }}>
          {needsSetup
            ? "Finish your account setup to start receiving patient requests."
            : signedOut
              ? "Please sign in to access patient requests."
              : "Please open your account link to access patient requests."}
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
