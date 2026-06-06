"use client";

import type { CSSProperties } from "react";
import {
  localNumberBreakdown,
  tollFreeNumberBreakdown,
  type NumberPriceGroup,
} from "../../../../config/billing.config";

// Step 1 of the add-number flow: choose Toll-free or Local. Each card shows a
// short explanation and the exact pricing breakdown from billing config (the UI
// never hard-codes amounts). No "free" wording anywhere.

const GRID: CSSProperties = {
  display: "grid",
  gap: "var(--space-4)",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

export function NumberTypeChooser({
  onChoose,
  onCancel,
}: {
  onChoose: (type: "toll_free" | "local") => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <div className="acct-search-head">
        <h3 className="t-h4">Add a number</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Hide
        </button>
      </div>
      <p className="t-small" style={{ margin: 0, color: "var(--text-muted)" }}>
        Choose the type of number to add.
      </p>

      <div style={GRID}>
        <TypeCard
          badgeClass="badge-info"
          badgeLabel="Toll-free"
          title="Toll-free number"
          explanation="Easier to launch. Patients see an 833/844/855/866/877/888-style number."
          groups={tollFreeNumberBreakdown()}
          ctaLabel="Choose toll-free"
          onChoose={() => onChoose("toll_free")}
        />
        <TypeCard
          badgeClass="badge-neutral"
          badgeLabel="Local"
          title="Local number"
          explanation="Local area code. Requires carrier registration and A2P 10DLC approval."
          groups={localNumberBreakdown()}
          ctaLabel="Choose local"
          onChoose={() => onChoose("local")}
        />
      </div>
    </div>
  );
}

function TypeCard({
  badgeClass,
  badgeLabel,
  title,
  explanation,
  groups,
  ctaLabel,
  onChoose,
}: {
  badgeClass: string;
  badgeLabel: string;
  title: string;
  explanation: string;
  groups: NumberPriceGroup[];
  ctaLabel: string;
  onChoose: () => void;
}) {
  return (
    <div className="acct-number" style={{ display: "grid", gap: "var(--space-3)" }}>
      <div>
        <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
        <p className="t-h4" style={{ margin: "var(--space-2) 0 0" }}>{title}</p>
        <p className="t-small" style={{ margin: "var(--space-1) 0 0", color: "var(--text-secondary)" }}>
          {explanation}
        </p>
      </div>

      <NumberBreakdown groups={groups} />

      <button type="button" className="btn btn-primary acct-primary-action" onClick={onChoose}>
        {ctaLabel}
      </button>
    </div>
  );
}

// Shared breakdown renderer. Each row: label on the left, price on the right.
export function NumberBreakdown({ groups }: { groups: NumberPriceGroup[] }) {
  return (
    <div style={{ display: "grid", gap: "var(--space-2)" }}>
      {groups.map((group, gi) => (
        <div key={group.heading ?? `g${gi}`} style={{ display: "grid", gap: "var(--space-1)" }}>
          {group.heading && (
            <p className="t-eyebrow" style={{ margin: 0 }}>{group.heading}</p>
          )}
          <dl className="acct-rows" style={{ margin: 0 }}>
            {group.rows.map((row) => (
              <div
                key={row.label}
                style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}
              >
                <dt className="t-small" style={{ color: "var(--text-secondary)" }}>{row.label}</dt>
                <dd className="t-small" style={{ margin: 0, fontWeight: 600, textAlign: "right" }}>
                  {row.price}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
