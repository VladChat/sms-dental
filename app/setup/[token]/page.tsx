import type { Metadata } from "next";
import { lookupSetupRequestByRawToken } from "../../../lib/onboarding/verify";
import { findClinicById } from "../../../lib/db/clinics";
import { findActiveOfficeTextingNumber } from "../../../lib/db/clinic-phone-numbers";
import { SetupInvalid } from "./_components/SetupInvalid";
import { ClinicForm } from "./_components/ClinicForm";
import { NumberSearch } from "./_components/NumberSearch";
import { SetupStatusReady } from "./_components/SetupStatusReady";
import { PageShell } from "./_components/PageShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Set up your office — Missed Calls Dental",
  description:
    "Complete your Missed Calls Dental setup. Choose an office texting number for missed-call follow-ups.",
  robots: { index: false, follow: false },
};

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

  // Branch by current step.
  if (
    setupRequest.status === "requested" ||
    setupRequest.status === "email_sent"
  ) {
    return (
      <PageShell>
        <ClinicForm
          token={token}
          ownerName={setupRequest.owner_full_name}
          ownerEmail={setupRequest.owner_email}
        />
      </PageShell>
    );
  }

  // After clinic_details_completed but before number_assigned, search.
  if (
    setupRequest.status === "clinic_details_completed" ||
    setupRequest.status === "number_selected"
  ) {
    if (!setupRequest.clinic_id) {
      return (
        <PageShell>
          <SetupInvalid reason="not_found" />
        </PageShell>
      );
    }
    const clinic = await findClinicById(setupRequest.clinic_id);
    return (
      <PageShell>
        <NumberSearch
          token={token}
          mainPhone={clinic?.main_phone ?? null}
          clinicName={clinic?.name ?? "Your clinic"}
          country={clinic?.country ?? "US"}
          preferredAreaCode={clinic?.preferred_area_code ?? null}
        />
      </PageShell>
    );
  }

  // Number assigned or later — show status page.
  if (
    setupRequest.status === "number_assigned" ||
    setupRequest.status === "qa_pending" ||
    setupRequest.status === "qa_passed" ||
    setupRequest.status === "ready_for_approval" ||
    setupRequest.status === "active"
  ) {
    if (!setupRequest.clinic_id) {
      return (
        <PageShell>
          <SetupInvalid reason="not_found" />
        </PageShell>
      );
    }
    const [clinic, mapping] = await Promise.all([
      findClinicById(setupRequest.clinic_id),
      findActiveOfficeTextingNumber(setupRequest.clinic_id),
    ]);
    return (
      <PageShell>
        <SetupStatusReady
          clinicName={clinic?.name ?? "Your clinic"}
          mainPhone={clinic?.main_phone ?? null}
          officeTextingNumber={mapping?.phone_number ?? null}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <SetupInvalid reason="completed" />
    </PageShell>
  );
}
