import { runtimeConfig } from "../../config/runtime.config";

// Supabase project URL and public anon key are non-secret runtime config values.
// Keep them in committed config (not .env.local) per project rules.

export function getSupabaseProjectConfig(): {
  url: string;
  anonKey: string;
} {
  const url = runtimeConfig.supabase.url.trim();
  const anonKey = runtimeConfig.supabase.anonKey.trim();
  if (!url || !anonKey) {
    throw new Error("Supabase project URL/anon key are not configured in runtime config");
  }
  return { url, anonKey };
}
