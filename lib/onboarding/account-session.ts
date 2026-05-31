import { cookies } from "next/headers";

// Minimal account-context session for the clean `/account` dashboard URL.
//
// After "Continue setup" creates the clinic, the server sets this httpOnly
// cookie holding the raw setup token. `/account` reads it server-side to resolve
// the clinic, so the long `/setup/{token}` URL no longer needs to stay in the
// address bar. The token is NOT exposed in any URL, is httpOnly (not readable by
// client JS), and is never logged. Token expiry is still enforced by the
// setup-request lookup, independent of cookie lifetime.

const ACCOUNT_COOKIE = "mcd_account";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function setAccountSessionCookie(rawToken: string): Promise<void> {
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readAccountSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCOUNT_COOKIE)?.value ?? null;
}

export async function clearAccountSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ACCOUNT_COOKIE);
}
