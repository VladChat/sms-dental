import { cookies } from "next/headers";

// Legacy setup-token account-context session.
//
// Real auth session + clinic membership is now the primary access path. This
// token-cookie path is intentionally kept as a temporary fallback so existing
// setup-link users are not locked out during rollout.

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
