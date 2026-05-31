"use client";

import { StatusBadge, StatusRow, type StatusKind } from "./AccountUI";
import type { LocalNumberStatus, SmsStatus } from "./account-types";

export function AssignedNumberCard({
  localNumberStatus,
  smsStatus,
  assignedPhone,
  hasPaymentMethod,
}: {
  localNumberStatus: LocalNumberStatus;
  smsStatus: SmsStatus;
  assignedPhone: string | null;
  hasPaymentMethod: boolean;
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

      <div>
        <StatusRow label="Voice / Calls">
          <StatusBadge kind={voiceKind} />
        </StatusRow>
        <StatusRow label="SMS / Texting">
          <StatusBadge kind={smsKind} />
        </StatusRow>
      </div>

      {!hasPaymentMethod && (
        <div className="acct-callout">
          <p className="t-body" style={{ margin: 0 }}>
            Add a payment method to receive your phone number.
          </p>
          <p className="t-small" style={{ margin: 0, color: "var(--text-muted)" }}>
            You will not be charged until SMS recovery is active and your trial period ends.
          </p>
        </div>
      )}
    </div>
  );
}
