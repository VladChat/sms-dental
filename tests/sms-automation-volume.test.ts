import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTOMATION_VOLUME_BOUNDS,
  DEFAULT_AUTOMATION_MUTE_HOURS,
  DEFAULT_UNANSWERED_HIGH_VOLUME_AFTER,
  DEFAULT_UNANSWERED_MUTE_AFTER,
  defaultAutomationVolumeSettings,
  evaluateUnansweredInbound,
  isAutomationMuted,
  isAutomationVolumeCustomized,
  reasonCountsAsUnanswered,
  resolveAutomationVolumeSettings,
  validateAutomationVolumeSettings,
} from "../lib/sms-recovery/automation-volume-limits";

test("anti-spam defaults are 6 unanswered -> pause, 24h mute, 10 -> high-volume", () => {
  assert.equal(DEFAULT_UNANSWERED_MUTE_AFTER, 6);
  assert.equal(DEFAULT_UNANSWERED_HIGH_VOLUME_AFTER, 10);
  assert.equal(DEFAULT_AUTOMATION_MUTE_HOURS, 24);
  assert.deepEqual(defaultAutomationVolumeSettings(), {
    unansweredMuteAfter: 6,
    unansweredHighVolumeAfter: 10,
    automationMuteHours: 24,
  });
});

test("NULL/missing settings resolve to code defaults; custom values stick", () => {
  assert.deepEqual(resolveAutomationVolumeSettings(null), defaultAutomationVolumeSettings());
  assert.deepEqual(resolveAutomationVolumeSettings({}), defaultAutomationVolumeSettings());
  assert.deepEqual(
    resolveAutomationVolumeSettings({
      unansweredMuteAfter: null,
      unansweredHighVolumeAfter: null,
      automationMuteHours: null,
    }),
    defaultAutomationVolumeSettings(),
  );
  assert.deepEqual(
    resolveAutomationVolumeSettings({ unansweredMuteAfter: 3, automationMuteHours: 48 }),
    { unansweredMuteAfter: 3, unansweredHighVolumeAfter: 10, automationMuteHours: 48 },
  );
  assert.equal(isAutomationVolumeCustomized(null), false);
  assert.equal(isAutomationVolumeCustomized({ unansweredMuteAfter: 6 }), false);
  assert.equal(isAutomationVolumeCustomized({ unansweredMuteAfter: 3 }), true);
});

test("validation accepts in-bounds settings and rejects invalid ones", () => {
  assert.deepEqual(
    validateAutomationVolumeSettings({
      unansweredMuteAfter: 6,
      unansweredHighVolumeAfter: 10,
      automationMuteHours: 24,
    }),
    { ok: true, value: { unansweredMuteAfter: 6, unansweredHighVolumeAfter: 10, automationMuteHours: 24 } },
  );
  // Bounds.
  assert.equal(validateAutomationVolumeSettings({ unansweredMuteAfter: 0, unansweredHighVolumeAfter: 10, automationMuteHours: 24 }).ok, false);
  assert.equal(validateAutomationVolumeSettings({ unansweredMuteAfter: 101, unansweredHighVolumeAfter: 150, automationMuteHours: 24 }).ok, false);
  assert.equal(validateAutomationVolumeSettings({ unansweredMuteAfter: 6, unansweredHighVolumeAfter: 201, automationMuteHours: 24 }).ok, false);
  assert.equal(validateAutomationVolumeSettings({ unansweredMuteAfter: 6, unansweredHighVolumeAfter: 10, automationMuteHours: 0 }).ok, false);
  assert.equal(validateAutomationVolumeSettings({ unansweredMuteAfter: 6, unansweredHighVolumeAfter: 10, automationMuteHours: 169 }).ok, false);
  // Cross-field: highVolumeAfter >= muteAfter.
  assert.equal(validateAutomationVolumeSettings({ unansweredMuteAfter: 10, unansweredHighVolumeAfter: 6, automationMuteHours: 24 }).ok, false);
  assert.equal(validateAutomationVolumeSettings({ unansweredMuteAfter: 10, unansweredHighVolumeAfter: 10, automationMuteHours: 24 }).ok, true);
  // Types.
  assert.equal(validateAutomationVolumeSettings({ unansweredMuteAfter: "6", unansweredHighVolumeAfter: 10, automationMuteHours: 24 }).ok, false);
  assert.equal(validateAutomationVolumeSettings({ unansweredMuteAfter: 6.5, unansweredHighVolumeAfter: 10, automationMuteHours: 24 }).ok, false);
  // Documented bounds.
  assert.deepEqual(AUTOMATION_VOLUME_BOUNDS.muteAfter, { min: 1, max: 100 });
  assert.deepEqual(AUTOMATION_VOLUME_BOUNDS.highVolumeAfter, { min: 1, max: 200 });
  assert.deepEqual(AUTOMATION_VOLUME_BOUNDS.muteHours, { min: 1, max: 168 });
});

