import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase-config";

/**
 * Supabase client with the secret key: it skips RLS and sees every user's
 * rows. `server-only` fails the build if this file is ever imported into code
 * that runs in the browser. Use it only after checking who is asking — the
 * admin pages check the admin role, and the AI refund acts on the caller's own
 * usage row.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Missing SUPABASE_SECRET_KEY — see .env.example");
  return createClient(supabaseEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
