"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, SaveBar, nowLabel } from "../../../../../setup/[token]/_components/AccountUI";

export type AdminBusinessProfileValue = {
  name: string;
  mainPhone: string;
  streetAddress: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  website: string;
};

type FieldErrors = Partial<Record<keyof AdminBusinessProfileValue, string>>;

// Admin-scoped Business Profile editor. Same fields + client validation as the
// owner form (BusinessProfileForm), but posts to the platform-admin-guarded
// /api/admin/clinics/{clinicId}/business-profile endpoint and refreshes the
// server page so the launch checklist / read sections reflect the save.
export function AdminBusinessProfileForm({
  clinicId,
  initial,
}: {
  clinicId: string;
  initial: AdminBusinessProfileValue;
}) {
  const router = useRouter();
  const [v, setV] = useState<AdminBusinessProfileValue>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function set(patch: Partial<AdminBusinessProfileValue>) {
    setV((prev) => ({ ...prev, ...patch }));
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (v.name.trim().length < 2) e.name = "Enter the clinic name.";
    if (v.mainPhone.replace(/\D/g, "").length < 10) e.mainPhone = "Enter a valid phone number.";
    if (v.streetAddress.trim().length < 2) e.streetAddress = "Enter the street address.";
    if (v.city.trim().length < 1) e.city = "Enter the city.";
    if (v.stateRegion.trim().length < 2) e.stateRegion = "Enter the state.";
    if (!/^\d{5}(-\d{4})?$/.test(v.postalCode.trim())) e.postalCode = "Enter a 5-digit ZIP code.";
    if (v.website.trim() && !/^https:\/\/.+\..+/.test(v.website.trim())) {
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
      const res = await fetch(`/api/admin/clinics/${clinicId}/business-profile`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          main_phone: v.mainPhone,
          street_address: v.streetAddress,
          address_line2: v.addressLine2,
          city: v.city,
          state_region: v.stateRegion,
          postal_code: v.postalCode,
          website: v.website,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; businessProfile?: AdminBusinessProfileValue; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok || !json.businessProfile) {
        setError(json?.error?.message ?? "Could not save the business profile.");
        return;
      }
      setV(json.businessProfile);
      setSavedAt(nowLabel());
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="acct-form">
      <Field label="Public clinic name" name="bp_name" value={v.name} onChange={(x) => set({ name: x })} required error={fieldErrors.name} helper="The name patients know this office by." />
      <Field label="Main office phone" name="bp_main_phone" value={v.mainPhone} onChange={(x) => set({ mainPhone: x })} required inputMode="tel" autoComplete="tel" error={fieldErrors.mainPhone} />
      <Field label="Street address" name="bp_street" value={v.streetAddress} onChange={(x) => set({ streetAddress: x })} required autoComplete="address-line1" error={fieldErrors.streetAddress} />
      <Field label="Address line 2" name="bp_line2" value={v.addressLine2} onChange={(x) => set({ addressLine2: x })} optional placeholder="Suite, unit, floor" autoComplete="address-line2" />
      <div className="acct-grid-3">
        <Field label="City" name="bp_city" value={v.city} onChange={(x) => set({ city: x })} required autoComplete="address-level2" error={fieldErrors.city} />
        <Field label="State" name="bp_state" value={v.stateRegion} onChange={(x) => set({ stateRegion: x })} required placeholder="IL" autoComplete="address-level1" error={fieldErrors.stateRegion} />
        <Field label="ZIP code" name="bp_zip" value={v.postalCode} onChange={(x) => set({ postalCode: x })} required inputMode="numeric" autoComplete="postal-code" error={fieldErrors.postalCode} />
      </div>
      <Field label="Website" name="bp_website" value={v.website} onChange={(x) => set({ website: x })} optional placeholder="https://example.com" autoComplete="url" error={fieldErrors.website} />
      <SaveBar label="Save business profile" saving={saving} savedAt={savedAt} error={error} />
    </form>
  );
}
