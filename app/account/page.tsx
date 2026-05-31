import type { Metadata } from "next";
import { readAccountSessionToken } from "../../lib/onboarding/account-session";
import { lookupSetupRequestByRawToken } from "../../lib/onboarding/verify";
import { findClinicById } from "../../lib/db/clinics";
import { findActiveOfficeTextingNumber } from "../../lib/db/clinic-phone-numbers";
import { getAppDomainsSafe } from "../../lib/env";
import { SetupInvalid } from "../setup/[token]/_components/SetupInvalid";
import { ClinicForm } from "../setup/[token]/_components/ClinicForm";
import { BusinessProfile, type BusinessProfileData } from "../setup/[token]/_components/BusinessProfile";
import { PageShell } from "../setup/[token]/_components/PageShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Your account — Missed Calls Dental",
  description: "Manage your Missed Calls Dental account and finish setup.",
  robots: { index: false, follow: false },
};

const TRIAL_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

// Clean account dashboard URL. Account context comes from the httpOnly session
// cookie set after "Continue setup", so the long /setup/{token} URL is not kept
// in the address bar. This reads fresh from the DB on every load.
export default async function AccountPage() {
  const token = await readAccountSessionToken();
  if (!token) {
    return (
      <PageShell>
        <SetupInvalid reason="no_session" />
      </PageShell>
    );
  }

  const lookup = await lookupSetupRequestByRawToken(token);
  if (!lookup.ok) {
    return (
      <PageShell>
        <SetupInvalid reason={lookup.reason} />
      </PageShell>
    );
  }
  const setupRequest = lookup.setupRequest;

  // Cookie is only set after a clinic exists, but handle the edge gracefully by
  // letting the customer finish the office profile (posts then returns here).
  if (!setupRequest.clinic_id) {
    return (
      <PageShell>
        <ClinicForm token={token} />
      </PageShell>
    );
  }

  const clinic = await findClinicById(setupRequest.clinic_id);
  if (!clinic) {
    return (
      <PageShell>
        <SetupInvalid reason="not_found" />
      </PageShell>
    );
  }

  const publicBaseUrl = getAppDomainsSafe()?.appBaseUrl ?? "";
  const assignedPhone = await findActiveOfficeTextingNumber(clinic.id)
    .then((row) => row?.phone_number ?? null)
    .catch(() => null);

  // Trial countdown from the safest available creation timestamp: the setup
  // request's created_at (the registration moment).
  const created = new Date(setupRequest.created_at).getTime();
  const elapsedDays = Math.max(0, Math.floor((Date.now() - created) / DAY_MS));
  const trialDaysRemaining = Math.max(0, TRIAL_DAYS - elapsedDays);

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
      assignedPhone,
    },
    billing: {
      hasPaymentMethod:
        Boolean(clinic.stripe_customer_id) ||
        ["trialing", "active", "past_due"].includes(clinic.billing_status),
      trialDaysRemaining,
      trialEnded: trialDaysRemaining <= 0,
    },
  };

  return <BusinessProfile data={data} />;
}
