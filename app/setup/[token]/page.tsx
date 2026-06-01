import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  lookupSetupRequestByRawToken,
  isSetupAlreadyCompleted,
} from "../../../lib/onboarding/verify";
import { findClinicById } from "../../../lib/db/clinics";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { SetupInvalid } from "./_components/SetupInvalid";
import { SetupComplete } from "./_components/SetupComplete";
import { ClinicForm } from "./_components/ClinicForm";
import { PageShell } from "./_components/PageShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Account setup — Missed Calls Dental",
  description:
    "Complete your Missed Calls Dental account setup.",
  robots: { index: false, follow: false },
};

// Completed-link behavior: a signed-in user goes straight to /account; otherwise
// we render a no-password completed-state card. This is decided server-side so we
// never re-render the password form for an already-created account.
async function renderCompleted() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect("/account");
  }
  return (
    <PageShell>
      <SetupComplete />
    </PageShell>
  );
}

// `/setup/[token]` is the magic-entry URL from the setup email. It validates the
// token, then determines the setup state BEFORE rendering anything:
//   - invalid/expired/cancelled token -> invalid-link card (unchanged)
//   - already-completed setup         -> redirect (signed in) or completed card
//   - first-time, not-yet-created     -> the onboarding form (office + password)
// Reopening a used link is therefore idempotent and never restarts setup.
export default async function SetupTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lookup = await lookupSetupRequestByRawToken(token);

  if (!lookup.ok) {
    // A valid-but-terminal token (status 'active') reports "completed" — treat it
    // the same as the auth-account-exists case below.
    if (lookup.reason === "completed") {
      return await renderCompleted();
    }
    return (
      <PageShell>
        <SetupInvalid reason={lookup.reason} />
      </PageShell>
    );
  }

  const setupRequest = lookup.setupRequest;

  // Canonical idempotency check: if the owner account already exists, setup is
  // done — show the completed state instead of the account/password form.
  if (await isSetupAlreadyCompleted(setupRequest.owner_email)) {
    return await renderCompleted();
  }

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
