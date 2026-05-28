"use client";

import { useMemo, useState } from "react";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  DEFAULT_BUSINESS_TYPE,
} from "../../../../lib/validation/url";

export type BusinessProfileData = {
  token: string;
  loginEmail: string;
  // Absolute base URL for the public /business/{slug} pages.
  publicBaseUrl: string;
  clinic: {
    name: string;
    mainPhone: string;
    postalCode: string;
    legalBusinessName: string;
    einTaxId: string;
    businessType: string;
    streetAddress: string;
    addressLine2: string;
    city: string;
    stateRegion: string;
    website: string;
    slug: string | null;
    businessInfoCompleted: boolean;
    a2p: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      authorized: boolean;
      completed: boolean;
    };
    localNumberStatus: "preparing" | "reserved" | "assigned";
    smsStatus: "preparing" | "waiting_for_approval" | "active";
    billingStatus: string;
  };
};

type StepId = 1 | 2 | 3 | 4 | 5 | 6;
type BadgeKind = "success" | "info" | "warn" | "muted";

export function BusinessProfile({ data }: { data: BusinessProfileData }) {
  const c = data.clinic;
  const [clinicName, setClinicName] = useState(c.name);
  const [smsStatus, setSmsStatus] = useState(c.smsStatus);
  const [businessDone, setBusinessDone] = useState(c.businessInfoCompleted);
  const [a2pDone, setA2pDone] = useState(c.a2p.completed);
  const [slug, setSlug] = useState(c.slug);

  const firstOpen: StepId = !businessDone ? 1 : !a2pDone ? 2 : 3;
  const [activeStep, setActiveStep] = useState<StepId>(firstOpen);

  const steps = useMemo(
    () => buildSteps({ businessDone, a2pDone, slug, smsStatus }),
    [businessDone, a2pDone, slug, smsStatus],
  );

  return (
    <main style={shellStyle}>
      <header style={appHeaderStyle}>
        <p style={brandStyle}>{clinicName || "Your clinic"}</p>
        <h1 style={appTitleStyle}>Account setup</h1>
        <p style={appSubtitleStyle}>
          Complete each step below. Patient texting stays off until everything is approved.
        </p>
      </header>

      <div style={layoutStyle}>
        <nav aria-label="Setup steps" style={sidebarStyle}>
          {steps.map((s) => {
            const active = s.id === activeStep;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStep(s.id)}
                style={{
                  ...stepNavItem,
                  ...(active ? stepNavItemActive : null),
                  ...(s.muted && !active ? stepNavItemMuted : null),
                }}
              >
                <span style={stepNavTop}>
                  <span style={stepNum}>{s.id}</span>
                  <span style={stepNavTitle}>{s.title}</span>
                </span>
                <Badge kind={s.badgeKind}>{s.badge}</Badge>
              </button>
            );
          })}
        </nav>

        <section style={contentStyle}>
          {activeStep === 1 && (
            <BusinessInformationCard
              token={data.token}
              clinic={c}
              onSaved={(next) => {
                setClinicName(next.name);
                setBusinessDone(true);
                if (next.slug) setSlug(next.slug);
                setActiveStep(2);
              }}
            />
          )}
          {activeStep === 2 && (
            <A2pCard
              token={data.token}
              clinicName={clinicName}
              loginEmail={data.loginEmail}
              defaultRep={c.a2p}
              defaultMainPhone={c.mainPhone}
              onSaved={() => {
                setA2pDone(true);
                setSmsStatus((s) => (s === "preparing" ? "waiting_for_approval" : s));
                setActiveStep(3);
              }}
            />
          )}
          {activeStep === 3 && (
            <CompliancePagesCard publicBaseUrl={data.publicBaseUrl} slug={slug} />
          )}
          {activeStep === 4 && (
            <PhoneNumberSetupCard status={c.localNumberStatus} />
          )}
          {activeStep === 5 && <SmsActivationCard status={smsStatus} a2pDone={a2pDone} />}
          {activeStep === 6 && <BillingCard />}
        </section>
      </div>
    </main>
  );
}

