import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SESSION_COOKIE_OPTIONS, supabaseEnv } from "@/lib/supabase-config";

/**
 * Supabase client that acts as the logged-in user: it reads the session from
 * the request cookies, so queries run under that user's RLS policies (unlike a
 * secret-key client, which bypasses RLS). Reading cookies is a request-time
 * API, so every page that loads data through this client renders per request
 * and is never prerendered.
 *
 * Create one per request — never cache it in a module variable, or one user's
 * session could end up in another's request.
 */
export async function createSessionClient() {
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't write cookies — only Server Actions and
          // Route Handlers can. The proxy refreshes expired sessions instead.
        }
      },
    },
  });
}

/**
 * A Supabase client passed into a read function. Pages pass nothing and read
 * as the logged-in user; the admin pages pass the secret-key client to read
 * another user's rows (the userId filter still applies).
 */
export type Db = SupabaseClient;

export interface Viewer {
  userId: string;
  /**
   * Set with SQL in the Supabase dashboard (auth.users.raw_app_meta_data).
   * app_metadata is part of the verified token and only the server can write
   * it, unlike user_metadata, which every user can edit for themselves. It
   * reaches the token when the session next refreshes (within about an hour)
   * or at the next login.
   */
  isAdmin: boolean;
}

/** Who is logged in, from the verified token; null when logged out. */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return null;
  return { userId: data.claims.sub, isAdmin: data.claims.app_metadata?.role === "admin" };
}

/** The logged-in user's id (the verified token's `sub` claim), or null when logged out. */
export async function getUserId(): Promise<string | null> {
  return (await getViewer())?.userId ?? null;
}
