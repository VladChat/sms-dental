"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BUSINESS_TYPE_OPTIONS,
  formatEinForDisplay,
  normalizeBusinessTypeForStorage,
  normalizeRepresentativePhone,
  validateBusinessType,
  validateEin,
  validateLegalBusinessName,
  validateRepresentativeEmail,
  validateRepresentativeName,
  validateRepresentativePhone,
  validateRepresentativeTitle,
} from "../../../../../../lib/a2p/validation";
import { Field, InfoTooltip, SelectField, SaveBar, nowLabel } from "../../../../../setup/[token]/_components/AccountUI";

export type AdminA2pValue = {
  legalBusinessName: string;
  einTaxId: string;
  businessType: string;
  repFirstName: string;
  repLastName: string;
  repBusinessTitle: string;
  repEmail: string;
  repPhone: string;
  authorized: boolean;
};

type FieldErrors = Partial<Record<keyof AdminA2pValue, string>>;
type Touched = Partial<Record<keyof AdminA2pValue, boolean>>;

// Admin-scoped A2P / SMS-approval editor. Same fields + client validation as the
// owner form (SmsApprovalForm), posting to the platform-admin-guarded
// /api/admin/clinics/{clinicId}/a2p endpoint. Saving stores data only — it never
// submits to a carrier (that backend does not exist yet).
export function AdminA2pForm({
  clinicId,
  initial,
  completed,
}: {
  clinicId: string;
  initial: AdminA2pValue;
  // Whether the clinic's SMS approval info is already saved (a2p_info_completed).
  // When true the form opens locked/read-only with an admin "Edit" action — the
  // same saved owner data, shown as a higher-permission continuation.
  completed: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<AdminA2pValue>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Touched>({});
  const businessTypeValue = normalizeBusinessTypeForStorage(v.businessType) ?? "";

  // Lock/edit state mirrors the owner form: saved data opens locked; an
  // incomplete clinic opens editable so the admin can complete it. `snapshot`
  // reverts unsaved edits on Cancel.
  const [everCompleted, setEverCompleted] = useState(completed);
  const [editing, setEditing] = useState(!completed);
  const [snapshot, setSnapshot] = useState<AdminA2pValue>(initial);
  const locked = !editing;

  function set(patch: Partial<AdminA2pValue>) {
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

  function fieldError(name: keyof AdminA2pValue, next = v): string | undefined {
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

  function validate(next = v): FieldErrors {
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

  function touch(name: keyof AdminA2pValue) {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors((prev) => ({ ...prev, [name]: fieldError(name) }));
  }

  function patch(nextPatch: Partial<AdminA2pValue>) {
    const next = { ...v, ...nextPatch };
    set(nextPatch);
    setFieldErrors((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(nextPatch) as Array<keyof AdminA2pValue>) {
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
          ein_tax_id: formatEinForDisplay(v.einTaxId),
          business_type: v.businessType,
          rep_first_name: v.repFirstName,
          rep_last_name: v.repLastName,
          rep_business_title: v.repBusinessTitle,
          rep_email: v.repEmail,
          rep_phone: normalizeRepresentativePhone(v.repPhone),
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
      <Field label="Legal business name" name="a2p_legal" value={v.legalBusinessName} onChange={(x) => patch({ legalBusinessName: x })} onBlur={() => touch("legalBusinessName")} readOnly={locked} infoTooltip={{ label: "Legal business name help", text: "Use the exact legal business name registered with the EIN. For a U.S. business, this should match the IRS CP 575 EIN Confirmation Letter or IRS 147C letter." }} required helper="The exact registered name on the business paperwork." error={fieldErrors.legalBusinessName} />
      <SelectField label="Business Type" name="a2p_type" value={businessTypeValue} onChange={(x) => patch({ businessType: x })} onBlur={() => touch("businessType")} readOnly={locked} infoTooltip={{ label: "Business Type help", text: "Choose the legal structure that matches the business registration. For an LLC, choose Limited Liability Corporation." }} options={BUSINESS_TYPE_OPTIONS} placeholder="--- Select Business Type ---" required helper={fieldErrors.businessType ? undefined : "Select the exact legal structure submitted for A2P review."} error={fieldErrors.businessType} />
      <Field label="EIN / Tax ID" name="a2p_ein" value={v.einTaxId} onChange={(x) => patch({ einTaxId: x })} onBlur={() => touch("einTaxId")} readOnly={locked} infoTooltip={{ label: "EIN help", text: "Enter the EIN exactly as issued by the IRS. It must match the legal business name." }} required inputMode="numeric" helper="Enter a valid 9-digit EIN, for example 12-3456789." error={fieldErrors.einTaxId} />
      <fieldset className="acct-fieldset">
        <legend className="t-label">
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <span>Authorized representative</span>
            <InfoTooltip label="Authorized representative help" text="This should be a person authorized to register the business for SMS messaging." />
          </span>
        </legend>
        <div className="acct-grid-2">
          <Field label="First name" name="a2p_rep_first" value={v.repFirstName} onChange={(x) => patch({ repFirstName: x })} onBlur={() => touch("repFirstName")} readOnly={locked} required autoComplete="given-name" error={fieldErrors.repFirstName} />
          <Field label="Last name" name="a2p_rep_last" value={v.repLastName} onChange={(x) => patch({ repLastName: x })} onBlur={() => touch("repLastName")} readOnly={locked} required autoComplete="family-name" error={fieldErrors.repLastName} />
          <Field label="Business title" name="a2p_rep_title" value={v.repBusinessTitle} onChange={(x) => patch({ repBusinessTitle: x })} onBlur={() => touch("repBusinessTitle")} readOnly={locked} infoTooltip={{ label: "Business title help", text: "Use the representative’s real business title, such as Owner, Director, or Office Manager." }} required helper="For example: Owner, Director, or Office Manager." error={fieldErrors.repBusinessTitle} />
          <Field label="Email" name="a2p_rep_email" type="email" value={v.repEmail} onChange={(x) => patch({ repEmail: x })} onBlur={() => touch("repEmail")} readOnly={locked} infoTooltip={{ label: "Representative email help", text: "Use a real email for the authorized representative. Disposable or temporary emails can fail review." }} required inputMode="email" autoComplete="email" error={fieldErrors.repEmail} />
          <Field label="Phone" name="a2p_rep_phone" value={v.repPhone} onChange={(x) => patch({ repPhone: x })} onBlur={() => touch("repPhone")} readOnly={locked} infoTooltip={{ label: "Representative phone help", text: "Use a direct phone number for the authorized representative in U.S./Canada format." }} required inputMode="tel" autoComplete="tel" error={fieldErrors.repPhone} />
        </div>
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={v.authorized} onChange={(e) => patch({ authorized: e.target.checked })} disabled={locked} />
        <span>I confirm these details are accurate and authorize submitting them for SMS approval.</span>
      </label>
      {locked ? (
        <div className="acct-action-stack">
          <button type="button" className="btn btn-secondary acct-primary-action" onClick={startEdit}>
            Edit
          </button>
          <span className="t-small acct-savebar-status">Saved by clinic owner — edit to update before A2P review.</span>
        </div>
      ) : (
        <div className="acct-action-stack">
          <SaveBar label="Save approval information" saving={saving} savedAt={savedAt} error={error} />
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
