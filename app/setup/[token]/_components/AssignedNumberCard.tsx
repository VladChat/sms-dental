"use client";

import { Badge, StatusRow, type BadgeTone } from "./AccountUI";
import type { LocalNumberStatus, SmsStatus } from "./account-types";

export function AssignedNumberCard({
  localNumberStatus,
  smsStatus,
}: {
  localNumberStatus: LocalNumberStatus;
  smsStatus: SmsStatus;
}) {
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
