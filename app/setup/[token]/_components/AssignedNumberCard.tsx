"use client";

import { StatusBadge, StatusRow, type StatusKind } from "./AccountUI";
import { OwnerLocalNumberSearch } from "./OwnerLocalNumberSearch";
import type { LocalNumberStatus, SmsStatus, RequestedNumberSummary } from "./account-types";

export function AssignedNumberCard({
  localNumberStatus,
  smsStatus,
  assignedPhone,
  areaCode,
  postalCode,
  hasPaymentMethod,
  onGoToBilling,
  requestedNumber,
}: {
  localNumberStatus: LocalNumberStatus;
  smsStatus: SmsStatus;
  assignedPhone: string | null;
  areaCode: string | null;
  postalCode: string | null;
  hasPaymentMethod: boolean;
  onGoToBilling: () => void;
  requestedNumber: RequestedNumberSummary | null;
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

      {requestedNumber && (
        <div className="acct-number">
          <span className="t-eyebrow">Requested number</span>
          <p className="t-h4 t-mono" style={{ margin: "var(--space-1) 0 0" }}>
            {formatUsPhone(requestedNumber.phoneNumber)}
          </p>
          {requestedNumber.locality && (
            <p className="t-small" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
              {[requestedNumber.locality, requestedNumber.region].filter(Boolean).join(", ")}
            </p>
          )}
          <div style={{ marginTop: "var(--space-2)" }}>
            <StatusBadge kind={requestedStatusKind(requestedNumber.status)} label={requestedStatusLabel(requestedNumber.status)} />
          </div>
          <p className="t-helper" style={{ margin: "var(--space-2) 0 0", color: "var(--text-muted)" }}>
            No number has been purchased or assigned yet.
          </p>
        </div>
      )}

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
        requestedNumberE164={requestedNumber?.phoneNumber ?? null}
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

// Format a +1NXXNXXXXXX number as (NXX) NXX-XXXX for display; pass through otherwise.
function formatUsPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

function requestedStatusLabel(status: string): string {
  switch (status) {
    case "pending": return "Pending review";
    case "reviewed": return "In review";
    case "fulfilled": return "Completed";
    case "rejected": return "Not available";
    case "cancelled": return "Superseded";
    default: return status;
  }
}

function requestedStatusKind(status: string): StatusKind {
  switch (status) {
    case "fulfilled": return "complete";
    case "rejected":
    case "cancelled": return "not_active";
    default: return "waiting";
  }
}
