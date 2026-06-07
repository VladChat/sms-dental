"use client";

import { useId, useState, type ReactNode } from "react";

export type ConfirmationSummaryRow = {
  label: string;
  value: string;
  emphasis?: boolean;
};

export function ConfirmationDialog({
  title,
  description,
  summaryLabel,
  summaryRows = [],
  checkboxLabel,
  checkboxRequired = false,
  primaryLabel,
  secondaryLabel = "Cancel",
  loading = false,
  pending = false,
  loadingLabel = "Starting...",
  pendingLabel = "Confirming...",
  error,
  onConfirm,
  onCancel,
  children,
  primaryDisabled: externalPrimaryDisabled,
  actionsLayout = "inline",
  primaryClassName = "btn btn-primary",
}: {
  title: string;
  description?: string;
  summaryLabel?: string;
  summaryRows?: ConfirmationSummaryRow[];
  checkboxLabel?: string;
  checkboxRequired?: boolean;
  primaryLabel: string;
  secondaryLabel?: string;
  loading?: boolean;
  pending?: boolean;
  loadingLabel?: string;
  pendingLabel?: string;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
  primaryDisabled?: boolean;
  actionsLayout?: "inline" | "stacked";
  primaryClassName?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [checked, setChecked] = useState(false);
  const isPrimaryDisabled = loading || pending || (checkboxRequired && !checked) || (externalPrimaryDisabled ?? false);
  const closeDisabled = loading || pending;

  return (
    <div
      className="acct-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!closeDisabled) onCancel();
      }}
    >
      <div
        className="acct-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <h3 id={titleId} className="t-h4">{title}</h3>
          {description && (
            <p id={descriptionId} className="t-small" style={{ margin: 0 }}>
              {description}
            </p>
          )}
        </div>

        {summaryRows.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: "var(--space-2)",
              padding: "var(--space-4)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
            }}
          >
            {summaryLabel && <p className="t-eyebrow" style={{ margin: 0 }}>{summaryLabel}</p>}
            {summaryRows.map((row, index) => (
              <SummaryRow key={`${row.label}-${index}`} {...row} />
            ))}
          </div>
        )}

        {children}

        <div style={{ display: "grid", gap: "var(--space-3)", paddingTop: "var(--space-2)" }}>
          {checkboxLabel && (
            <label className="check">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                disabled={loading || pending}
              />
              <span>{checkboxLabel}</span>
            </label>
          )}
          {pending && (
            <div className="alert alert-info" role="status" aria-live="polite">
              <span>Your paid plan is being confirmed. This can take a few seconds.</span>
            </div>
          )}
          {error && (
            <div className="alert alert-error" role="alert" aria-live="polite">
              <span>{error}</span>
            </div>
          )}
          {actionsLayout === "stacked" ? (
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              <button
                type="button"
                className={primaryClassName}
                onClick={onConfirm}
                disabled={isPrimaryDisabled}
                aria-busy={loading || pending}
              >
                {loading ? loadingLabel : pending ? pendingLabel : primaryLabel}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ justifySelf: "center" }}
                onClick={onCancel}
                disabled={closeDisabled}
              >
                {secondaryLabel}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={closeDisabled}>
                {secondaryLabel}
              </button>
              <button
                type="button"
                className={primaryClassName}
                onClick={onConfirm}
                disabled={isPrimaryDisabled}
                aria-busy={loading || pending}
              >
                {loading ? loadingLabel : pending ? pendingLabel : primaryLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, emphasis = false }: ConfirmationSummaryRow) {
  return (
    <>
      {emphasis && <div className="divider" />}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)" }}>
        <span
          className={emphasis ? "t-body" : "t-small"}
          style={{ margin: 0, fontWeight: emphasis ? 800 : 600, color: "var(--text)" }}
        >
          {label}:
        </span>
        <span
          className={emphasis ? "t-h4" : "t-small"}
          style={{ margin: 0, fontWeight: emphasis ? 800 : 700, color: "var(--text)" }}
        >
          {value}
        </span>
      </div>
    </>
  );
}
