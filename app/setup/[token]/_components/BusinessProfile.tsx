"use client";

import { useState } from "react";
import { Badge, Section, type BadgeTone } from "./AccountUI";
import { BusinessProfileForm } from "./BusinessProfileForm";
import { SmsApprovalForm } from "./SmsApprovalForm";
import { AssignedNumberCard } from "./AssignedNumberCard";
import { BillingCard } from "./BillingCard";
import type {
  BusinessProfileData,
  BusinessProfileFields,
  SmsApprovalFields,
  SmsStatus,
} from "./account-types";

export type { BusinessProfileData } from "./account-types";

export function BusinessProfile({ data }: { data: BusinessProfileData }) {
  const [biz, setBiz] = useState<BusinessProfileFields>(stripCompleted(data.businessProfile));
  const [bizDone, setBizDone] = useState(data.businessProfile.completed);

  const [sms, setSms] = useState<SmsApprovalFields>(() => withRepDefaults(data));
  const [smsDone, setSmsDone] = useState(data.smsApproval.completed);
  const [smsStatus, setSmsStatus] = useState<SmsStatus>(data.number.smsStatus);

  const clinicName = biz.name || "Your clinic";

  const numberBadge = numberSectionBadge(data.number.localNumberStatus, smsStatus);

  return (
    <main className="acct-page">
      <header className="acct-header">
        <p className="t-eyebrow">{clinicName}</p>
        <h1 className="t-h2" style={{ marginTop: "var(--space-2)" }}>Account setup</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Add your details below. Patient texting stays off until your account is approved.
        </p>
        <div className="acct-summary" role="status">
          <Badge tone={smsStatusTone(smsStatus)}>Texting: {smsStatusLabel(smsStatus)}</Badge>
        </div>
      </header>

      <div className="acct-sections">
        <Section
          id="business-profile"
          title="Business profile"
          description="The basics patients and approvals rely on."
          badge={
            bizDone
              ? { tone: "success", label: "Saved" }
              : { tone: "warning", label: "Needs your details" }
          }
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

        <Section
          id="sms-approval"
          title="SMS approval information"
          description="Details carriers require before your office can text patients."
          badge={
            smsDone
              ? { tone: "info", label: "Ready for review" }
              : { tone: "warning", label: "Needs your details" }
          }
        >
          <SmsApprovalForm
            token={data.token}
            publicBaseUrl={data.publicBaseUrl}
            slug={data.slug}
            businessProfile={biz}
            value={sms}
            onChange={(patch) => setSms((prev) => ({ ...prev, ...patch }))}
            onSaved={(persisted) => {
              setSms(persisted);
              setSmsDone(true);
              setSmsStatus((s) => (s === "preparing" ? "waiting_for_approval" : s));
            }}
          />
        </Section>

        <Section
          id="assigned-number"
          title="Assigned phone number"
          badge={numberBadge}
        >
          <AssignedNumberCard
            localNumberStatus={data.number.localNumberStatus}
            smsStatus={smsStatus}
          />
        </Section>

        <Section
          id="billing"
          title="Billing & payment method"
          badge={{ tone: "neutral", label: "Set up later" }}
        >
          <BillingCard trialDays={data.billing.trialDays} />
        </Section>
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

function numberSectionBadge(
  localNumberStatus: BusinessProfileData["number"]["localNumberStatus"],
  smsStatus: SmsStatus,
): { tone: BadgeTone; label: string } {
  if (smsStatus === "active") return { tone: "success", label: "Active" };
  if (smsStatus === "waiting_for_approval") return { tone: "info", label: "Waiting for approval" };
  if (localNumberStatus === "assigned" || localNumberStatus === "reserved") {
    return { tone: "neutral", label: "Number ready" };
  }
  return { tone: "neutral", label: "Preparing" };
}

function smsStatusLabel(s: SmsStatus): string {
  if (s === "active") return "Active";
  if (s === "waiting_for_approval") return "Pending approval";
  return "Not started";
}

function smsStatusTone(s: SmsStatus): BadgeTone {
  if (s === "active") return "success";
  if (s === "waiting_for_approval") return "info";
  return "neutral";
}
