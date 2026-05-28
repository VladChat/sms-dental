"use client";

import { useState } from "react";

export type BusinessProfileData = {
  token: string;
  loginEmail: string;
  // Absolute base URL for the public /business/{slug} pages (app domain).
  publicBaseUrl: string;
  clinic: {
    name: string;
    mainPhone: string;
    postalCode: string;
    legalBusinessName: string;
    einTaxId: string;
    businessType: string;
    streetAddress: string;
    city: string;
    stateRegion: string;
    website: string;
    slug: string | null;
    businessInfoCompleted: boolean;
    a2p: {
      firstName: string;
      lastName: string;
      businessTitle: string;
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

function localNumberLabel(s: BusinessProfileData["clinic"]["localNumberStatus"]) {
  return s === "preparing" ? "Preparing" : "Reserved";
}
function smsLabel(s: BusinessProfileData["clinic"]["smsStatus"]) {
  if (s === "waiting_for_approval") return "Waiting for approval";
  if (s === "active") return "Active";
  return "Preparing";
}

export function BusinessProfile({ data }: { data: BusinessProfileData }) {
  const c = data.clinic;
  const [clinicName, setClinicName] = useState(c.name);
  const [smsStatus, setSmsStatus] = useState(c.smsStatus);
  const [businessDone, setBusinessDone] = useState(c.businessInfoCompleted);
  const [a2pDone, setA2pDone] = useState(c.a2p.completed);
  const [slug, setSlug] = useState(c.slug);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <StatusStrip
        localNumber={localNumberLabel(c.localNumberStatus)}
        sms={smsLabel(smsStatus)}
        billing="Not started"
      />

      <BusinessInformationCard
        token={data.token}
        clinic={c}
        complete={businessDone}
        onSaved={(next) => {
          setClinicName(next.name);
          setBusinessDone(true);
          if (next.slug) setSlug(next.slug);
        }}
      />

      <A2pCard
        token={data.token}
        clinicName={clinicName}
        loginEmail={data.loginEmail}
        defaultRep={c.a2p}
        defaultMainPhone={c.mainPhone}
        complete={a2pDone}
        onSaved={() => {
          setA2pDone(true);
          setSmsStatus((s) => (s === "preparing" ? "waiting_for_approval" : s));
        }}
      />

      <PublicBusinessPageCard publicBaseUrl={data.publicBaseUrl} slug={slug} />

      <BillingCard />
      <BillingHistoryCard />
      <LoginSecurityCard loginEmail={data.loginEmail} />
      <SupportCard />
    </div>
  );
}

/* ---------------------------------------------------------------- status */

function StatusStrip({
  localNumber,
  sms,
  billing,
}: {
  localNumber: string;
  sms: string;
  billing: string;
}) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        padding: 16,
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
      }}
    >
      <StatusPill label="Local number" value={localNumber} />
      <StatusPill label="SMS" value={sms} />
      <StatusPill label="Billing" value={billing} />
    </section>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={statusLabelStyle}>{label}</p>
      <p style={statusValueStyle}>{value}</p>
    </div>
  );
}

/* -------------------------------------------------- Card 1: Business Info */

function BusinessInformationCard({
  token,
  clinic,
  complete,
  onSaved,
}: {
  token: string;
  clinic: BusinessProfileData["clinic"];
  complete: boolean;
  onSaved: (next: { name: string; slug: string | null }) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
      setSaved(true);
      onSaved({ name: String(payload.name ?? clinic.name), slug: json.slug ?? null });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Business Information" badge={complete ? "Complete" : undefined}>
      <form onSubmit={onSubmit} noValidate>
        <Field label="Clinic name" name="name" defaultValue={clinic.name} required />
        <Field label="Main office phone" name="main_phone" defaultValue={clinic.mainPhone} required inputMode="tel" />
        <Field label="ZIP code" name="postal_code" defaultValue={clinic.postalCode} required inputMode="numeric" />
        <Field label="Legal business name" name="legal_business_name" defaultValue={clinic.legalBusinessName} required />
        <Field label="EIN / Tax ID" name="ein_tax_id" defaultValue={clinic.einTaxId} required />
        <Field label="Business type" name="business_type" defaultValue={clinic.businessType} placeholder="e.g. Dental practice" required />
        <Field label="Street address" name="street_address" defaultValue={clinic.streetAddress} required />
        <Field label="City" name="city" defaultValue={clinic.city} required />
        <Field label="State" name="state_region" defaultValue={clinic.stateRegion} placeholder="IL" required />
        <Field label="Website (optional)" name="website" defaultValue={clinic.website} placeholder="https://" inputMode="text" />

        <FormFooter
          error={error}
          saved={saved}
          saving={saving}
          label="Save business information"
          savingLabel="Saving…"
        />
      </form>
    </Card>
  );
}

