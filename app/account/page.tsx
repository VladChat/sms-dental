import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readAccountSessionToken } from "../../lib/onboarding/account-session";
import { lookupSetupRequestByRawToken } from "../../lib/onboarding/verify";
import { findClinicById } from "../../lib/db/clinics";
import {
  listClinicPhoneNumbersForClinic,
  type ClinicPhoneNumberRow,
} from "../../lib/db/clinic-phone-numbers";
import { getNumberEntitlement } from "../../lib/billing/number-entitlements";
import { buildClinicBillingSummary } from "../../lib/billing/clinic-billing-summary";
import { getAppDomainsSafe, hasLocalNumberBillingConfigured } from "../../lib/env";
import { normalizeBusinessTypeForStorage } from "../../lib/a2p/validation";
import { resolveAuthClinicAccess } from "../../lib/auth/access";
import { listActiveMembershipsForClinic } from "../../lib/db/clinic-memberships";
import { listProfilesByIds } from "../../lib/db/profiles";
import { SetupInvalid } from "../setup/[token]/_components/SetupInvalid";
import { ClinicForm } from "../setup/[token]/_components/ClinicForm";
import { BusinessProfile, type BusinessProfileData } from "../setup/[token]/_components/BusinessProfile";
import type {
  AssignedBusinessNumberSummary,
  OwnerNumberEntitlement,
  PaymentMethodSetupResult,
  PaymentMethodSummary,
} from "../setup/[token]/_components/account-types";
import { PageShell } from "../setup/[token]/_components/PageShell";
import { phoneAreaCode } from "../../lib/twilio/numbers";
import type { ClinicOnboardingRow } from "../../lib/db/clinics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Your account — Missed Calls Dental",
  description: "Manage your Missed Calls Dental account and finish setup.",
  robots: { index: false, follow: false },
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Trial countdown comes from clinics.trial_ends_at (the product source of truth),
// NOT the setup-request date. 0 when no trial or already ended.
function trialDaysRemainingFrom(clinic: ClinicOnboardingRow): number {
  if (!clinic.trial_ends_at) return 0;
  const ms = clinic.trial_ends_at.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / DAY_MS));
}

// Real saved-payment-method signal: keyed strictly off stripe_payment_method_id.
function buildBilling(
  clinic: ClinicOnboardingRow,
  ent: OwnerNumberEntitlement,
  trialDaysRemaining: number,
  assignedRows: ClinicPhoneNumberRow[],
): BusinessProfileData["billing"] {
  const hasPaymentMethod = Boolean(clinic.stripe_payment_method_id);
  const paymentMethod: PaymentMethodSummary | null = hasPaymentMethod
    ? {
        brand: clinic.stripe_payment_method_brand,
        last4: clinic.stripe_payment_method_last4,
        expMonth: clinic.stripe_payment_method_exp_month,
        expYear: clinic.stripe_payment_method_exp_year,
        addedAt: clinic.stripe_payment_method_added_at
          ? clinic.stripe_payment_method_added_at.toISOString()
          : null,
      }
    : null;
  return {
    hasPaymentMethod,
    paymentMethod,
    trialDaysRemaining,
    trialEnded: ent.trialEnded,
    isTrialing: ent.isTrialing,
    paidPlanActive: ent.hasActivePaidSubscription,
    billingStatus: ent.billingStatus,
    summary: buildClinicBillingSummary(assignedRows),
  };
}

function toAssignedSummary(row: ClinicPhoneNumberRow): AssignedBusinessNumberSummary {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    // Default to 'local' if a legacy row predates the column (conservative).
    numberType: row.number_type === "toll_free" ? "toll_free" : "local",
    role: row.role,
    isActive: row.is_active,
    billingClass: row.billing_class,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    removalStatus: row.removal_status ?? "active",
    removalRequestedAt: row.removal_requested_at ? row.removal_requested_at.toISOString() : null,
    removalRequestedByEmail: row.removal_requested_by_email,
    permanentRemovalAt: row.permanent_removal_at ? row.permanent_removal_at.toISOString() : null,
    restoredAt: row.restored_at ? row.restored_at.toISOString() : null,
    twilioReleasedAt: row.twilio_released_at ? row.twilio_released_at.toISOString() : null,
    twilioReleaseStatus: row.twilio_release_status ?? "not_required",
  };
}

// Load the server-computed entitlement, mapped to the owner-safe shape. Resilient
// to the new columns not existing yet (pre-migration): falls back to a SAFE,
// purchase-blocked entitlement so /account never errors and never over-grants.
async function loadOwnerEntitlement(
  clinicId: string,
  assigned: AssignedBusinessNumberSummary[],
): Promise<OwnerNumberEntitlement> {
  try {
    const e = await getNumberEntitlement(clinicId);
    return {
      heldNumberCount: e.heldNumberCount,
      activeNumberCount: e.activeNumberCount,
      numberLimit: e.numberLimit,
      additionalBilledQuantity: e.additionalBilledQuantity,
      purchasesEnabled: e.purchasesEnabled,
      nextSlotClass: e.nextSlotClass,
      isTrialing: e.isTrialing,
      trialEnded: e.trialEnded,
      hasActivePaidSubscription: e.hasActivePaidSubscription,
      localBillingConfigured: hasLocalNumberBillingConfigured(),
      canPurchaseNext: e.canPurchaseNext,
      blockReason: e.blockReason,
      trialStartedAt: e.trialStartedAt,
      trialEndsAt: e.trialEndsAt,
      paidPlanStartedAt: e.paidPlanStartedAt,
      billingStatus: e.billingStatus,
    };
  } catch {
    return {
      heldNumberCount: assigned.length,
      activeNumberCount: assigned.filter((n) => n.isActive).length,
      numberLimit: 5,
      additionalBilledQuantity: 0,
      purchasesEnabled: false,
      nextSlotClass: "included",
      isTrialing: false,
      trialEnded: false,
      hasActivePaidSubscription: false,
      localBillingConfigured: false,
      canPurchaseNext: false,
      blockReason: "billing_configuration_missing",
      trialStartedAt: null,
      trialEndsAt: null,
      paidPlanStartedAt: null,
      billingStatus: "not_started",
    };
  }
}

