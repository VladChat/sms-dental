import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseProjectConfig } from "./config";

// Server Supabase client for Next.js App Router.
//
// Uses cookie-based auth sessions. In places where mutating cookies is not
// allowed (some server component contexts), setAll may throw; ignore there so
// read-only auth checks still work.
export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseProjectConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
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
