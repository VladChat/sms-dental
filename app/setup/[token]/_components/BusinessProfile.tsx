"use client";

import { useState } from "react";
import { Section, NavStatusIcon, type StatusKind } from "./AccountUI";
import { BusinessProfileForm } from "./BusinessProfileForm";
import { SmsApprovalForm } from "./SmsApprovalForm";
import { AssignedNumberCard } from "./AssignedNumberCard";
import { BillingCard } from "./BillingCard";
import { AccountAccessCard } from "./SecurityCard";
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

export function BusinessProfile({ data }: { data: BusinessProfileData }) {
  const [biz, setBiz] = useState<BusinessProfileFields>(stripCompleted(data.businessProfile));
  const [bizDone, setBizDone] = useState(data.businessProfile.completed);

  const [sms, setSms] = useState<SmsApprovalFields>(() => withRepDefaults(data));
  const [smsDone, setSmsDone] = useState(data.smsApproval.completed);
  const [smsStatus, setSmsStatus] = useState<SmsStatus>(data.number.smsStatus);

  const hasPaymentMethod = data.billing.hasPaymentMethod;
  const clinicName = biz.name || "Your clinic";

  // Phone number is the customer's primary resource, so it is first and opens by
  // default. We do NOT auto-jump to the first incomplete section.
  const [active, setActive] = useState<SectionId>("phone");

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
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Manage your account details and finish setup. Texting starts after approval.
        </p>
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
                  onClick={() => setActive(item.id)}
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
                  onClick={() => setActive(item.id)}
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
              title="Phone number"
              description="Your office number for calls and texting."
            >
              <AssignedNumberCard
                localNumberStatus={data.number.localNumberStatus}
                smsStatus={smsStatus}
                assignedPhone={data.number.assignedPhone}
                hasPaymentMethod={hasPaymentMethod}
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
              description="Add a payment method to finish setup."
            >
              <BillingCard
                hasPaymentMethod={hasPaymentMethod}
                trialDaysRemaining={data.billing.trialDaysRemaining}
                trialEnded={data.billing.trialEnded}
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
