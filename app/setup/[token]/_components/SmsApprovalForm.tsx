"use client";

import { useState } from "react";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
} from "../../../../lib/validation/url";
import { Field, SelectField, SaveBar, StatusBadge, nowLabel, type StatusKind } from "./AccountUI";
import type { SmsApprovalFields, SmsStatus } from "./account-types";

type FieldErrors = Partial<Record<keyof SmsApprovalFields, string>>;

const BUSINESS_TYPE_OPTIONS = BUSINESS_TYPES.map((v) => ({
  value: v,
  label: BUSINESS_TYPE_LABELS[v],
}));

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
      const endpoint = token
        ? `/api/onboarding/${encodeURIComponent(token)}/a2p`
        : "/api/account/a2p";
      const res = await fetch(endpoint, {
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
    <form onSubmit={onSubmit} noValidate className="acct-form">
      <Field
        label="Legal business name"
        name="legal_business_name"
        value={value.legalBusinessName}
        onChange={(v) => onChange({ legalBusinessName: v })}
        required
        helper="The exact registered name on your business paperwork."
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
        helper="Select the legal business structure that matches your registration."
        error={fieldErrors.businessType}
      />

      <Field
        label="EIN"
        name="ein_tax_id"
        value={value.einTaxId}
        onChange={(v) => onChange({ einTaxId: v })}
        required
        inputMode="numeric"
        helper="Your 9-digit federal tax ID."
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
          onChange={(e) => onChange({ authorized: e.target.checked })}
        />
        <span>
          I confirm these details are accurate and authorize Missed Calls Dental to submit them for
          SMS approval.
        </span>
      </label>
      <div className="acct-texting-row">
        <span className="t-small" style={{ color: "var(--text-secondary)" }}>Texting</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
          {smsStatus !== "active" && (
            <span className="t-helper">Starts after approval</span>
          )}
          <StatusBadge kind={textingKind} />
        </span>
      </div>

      <SaveBar label="Save approval information" saving={saving} savedAt={savedAt} error={error} />
    </form>
  );
}
