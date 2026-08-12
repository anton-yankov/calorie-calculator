import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authTokenFor } from "@/lib/auth";

/**
 * Site-wide password gate so strangers can't run analyses on our OpenAI
 * credits. Active only when SITE_PASSWORD is set — locally it usually isn't,
 * so dev stays open.
 *
 * Uses a cookie set by the /login page instead of HTTP Basic Auth: standalone
 * home-screen web apps can't show the Basic Auth dialog (they just hang on a
 * blank splash screen), but they can render a login page and keep a cookie.
 */
export default async function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const authed =
    request.cookies.get(AUTH_COOKIE)?.value === (await authTokenFor(password));
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    // Already-unlocked visitors skip straight to the app
    return authed ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (authed) return NextResponse.next();

  // fetch() callers need a status code, not a redirect to an HTML page
  if (pathname.startsWith("/api/")) {
    return new NextResponse("Authentication required", { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except Next's static assets and the icons/manifest — phones
  // fetch those without credentials when adding to the home screen
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|apple-icon.png|icon-192.png|icon-512.png|icon-maskable-512.png).*)",
  ],
};
