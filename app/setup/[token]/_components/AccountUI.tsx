"use client";

/* Shared building blocks for the customer-facing account setup dashboard.
   These use the global design-system classes (.card, .field, .input, .btn,
   .badge, .alert) so the dashboard matches the rest of the product. */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "info" | "error";

/* -------------------------------------------------- unified status system */
/* One consistent vocabulary used in the left nav, panel headers, status rows,
   phone-number service statuses, and billing. Calm colors: green = done,
   amber = needs action, blue = informational in-progress, gray = idle. Red is
   reserved for real errors only. */

export type StatusKind =
  | "complete"
  | "active"
  | "waiting"
  | "pending"
  | "needs_setup"
  | "needs_action"
  | "not_started"
  | "not_active"
  | "error";

type StatusIconName = "check" | "clock" | "alert" | "dot";

// Calm, professional vocabulary. `needs_setup` (amber dot) is the default for
// "not finished yet" setup states — it is intentionally softer than
// `needs_action` (amber alert), which is reserved for states that genuinely ask
// the owner to act now (e.g. trial ended). Red (`error`) is for real errors only.
const STATUS_META: Record<StatusKind, { label: string; tone: BadgeTone; icon: StatusIconName }> = {
  complete: { label: "Complete", tone: "success", icon: "check" },
  active: { label: "Active", tone: "success", icon: "check" },
  waiting: { label: "Waiting for approval", tone: "info", icon: "clock" },
  pending: { label: "Pending", tone: "neutral", icon: "clock" },
  needs_setup: { label: "Needs setup", tone: "warning", icon: "dot" },
  needs_action: { label: "Needs action", tone: "warning", icon: "alert" },
  not_started: { label: "Not started", tone: "neutral", icon: "dot" },
  not_active: { label: "Not active", tone: "neutral", icon: "dot" },
  error: { label: "Error", tone: "error", icon: "alert" },
};

function StatusIcon({ name }: { name: StatusIconName }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "check":
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "dot":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}

export function StatusBadge({ kind, label }: { kind: StatusKind; label?: string }) {
  const m = STATUS_META[kind];
  return (
    <span className={`badge badge-${m.tone}`}>
      <StatusIcon name={m.icon} />
      {label ?? m.label}
    </span>
  );
}

/** Compact colored status icon for the left nav (no text label). */
export function NavStatusIcon({ kind }: { kind: StatusKind }) {
  const m = STATUS_META[kind];
  return (
    <span className={`acct-nav-status tone-${m.tone}`} title={m.label} aria-hidden="true">
      <StatusIcon name={m.icon} />
    </span>
  );
}

/** A top-level dashboard section: a card with a header, optional status, body. */
export function Section({
  id,
  title,
  description,
  status,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  status?: { kind: StatusKind; label?: string };
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
        {status && <StatusBadge kind={status.kind} label={status.label} />}
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
  onBlur,
  type = "text",
  required = false,
  optional = false,
  placeholder,
  inputMode,
  autoComplete,
  helper,
  error,
}: {
  label: ReactNode;
  name: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
  helper?: ReactNode;
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
        onBlur={onBlur}
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
  onBlur,
  options,
  placeholder,
  required = false,
  helper,
  error,
}: {
  label: ReactNode;
  name: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  helper?: ReactNode;
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
        onBlur={onBlur}
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
    <div className="acct-action-stack">
      {error && (
        <div className="alert alert-error" role="alert" aria-live="polite">
          <span>{error}</span>
        </div>
      )}
      <div className="acct-action-stack">
        <button type="submit" className="btn btn-primary acct-primary-action" disabled={saving}>
          {saving ? "Saving…" : label}
        </button>
        {savedAt && !error && (
          <span role="status" aria-live="polite" className="t-small acct-savebar-status">
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

export function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * A small circular question-mark info control with an accessible tooltip. Works
 * with mouse hover, keyboard focus, and click/tap (not hover-only). Closes on
 * Escape and on outside click. The visible icon is small but the hit target stays
 * touch-friendly. Uses semantic design tokens (no hard-coded colors).
 */
export function InfoTooltip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [open]);

  return (
    <span
      className="acct-tooltip"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="acct-tooltip-btn"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            e.currentTarget.blur();
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" />
          <path d="M12 17h.01" />
        </svg>
      </button>
      {open && (
        <span role="tooltip" id={tooltipId} className="acct-tooltip-pop">
          {text}
        </span>
      )}
    </span>
  );
}
