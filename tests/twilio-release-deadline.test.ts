import test from "node:test";
import assert from "node:assert/strict";

import {
  computeTwilioReleaseDeadline,
  nextTwilioRenewalAfter,
  TWILIO_RELEASE_BUFFER_DAYS,
} from "../lib/phone-numbers/twilio-release-deadline";

const iso = (d: Date) => d.toISOString();

test("buffer is 1 day", () => {
  assert.equal(TWILIO_RELEASE_BUFFER_DAYS, 1);
});

test("normal mid-cycle removal: deadline = next renewal minus 1 day", () => {
  const anchor = new Date("2026-01-15T10:00:00.000Z");
  const now = new Date("2026-03-20T00:00:00.000Z");

  assert.equal(iso(nextTwilioRenewalAfter(anchor, now)), "2026-04-15T10:00:00.000Z");

  const deadline = computeTwilioReleaseDeadline({ purchaseAnchor: anchor, now });
  assert.equal(iso(deadline), "2026-04-14T10:00:00.000Z");
  assert.ok(deadline.getTime() > now.getTime());
});

test("removal one day before renewal: deadline is just ahead of now (not clamped)", () => {
  const anchor = new Date("2026-01-15T10:00:00.000Z");
  // One hour before the Apr 14 10:00 deadline.
  const now = new Date("2026-04-14T09:00:00.000Z");

  const deadline = computeTwilioReleaseDeadline({ purchaseAnchor: anchor, now });
  assert.equal(iso(deadline), "2026-04-14T10:00:00.000Z");
  assert.ok(deadline.getTime() > now.getTime());
});

test("removal after the safety deadline has passed: clamps to now (release ASAP)", () => {
  const anchor = new Date("2026-01-15T10:00:00.000Z");
  // After the Apr 14 10:00 deadline but before the Apr 15 10:00 renewal.
  const now = new Date("2026-04-14T12:00:00.000Z");

  const deadline = computeTwilioReleaseDeadline({ purchaseAnchor: anchor, now });
  assert.equal(deadline.getTime(), now.getTime());
});

test("Jan 31 anchor clamps to a non-leap February (Feb 28), preserving time-of-day", () => {
  const anchor = new Date("2026-01-31T08:30:00.000Z");
  const now = new Date("2026-02-05T00:00:00.000Z");

  assert.equal(iso(nextTwilioRenewalAfter(anchor, now)), "2026-02-28T08:30:00.000Z");

  const deadline = computeTwilioReleaseDeadline({ purchaseAnchor: anchor, now });
  assert.equal(iso(deadline), "2026-02-27T08:30:00.000Z");
});

test("Mar 31 anchor clamps to Apr 30", () => {
  const anchor = new Date("2026-03-31T00:00:00.000Z");
  const now = new Date("2026-04-10T00:00:00.000Z");

  assert.equal(iso(nextTwilioRenewalAfter(anchor, now)), "2026-04-30T00:00:00.000Z");

  const deadline = computeTwilioReleaseDeadline({ purchaseAnchor: anchor, now });
  assert.equal(iso(deadline), "2026-04-29T00:00:00.000Z");
});

test("Feb 29 leap anchor: clamps to Feb 28 in a non-leap renewal year", () => {
  const anchor = new Date("2024-02-29T12:00:00.000Z");
  const now = new Date("2026-02-10T00:00:00.000Z");

  assert.equal(iso(nextTwilioRenewalAfter(anchor, now)), "2026-02-28T12:00:00.000Z");

  const deadline = computeTwilioReleaseDeadline({ purchaseAnchor: anchor, now });
  assert.equal(iso(deadline), "2026-02-27T12:00:00.000Z");
});

test("Feb 29 leap anchor: keeps Feb 29 in a leap renewal year", () => {
  const anchor = new Date("2024-02-29T12:00:00.000Z");
  const now = new Date("2028-02-10T00:00:00.000Z");

  // 2028 is a leap year, so the day-29 anniversary is preserved.
  assert.equal(iso(nextTwilioRenewalAfter(anchor, now)), "2028-02-29T12:00:00.000Z");

  const deadline = computeTwilioReleaseDeadline({ purchaseAnchor: anchor, now });
  assert.equal(iso(deadline), "2028-02-28T12:00:00.000Z");
});

test("renewal is strictly after now even when now equals an anniversary instant", () => {
  const anchor = new Date("2026-01-15T10:00:00.000Z");
  // now is exactly on the Mar 15 anniversary instant -> next must be Apr 15.
  const now = new Date("2026-03-15T10:00:00.000Z");

  assert.equal(iso(nextTwilioRenewalAfter(anchor, now)), "2026-04-15T10:00:00.000Z");
});