function buildSteps(s: {
  businessDone: boolean;
  a2pDone: boolean;
  slug: string | null;
  smsStatus: BusinessProfileData["clinic"]["smsStatus"];
}): {
  id: StepId;
  title: string;
  badge: string;
  badgeKind: BadgeKind;
  muted: boolean;
}[] {
  return [
    {
      id: 1,
      title: "Business Information",
      badge: s.businessDone ? "Saved" : "Needs attention",
      badgeKind: s.businessDone ? "success" : "warn",
      muted: false,
    },
    {
      id: 2,
      title: "A2P Approval Information",
      badge: s.a2pDone ? "Ready for review" : "Needs attention",
      badgeKind: s.a2pDone ? "info" : "warn",
      muted: !s.businessDone,
    },
    {
      id: 3,
      title: "Compliance Pages",
      badge: s.slug ? "Generated" : "Pending",
      badgeKind: s.slug ? "success" : "muted",
      muted: !s.slug,
    },
    {
      id: 4,
      title: "Phone Number Setup",
      badge: "Preparing",
      badgeKind: "muted",
      muted: true,
    },
    {
      id: 5,
      title: "SMS Activation",
      badge: s.smsStatus === "waiting_for_approval" ? "Waiting for approval" : "Not started",
      badgeKind: s.smsStatus === "waiting_for_approval" ? "info" : "muted",
      muted: true,
    },
    {
      id: 6,
      title: "Billing",
      badge: "Later",
      badgeKind: "muted",
      muted: true,
    },
  ];
}

/* -------------------------------------------------- Step 1: Business Info */

function BusinessInformationCard({
  token,
  clinic,
  onSaved,
}: {
  token: string;
  clinic: BusinessProfileData["clinic"];
  onSaved: (next: { name: string; slug: string | null }) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      const payload = Object.fromEntries(fd.entries());
      const res = await fetch(`/api/onboarding/${encodeURIComponent(token)}/business-info`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        slug?: string | null;
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Could not save business information.");
        return;
      }
      setSavedAt(nowLabel());
      onSaved({ name: String(payload.name ?? clinic.name), slug: json.slug ?? null });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const businessTypeInitial =
    clinic.businessType && (BUSINESS_TYPES as readonly string[]).includes(clinic.businessType)
      ? clinic.businessType
      : DEFAULT_BUSINESS_TYPE;

  return (
    <Card title="Business Information" subtitle="Tell us about your practice.">
      <form onSubmit={onSubmit} noValidate>
        <Field label="Clinic name" name="name" defaultValue={clinic.name} required />
        <Field label="Legal business name" name="legal_business_name" defaultValue={clinic.legalBusinessName} required />
        <SelectField
          label="Business Type"
          name="business_type"
          defaultValue={businessTypeInitial}
          options={BUSINESS_TYPES}
          labelFor={(v) => BUSINESS_TYPE_LABELS[v as keyof typeof BUSINESS_TYPE_LABELS] ?? v}
        />
        <Field label="EIN" name="ein_tax_id" defaultValue={clinic.einTaxId} required helper="Your business EIN (employer identification number)." />
        <Field label="Main office phone" name="main_phone" defaultValue={clinic.mainPhone} required inputMode="tel" />
        <Field label="Street address" name="street_address" defaultValue={clinic.streetAddress} required />
        <Field label="Address line 2" name="address_line2" defaultValue={clinic.addressLine2} placeholder="Suite, unit, floor (optional)" />
        <Field label="City" name="city" defaultValue={clinic.city} required />
        <Field label="State" name="state_region" defaultValue={clinic.stateRegion} placeholder="IL" required />
        <Field label="ZIP code" name="postal_code" defaultValue={clinic.postalCode} required inputMode="numeric" />
        <Field label="Website" name="website" defaultValue={clinic.website} placeholder="https://yourpractice.com" helper="Optional." />

        <FormFooter error={error} savedAt={savedAt} saving={saving} label="Save business information" />
      </form>
    </Card>
  );
}

/* ------------------------------------------------ Step 2: A2P Approval */

function A2pCard({
  token,
  clinicName,
  loginEmail,
  defaultRep,
  defaultMainPhone,
  onSaved,
}: {
  token: string;
  clinicName: string;
  loginEmail: string;
  defaultRep: BusinessProfileData["clinic"]["a2p"];
  defaultMainPhone: string;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(defaultRep.authorized);

  const sample = `Hi, this is ${clinicName || "your clinic"}. We missed your call. Reply here and our team will follow up. Reply STOP to opt out.`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!authorized) {
      setError("Please confirm you are authorized to approve SMS setup for this business.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      const payload = {
        rep_first_name: fd.get("rep_first_name"),
        rep_last_name: fd.get("rep_last_name"),
        rep_email: fd.get("rep_email"),
        rep_phone: fd.get("rep_phone"),
        authorized,
      };
      const res = await fetch(`/api/onboarding/${encodeURIComponent(token)}/a2p`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Could not save approval information.");
        return;
      }
      setSavedAt(nowLabel());
      onSaved();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="A2P Approval Information"
      subtitle="The authorized contact for this business. Required before texting can be approved."
    >
      <form onSubmit={onSubmit} noValidate>
        <Field label="First name" name="rep_first_name" defaultValue={defaultRep.firstName} required />
        <Field label="Last name" name="rep_last_name" defaultValue={defaultRep.lastName} required />
        <Field label="Email" name="rep_email" type="email" defaultValue={defaultRep.email || loginEmail} required />
        <Field label="Phone" name="rep_phone" defaultValue={defaultRep.phone || defaultMainPhone} inputMode="tel" required />

        <div style={previewBox}>
          <p style={previewLabel}>Prepared for you automatically</p>
          <p style={previewText}>
            We generate the texting use case and a sample message from your business details, so you
            don’t have to write them.
          </p>
          <p style={{ ...previewText, marginTop: 8, color: "#475569" }}>
            <em>Sample:</em> {sample}
          </p>
        </div>

        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>I am authorized to approve SMS setup for this business.</span>
        </label>

        <FormFooter error={error} savedAt={savedAt} saving={saving} label="Save A2P information" />
      </form>
    </Card>
  );
}

/* ----------------------------------------- Step 3: Compliance Pages */

function CompliancePagesCard({
  publicBaseUrl,
  slug,
}: {
  publicBaseUrl: string;
  slug: string | null;
}) {
  if (!slug) {
    return (
      <Card title="Compliance Pages">
        <p style={mutedText}>
          Your compliance pages are generated automatically after you save your business
          information.
        </p>
      </Card>
    );
  }
  const base = `${publicBaseUrl}/business/${slug}`;
  return (
    <Card
      title="Generated compliance pages"
      subtitle="These public pages are created for you and used for messaging approval."
    >
      <div style={{ display: "grid", gap: 10 }}>
        <ComplianceRow label="Business profile" url={base} />
        <ComplianceRow label="Privacy policy" url={`${base}/privacy`} />
        <ComplianceRow label="SMS terms" url={`${base}/sms-terms`} />
      </div>
    </Card>
  );
}

function ComplianceRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable; View still works */
    }
  }
  return (
    <div style={complianceRowStyle}>
      <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>{label}</span>
      <span style={{ display: "flex", gap: 8 }}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={secondaryBtnStyle}>
          View
        </a>
        <button type="button" onClick={copy} style={secondaryBtnStyle}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </span>
    </div>
  );
}

