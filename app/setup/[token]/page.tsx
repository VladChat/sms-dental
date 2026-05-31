import type { Metadata } from "next";
import { lookupSetupRequestByRawToken } from "../../../lib/onboarding/verify";
import { findClinicById } from "../../../lib/db/clinics";
import { SetupInvalid } from "./_components/SetupInvalid";
import { ClinicForm } from "./_components/ClinicForm";
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
// token and shows the first-entry onboarding form (office identity + password).
// After submit, the server creates/updates clinic records, creates owner auth,
// establishes session, and redirects to the clean `/account` URL.
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

  const clinic = setupRequest.clinic_id
    ? await findClinicById(setupRequest.clinic_id).catch(() => null)
    : null;

  return (
    <PageShell>
      <ClinicForm
        token={token}
        loginEmail={setupRequest.owner_email}
        initialValues={{
          name: clinic?.name ?? "",
          mainPhone: clinic?.main_phone ?? "",
          postalCode: clinic?.postal_code ?? "",
        }}
      />
    </PageShell>
  );
}
