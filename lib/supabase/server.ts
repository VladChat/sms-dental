import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseProjectConfig } from "./config";

// Server Supabase client for Next.js App Router.
//
// Uses cookie-based auth sessions. In places where mutating cookies is not
// allowed (some server component contexts), setAll may throw; ignore there so
// read-only auth checks still work.
//
// When `request` is provided (Route Handler usage), incoming cookies are read
// from that request to avoid context mismatches.
export async function createSupabaseServerClient(input?: {
  request?: Pick<NextRequest, "cookies">;
}) {
  const { url, anonKey } = getSupabaseProjectConfig();
  const cookieStore = await cookies();
  const requestCookieStore = input?.request?.cookies;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return requestCookieStore?.getAll() ?? cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // No-op in read-only cookie contexts.
        }
      },
    },
  });
}