/* ----------------------------------- Steps 4-6: status-only (muted) */

function PhoneNumberSetupCard({
  status,
}: {
  status: BusinessProfileData["clinic"]["localNumberStatus"];
}) {
  const label = status === "reserved" || status === "assigned" ? "Reserved" : "Preparing";
  return (
    <Card title="Phone Number Setup" subtitle="We prepare a local number for your office automatically.">
      <KeyVal k="Status" v={label} />
      <p style={mutedText}>
        You don’t need to pick a number. We select and prepare a suitable local number for you.
      </p>
    </Card>
  );
}

function SmsActivationCard({
  status,
  a2pDone,
}: {
  status: BusinessProfileData["clinic"]["smsStatus"];
  a2pDone: boolean;
}) {
  const label =
    status === "active"
      ? "Active"
      : status === "waiting_for_approval" || a2pDone
        ? "Waiting for approval"
        : "Not started";
  return (
    <Card title="SMS Activation" subtitle="Patient texting turns on only after approval is complete.">
      <KeyVal k="Status" v={label} />
      <p style={mutedText}>
        Texting stays off until your details are reviewed and approved. We’ll handle the approval
        steps for you.
      </p>
    </Card>
  );
}

function BillingCard() {
  return (
    <Card title="Billing">
      <KeyVal k="Plan" v="Missed-call text follow-up" />
      <KeyVal k="Trial" v="21 days, starting after SMS activation" />
      <p style={mutedTextStrong}>Billing starts after SMS activation.</p>
      <p style={mutedText}>Billing will be available after SMS activation.</p>
    </Card>
  );
}

/* ---------------------------------------------------- shared primitives */

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={cardStyle}>
      <h2 style={cardTitleStyle}>{title}</h2>
      {subtitle && <p style={cardSubtitleStyle}>{subtitle}</p>}
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
  inputMode,
  helper,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  helper?: string;
}) {
  const helperId = helper ? `${name}-help` : undefined;
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
      <label htmlFor={name} style={labelStyle}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        inputMode={inputMode}
        aria-describedby={helperId}
        autoComplete="off"
        spellCheck={false}
        style={inputStyle}
      />
      {helper && <p id={helperId} style={helperLineStyle}>{helper}</p>}
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
  labelFor,
}: {
  label: string;
  name: string;
  options: readonly string[];
  defaultValue: string;
  labelFor?: (v: string) => string;
}) {
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
      <label htmlFor={name} style={labelStyle}>{label}</label>
      <select id={name} name={name} defaultValue={defaultValue} required style={inputStyle}>
        {options.map((o) => (
          <option key={o} value={o}>{labelFor ? labelFor(o) : o}</option>
        ))}
      </select>
    </div>
  );
}