function parseAccountSearch(sp: Record<string, string | string[] | undefined>): {
  initialSection: string | null;
  paymentMethodSetup: PaymentMethodSetupResult;
  paidPlanResult: "success" | "cancelled" | null;
} {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const section = one(sp.section);
  const setup = one(sp.payment_method_setup);
  const paid = one(sp.paid_plan);
  return {
    initialSection: section,
    paymentMethodSetup: setup === "success" ? "success" : setup === "cancelled" ? "cancelled" : null,
    paidPlanResult: paid === "success" ? "success" : paid === "cancelled" ? "cancelled" : null,
  };
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { initialSection, paymentMethodSetup, paidPlanResult } = parseAccountSearch(await searchParams);

  // Primary access path: real authenticated session + clinic membership.
  const access = await resolveAuthClinicAccess();
  if (access.ok) {
    if (access.membership.role === "front_desk") {
      redirect("/workspace");
    }

    const clinic = access.clinic;
    const publicBaseUrl = getAppDomainsSafe()?.appBaseUrl ?? "";
    const assignedRows = await listClinicPhoneNumbersForClinic(clinic.id).catch(() => []);
    const assignedNumbers = assignedRows.map(toAssignedSummary);
    const entitlement = await loadOwnerEntitlement(clinic.id, assignedNumbers);

    const memberships = await listActiveMembershipsForClinic(clinic.id).catch(() => []);
    const profiles = await listProfilesByIds(memberships.map((m) => m.profile_id)).catch(() => []);
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

    const data = buildData({
      clinic,
      token: null,
      loginEmail: access.userEmail ?? clinic.owner_contact_email ?? "",
      publicBaseUrl,
      assignedNumbers,
      assignedRows,
      entitlement,
      teamMembers,
      initialSection,
      paymentMethodSetup,
      paidPlanResult,
    });
    return <BusinessProfile data={data} />;
  }

  // Temporary fallback path: legacy setup-token cookie.
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
  if (!setupRequest.clinic_id) {
    return (
      <PageShell>
        <ClinicForm token={token} loginEmail={setupRequest.owner_email} initialValues={{ name: "", mainPhone: "", postalCode: "" }} />
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
  const assignedRows = await listClinicPhoneNumbersForClinic(clinic.id).catch(() => []);
  const assignedNumbers = assignedRows.map(toAssignedSummary);
  const entitlement = await loadOwnerEntitlement(clinic.id, assignedNumbers);

  const data = buildData({
    clinic,
    token,
    loginEmail: setupRequest.owner_email,
    publicBaseUrl,
    assignedNumbers,
    assignedRows,
    entitlement,
    teamMembers: [
      { email: setupRequest.owner_email.trim().toLowerCase(), role: "owner", status: "active" as const },
    ],
    initialSection,
    paymentMethodSetup,
    paidPlanResult,
  });
  return <BusinessProfile data={data} />;
}

function buildData(args: {
  clinic: ClinicOnboardingRow;
  token: string | null;
  loginEmail: string;
  publicBaseUrl: string;
  assignedNumbers: AssignedBusinessNumberSummary[];
  assignedRows: ClinicPhoneNumberRow[];
  entitlement: OwnerNumberEntitlement;
  teamMembers: BusinessProfileData["teamAccess"]["members"];
  initialSection: string | null;
  paymentMethodSetup: PaymentMethodSetupResult;
  paidPlanResult: "success" | "cancelled" | null;
}): BusinessProfileData {
  const { clinic, entitlement, assignedNumbers } = args;
  const trialDaysRemaining = trialDaysRemainingFrom(clinic);
  return {
    token: args.token,
    loginEmail: args.loginEmail,
    publicBaseUrl: args.publicBaseUrl,
    slug: clinic.slug,
    initialSection: args.initialSection,
    paymentMethodSetup: args.paymentMethodSetup,
    paidPlanResult: args.paidPlanResult,
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
      businessType: normalizeBusinessTypeForStorage(clinic.business_type) ?? clinic.business_type ?? "",
      repFirstName: clinic.a2p_rep_first_name ?? "",
      repLastName: clinic.a2p_rep_last_name ?? "",
      repBusinessTitle: clinic.a2p_rep_business_title ?? "",
      repEmail: clinic.a2p_rep_email ?? "",
      repPhone: clinic.a2p_rep_phone ?? "",
      authorized: clinic.a2p_authorized,
      completed: clinic.a2p_info_completed,
    },
    number: {
      localNumberStatus: clinic.local_number_status,
      smsStatus: clinic.sms_status,
      assignedNumbers,
      areaCode: clinic.main_phone ? phoneAreaCode(clinic.main_phone) : null,
      postalCode: clinic.postal_code,
      entitlement,
    },
    billing: buildBilling(clinic, entitlement, trialDaysRemaining, args.assignedRows),
    security: { passwordEnabled: true },
    teamAccess: { members: args.teamMembers },
  };
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
