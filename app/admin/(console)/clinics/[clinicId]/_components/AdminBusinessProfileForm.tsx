"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  normalizeRepresentativePhone,
  validateBusinessAddress,
  validateWebsiteUrl,
} from "../../../../../../lib/a2p/validation";
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
type Touched = Partial<Record<keyof AdminBusinessProfileValue, boolean>>;

// Admin-scoped Business Profile editor. Same fields + client validation as the
// owner form (BusinessProfileForm), but posts to the platform-admin-guarded
// /api/admin/clinics/{clinicId}/business-profile endpoint and refreshes the
// server page so the launch checklist / read sections reflect the save.
export function AdminBusinessProfileForm({
  clinicId,
  initial,
  completed,
}: {
  clinicId: string;
  initial: AdminBusinessProfileValue;
  // Whether the clinic's business profile is already saved (business_info_completed).
  // When true the form opens locked/read-only with an admin "Edit" action — the
  // same saved clinic data, edited as a higher-permission continuation.
  completed: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<AdminBusinessProfileValue>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Touched>({});

  // Lock/edit state mirrors the owner form: saved data opens locked; an
  // incomplete clinic opens editable. `snapshot` reverts unsaved edits on Cancel.
  const [everCompleted, setEverCompleted] = useState(completed);
  const [editing, setEditing] = useState(!completed);
  const [snapshot, setSnapshot] = useState<AdminBusinessProfileValue>(initial);
  const locked = !editing;

  function set(patch: Partial<AdminBusinessProfileValue>) {
    setV((prev) => ({ ...prev, ...patch }));
  }

  function startEdit() {
    setSnapshot(v);
    setError(null);
    setSavedAt(null);
    setFieldErrors({});
    setTouched({});
    setEditing(true);
  }

  function cancelEdit() {
    setV(snapshot);
    setError(null);
    setFieldErrors({});
    setTouched({});
    setEditing(false);
  }

  function fieldError(name: keyof AdminBusinessProfileValue, next = v): string | undefined {
    if (name === "name") return next.name.trim().length < 2 ? "Enter the clinic name." : undefined;
    if (name === "mainPhone") {
      return /^\+1\d{10}$/.test(normalizeRepresentativePhone(next.mainPhone))
        ? undefined
        : "Enter a valid U.S. phone number for the main office phone.";
    }
    if (name === "website") return next.website.trim() ? validateWebsiteUrl(next.website)?.message : undefined;
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

  function validate(next = v): FieldErrors {
    const e: FieldErrors = {};
    for (const key of ["name", "mainPhone", "streetAddress", "city", "stateRegion", "postalCode", "website"] as const) {
      const message = fieldError(key, next);
      if (message) e[key] = message;
    }
    return e;
  }

  function touch(name: keyof AdminBusinessProfileValue) {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors((prev) => ({ ...prev, [name]: fieldError(name) }));
  }

  function patch(nextPatch: Partial<AdminBusinessProfileValue>) {
    const next = { ...v, ...nextPatch };
    set(nextPatch);
    setFieldErrors((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(nextPatch) as Array<keyof AdminBusinessProfileValue>) {
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
      const res = await fetch(`/api/admin/clinics/${clinicId}/business-profile`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          main_phone: normalizeRepresentativePhone(v.mainPhone),
          street_address: v.streetAddress,
          address_line2: v.addressLine2,
          city: v.city,
          state_region: v.stateRegion.toUpperCase(),
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
      // Return to locked/read-only mode showing the persisted response.
      setEverCompleted(true);
      setEditing(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="acct-form">
      <Field label="Public clinic name" name="bp_name" value={v.name} onChange={(x) => patch({ name: x })} onBlur={() => touch("name")} readOnly={locked} required error={fieldErrors.name} helper="The name patients know this office by." />
      <Field label="Main office phone" name="bp_main_phone" value={v.mainPhone} onChange={(x) => patch({ mainPhone: x })} onBlur={() => touch("mainPhone")} readOnly={locked} required inputMode="tel" autoComplete="tel" error={fieldErrors.mainPhone} />
      <Field label="Street address" name="bp_street" value={v.streetAddress} onChange={(x) => patch({ streetAddress: x })} onBlur={() => touch("streetAddress")} readOnly={locked} required infoTooltip={{ label: "Street address help", text: "Use the business address associated with the clinic or business registration when possible." }} autoComplete="address-line1" error={fieldErrors.streetAddress} />
      <Field label="Address line 2" name="bp_line2" value={v.addressLine2} onChange={(x) => patch({ addressLine2: x })} readOnly={locked} optional placeholder="Suite, unit, floor" autoComplete="address-line2" />
      <div className="acct-grid-3">
        <Field label="City" name="bp_city" value={v.city} onChange={(x) => patch({ city: x })} onBlur={() => touch("city")} readOnly={locked} required autoComplete="address-level2" error={fieldErrors.city} />
        <Field label="State" name="bp_state" value={v.stateRegion} onChange={(x) => patch({ stateRegion: x })} onBlur={() => touch("stateRegion")} readOnly={locked} required placeholder="IL" autoComplete="address-level1" error={fieldErrors.stateRegion} />
        <Field label="ZIP code" name="bp_zip" value={v.postalCode} onChange={(x) => patch({ postalCode: x })} onBlur={() => touch("postalCode")} readOnly={locked} required inputMode="numeric" autoComplete="postal-code" error={fieldErrors.postalCode} />
      </div>
      <Field label="Website" name="bp_website" value={v.website} onChange={(x) => patch({ website: x })} onBlur={() => touch("website")} readOnly={locked} optional infoTooltip={{ label: "Website help", text: "The website must be public, functional, and related to the legal business name or clinic name. Twilio may review it during A2P verification." }} placeholder="https://example.com" autoComplete="url" error={fieldErrors.website} />
      {locked ? (
        <div className="acct-action-stack">
          <button type="button" className="btn btn-secondary acct-primary-action" onClick={startEdit}>
            Edit
          </button>
          <span className="t-small acct-savebar-status">Business profile saved — edit to update this clinic.</span>
        </div>
      ) : (
        <div className="acct-action-stack">
          <SaveBar label="Save business profile" saving={saving} savedAt={savedAt} error={error} />
          {everCompleted && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={cancelEdit}
              disabled={saving}
              style={{ justifySelf: "center" }}
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </form>
  );
}
