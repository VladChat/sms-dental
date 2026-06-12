// Pure anti-spam / automation-pause decisions for conversation auto-replies.
//
// Business rule: once automation has ENDED for a recovery cycle (max replies
// reached or no eligible follow-up remains), ordinary inbound SMS that get no
// automated response are counted. At the mute threshold automation pauses for a
// fixed number of hours; at the high-volume threshold the conversation is
// flagged. Inbound messages are ALWAYS still recorded, STOP/START/HELP keeps
// working, and nothing here blocks the phone number permanently.
//
// No DB and no Twilio here — unit-testable decisions only.

export const DEFAULT_UNANSWERED_MUTE_AFTER = 6;
export const DEFAULT_UNANSWERED_HIGH_VOLUME_AFTER = 10;
export const DEFAULT_AUTOMATION_MUTE_HOURS = 24;

export const AUTOMATION_VOLUME_BOUNDS = {
  muteAfter: { min: 1, max: 100 },
  highVolumeAfter: { min: 1, max: 200 },
  muteHours: { min: 1, max: 168 },
} as const;

export type AutomationVolumeSettings = {
  unansweredMuteAfter: number;
  unansweredHighVolumeAfter: number;
  automationMuteHours: number;
};

export type AutomationVolumeSettingsInput = {
  unansweredMuteAfter?: number | null;
  unansweredHighVolumeAfter?: number | null;
  automationMuteHours?: number | null;
};

export function defaultAutomationVolumeSettings(): AutomationVolumeSettings {
  return {
    unansweredMuteAfter: DEFAULT_UNANSWERED_MUTE_AFTER,
    unansweredHighVolumeAfter: DEFAULT_UNANSWERED_HIGH_VOLUME_AFTER,
    automationMuteHours: DEFAULT_AUTOMATION_MUTE_HOURS,
  };
}

// NULL/missing values mean "use the current code default".
export function resolveAutomationVolumeSettings(
  input?: AutomationVolumeSettingsInput | null,
): AutomationVolumeSettings {
  return {
    unansweredMuteAfter: input?.unansweredMuteAfter ?? DEFAULT_UNANSWERED_MUTE_AFTER,
    unansweredHighVolumeAfter:
      input?.unansweredHighVolumeAfter ?? DEFAULT_UNANSWERED_HIGH_VOLUME_AFTER,
    automationMuteHours: input?.automationMuteHours ?? DEFAULT_AUTOMATION_MUTE_HOURS,
  };
}

export function isAutomationVolumeCustomized(input?: AutomationVolumeSettingsInput | null): boolean {
  const resolved = resolveAutomationVolumeSettings(input);
  const defaults = defaultAutomationVolumeSettings();
  return (
    resolved.unansweredMuteAfter !== defaults.unansweredMuteAfter ||
    resolved.unansweredHighVolumeAfter !== defaults.unansweredHighVolumeAfter ||
    resolved.automationMuteHours !== defaults.automationMuteHours
  );
}

export type AutomationVolumeValidation =
  | { ok: true; value: AutomationVolumeSettings }
  | { ok: false; message: string };

// Server-side validation for admin-submitted thresholds. The cross-field rule
// (highVolumeAfter >= muteAfter) is enforced here rather than as a DB
// cross-column constraint.
export function validateAutomationVolumeSettings(input: {
  unansweredMuteAfter: unknown;
  unansweredHighVolumeAfter: unknown;
  automationMuteHours: unknown;
}): AutomationVolumeValidation {
  const muteAfter = toBoundedInt(
    input.unansweredMuteAfter,
    AUTOMATION_VOLUME_BOUNDS.muteAfter.min,
    AUTOMATION_VOLUME_BOUNDS.muteAfter.max,
  );
  if (muteAfter === null) {
    return {
      ok: false,
      message: `Pause automation after must be between ${AUTOMATION_VOLUME_BOUNDS.muteAfter.min} and ${AUTOMATION_VOLUME_BOUNDS.muteAfter.max} unanswered messages.`,
    };
  }
  const highVolumeAfter = toBoundedInt(
    input.unansweredHighVolumeAfter,
    AUTOMATION_VOLUME_BOUNDS.highVolumeAfter.min,
    AUTOMATION_VOLUME_BOUNDS.highVolumeAfter.max,
  );
  if (highVolumeAfter === null) {
    return {
      ok: false,
      message: `High-volume flag must be between ${AUTOMATION_VOLUME_BOUNDS.highVolumeAfter.min} and ${AUTOMATION_VOLUME_BOUNDS.highVolumeAfter.max} unanswered messages.`,
    };
  }
  if (highVolumeAfter < muteAfter) {
    return {
      ok: false,
      message: "The high-volume flag threshold can't be lower than the pause threshold.",
    };
  }
  const muteHours = toBoundedInt(
    input.automationMuteHours,
    AUTOMATION_VOLUME_BOUNDS.muteHours.min,
    AUTOMATION_VOLUME_BOUNDS.muteHours.max,
  );
  if (muteHours === null) {
    return {
      ok: false,
      message: `Pause duration must be between ${AUTOMATION_VOLUME_BOUNDS.muteHours.min} and ${AUTOMATION_VOLUME_BOUNDS.muteHours.max} hours.`,
    };
  }
  return {
    ok: true,
    value: {
      unansweredMuteAfter: muteAfter,
      unansweredHighVolumeAfter: highVolumeAfter,
      automationMuteHours: muteHours,
    },
  };
}

function toBoundedInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

export type AutomationVolumeState = {
  unansweredAfterAutomationCount: number;
  automationMutedUntil: string | null; // ISO timestamp
  highVolumeFlaggedAt: string | null; // ISO timestamp
};

export function isAutomationMuted(
  state: Pick<AutomationVolumeState, "automationMutedUntil"> | null | undefined,
  now: Date,
): boolean {
  const until = state?.automationMutedUntil;
  if (!until) return false;
  const ts = Date.parse(until);
  return Number.isFinite(ts) && ts > now.getTime();
}

// Only these auto-reply skip reasons mean "automation has ended for this
// cycle" — the inbound got no automated answer because the cycle ran out of
// follow-ups, not because of gates, keywords, duplicates, or simple
// thanks/ack/negative classifications.
const UNANSWERED_REASONS = new Set(["max_auto_replies_reached", "template_disabled"]);

export function reasonCountsAsUnanswered(reason: string | null | undefined): boolean {
  return !!reason && UNANSWERED_REASONS.has(reason);
}

// Pure threshold evaluation for one newly counted unanswered inbound.
// `shouldMute` re-arms only when no mute is currently active so an active mute
// is never shortened or extended mid-window.
export function evaluateUnansweredInbound(input: {
  currentCount: number;
  settings: AutomationVolumeSettings;
  alreadyMuted: boolean;
  alreadyFlaggedHighVolume: boolean;
}): { nextCount: number; shouldMute: boolean; shouldFlagHighVolume: boolean } {
  const nextCount = Math.max(0, input.currentCount) + 1;
  return {
    nextCount,
    shouldMute: nextCount >= input.settings.unansweredMuteAfter && !input.alreadyMuted,
    shouldFlagHighVolume:
      nextCount >= input.settings.unansweredHighVolumeAfter && !input.alreadyFlaggedHighVolume,
  };
}
