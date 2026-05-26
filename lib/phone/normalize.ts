// Twilio sends phone numbers in E.164 already (+12345678901).
// This module provides a consistent normalization entry point and a
// validation helper used by callers that need to reject bad input early.

export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.trim();
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}
