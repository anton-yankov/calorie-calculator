import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client. The publishable key is public by design
 * (access control lives in RLS policies), but this app keeps all table
 * access in server code behind the site password gate, so the key never
 * ships in the client bundle. FUTURE-TASKS.md tracks the planned switch
 * to a secret key with locked-down policies.
 */
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("The Supabase client must only be used in server code");
  }
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — see .env.example",
      );
    }
    // No Supabase Auth in this app — sessions would have nowhere to live
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
