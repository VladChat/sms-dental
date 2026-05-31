import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readAccountSessionToken } from "../../lib/onboarding/account-session";
import { lookupSetupRequestByRawToken } from "../../lib/onboarding/verify";
import { findClinicById } from "../../lib/db/clinics";
import { findActiveOfficeTextingNumber } from "../../lib/db/clinic-phone-numbers";
import { findMostRecentSetupRequestByClinicId } from "../../lib/db/setup-requests";
import { getAppDomainsSafe } from "../../lib/env";
import { resolveAuthClinicAccess } from "../../lib/auth/access";
import { listActiveMembershipsForClinic } from "../../lib/db/clinic-memberships";
import { listProfilesByIds } from "../../lib/db/profiles";
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

// `/account` now prefers real authenticated session + clinic membership.
// The setup-token cookie path is kept as temporary fallback during rollout.
export default async function AccountPage() {
  // Primary access path: real authenticated session + clinic membership.
  const access = await resolveAuthClinicAccess();
  if (access.ok) {
    if (access.membership.role === "front_desk") {
      redirect("/workspace");
    }

    const clinic = access.clinic;
    const publicBaseUrl = getAppDomainsSafe()?.appBaseUrl ?? "";
    const assignedPhone = await findActiveOfficeTextingNumber(clinic.id)
      .then((row) => row?.phone_number ?? null)
      .catch(() => null);
    const memberships = await listActiveMembershipsForClinic(clinic.id).catch(() => []);
    const profileIds = memberships.map((m) => m.profile_id);
    const profiles = await listProfilesByIds(profileIds).catch(() => []);
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const teamMembers = memberships
      .map((m) => {
        const profile = profileById.get(m.profile_id);
        const fallbackEmail =
          m.profile_id === access.userId ? (access.userEmail ?? clinic.owner_contact_email ?? "") : "";
        return {
          email: (profile?.email ?? fallbackEmail).trim().toLowerCase(),
          role: m.role,
          status: "active" as const,
        };
      })
      .filter((m) => m.email.length > 0);
    if (!teamMembers.some((m) => m.role === "owner")) {
      teamMembers.unshift({
        email: (access.userEmail ?? clinic.owner_contact_email ?? "").trim().toLowerCase(),
        role: "owner",
        status: "active",
      });
    }

    // Keep trial countdown aligned to the original setup creation when
    // available, otherwise fall back to now.
    const setupRequest = await findMostRecentSetupRequestByClinicId(clinic.id).catch(() => null);
    const created = new Date(setupRequest?.created_at ?? new Date()).getTime();
    const elapsedDays = Math.max(0, Math.floor((Date.now() - created) / DAY_MS));
    const trialDaysRemaining = Math.max(0, TRIAL_DAYS - elapsedDays);

    const data: BusinessProfileData = {
      token: null,
      loginEmail: access.userEmail ?? clinic.owner_contact_email ?? "",
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
      security: {
        passwordEnabled: true,
      },
      teamAccess: {
        members: teamMembers,
      },
    };

    return <BusinessProfile data={data} />;
  }

  // Temporary fallback path: legacy setup-token cookie. Keep while auth rollout
  // is verified so existing setup-link users are not locked out.
  const token = await readAccountSessionToken();
  if (!token) {
    return <AccountGate />;
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
        <ClinicForm
          token={token}
          loginEmail={setupRequest.owner_email}
          initialValues={{ name: "", mainPhone: "", postalCode: "" }}
        />
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
    security: {
      passwordEnabled: true,
    },
    teamAccess: {
      members: [
        {
          email: setupRequest.owner_email.trim().toLowerCase(),
          role: "owner",
          status: "active",
        },
      ],
    },
  };

  return <BusinessProfile data={data} />;
}

function AccountGate() {
  return (
    <main className="acct-page">
      <section className="card card-pad" style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 className="t-h3">Sign in to your account</h1>
        <p className="t-body" style={{ marginTop: "var(--space-3)" }}>
          Use your account email and password to access your account dashboard.
        </p>
        <p style={{ marginTop: "var(--space-5)" }}>
          <a className="link" href="/login">Go to sign in →</a>
        </p>
      </section>
    </main>
  );
}
