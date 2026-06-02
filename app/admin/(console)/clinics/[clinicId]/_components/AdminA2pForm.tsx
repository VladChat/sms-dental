"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, SelectField, SaveBar, nowLabel } from "../../../../../setup/[token]/_components/AccountUI";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS } from "../../../../../../lib/validation/url";

export type AdminA2pValue = {
  legalBusinessName: string;
  einTaxId: string;
  businessType: string;
  repFirstName: string;
  repLastName: string;
  repEmail: string;
  repPhone: string;
  authorized: boolean;
};

type FieldErrors = Partial<Record<keyof AdminA2pValue, string>>;

const BUSINESS_TYPE_OPTIONS = BUSINESS_TYPES.map((value) => ({
  value,
  label: BUSINESS_TYPE_LABELS[value],
}));

// Admin-scoped A2P / SMS-approval editor. Same fields + client validation as the
// owner form (SmsApprovalForm), posting to the platform-admin-guarded
// /api/admin/clinics/{clinicId}/a2p endpoint. Saving stores data only — it never
// submits to a carrier (that backend does not exist yet).
export function AdminA2pForm({
  clinicId,
  initial,
}: {
  clinicId: string;
  initial: AdminA2pValue;
}) {
  const router = useRouter();
  const [v, setV] = useState<AdminA2pValue>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function set(patch: Partial<AdminA2pValue>) {
    setV((prev) => ({ ...prev, ...patch }));
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (v.legalBusinessName.trim().length < 2) e.legalBusinessName = "Enter the legal business name.";
    if (v.einTaxId.trim().length < 2) e.einTaxId = "Enter the EIN.";
    if (!(BUSINESS_TYPES as readonly string[]).includes(v.businessType)) e.businessType = "Choose a business type.";
    if (v.repFirstName.trim().length < 1) e.repFirstName = "Enter a first name.";
    if (v.repLastName.trim().length < 1) e.repLastName = "Enter a last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.repEmail.trim())) e.repEmail = "Enter a valid email.";
    if (v.repPhone.replace(/\D/g, "").length < 10) e.repPhone = "Enter a valid phone number.";
    return e;
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!v.authorized) {
      setError("Please confirm and authorize before saving.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/a2p`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          legal_business_name: v.legalBusinessName,
          ein_tax_id: v.einTaxId,
          business_type: v.businessType,
          rep_first_name: v.repFirstName,
          rep_last_name: v.repLastName,
          rep_email: v.repEmail,
          rep_phone: v.repPhone,
          authorized: v.authorized,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; smsApproval?: AdminA2pValue; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok || !json.smsApproval) {
        setError(json?.error?.message ?? "Could not save the approval information.");
        return;
      }
      setV(json.smsApproval);
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
      <Field label="Legal business name" name="a2p_legal" value={v.legalBusinessName} onChange={(x) => set({ legalBusinessName: x })} required helper="The exact registered name on the business paperwork." error={fieldErrors.legalBusinessName} />
      <SelectField label="Business type" name="a2p_type" value={v.businessType} onChange={(x) => set({ businessType: x })} options={BUSINESS_TYPE_OPTIONS} placeholder="Select business type…" required error={fieldErrors.businessType} />
      <Field label="EIN / Tax ID" name="a2p_ein" value={v.einTaxId} onChange={(x) => set({ einTaxId: x })} required inputMode="numeric" helper="9-digit federal tax ID." error={fieldErrors.einTaxId} />
      <fieldset className="acct-fieldset">
        <legend className="t-label">Authorized representative</legend>
        <div className="acct-grid-2">
          <Field label="First name" name="a2p_rep_first" value={v.repFirstName} onChange={(x) => set({ repFirstName: x })} required autoComplete="given-name" error={fieldErrors.repFirstName} />
          <Field label="Last name" name="a2p_rep_last" value={v.repLastName} onChange={(x) => set({ repLastName: x })} required autoComplete="family-name" error={fieldErrors.repLastName} />
          <Field label="Email" name="a2p_rep_email" type="email" value={v.repEmail} onChange={(x) => set({ repEmail: x })} required inputMode="email" autoComplete="email" error={fieldErrors.repEmail} />
          <Field label="Phone" name="a2p_rep_phone" value={v.repPhone} onChange={(x) => set({ repPhone: x })} required inputMode="tel" autoComplete="tel" error={fieldErrors.repPhone} />
        </div>
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={v.authorized} onChange={(e) => set({ authorized: e.target.checked })} />
        <span>I confirm these details are accurate and authorize submitting them for SMS approval.</span>
      </label>
      <SaveBar label="Save approval information" saving={saving} savedAt={savedAt} error={error} />
    </form>
  );
}
