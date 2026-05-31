"use client";

import { Badge, StatusRow, type BadgeTone } from "./AccountUI";
import type { LocalNumberStatus, SmsStatus } from "./account-types";

export function AssignedNumberCard({
  localNumberStatus,
  smsStatus,
  hasPaymentMethod,
  onAddPaymentMethod,
}: {
  localNumberStatus: LocalNumberStatus;
  smsStatus: SmsStatus;
  hasPaymentMethod: boolean;
  onAddPaymentMethod: () => void;
}) {
  // A payment method must be on file before we prepare or assign a number.
  if (!hasPaymentMethod) {
    return (
      <div className="acct-callout">
        <StatusRow label="Status">
          <Badge tone="warning">Payment method needed</Badge>
        </StatusRow>
        <p className="t-body" style={{ margin: 0 }}>
          Add a payment method to receive your phone number.
        </p>
        <p className="t-small" style={{ margin: 0, color: "var(--text-muted)" }}>
          You will not be charged until SMS recovery is active and your trial period ends.
        </p>
        <div>
          <button type="button" className="btn btn-primary" onClick={onAddPaymentMethod}>
            Add payment method
          </button>
        </div>
      </div>
    );
  }

  const numberAssigned = localNumberStatus === "assigned" || localNumberStatus === "reserved";
  const numberLabel =
    localNumberStatus === "assigned"
      ? "Assigned"
      : localNumberStatus === "reserved"
        ? "Reserved"
        : "Preparing your number";

  const voice: { tone: BadgeTone; label: string } = numberAssigned
    ? { tone: "success", label: "Active" }
    : { tone: "neutral", label: "Pending" };

  const sms: { tone: BadgeTone; label: string } =
    smsStatus === "active"
      ? { tone: "success", label: "Active" }
      : smsStatus === "waiting_for_approval"
        ? { tone: "info", label: "Waiting for approval" }
        : { tone: "neutral", label: "Not started" };

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div className="acct-number">
        <span className="t-eyebrow">Your number</span>
        <p className="t-h3" style={{ margin: "var(--space-1) 0 0" }}>{numberLabel}</p>
      </div>
      <div>
        <StatusRow label="Voice / Calls">
          <Badge tone={voice.tone}>{voice.label}</Badge>
        </StatusRow>
        <StatusRow label="SMS / Texting">
          <Badge tone={sms.tone}>{sms.label}</Badge>
        </StatusRow>
      </div>
    </div>
  );
}
