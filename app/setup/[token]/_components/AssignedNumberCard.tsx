"use client";

import { StatusBadge, StatusRow, type StatusKind } from "./AccountUI";
import { OwnerLocalNumberSearch } from "./OwnerLocalNumberSearch";
import type { LocalNumberStatus, SmsStatus } from "./account-types";

export function AssignedNumberCard({
  localNumberStatus,
  smsStatus,
  assignedPhone,
  areaCode,
  postalCode,
  hasPaymentMethod,
  onGoToBilling,
}: {
  localNumberStatus: LocalNumberStatus;
  smsStatus: SmsStatus;
  assignedPhone: string | null;
  areaCode: string | null;
  postalCode: string | null;
  hasPaymentMethod: boolean;
  onGoToBilling: () => void;
}) {
  const numberAssigned =
    localNumberStatus === "assigned" || localNumberStatus === "reserved" || Boolean(assignedPhone);

  const voiceKind: StatusKind = numberAssigned
    ? "active"
    : hasPaymentMethod
      ? "pending"
      : "not_active";

  const smsKind: StatusKind =
    smsStatus === "active"
      ? "active"
      : smsStatus === "waiting_for_approval"
        ? "waiting"
        : numberAssigned || hasPaymentMethod
          ? "pending"
          : "not_active";

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div className="acct-number">
        <span className="t-eyebrow">Assigned phone number</span>
        {assignedPhone ? (
          <p className="t-h3 t-mono" style={{ margin: "var(--space-1) 0 0" }}>{assignedPhone}</p>
        ) : (
          <p className="t-body" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
            Not assigned yet
          </p>
        )}
      </div>

      <div className="acct-callout">
        <p className="t-body" style={{ margin: 0 }}>
          We&apos;ll look for a local number near your office.
        </p>
        <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
          <StatusRow label="Area code">
            <span className="t-mono">{areaCode || "Not available"}</span>
          </StatusRow>
          <StatusRow label="ZIP code">
            <span className="t-mono">{postalCode || "Not available"}</span>
          </StatusRow>
        </div>
      </div>

      <OwnerLocalNumberSearch
        hasPaymentMethod={hasPaymentMethod}
        onGoToBilling={onGoToBilling}
      />

      <div>
        <StatusRow label="Voice / Calls">
          <StatusBadge kind={voiceKind} />
        </StatusRow>
        <StatusRow label="SMS / Texting">
          <StatusBadge kind={smsKind} />
        </StatusRow>
      </div>
    </div>
  );
}
