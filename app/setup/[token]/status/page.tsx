import type { Metadata } from "next";
import { lookupSetupRequestByRawToken } from "../../../../lib/onboarding/verify";
import { findClinicById } from "../../../../lib/db/clinics";
import { findActiveOfficeTextingNumber } from "../../../../lib/db/clinic-phone-numbers";
import { PageShell } from "../_components/PageShell";
import { SetupInvalid } from "../_components/SetupInvalid";
import { SetupStatusReady } from "../_components/SetupStatusReady";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Setup status — Missed Calls Dental",
  robots: { index: false, follow: false },
};

export default async function SetupStatusPage({
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