function FormFooter({
  error,
  savedAt,
  saving,
  label,
}: {
  error: string | null;
  savedAt: string | null;
  saving: boolean;
  label: string;
}) {
  return (
    <>
      {error && <p role="alert" aria-live="polite" style={errorBox}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
        <button type="submit" disabled={saving} style={primaryBtnStyle}>
          {saving ? "Saving…" : label}
        </button>
        {savedAt && !error && (
          <span role="status" aria-live="polite" style={lastSavedStyle}>
            Saved · {savedAt}
          </span>
        )}
      </div>
    </>
  );
}

function Badge({ kind, children }: { kind: BadgeKind; children: React.ReactNode }) {
  return <span style={{ ...badgeBase, ...badgeKinds[kind] }}>{children}</span>;
}

function KeyVal({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0" }}>
      <span style={{ color: "#6b7280", fontSize: 14 }}>{k}</span>
      <span style={{ color: "#111827", fontSize: 14, fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/* ---------------------------------------------------------------- styles */

const shellStyle: React.CSSProperties = {
  maxWidth: 1040,
  margin: "0 auto",
  padding: "40px 24px 80px",
};
const appHeaderStyle: React.CSSProperties = { marginBottom: 24 };
const brandStyle: React.CSSProperties = {
  margin: 0,
  color: "#0d9488",
  fontSize: 12,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  fontWeight: 700,
};
const appTitleStyle: React.CSSProperties = {
  margin: "6px 0 4px",
  fontSize: 26,
  color: "#111827",
  letterSpacing: "-.02em",
};
const appSubtitleStyle: React.CSSProperties = { margin: 0, color: "#6b7280", fontSize: 14 };
const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 280px) 1fr",
  gap: 24,
  alignItems: "start",
};
const sidebarStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  position: "sticky",
  top: 24,
};
const stepNavItem: React.CSSProperties = {
  display: "grid",
  gap: 8,
  textAlign: "left",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  cursor: "pointer",
  font: "inherit",
};
const stepNavItemActive: React.CSSProperties = {
  border: "1px solid #0d9488",
  boxShadow: "0 1px 2px rgba(13,148,136,.12)",
  background: "#f0fdfa",
};
const stepNavItemMuted: React.CSSProperties = { opacity: 0.6 };
const stepNavTop: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const stepNum: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
  flex: "0 0 auto",
};
const stepNavTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: "#111827" };
const contentStyle: React.CSSProperties = { minWidth: 0 };
const cardStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};
const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 19,
  color: "#111827",
  letterSpacing: "-.01em",
};
const cardSubtitleStyle: React.CSSProperties = { margin: "6px 0 0", color: "#6b7280", fontSize: 14 };
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#111827" };
const helperLineStyle: React.CSSProperties = { margin: 0, color: "#6b7280", fontSize: 12 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  font: "inherit",
  fontSize: 15,
};
const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "11px 18px",
  borderRadius: 999,
  border: "1px solid transparent",
  background: "#0d9488",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
const secondaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  textDecoration: "none",
};
const lastSavedStyle: React.CSSProperties = { color: "#0f766e", fontSize: 13 };
const complianceRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
};
const mutedText: React.CSSProperties = { margin: "10px 0 0", color: "#6b7280", fontSize: 14 };
const mutedTextStrong: React.CSSProperties = { margin: "12px 0 0", color: "#334155", fontSize: 14, fontWeight: 600 };
const previewBox: React.CSSProperties = {
  margin: "2px 0 16px",
  padding: "12px 14px",
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};
const previewLabel: React.CSSProperties = {
  margin: 0,
  color: "#6b7280",
  fontSize: 12,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  fontWeight: 700,
};
const previewText: React.CSSProperties = { margin: "6px 0 0", color: "#334155", fontSize: 14 };
const checkboxRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  margin: "4px 0 18px",
  color: "#111827",
  fontSize: 14,
  cursor: "pointer",
};
const errorBox: React.CSSProperties = {
  margin: "0 0 14px",
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 14,
};
const badgeBase: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: ".04em",
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  whiteSpace: "nowrap",
  justifySelf: "start",
};
const badgeKinds: Record<BadgeKind, React.CSSProperties> = {
  success: { color: "#0d9488", background: "#ccfbf1", border: "1px solid #99f6e4" },
  info: { color: "#1e40af", background: "#dbeafe", border: "1px solid #bfdbfe" },
  warn: { color: "#9a3412", background: "#ffedd5", border: "1px solid #fed7aa" },
  muted: { color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0" },
};
