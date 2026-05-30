import type { Metadata } from "next";
import { lookupSetupRequestByRawToken } from "../../../lib/onboarding/verify";
import { findClinicById } from "../../../lib/db/clinics";
import { getAppDomainsSafe } from "../../../lib/env";
import { SetupInvalid } from "./_components/SetupInvalid";
import { ClinicForm } from "./_components/ClinicForm";
import { BusinessProfile, type BusinessProfileData } from "./_components/BusinessProfile";
import { PageShell } from "./_components/PageShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Set up your office — Missed Calls Dental",
  description:
    "Complete your Missed Calls Dental setup: create your office profile and business profile.",
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

  // Screen 1 — Create office profile (no clinic yet).
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

  // Screen 2 — Business Profile (clinic exists).
  const clinic = await findClinicById(setupRequest.clinic_id);
  if (!clinic) {
    return (
      <PageShell>
        <SetupInvalid reason="not_found" />
      </PageShell>
    );
  }

  const publicBaseUrl = getAppDomainsSafe()?.appBaseUrl ?? "";
  // This data is read fresh from the DB on every load (force-dynamic), so the
  // account page always reflects persisted state after any save + reload.
  const data: BusinessProfileData = {
    token,
    loginEmail: setupRequest.owner_email,
    publicBaseUrl,
    slug: clinic.slug,
    businessProfile: {
      name: clinic.name,
      mainPhone: clinic.main_phone ?? "",
      streetAddress: clinic.street_address ?? "",
      addressLine2: clinic.address_line2 ?? "",
      city: clinic.city ?? "",
      stateRegion: clinic.state_region ?? "",
      postalCode: clinic.postal_code ?? "",
      website: clinic.website ?? "",
      completed: clinic.business_info_completed,
    },
    smsApproval: {
      legalBusinessName: clinic.legal_business_name ?? "",
      einTaxId: clinic.ein_tax_id ?? "",
      businessType: clinic.business_type ?? "",
      repFirstName: clinic.a2p_rep_first_name ?? "",
      repLastName: clinic.a2p_rep_last_name ?? "",
      repEmail: clinic.a2p_rep_email ?? "",
      repPhone: clinic.a2p_rep_phone ?? "",
      authorized: clinic.a2p_authorized,
      completed: clinic.a2p_info_completed,
    },
    number: {
      localNumberStatus: clinic.local_number_status,
      smsStatus: clinic.sms_status,
    },
    billing: {
      billingStatus: clinic.billing_status,
      trialDays: 21,
    },
  };

  // BusinessProfile renders its own wide account shell, so it is not wrapped in
  // the narrow PageShell used by the earlier office-creation step.
  return <BusinessProfile data={data} />;
}
