// Single source of truth for account notification TYPES and their labels.
//
// Safe to import from BOTH server and client code: no secrets, no environment
// reads, no Node-only dependencies. The account UI, the API validation, and the
// DB defaults all read from here so notification types are never duplicated
// across the codebase.
//
// Scope (v1): account-level notification PREFERENCES only — which alerts an
// owner/admin wants to receive. There is no delivery here (no email, no SMS, no
// jobs) and no usage evaluation. Those land in later, explicitly-approved work.
//
// Extensibility: add a new group to NOTIFICATION_GROUPS and a new type to
// NOTIFICATION_TYPES. Keep amounts/limits out of this file — when copy needs an
// included-usage number, derive it from billingConfig (the billing
// source-of-truth) so there is never a second source of truth for billing
// numbers.

import { billingConfig, formatInteger } from "./billing.config";

// Every notification type the product currently knows about. Adding a value here
// (plus a row in NOTIFICATION_TYPES) is all it takes to introduce a new alert.
export type NotificationType =
  | "ai_answered_minutes_90_percent"
  | "ai_answered_minutes_100_percent";

// Display groups in the account UI. A group is purely presentational — it bundles
// related notification types under one heading.
export type NotificationGroupId = "ai_answered_call_minutes";

export type NotificationGroupDef = {
  id: NotificationGroupId;
  title: string;
  // Plain, channel-agnostic helper text. Must not promise a delivery channel.
  description: string;
};

export type NotificationTypeDef = {
  type: NotificationType;
  group: NotificationGroupId;
  // Real, human-readable checkbox label.
  label: string;
  // Default state for a clinic that has not saved a preference yet. v1 alerts
  // default ON; an owner can turn any of them off. There is no "mandatory" /
  // "cannot disable" concept.
  defaultEnabled: boolean;
};

export const NOTIFICATION_GROUPS: readonly NotificationGroupDef[] = [
  {
    id: "ai_answered_call_minutes",
    title: "AI answered call minutes",
    description:
      "AI answered call minute alerts are based on the included minutes in your plan.",
  },
] as const;

export const NOTIFICATION_TYPES: readonly NotificationTypeDef[] = [
  {
    type: "ai_answered_minutes_90_percent",
    group: "ai_answered_call_minutes",
    label: "Notify me when AI answered call minutes reach 90%",
    defaultEnabled: true,
  },
  {
    type: "ai_answered_minutes_100_percent",
    group: "ai_answered_call_minutes",
    label: "Notify me when AI answered call minutes reach 100%",
    defaultEnabled: true,
  },
] as const;

// Fast membership check used by API validation: only known types are ever saved.
const NOTIFICATION_TYPE_SET = new Set<string>(NOTIFICATION_TYPES.map((t) => t.type));

export function isKnownNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && NOTIFICATION_TYPE_SET.has(value);
}

export function listNotificationTypes(): NotificationType[] {
  return NOTIFICATION_TYPES.map((t) => t.type);
}

// The default preference map (every known type → its default enabled state).
// The read path returns this when a clinic has saved nothing yet, and the UI
// uses it before the saved preferences load.
export function defaultNotificationPreferences(): Record<NotificationType, boolean> {
  const out = {} as Record<NotificationType, boolean>;
  for (const t of NOTIFICATION_TYPES) out[t.type] = t.defaultEnabled;
  return out;
}

// Included AI answered call minutes, formatted for copy (e.g. "100"). Derived
// from the billing source of truth so the number is never duplicated here.
export function includedAiAnsweredMinutesLabel(): string {
  return formatInteger(billingConfig.basePlan.includedAiAnsweredCallMinutes);
}
