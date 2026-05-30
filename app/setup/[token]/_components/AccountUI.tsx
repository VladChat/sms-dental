"use client";

import { useState } from "react";

/* Shared building blocks for the customer-facing account setup page.
   These use the global design-system classes (.card, .field, .input, .btn,
   .badge, .alert) so the account page matches the rest of the product. */

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "info";

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** A top-level account section rendered as a card with a header + badge. */
export function Section({
  id,
  title,
  description,
  badge,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  badge?: { tone: BadgeTone; label: string };
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="card card-pad acct-section" aria-labelledby={`${id}-title`}>
      <header className="acct-section-head">
        <div>
          <h2 id={`${id}-title`} className="t-h3">{title}</h2>
          {description && (
            <p className="t-small" style={{ marginTop: "var(--space-1)" }}>{description}</p>
          )}
        </div>
        {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
      </header>
      {children}
    </section>
  );
}

/** A standard labelled text input with helper + near-field error. */
export function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  optional = false,
  placeholder,
  inputMode,
  autoComplete,
  helper,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
  helper?: string;
  error?: string;
}) {
  const helperId = helper ? `${name}-help` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
        {optional && <span className="t-helper"> (optional)</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete ?? "off"}
        aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        spellCheck={false}
      />
      {helper && <p id={helperId} className="helper">{helper}</p>}
      {error && (
        <p id={errorId} className="helper" role="alert" style={{ color: "var(--error-text)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** A labelled select whose stored value is always the exact option value. */
export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  helper,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  helper?: string;
  error?: string;
}) {
  const helperId = helper ? `${name}-help` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {helper && <p id={helperId} className="helper">{helper}</p>}
      {error && (
        <p id={errorId} className="helper" role="alert" style={{ color: "var(--error-text)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** A read-only field shown as a locked input (e.g. login email). */
export function ReadonlyField({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input acct-readonly" value={value} readOnly aria-readonly="true" tabIndex={-1} />
      {helper && <p className="helper">{helper}</p>}
    </div>
  );
}

/** Submit button + inline saved/error status for a form. */
export function SaveBar({
  label,
  saving,
  savedAt,
  error,
}: {
  label: string;
  saving: boolean;
  savedAt: string | null;
  error: string | null;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      {error && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{error}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : label}
        </button>
        {savedAt && !error && (
          <span role="status" aria-live="polite" className="t-small" style={{ color: "var(--success-text)" }}>
            Saved · {savedAt}
          </span>
        )}
      </div>
    </div>
  );
}

/** A read-only status row: label on the left, value/badge on the right. */
export function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="acct-statusrow">
      <span className="t-small" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>{children}</span>
    </div>
  );
}

/** A row in the "What we'll submit" review summary. */
export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="acct-review-row">
      <dt>{label}</dt>
      <dd>{value || <span style={{ color: "var(--text-muted)" }}>Not provided yet</span>}</dd>
    </div>
  );
}

/** A generated compliance document row with View + Copy actions. */
export function DocRow({ label, url }: { label: string; url: string }) {
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
    <div className="acct-doc-row">
      <span style={{ fontWeight: 600, color: "var(--text)" }}>{label}</span>
      <span style={{ display: "inline-flex", gap: "var(--space-2)" }}>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
          View
        </a>
        <button type="button" onClick={copy} className="btn btn-secondary btn-sm">
          {copied ? "Copied" : "Copy link"}
        </button>
      </span>
    </div>
  );
}

export function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
