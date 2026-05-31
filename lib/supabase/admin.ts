import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleEnv } from "../env";
import { getSupabaseProjectConfig } from "./config";

// Service-role Supabase client for trusted server code only.
// Never import/use in browser code.
export function createSupabaseAdminClient() {
  const { url } = getSupabaseProjectConfig();
  const { SUPABASE_SERVICE_ROLE_KEY } = getSupabaseServiceRoleEnv();
  return createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
