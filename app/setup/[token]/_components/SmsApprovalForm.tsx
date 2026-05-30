"use client";

import { useState } from "react";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
} from "../../../../lib/validation/url";
import { Field, SelectField, SaveBar, DocRow, ReviewRow, nowLabel } from "./AccountUI";
import type { BusinessProfileFields, SmsApprovalFields } from "./account-types";

type FieldErrors = Partial<Record<keyof SmsApprovalFields, string>>;

const BUSINESS_TYPE_OPTIONS = BUSINESS_TYPES.map((v) => ({
  value: v,
  label: BUSINESS_TYPE_LABELS[v],
}));

function businessTypeLabel(value: string): string {
  return BUSINESS_TYPE_LABELS[value as keyof typeof BUSINESS_TYPE_LABELS] ?? "";
}

function formatAddress(b: BusinessProfileFields): string {
  const line1 = [b.streetAddress, b.addressLine2].filter(Boolean).join(", ");
  const line2 = [b.city, b.stateRegion, b.postalCode].filter(Boolean).join(" ");
  return [line1, line2].filter(Boolean).join(", ");
}

export function SmsApprovalForm({
  token,
  publicBaseUrl,
  slug,
  businessProfile,
  value,
  onChange,
  onSaved,
}: {
  token: string;
  publicBaseUrl: string;
  slug: string | null;
  businessProfile: BusinessProfileFields;
  value: SmsApprovalFields;
  onChange: (patch: Partial<SmsApprovalFields>) => void;
  onSaved: (persisted: SmsApprovalFields) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const base = slug ? `${publicBaseUrl}/business/${slug}` : null;

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (value.legalBusinessName.trim().length < 2) e.legalBusinessName = "Enter your legal business name.";
    if (value.einTaxId.trim().length < 2) e.einTaxId = "Enter your EIN.";
    if (!(BUSINESS_TYPES as readonly string[]).includes(value.businessType)) {
      e.businessType = "Choose a business type.";
    }
    if (value.repFirstName.trim().length < 1) e.repFirstName = "Enter a first name.";
    if (value.repLastName.trim().length < 1) e.repLastName = "Enter a last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.repEmail.trim())) e.repEmail = "Enter a valid email.";
    if (value.repPhone.replace(/\D/g, "").length < 10) e.repPhone = "Enter a valid phone number.";
    return e;
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!value.authorized) {
      setError("Please confirm and authorize before saving.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/onboarding/${encodeURIComponent(token)}/a2p`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          legal_business_name: value.legalBusinessName,
          ein_tax_id: value.einTaxId,
          business_type: value.businessType,
          rep_first_name: value.repFirstName,
          rep_last_name: value.repLastName,
          rep_email: value.repEmail,
          rep_phone: value.repPhone,
          authorized: value.authorized,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        smsApproval?: SmsApprovalFields;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.smsApproval) {
        setError(json?.error?.message ?? "Could not save your approval information.");
        return;
      }
      setSavedAt(nowLabel());
      onSaved(json.smsApproval);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "grid", gap: "var(--space-5)" }}>
      <Field
        label="Legal business name"
        name="legal_business_name"
        value={value.legalBusinessName}
        onChange={(v) => onChange({ legalBusinessName: v })}
        required
        helper="The exact registered name on your business paperwork. It can differ from the name patients see."
        error={fieldErrors.legalBusinessName}
      />

      <SelectField
        label="Business type"
        name="business_type"
        value={value.businessType}
        onChange={(v) => onChange({ businessType: v })}
        options={BUSINESS_TYPE_OPTIONS}
        placeholder="Select business type…"
        required
        helper="Most dental offices are a private company. Pick what matches your registration."
        error={fieldErrors.businessType}
      />

      <Field
        label="EIN"
        name="ein_tax_id"
        value={value.einTaxId}
        onChange={(v) => onChange({ einTaxId: v })}
        required
        inputMode="numeric"
        helper="Your federal Employer Identification Number. Carriers require it to approve business texting."
        error={fieldErrors.einTaxId}
      />

      <fieldset className="acct-fieldset">
        <legend className="t-label">Authorized representative</legend>
        <div className="acct-grid-2">
          <Field
            label="First name"
            name="rep_first_name"
            value={value.repFirstName}
            onChange={(v) => onChange({ repFirstName: v })}
            required
            autoComplete="given-name"
            error={fieldErrors.repFirstName}
          />
          <Field
            label="Last name"
            name="rep_last_name"
            value={value.repLastName}
            onChange={(v) => onChange({ repLastName: v })}
            required
            autoComplete="family-name"
            error={fieldErrors.repLastName}
          />
          <Field
            label="Email"
            name="rep_email"
            type="email"
            value={value.repEmail}
            onChange={(v) => onChange({ repEmail: v })}
            required
            inputMode="email"
            autoComplete="email"
            error={fieldErrors.repEmail}
          />
          <Field
            label="Phone"
            name="rep_phone"
            value={value.repPhone}
            onChange={(v) => onChange({ repPhone: v })}
            required
            inputMode="tel"
            autoComplete="tel"
            error={fieldErrors.repPhone}
          />
        </div>
      </fieldset>

      {/* Generated approval documents */}
      <div className="acct-subsection">
        <h3 className="t-h4">Approval documents</h3>
        <p className="t-small" style={{ margin: "var(--space-1) 0 var(--space-3)" }}>
          We created these public pages from your details. They&apos;re submitted with your approval.
        </p>
        {base ? (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <DocRow label="Business profile" url={base} />
            <DocRow label="Privacy policy" url={`${base}/privacy`} />
            <DocRow label="SMS terms" url={`${base}/sms-terms`} />
          </div>
        ) : (
          <p className="t-small" style={{ color: "var(--text-muted)" }}>
            These appear automatically once you save your business profile.
          </p>
        )}
      </div>

      {/* What we'll submit — read-only review summary */}
      <div className="acct-subsection">
        <h3 className="t-h4">What we&apos;ll submit</h3>
        <dl className="acct-review" style={{ marginTop: "var(--space-3)" }}>
          <ReviewRow label="Clinic name" value={businessProfile.name} />
          <ReviewRow label="Legal business name" value={value.legalBusinessName} />
          <ReviewRow label="Business type" value={businessTypeLabel(value.businessType)} />
          <ReviewRow label="EIN" value={value.einTaxId} />
          <ReviewRow label="Main office phone" value={businessProfile.mainPhone} />
          <ReviewRow label="Business address" value={formatAddress(businessProfile)} />
          <ReviewRow
            label="Representative"
            value={[value.repFirstName, value.repLastName].filter(Boolean).join(" ")}
          />
          <ReviewRow label="Representative email" value={value.repEmail} />
          <ReviewRow label="Representative phone" value={value.repPhone} />
        </dl>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={value.authorized}
          onChange={(e) => onChange({ authorized: e.target.checked })}
        />
        <span>
          I&apos;ve reviewed the business and approval details above, confirm they&apos;re accurate,
          and authorize Missed Calls Dental to use them to submit this business for SMS texting
          approval.
        </span>
      </label>
      <p className="t-helper" style={{ marginTop: "calc(var(--space-3) * -1 + var(--space-1))" }}>
        Texting stays off until approval is complete. You can update these details before then.
      </p>

      <SaveBar label="Save approval information" saving={saving} savedAt={savedAt} error={error} />
    </form>
  );
}
