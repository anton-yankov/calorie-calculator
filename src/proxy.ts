import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS, supabaseEnv } from "@/lib/supabase-config";

/**
 * Runs before every page and API request: refreshes the Supabase session when
 * its access token has expired, then sends logged-out visitors to /login so
 * strangers can't run analyses on our OpenAI credits.
 *
 * Uses a login page and cookies instead of HTTP Basic Auth: standalone
 * home-screen web apps can't show the Basic Auth dialog (they just hang on a
 * blank splash screen), but they can render a login page and keep a cookie.
 */
export default async function proxy(request: NextRequest) {
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });
  let sessionHeaders: Record<string, string> = {};

  const supabase = createServerClient(url, key, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Refreshed tokens go onto the request too, so the page rendered after
        // this proxy already sees the new session, not the expired one
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set session cookies must never be cached and served to someone else
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        sessionHeaders = headers;
      },
    },
  });

  // getClaims verifies the token's signature (and refreshes it if expired);
  // getSession would trust whatever the cookie says, so it can't guard pages
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  // Any response other than `response` must carry the refreshed cookies and
  // the no-cache headers along, or the browser keeps the stale session
  const withSession = (res: NextResponse) => {
    for (const cookie of response.cookies.getAll()) res.cookies.set(cookie);
    for (const [name, value] of Object.entries(sessionHeaders)) res.headers.set(name, value);
    return res;
  };

  if (pathname === "/login") {
    // Logged-in visitors skip straight to the app
    return loggedIn ? withSession(NextResponse.redirect(new URL("/", request.url))) : response;
  }

  if (loggedIn) return response;

  // fetch() callers need a status code and the same JSON error shape as the
  // route handlers, not a redirect to an HTML page
  if (pathname.startsWith("/api/")) {
    return withSession(NextResponse.json({ error: "Authentication required" }, { status: 401 }));
  }

  return withSession(NextResponse.redirect(new URL("/login", request.url)));
}

export const config = {
  // Everything except Next's static assets and the icons/manifest — phones
  // fetch those without credentials when adding to the home screen
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|apple-icon.png|icon-192.png|icon-512.png|icon-maskable-512.png).*)",
  ],
};
