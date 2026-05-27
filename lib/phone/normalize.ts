// Phone normalization for internal storage.
//
// Twilio always sends phone numbers in E.164 (+12345678901). For
// human-entered numbers (e.g. clinic owner typing into a form), we accept
// common U.S. formats and normalize them to E.164 internally so downstream
// code can rely on a single shape.
//
// Accepted U.S. inputs:
//   +12245551234   2245551234   (224) 555-1234
//   224-555-1234   224.555.1234 12245551234
//
// Unknown / international inputs are left as a trimmed string. The caller
// should then validate with isValidE164() and surface a clear error.

export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Already-E.164 input: just strip whitespace/separators inside.
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/\D/g, "");
  }

  const digits = trimmed.replace(/\D/g, "");
  // 11-digit NANP starting with country code 1.
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  // 10-digit U.S./NANP: prepend +1.
  if (digits.length === 10) return "+1" + digits;

  // Unknown shape — return as-is so isValidE164 will reject it.
  return trimmed;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}
