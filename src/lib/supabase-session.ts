import { createServerClient } from "@supabase/ssr";
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

/** The logged-in user's id (the verified token's `sub` claim), or null when logged out. */
export async function getUserId(): Promise<string | null> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}
