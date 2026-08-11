import { NextResponse, type NextRequest } from "next/server";

/**
 * Site-wide password gate (HTTP Basic Auth) so strangers can't run analyses
 * on our OpenAI credits. Active only when SITE_PASSWORD is set — locally it
 * usually isn't, so dev stays open. The browser prompts once and remembers.
 */
export default function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      // Any username is accepted; only the password matters
      const submitted = atob(auth.slice(6)).split(":").slice(1).join(":");
      if (submitted === password) return NextResponse.next();
    } catch {
      // fall through to the 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Calorie Calculator"' },
  });
}

export const config = {
  // Everything except Next's static assets and the icon
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