test("the 6th unanswered inbound mutes automation; the 10th flags high volume", () => {
  const settings = defaultAutomationVolumeSettings();

  // Counts 1-5: no mute, no flag.
  for (let current = 0; current < 5; current += 1) {
    const d = evaluateUnansweredInbound({
      currentCount: current,
      settings,
      alreadyMuted: false,
      alreadyFlaggedHighVolume: false,
    });
    assert.equal(d.nextCount, current + 1);
    assert.equal(d.shouldMute, false, `count ${d.nextCount} must not mute`);
    assert.equal(d.shouldFlagHighVolume, false);
  }

  // Count 6: mute.
  const sixth = evaluateUnansweredInbound({
    currentCount: 5,
    settings,
    alreadyMuted: false,
    alreadyFlaggedHighVolume: false,
  });
  assert.deepEqual(sixth, { nextCount: 6, shouldMute: true, shouldFlagHighVolume: false });

  // Counts 7-9 while muted: no re-mute, no flag yet.
  const eighth = evaluateUnansweredInbound({
    currentCount: 7,
    settings,
    alreadyMuted: true,
    alreadyFlaggedHighVolume: false,
  });
  assert.deepEqual(eighth, { nextCount: 8, shouldMute: false, shouldFlagHighVolume: false });

  // Count 10: high-volume flag (still muted, no second mute).
  const tenth = evaluateUnansweredInbound({
    currentCount: 9,
    settings,
    alreadyMuted: true,
    alreadyFlaggedHighVolume: false,
  });
  assert.deepEqual(tenth, { nextCount: 10, shouldMute: false, shouldFlagHighVolume: true });

  // Count 11+: flag already set, never repeated.
  const eleventh = evaluateUnansweredInbound({
    currentCount: 10,
    settings,
    alreadyMuted: true,
    alreadyFlaggedHighVolume: true,
  });
  assert.deepEqual(eleventh, { nextCount: 11, shouldMute: false, shouldFlagHighVolume: false });
});

test("an expired mute re-arms when the count is still above the threshold", () => {
  const settings = defaultAutomationVolumeSettings();
  const afterExpiry = evaluateUnansweredInbound({
    currentCount: 7,
    settings,
    alreadyMuted: false, // mute expired
    alreadyFlaggedHighVolume: false,
  });
  assert.equal(afterExpiry.shouldMute, true);
});

test("isAutomationMuted respects the timestamp and expiry", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");
  assert.equal(isAutomationMuted(null, now), false);
  assert.equal(isAutomationMuted({ automationMutedUntil: null }, now), false);
  assert.equal(
    isAutomationMuted({ automationMutedUntil: "2026-06-13T12:00:00.000Z" }, now),
    true,
  );
  assert.equal(
    isAutomationMuted({ automationMutedUntil: "2026-06-12T11:59:59.000Z" }, now),
    false,
  );
  assert.equal(isAutomationMuted({ automationMutedUntil: "not-a-date" }, now), false);
});

test("only automation-ended skip reasons count as unanswered", () => {
  assert.equal(reasonCountsAsUnanswered("max_auto_replies_reached"), true);
  assert.equal(reasonCountsAsUnanswered("template_disabled"), true);

  for (const reason of [
    "keyword_stop",
    "keyword_start",
    "keyword_help",
    "duplicate_inbound",
    "reply_thanks",
    "reply_acknowledgement",
    "reply_negative",
    "reply_unclear_short",
    "mode_disabled",
    "opted_out",
    "no_prior_recovery",
    "send_gate_blocked",
    "auto_replies_disabled",
    "slot_already_claimed",
    "automation_muted",
    null,
    undefined,
  ]) {
    assert.equal(reasonCountsAsUnanswered(reason as string | null | undefined), false, `must not count: ${reason}`);
  }
});
