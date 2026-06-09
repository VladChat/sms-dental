// Estimated Twilio billing-window release deadline.
//
// IMPORTANT: This is an ESTIMATE, not an authoritative Twilio paid-through date.
// Twilio's IncomingPhoneNumber resource does NOT expose a reliable per-number
// `paid_through_at` / `next_renewal_at` field — it only exposes `dateCreated`
// (the moment the number was purchased/created in our account). Twilio bills a
// purchased phone number monthly on the anniversary of that purchase date, so we
// estimate the next renewal from the stored purchase timestamp and release the
// number ~1 day before that estimated renewal to reduce the risk of paying Twilio
// for another month while still allowing one-click restore beforehand.
//
// All calendar math is UTC-safe and preserves the original time-of-day from the
// purchase timestamp. Month-end anchors are clamped to the last valid day of the
// target month (Jan 31 -> Feb 28/29, Mar 31 -> Apr 30, Feb 29 -> sensible
// leap/non-leap behavior).

/** One day in milliseconds. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Safety buffer (days) before the estimated monthly renewal anniversary. */
export const TWILIO_RELEASE_BUFFER_DAYS = 1;

// Last calendar day of a given UTC year/month (month is 0-indexed). Day 0 of the
// next month is the last day of the requested month.
function lastDayOfUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Build a UTC date for the given year/month using `anchorDay` clamped to the last
// valid day of that month, preserving the anchor's time-of-day. `monthIndex` may
// be outside 0-11; it is normalized (so callers can simply add months).
function utcAnniversaryCandidate(
  year: number,
  monthIndex: number,
  anchorDay: number,
  h: number,
  m: number,
  s: number,
  ms: number,
): Date {
  const normalizedYear = year + Math.floor(monthIndex / 12);
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  const clampedDay = Math.min(anchorDay, lastDayOfUtcMonth(normalizedYear, normalizedMonth));
  return new Date(Date.UTC(normalizedYear, normalizedMonth, clampedDay, h, m, s, ms));
}

/**
 * The next estimated monthly Twilio renewal anniversary strictly after `now`,
 * based on `purchaseAnchor`'s day-of-month and time-of-day (UTC, month-end safe).
 */
export function nextTwilioRenewalAfter(purchaseAnchor: Date, now: Date): Date {
  const anchorDay = purchaseAnchor.getUTCDate();
  const h = purchaseAnchor.getUTCHours();
  const mi = purchaseAnchor.getUTCMinutes();
  const s = purchaseAnchor.getUTCSeconds();
  const ms = purchaseAnchor.getUTCMilliseconds();

  const startYear = now.getUTCFullYear();
  const startMonth = now.getUTCMonth();

  // Find the first anniversary candidate strictly after `now`. This loops a tiny,
  // bounded number of times (at most ~2 iterations in practice).
  let monthOffset = 0;
  let candidate = utcAnniversaryCandidate(startYear, startMonth + monthOffset, anchorDay, h, mi, s, ms);
  while (candidate.getTime() <= now.getTime()) {
    monthOffset += 1;
    candidate = utcAnniversaryCandidate(startYear, startMonth + monthOffset, anchorDay, h, mi, s, ms);
  }
  return candidate;
}

/**
 * Estimated permanent-removal / Twilio-release deadline.
 *
 * deadline = (next estimated monthly renewal after `now`) minus a 1-day safety
 * buffer. If that deadline is already due or in the past relative to `now`, it is
 * clamped to `now` so the number becomes eligible for release as soon as the
 * release job runs.
 *
 * Pure function — no I/O, no Twilio call. The caller supplies the stored purchase
 * anchor (clinic_phone_numbers.twilio_purchased_at, falling back to created_at).
 */
export function computeTwilioReleaseDeadline(args: {
  purchaseAnchor: Date;
  now: Date;
}): Date {
  const { purchaseAnchor, now } = args;
  const renewal = nextTwilioRenewalAfter(purchaseAnchor, now);
  const deadlineMs = renewal.getTime() - TWILIO_RELEASE_BUFFER_DAYS * ONE_DAY_MS;
  if (deadlineMs <= now.getTime()) {
    // Already inside the final pre-renewal day (or past it): release ASAP.
    return new Date(now.getTime());
  }
  return new Date(deadlineMs);
}
