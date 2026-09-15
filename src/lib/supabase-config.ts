/**
 * Settings shared by both Supabase clients: the proxy's and the per-request
 * session client. Kept free of `next/headers` so the proxy can import it.
 */

export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — see .env.example",
    );
  }
  return { url, key };
}

/**
 * Flags for the session cookies. @supabase/ssr defaults to cookies that page
 * JavaScript can read and that also travel over plain http. Nothing in the
 * browser talks to Supabase, so the tokens are hidden from scripts (httpOnly)
 * and sent over https only (secure; localhost is http, hence production only).
 * A browser Supabase client, if ever added, would need httpOnly: false.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
