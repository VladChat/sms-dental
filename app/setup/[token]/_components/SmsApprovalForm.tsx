"use client";

import { useState } from "react";
import {
  BUSINESS_TYPE_OPTIONS,
  formatEinForDisplay,
  normalizeBusinessTypeForStorage,
  normalizeRepresentativePhone,
  validateBusinessType,
  validateEin,
  validateRepresentativeEmail,
  validateRepresentativeName,
  validateRepresentativePhone,
  validateRepresentativeTitle,
  validateLegalBusinessName,
} from "../../../../lib/a2p/validation";
import { Field, InfoTooltip, SelectField, SaveBar, StatusBadge, nowLabel, type StatusKind } from "./AccountUI";
import type { SmsApprovalFields, SmsStatus } from "./account-types";

type FieldErrors = Partial<Record<keyof SmsApprovalFields, string>>;
type Touched = Partial<Record<keyof SmsApprovalFields, boolean>>;

export function SmsApprovalForm({
  token,
  publicBaseUrl,
  slug,
  smsStatus,
  value,
  onChange,
  onSaved,
}: {
  token: string | null;
  publicBaseUrl: string;
  slug: string | null;
  smsStatus: SmsStatus;
  value: SmsApprovalFields;
  onChange: (patch: Partial<SmsApprovalFields>) => void;
  onSaved: (persisted: SmsApprovalFields) => void;
}) {
  const docsBase = slug ? `${publicBaseUrl}/business/${slug}` : null;
  const businessTypeValue = normalizeBusinessTypeForStorage(value.businessType) ?? "";

  // Texting approval is a separate concept from form completion: saving the form
  // marks the section "Complete", but patient texting only turns on after a
  // separate approval. Surface that explicitly so "Complete" is never mistaken
  // for "texting is live".
  const textingKind: StatusKind =
    smsStatus === "active" ? "active" : smsStatus === "waiting_for_approval" ? "waiting" : "not_active";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Touched>({});

  function fieldError(name: keyof SmsApprovalFields, next = value): string | undefined {
    switch (name) {
      case "legalBusinessName":
        return validateLegalBusinessName(next.legalBusinessName)?.message;
      case "einTaxId":
        return validateEin(next.einTaxId)?.message;
      case "businessType":
        return validateBusinessType(next.businessType)?.message;
      case "repFirstName":
        return validateRepresentativeName(next.repFirstName, "rep_first_name")?.message;
      case "repLastName":
        return validateRepresentativeName(next.repLastName, "rep_last_name")?.message;
      case "repBusinessTitle":
        return validateRepresentativeTitle(next.repBusinessTitle)?.message;
      case "repEmail":
        return validateRepresentativeEmail(next.repEmail)?.message;
      case "repPhone":
        return validateRepresentativePhone(next.repPhone)?.message;
      default:
        return undefined;
    }
  }

  function validate(next = value): FieldErrors {
    const e: FieldErrors = {};
    for (const key of [
      "legalBusinessName",
      "einTaxId",
      "businessType",
      "repFirstName",
      "repLastName",
      "repBusinessTitle",
      "repEmail",
      "repPhone",
    ] as const) {
      const message = fieldError(key, next);
      if (message) e[key] = message;
    }
    return e;
  }

  function touch(name: keyof SmsApprovalFields) {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors((prev) => ({ ...prev, [name]: fieldError(name) }));
  }

  function patch(nextPatch: Partial<SmsApprovalFields>) {
    const next = { ...value, ...nextPatch };
    onChange(nextPatch);
    setFieldErrors((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(nextPatch) as Array<keyof SmsApprovalFields>) {
        if (touched[key]) updated[key] = fieldError(key, next);
      }
      return updated;
    });
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
      const endpoint = token
        ? `/api/onboarding/${encodeURIComponent(token)}/a2p`
        : "/api/account/a2p";
      const normalizedEin = formatEinForDisplay(value.einTaxId);
      const normalizedRepPhone = normalizeRepresentativePhone(value.repPhone);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          legal_business_name: value.legalBusinessName,
          ein_tax_id: normalizedEin,
          business_type: value.businessType,
          rep_first_name: value.repFirstName,
          rep_last_name: value.repLastName,
          rep_business_title: value.repBusinessTitle,
          rep_email: value.repEmail,
          rep_phone: normalizedRepPhone,
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
    <form onSubmit={onSubmit} noValidate className="acct-form">
      <Field
        label="Legal business name"
        name="legal_business_name"
        value={value.legalBusinessName}
        onChange={(v) => patch({ legalBusinessName: v })}
        onBlur={() => touch("legalBusinessName")}
        infoTooltip={{
          label: "Legal business name help",
          text: "Use the exact legal business name registered with the EIN. For a U.S. business, this should match the IRS CP 575 EIN Confirmation Letter or IRS 147C letter.",
        }}
        required
        helper="The exact registered name on your business paperwork."
        error={fieldErrors.legalBusinessName}
      />

      <SelectField
        label="Business Type"
        name="business_type"
        value={businessTypeValue}
        onChange={(v) => patch({ businessType: v })}
        onBlur={() => touch("businessType")}
        infoTooltip={{
          label: "Business Type help",
          text: "Choose the legal structure that matches the business registration. For an LLC, choose Limited Liability Corporation.",
        }}
        options={BUSINESS_TYPE_OPTIONS}
        placeholder="--- Select Business Type ---"
        required
        helper={fieldErrors.businessType ? undefined : "Select the exact legal structure submitted for A2P review."}
        error={fieldErrors.businessType}
      />

      <Field
        label="EIN"
        name="ein_tax_id"
        value={value.einTaxId}
        onChange={(v) => patch({ einTaxId: v })}
        onBlur={() => touch("einTaxId")}
        infoTooltip={{
          label: "EIN help",
          text: "Enter the EIN exactly as issued by the IRS. It must match the legal business name.",
        }}
        required
        inputMode="numeric"
        helper="Enter a valid 9-digit EIN, for example 12-3456789."
        error={fieldErrors.einTaxId}
      />

      <fieldset className="acct-fieldset">
        <legend className="t-label">
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <span>Authorized representative</span>
            <InfoTooltip
              label="Authorized representative help"
              text="This should be a person authorized to register the business for SMS messaging."
            />
          </span>
        </legend>
        <div className="acct-grid-2">
          <Field
            label="First name"
            name="rep_first_name"
            value={value.repFirstName}
            onChange={(v) => patch({ repFirstName: v })}
            onBlur={() => touch("repFirstName")}
            required
            autoComplete="given-name"
            error={fieldErrors.repFirstName}
          />
          <Field
            label="Last name"
            name="rep_last_name"
            value={value.repLastName}
            onChange={(v) => patch({ repLastName: v })}
            onBlur={() => touch("repLastName")}
            required
            autoComplete="family-name"
            error={fieldErrors.repLastName}
          />
          <Field
            label="Business title"
            name="rep_business_title"
            value={value.repBusinessTitle}
            onChange={(v) => patch({ repBusinessTitle: v })}
            onBlur={() => touch("repBusinessTitle")}
            infoTooltip={{
              label: "Business title help",
              text: "Use the representative’s real business title, such as Owner, Director, or Office Manager.",
            }}
            required
            helper="For example: Owner, Director, or Office Manager."
            error={fieldErrors.repBusinessTitle}
          />
          <Field
            label="Email"
            name="rep_email"
            type="email"
            value={value.repEmail}
            onChange={(v) => patch({ repEmail: v })}
            onBlur={() => touch("repEmail")}
            infoTooltip={{
              label: "Representative email help",
              text: "Use a real email for the authorized representative. Disposable or temporary emails can fail review.",
            }}
            required
            inputMode="email"
            autoComplete="email"
            error={fieldErrors.repEmail}
          />
          <Field
            label="Phone"
            name="rep_phone"
            value={value.repPhone}
            onChange={(v) => patch({ repPhone: v })}
            onBlur={() => touch("repPhone")}
            infoTooltip={{
              label: "Representative phone help",
              text: "Use a direct phone number for the authorized representative in U.S./Canada format.",
            }}
            required
            inputMode="tel"
            autoComplete="tel"
            error={fieldErrors.repPhone}
          />
        </div>
      </fieldset>

      {docsBase && (
        <p className="t-small acct-review-links">
          Review public pages:{" "}
          <a className="link" href={docsBase} target="_blank" rel="noopener noreferrer">Business profile</a>
          {" · "}
          <a className="link" href={`${docsBase}/privacy`} target="_blank" rel="noopener noreferrer">Privacy policy</a>
          {" · "}
          <a className="link" href={`${docsBase}/sms-terms`} target="_blank" rel="noopener noreferrer">SMS terms</a>
        </p>
      )}

      <label className="check">
        <input
          type="checkbox"
          checked={value.authorized}
          onChange={(e) => patch({ authorized: e.target.checked })}
        />
        <span>
          I confirm these details are accurate and authorize Missed Calls Dental to use them for
          SMS approval review.
        </span>
      </label>
      <div className="acct-texting-row">
        <span className="t-small" style={{ color: "var(--text-secondary)" }}>Texting</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
          {smsStatus !== "active" && (
            <span className="t-helper">Not active yet</span>
          )}
          <StatusBadge kind={textingKind} />
        </span>
      </div>
      {smsStatus !== "active" && (
        <p className="t-helper" style={{ margin: 0 }}>
          Carrier/A2P approval and Messaging Service coverage must be verified before SMS can be enabled.
        </p>
      )}

      <SaveBar label="Save approval information" saving={saving} savedAt={savedAt} error={error} />
    </form>
  );
}
