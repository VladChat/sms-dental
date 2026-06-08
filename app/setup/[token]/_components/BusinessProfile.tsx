"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Section, NavStatusIcon, type StatusKind } from "./AccountUI";
import { BusinessProfileForm } from "./BusinessProfileForm";
import { SmsApprovalForm } from "./SmsApprovalForm";
import { AssignedNumberCard } from "./AssignedNumberCard";
import { BillingCard } from "./BillingCard";
import { AccountAccessCard } from "./AccountAccessCard";
import { TeamAccessCard } from "./TeamAccessCard";
import type {
  BusinessProfileData,
  BusinessProfileFields,
  SmsApprovalFields,
  SmsStatus,
} from "./account-types";

export type { BusinessProfileData } from "./account-types";

type SetupSectionId = "phone" | "business" | "sms" | "billing";
type AccountSectionId = "account_access" | "team_access";
type SectionId = SetupSectionId | AccountSectionId;
const ONE_TIME_RETURN_PARAMS = ["payment_method_setup", "paid_plan"] as const;

export function BusinessProfile({ data }: { data: BusinessProfileData }) {
  const [biz, setBiz] = useState<BusinessProfileFields>(stripCompleted(data.businessProfile));
  const [bizDone, setBizDone] = useState(data.businessProfile.completed);

  const [sms, setSms] = useState<SmsApprovalFields>(() => withRepDefaults(data));
  const [smsDone, setSmsDone] = useState(data.smsApproval.completed);
  const [smsStatus, setSmsStatus] = useState<SmsStatus>(data.number.smsStatus);
  const router = useRouter();
  const pathname = usePathname();
  const [startingPaidPlan, setStartingPaidPlan] = useState(false);
  const [paidPlanPending, setPaidPlanPending] = useState(false);
  const [paidPlanError, setPaidPlanError] = useState<string | null>(null);
  const [paymentMethodSetup, setPaymentMethodSetup] = useState(data.paymentMethodSetup ?? null);
  const [paidPlanResult, setPaidPlanResult] = useState(data.paidPlanResult ?? null);

  // Explicit trial -> paid conversion. The API creates the subscription using
  // the saved Stripe payment method; paid status is granted only by webhook-
  // confirmed subscription state, so the UI refreshes until that state lands.
  async function startPaidPlan() {
    setStartingPaidPlan(true);
    setPaidPlanPending(false);
    setPaidPlanError(null);
    try {
      const res = await fetch("/api/account/billing/start-paid-plan", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; status?: "active" | "pending"; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setPaidPlanError(json?.error?.message ?? "Could not start the paid plan. Please try again.");
        setStartingPaidPlan(false);
        setPaidPlanPending(false);
        return;
      }
      setPaidPlanPending(true);
      setStartingPaidPlan(false);
      router.refresh();
    } catch {
      setPaidPlanError("Could not start the paid plan. Please try again.");
      setStartingPaidPlan(false);
    }
  }

  useEffect(() => {
    if (data.billing.paidPlanActive) {
      setPaidPlanPending(false);
      setStartingPaidPlan(false);
      setPaidPlanError(null);
      return;
    }
    if (!paidPlanPending) return;
    let ticks = 0;
    const id = window.setInterval(() => {
      ticks += 1;
      router.refresh();
      if (ticks >= 10) {
        window.clearInterval(id);
        setPaidPlanPending(false);
        setPaidPlanError("We couldn\u2019t confirm your paid plan yet. Please check Billing or try again.");
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [data.billing.paidPlanActive, paidPlanPending, router]);

  // After a successful purchase, reload server data so entitlement (counts,
  // trial start, next slot) and the assigned-number list refresh in place.
  function handlePurchased() {
    router.refresh();
  }

  const hasPaymentMethod = data.billing.hasPaymentMethod;
  const entitlement = data.number.entitlement;
  const hasActiveNumber = data.number.assignedNumbers.some((n) => n.isActive);
  const canStartPaidPlan = hasActiveNumber && !data.billing.paidPlanActive;
  const clinicName = biz.name || "Your clinic";

  // Phone number is the customer's primary resource, so it is first and opens by
  // default. We do NOT auto-jump to the first incomplete section. The one
  // exception: an explicit ?section=… (e.g. returning from Stripe billing setup).
  const [active, setActive] = useState<SectionId>(() => resolveInitialSection(data.initialSection));

  useEffect(() => {
    function syncSectionFromUrl() {
      const next = resolveInitialSection(new URLSearchParams(window.location.search).get("section"));
      setActive((prev) => (prev === next ? prev : next));
    }

    window.addEventListener("popstate", syncSectionFromUrl);
    return () => window.removeEventListener("popstate", syncSectionFromUrl);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasOneTimeParams = ONE_TIME_RETURN_PARAMS.some((key) => params.has(key));
    if (!hasOneTimeParams) return;
    window.history.replaceState(null, "", buildAccountHref(pathname, active, params));
  }, [active, pathname]);

  function setActiveSection(section: SectionId) {
    setActive(section);
    setPaymentMethodSetup(null);
    setPaidPlanResult(null);

    const params = new URLSearchParams(window.location.search);
    const href = buildAccountHref(pathname, section, params);
    const currentHref = `${pathname}${window.location.search}`;
    if (href !== currentHref) {
      window.history.pushState(null, "", href);
    }
  }

  const phoneStatus = phoneSectionStatus(data.number.localNumberStatus, smsStatus, hasPaymentMethod);
  const bizStatus: StatusKind = bizDone ? "complete" : "needs_setup";
  const smsSectionStatus: StatusKind = smsDone ? "complete" : "needs_setup";
  const billingStatus: StatusKind = hasPaymentMethod ? "complete" : "needs_setup";

  const setupNavItems: { id: SetupSectionId; label: string; status: StatusKind }[] = [
    { id: "phone", label: "Phone number", status: phoneStatus },
    { id: "business", label: "Business profile", status: bizStatus },
    { id: "sms", label: "SMS approval", status: smsSectionStatus },
    { id: "billing", label: "Billing", status: billingStatus },
  ];

  const accountNavItems: { id: AccountSectionId; label: string }[] = [
    { id: "account_access", label: "Account access" },
    { id: "team_access", label: "Team access" },
  ];

  return (
    <main className="acct-page">
      <header className="acct-header">
        <p className="t-eyebrow">{clinicName}</p>
        <h1 className="t-h2" style={{ marginTop: "var(--space-2)" }}>Account</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>Texting starts after approval.</p>
      </header>

      <div className="acct-layout">
        <nav className="acct-nav" aria-label="Account sections">
          <section className="acct-nav-group" aria-labelledby="acct-nav-group-setup">
            <h2 id="acct-nav-group-setup" className="acct-nav-group-label">Setup</h2>
            {setupNavItems.map((item, i) => {
              const isActive = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="acct-nav-item"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setActiveSection(item.id)}
                >
                  <span className="acct-nav-main">
                    <span className="acct-nav-num" aria-hidden="true">{i + 1}</span>
                    <span className="acct-nav-text">{item.label}</span>
                  </span>
                  <NavStatusIcon kind={item.status} />
                </button>
              );
            })}
          </section>

          <section className="acct-nav-group" aria-labelledby="acct-nav-group-account">
            <h2 id="acct-nav-group-account" className="acct-nav-group-label">Account</h2>
            {accountNavItems.map((item) => {
              const isActive = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="acct-nav-item"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setActiveSection(item.id)}
                >
                  <span className="acct-nav-main">
                    <span className="acct-nav-text">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </section>
        </nav>

        <div className="acct-panel">
          {active === "phone" && (
            <Section
              id="phone-number"
              title="Phone numbers"
              description="Your numbers for calls and texting."
            >
              <AssignedNumberCard
                assignedNumbers={data.number.assignedNumbers}
                smsStatus={data.number.smsStatus}
                areaCode={data.number.areaCode}
                postalCode={data.number.postalCode}
                hasPaymentMethod={hasPaymentMethod}
                entitlement={entitlement}
                onGoToBilling={() => setActiveSection("billing")}
                onStartPaidPlan={startPaidPlan}
                startingPaidPlan={startingPaidPlan}
                paidPlanPending={paidPlanPending}
                paidPlanError={paidPlanError}
                onPurchased={handlePurchased}
              />
            </Section>
          )}

          {active === "business" && (
            <Section
              id="business-profile"
              title="Business profile"
              description="The basics patients and approvals rely on."
              status={{ kind: bizStatus }}
            >
              <BusinessProfileForm
                token={data.token}
                loginEmail={data.loginEmail}
                value={biz}
                completed={bizDone}
                onChange={(patch) => setBiz((prev) => ({ ...prev, ...patch }))}
                onSaved={(persisted) => {
                  setBiz(persisted);
                  setBizDone(true);
                }}
              />
            </Section>
          )}

          {active === "sms" && (
            <Section
              id="sms-approval"
              title="SMS approval"
              description="Details required before your office can text patients."
              status={{ kind: smsSectionStatus }}
            >
              <SmsApprovalForm
                token={data.token}
                publicBaseUrl={data.publicBaseUrl}
                slug={data.slug}
                smsStatus={smsStatus}
                value={sms}
                completed={smsDone}
                onChange={(patch) => setSms((prev) => ({ ...prev, ...patch }))}
                onSaved={(persisted) => {
                  setSms(persisted);
                  setSmsDone(true);
                  setSmsStatus((s) => (s === "preparing" ? "waiting_for_approval" : s));
                }}
              />
            </Section>
          )}

          {active === "billing" && (
            <Section
              id="billing"
              title="Billing & payment method"
              description="Manage your plan and payment method."
            >
              <BillingCard
                hasPaymentMethod={hasPaymentMethod}
                paymentMethod={data.billing.paymentMethod}
                summary={data.billing.summary}
                trialDaysRemaining={data.billing.trialDaysRemaining}
                trialEnded={data.billing.trialEnded}
                paymentMethodSetup={paymentMethodSetup}
                paidPlanActive={data.billing.paidPlanActive}
                canStartPaidPlan={canStartPaidPlan}
                isTrialing={data.billing.isTrialing}
                paidPlanResult={paidPlanResult}
                startingPaidPlan={startingPaidPlan}
                paidPlanPending={paidPlanPending}
                paidPlanError={paidPlanError}
                onStartPaidPlan={startPaidPlan}
              />
            </Section>
          )}

          {active === "account_access" && (
            <Section
              id="account-access"
              title="Account access"
            >
              <AccountAccessCard
                loginEmail={data.loginEmail}
                passwordEnabled={data.security.passwordEnabled}
              />
            </Section>
          )}

          {active === "team_access" && (
            <Section
              id="team-access"
              title="Team access"
            >
              <TeamAccessCard
                appBaseUrl={data.publicBaseUrl}
                ownerEmail={data.loginEmail}
                members={data.teamAccess.members}
              />
            </Section>
          )}
        </div>
      </div>
    </main>
  );
}

const VALID_SECTIONS: SectionId[] = [
  "phone", "business", "sms", "billing", "account_access", "team_access",
];

// Map an optional ?section=… value to a known section. Defaults to "phone"
// (the customer's primary resource) for anything missing or unrecognized.
function resolveInitialSection(section: string | null | undefined): SectionId {
  if (section && (VALID_SECTIONS as string[]).includes(section)) {
    return section as SectionId;
  }
  return "phone";
}

function buildAccountHref(pathname: string, section: SectionId, sourceParams: URLSearchParams): string {
  const params = new URLSearchParams(sourceParams);
  for (const key of ONE_TIME_RETURN_PARAMS) params.delete(key);
  params.set("section", section);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function stripCompleted(b: BusinessProfileData["businessProfile"]): BusinessProfileFields {
  const { completed: _completed, ...fields } = b;
  void _completed;
  return fields;
}

// Pre-fill representative email/phone from the login email and main office
// phone when not yet set, so the customer doesn't retype what we already know.
function withRepDefaults(data: BusinessProfileData): SmsApprovalFields {
  const a = data.smsApproval;
  return {
    legalBusinessName: a.legalBusinessName,
    einTaxId: a.einTaxId,
    businessType: a.businessType,
    repFirstName: a.repFirstName,
    repLastName: a.repLastName,
    repBusinessTitle: a.repBusinessTitle,
    repEmail: a.repEmail || data.loginEmail,
    repPhone: a.repPhone || data.businessProfile.mainPhone,
    authorized: a.authorized,
  };
}

function phoneSectionStatus(
  localNumberStatus: BusinessProfileData["number"]["localNumberStatus"],
  smsStatus: SmsStatus,
  hasPaymentMethod: boolean,
): StatusKind {
  if (smsStatus === "active") return "active";
  if (smsStatus === "waiting_for_approval") return "waiting";
  if (localNumberStatus === "assigned" || localNumberStatus === "reserved") return "pending";
  if (!hasPaymentMethod) return "needs_setup";
  return "pending";
}
