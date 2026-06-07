"use client";

import { useState } from "react";
import {
  normalizeRepresentativePhone,
  validateBusinessAddress,
  validateWebsiteUrl,
} from "../../../../lib/a2p/validation";
import { Field, InfoTooltip, ReadonlyField, SaveBar, nowLabel } from "./AccountUI";
import type { BusinessProfileFields } from "./account-types";

type FieldErrors = Partial<Record<keyof BusinessProfileFields, string>>;
type Touched = Partial<Record<keyof BusinessProfileFields, boolean>>;

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
  const [touched, setTouched] = useState<Touched>({});

  function fieldError(name: keyof BusinessProfileFields, next = value): string | undefined {
    if (name === "name") {
      return next.name.trim().length < 2 ? "Enter your clinic name." : undefined;
    }
    if (name === "mainPhone") {
      return /^\+1\d{10}$/.test(normalizeRepresentativePhone(next.mainPhone))
        ? undefined
        : "Enter a valid U.S. phone number for your main office phone.";
    }
    if (name === "website") {
      return next.website.trim() ? validateWebsiteUrl(next.website)?.message : undefined;
    }
    const issues = validateBusinessAddress({
      street: next.streetAddress,
      city: next.city,
      region: next.stateRegion.toUpperCase(),
      postalCode: next.postalCode,
      country: "US",
    });
    if (name === "streetAddress") return issues.find((issue) => issue.field === "street_address")?.message;
    if (name === "city") return issues.find((issue) => issue.field === "city")?.message;
    if (name === "stateRegion") return issues.find((issue) => issue.field === "state_region")?.message;
    if (name === "postalCode") return issues.find((issue) => issue.field === "postal_code")?.message;
    return undefined;
  }

  function validate(next = value): FieldErrors {
    const e: FieldErrors = {};
    for (const key of ["name", "mainPhone", "streetAddress", "city", "stateRegion", "postalCode", "website"] as const) {
      const message = fieldError(key, next);
      if (message) e[key] = message;
    }
    return e;
  }

  function touch(name: keyof BusinessProfileFields) {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors((prev) => ({ ...prev, [name]: fieldError(name) }));
  }

  function patch(nextPatch: Partial<BusinessProfileFields>) {
    const next = { ...value, ...nextPatch };
    onChange(nextPatch);
    setFieldErrors((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(nextPatch) as Array<keyof BusinessProfileFields>) {
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
          main_phone: normalizeRepresentativePhone(value.mainPhone),
          street_address: value.streetAddress,
          address_line2: value.addressLine2,
          city: value.city,
          state_region: value.stateRegion.toUpperCase(),
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
        onChange={(v) => patch({ name: v })}
        onBlur={() => touch("name")}
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
        onChange={(v) => patch({ mainPhone: v })}
        onBlur={() => touch("mainPhone")}
        required
        inputMode="tel"
        autoComplete="tel"
        error={fieldErrors.mainPhone}
      />

      <Field
        label={<LabelWithInfo label="Street address" tooltip="Use the business address associated with the clinic or business registration when possible." />}
        name="street_address"
        value={value.streetAddress}
        onChange={(v) => patch({ streetAddress: v })}
        onBlur={() => touch("streetAddress")}
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
        onChange={(v) => patch({ city: v })}
        onBlur={() => touch("city")}
        required
        autoComplete="address-level2"
        error={fieldErrors.city}
        />
        <Field
        label="State"
        name="state_region"
        value={value.stateRegion}
        onChange={(v) => patch({ stateRegion: v })}
        onBlur={() => touch("stateRegion")}
        required
        placeholder="IL"
        autoComplete="address-level1"
          error={fieldErrors.stateRegion}
        />
        <Field
        label="ZIP code"
        name="postal_code"
        value={value.postalCode}
        onChange={(v) => patch({ postalCode: v })}
        onBlur={() => touch("postalCode")}
        required
        inputMode="numeric"
        autoComplete="postal-code"
          error={fieldErrors.postalCode}
        />
      </div>

      <Field
        label={<LabelWithInfo label="Website" tooltip="The website must be public, functional, and related to the legal business name or clinic name. Twilio may review it during A2P verification." />}
        name="website"
        value={value.website}
        onChange={(v) => patch({ website: v })}
        onBlur={() => touch("website")}
        optional
        placeholder="https://yourpractice.com"
        autoComplete="url"
        error={fieldErrors.website}
      />

      <SaveBar label="Save business profile" saving={saving} savedAt={savedAt} error={error} />
    </form>
  );
}

function LabelWithInfo({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <span>{label}</span>
      <InfoTooltip label={`${label} help`} text={tooltip} />
    </span>
  );
}
