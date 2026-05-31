"use client";

import { useState } from "react";
import { Field, ReadonlyField, SaveBar, nowLabel } from "./AccountUI";
import type { BusinessProfileFields } from "./account-types";

type FieldErrors = Partial<Record<keyof BusinessProfileFields, string>>;

export function BusinessProfileForm({
  token,
  loginEmail,
  value,
  onChange,
  onSaved,
}: {
  token: string | null;
  loginEmail: string;
  value: BusinessProfileFields;
  onChange: (patch: Partial<BusinessProfileFields>) => void;
  onSaved: (persisted: BusinessProfileFields) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (value.name.trim().length < 2) e.name = "Enter your clinic name.";
    if (value.mainPhone.replace(/\D/g, "").length < 10) e.mainPhone = "Enter a valid phone number.";
    if (value.streetAddress.trim().length < 2) e.streetAddress = "Enter your street address.";
    if (value.city.trim().length < 1) e.city = "Enter your city.";
    if (value.stateRegion.trim().length < 2) e.stateRegion = "Enter your state.";
    if (!/^\d{5}(-\d{4})?$/.test(value.postalCode.trim())) e.postalCode = "Enter a 5-digit ZIP code.";
    if (value.website.trim() && !/^https:\/\/.+\..+/.test(value.website.trim())) {
      e.website = "Website must start with https://";
    }
    return e;
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const endpoint = token
        ? `/api/onboarding/${encodeURIComponent(token)}/business-info`
        : "/api/account/business-info";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: value.name,
          main_phone: value.mainPhone,
          street_address: value.streetAddress,
          address_line2: value.addressLine2,
          city: value.city,
          state_region: value.stateRegion,
          postal_code: value.postalCode,
          website: value.website,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        slug?: string | null;
        businessProfile?: BusinessProfileFields;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.businessProfile) {
        setError(json?.error?.message ?? "Could not save your business profile.");
        return;
      }
      // Reconcile to the persisted values returned by the server.
      setSavedAt(nowLabel());
      onSaved(json.businessProfile);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="acct-form">
      <Field
        label="Clinic name"
        name="name"
        value={value.name}
        onChange={(v) => onChange({ name: v })}
        required
        helper="The name patients know your office by."
        error={fieldErrors.name}
      />

      <ReadonlyField
        label="Login email"
        value={loginEmail}
        helper="This is the email your setup link was sent to."
      />

      <Field
        label="Main office phone"
        name="main_phone"
        value={value.mainPhone}
        onChange={(v) => onChange({ mainPhone: v })}
        required
        inputMode="tel"
        autoComplete="tel"
        error={fieldErrors.mainPhone}
      />

      <Field
        label="Street address"
        name="street_address"
        value={value.streetAddress}
        onChange={(v) => onChange({ streetAddress: v })}
        required
        autoComplete="address-line1"
        error={fieldErrors.streetAddress}
      />

      <Field
        label="Address line 2"
        name="address_line2"
        value={value.addressLine2}
        onChange={(v) => onChange({ addressLine2: v })}
        optional
        placeholder="Suite, unit, floor"
        autoComplete="address-line2"
      />

      <div className="acct-grid-3">
        <Field
          label="City"
          name="city"
          value={value.city}
          onChange={(v) => onChange({ city: v })}
          required
          autoComplete="address-level2"
          error={fieldErrors.city}
        />
        <Field
          label="State"
          name="state_region"
          value={value.stateRegion}
          onChange={(v) => onChange({ stateRegion: v })}
          required
          placeholder="IL"
          autoComplete="address-level1"
          error={fieldErrors.stateRegion}
        />
        <Field
          label="ZIP code"
          name="postal_code"
          value={value.postalCode}
          onChange={(v) => onChange({ postalCode: v })}
          required
          inputMode="numeric"
          autoComplete="postal-code"
          error={fieldErrors.postalCode}
        />
      </div>

      <Field
        label="Website"
        name="website"
        value={value.website}
        onChange={(v) => onChange({ website: v })}
        optional
        placeholder="https://yourpractice.com"
        autoComplete="url"
        error={fieldErrors.website}
      />

      <SaveBar label="Save business profile" saving={saving} savedAt={savedAt} error={error} />
    </form>
  );
}