/* ------------------------------------------------ Card 2: A2P Approval */

function A2pCard({
  token,
  clinicName,
  loginEmail,
  defaultRep,
  defaultMainPhone,
  complete,
  onSaved,
}: {
  token: string;
  clinicName: string;
  loginEmail: string;
  defaultRep: BusinessProfileData["clinic"]["a2p"];
  defaultMainPhone: string;
  complete: boolean;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [authorized, setAuthorized] = useState(defaultRep.authorized);

  const sample = `Hi, this is ${clinicName || "{{clinic_name}}"}. We missed your call. Reply here and our team will follow up. Reply STOP to opt out.`;

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
        business_title: fd.get("business_title"),
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
        setError(json?.error?.message ?? "Could not save A2P information.");
        return;
      }
      setSaved(true);
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
      subtitle="Required for carrier approval before patient SMS can be activated."
      badge={complete ? "Complete" : undefined}
    >
      <form onSubmit={onSubmit} noValidate>
        <Field label="Representative first name" name="rep_first_name" defaultValue={defaultRep.firstName} required />
        <Field label="Representative last name" name="rep_last_name" defaultValue={defaultRep.lastName} required />
        <Field label="Business title" name="business_title" defaultValue={defaultRep.businessTitle} required />
        <Field
          label="Representative email"
          name="rep_email"
          type="email"
          defaultValue={defaultRep.email || loginEmail}
          required
        />
        <Field
          label="Representative phone"
          name="rep_phone"
          defaultValue={defaultRep.phone || defaultMainPhone}
          inputMode="tel"
          required
        />

        <div style={previewBox}>
          <p style={previewLabel}>Use case</p>
          <p style={previewText}>Missed-call follow-up for patients who called the office.</p>
          <p style={{ ...previewLabel, marginTop: 10 }}>Sample message</p>
          <p style={previewText}>{sample}</p>
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

        <FormFooter
          error={error}
          saved={saved}
          saving={saving}
          label="Save A2P information"
          savingLabel="Saving…"
        />
      </form>
    </Card>
  );
}

/* ----------------------------------------- Card 3: Public Business Page */

