import type { Metadata } from "next";
import { lookupSetupRequestByRawToken } from "../../../lib/onboarding/verify";
import { SetupInvalid } from "./_components/SetupInvalid";
import { ClinicForm } from "./_components/ClinicForm";
import { AccountHandoff } from "./_components/AccountHandoff";
import { PageShell } from "./_components/PageShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Set up your office — Missed Calls Dental",
  description:
    "Complete your Missed Calls Dental setup: create your office profile and account.",
  robots: { index: false, follow: false },
};

// `/setup/[token]` is the magic-entry URL from the setup email. It validates the
// token and shows the initial office-profile form. Once a clinic exists, account
// context is established and the customer moves to the clean `/account` URL so
// the long token does not stay in the address bar.
export default async function SetupTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lookup = await lookupSetupRequestByRawToken(token);

  if (!lookup.ok) {
    return (
      <PageShell>
        <SetupInvalid reason={lookup.reason} />
      </PageShell>
    );
  }
  const setupRequest = lookup.setupRequest;

  // Magic-entry screen — create office profile (no clinic yet).
  if (
    setupRequest.status === "requested" ||
    setupRequest.status === "email_sent" ||
    !setupRequest.clinic_id
  ) {
    return (
      <PageShell>
        <ClinicForm token={token} />
      </PageShell>
    );
  }

  // Clinic exists — establish account context and move to the clean /account URL.
  return <AccountHandoff token={token} />;
}
