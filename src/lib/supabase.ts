import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client. Prefers the secret key (server-only, bypasses
 * RLS — the anon policies can be dropped once every environment has it, see
 * FUTURE-TASKS.md) and falls back to the publishable key so environments
 * without the secret keep working during the switch. All table access stays
 * in server code behind the site password gate either way.
 */
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("The Supabase client must only be used in server code");
  }
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key (SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) — see .env.example",
      );
    }
    // No Supabase Auth in this app — sessions would have nowhere to live
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