function PublicBusinessPageCard({
  publicBaseUrl,
  slug,
}: {
  publicBaseUrl: string;
  slug: string | null;
}) {
  if (!slug) {
    return (
      <Card title="Public Business Page">
        <p style={mutedText}>
          Your public business page will appear here once your business information is saved.
        </p>
      </Card>
    );
  }
  const base = `${publicBaseUrl}/business/${slug}`;
  return (
    <Card title="Public Business Page">
      <ul style={linkList}>
        <li><code style={codePill}>/business/{slug}</code></li>
        <li><code style={codePill}>/business/{slug}/privacy</code></li>
        <li><code style={codePill}>/business/{slug}/sms-terms</code></li>
      </ul>
      <div style={buttonRow}>
        <LinkButton href={base}>View business page</LinkButton>
        <LinkButton href={`${base}/privacy`}>View privacy policy</LinkButton>
        <LinkButton href={`${base}/sms-terms`}>View SMS terms</LinkButton>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------- Card 4: Billing */

function BillingCard() {
  return (
    <Card title="Billing">
      <dl style={defList}>
        <Row k="Trial" v="21 days after SMS activation" />
        <Row k="Billing status" v="Not started" />
        <Row k="Plan" v="Missed-call SMS recovery" />
      </dl>
      <div style={buttonRow}>
        <GhostButton disabled title="Available after SMS activation">View billing</GhostButton>
      </div>
    </Card>
  );
}

function BillingHistoryCard() {
  return (
    <Card title="Billing History">
      <p style={mutedText}>No payments yet</p>
      <div style={buttonRow}>
        <GhostButton disabled title="Available after your first payment">View invoices</GhostButton>
      </div>
    </Card>
  );
}

/* ---------------------------------------------- Card 6: Login & Security */

function LoginSecurityCard({ loginEmail }: { loginEmail: string }) {
  return (
    <Card title="Login & Security">
      <dl style={defList}>
        <Row k="Login method" v="Email link" />
        <Row k="Login email" v={loginEmail} />
        <Row k="Password" v="Not created" />
        <Row k="Two-factor authentication" v="Off" />
      </dl>
      <div style={buttonRow}>
        <GhostButton disabled title="Coming soon">Create password</GhostButton>
        <GhostButton disabled title="Coming soon">Set up 2FA</GhostButton>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------- Card 7: Support */

function SupportCard() {
  return (
    <Card title="Support">
      <p style={mutedText}>Need help?</p>
      <div style={buttonRow}>
        <LinkButton href="mailto:support@missedcallsdental.com">Contact support</LinkButton>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------- shared primitives */

function Card({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h3 style={cardTitleStyle}>{title}</h3>
        {badge && <span style={completeBadge}>{badge}</span>}
      </div>
      {subtitle && <p style={cardSubtitleStyle}>{subtitle}</p>}
      <div style={{ marginTop: 14 }}>{children}</div>
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
}) {
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
      <label htmlFor={name} style={labelStyle}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        style={inputStyle}
      />
    </div>
  );
}

function FormFooter({
  error,
  saved,
  saving,
  label,
  savingLabel,
}: {
  error: string | null;
  saved: boolean;
  saving: boolean;
  label: string;
  savingLabel: string;
}) {
  return (
    <>
      {error && (
        <p role="alert" aria-live="polite" style={errorBox}>{error}</p>
      )}
      {saved && !error && (
        <p role="status" aria-live="polite" style={savedBox}>Saved.</p>
      )}
      <button type="submit" disabled={saving} style={primaryBtnStyle}>
        {saving ? savingLabel : label}
      </button>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0" }}>
      <dt style={{ color: "#6b7280", fontSize: 14 }}>{k}</dt>
      <dd style={{ margin: 0, color: "#111827", fontSize: 14, fontWeight: 600, textAlign: "right" }}>{v}</dd>
    </div>
  );
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={secondaryBtnStyle}>
      {children}
    </a>
  );
}

function GhostButton({
  children,
  disabled,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      style={{ ...secondaryBtnStyle, ...(disabled ? disabledBtn : {}) }}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- styles */

const cardStyle: React.CSSProperties = {
  padding: 22,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};
const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  color: "#111827",
  letterSpacing: "-.01em",
};
const cardSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#6b7280",
  fontSize: 13,
};
const statusLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b7280",
  fontSize: 12,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  fontWeight: 700,
};
const statusValueStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#111827",
  fontSize: 15,
  fontWeight: 600,
};
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#111827" };
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
  marginTop: 8,
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
  padding: "9px 14px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  textDecoration: "none",
};
const disabledBtn: React.CSSProperties = {
  color: "#9ca3af",
  borderColor: "#e5e7eb",
  background: "#f9fafb",
  cursor: "not-allowed",
};
const completeBadge: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "#0d9488",
  background: "#ccfbf1",
  border: "1px solid #99f6e4",
  padding: "3px 9px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};
const buttonRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};
const linkList: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 6,
};
const codePill: React.CSSProperties = {
  fontSize: 13,
  color: "#0f172a",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "3px 8px",
};
const defList: React.CSSProperties = { margin: 0 };
const mutedText: React.CSSProperties = { margin: 0, color: "#6b7280", fontSize: 14 };
const previewBox: React.CSSProperties = {
  margin: "6px 0 14px",
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
const previewText: React.CSSProperties = { margin: "4px 0 0", color: "#334155", fontSize: 14 };
const checkboxRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  margin: "4px 0 4px",
  color: "#111827",
  fontSize: 14,
  cursor: "pointer",
};
const errorBox: React.CSSProperties = {
  margin: "12px 0",
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 14,
};
const savedBox: React.CSSProperties = {
  margin: "12px 0",
  padding: "10px 12px",
  borderRadius: 10,
  background: "#f0fdfa",
  border: "1px solid #99f6e4",
  color: "#0f766e",
  fontSize: 14,
};
