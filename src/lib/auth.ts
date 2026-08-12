export const AUTH_COOKIE = "site-auth";

/**
 * The auth cookie stores a SHA-256 digest of the site password rather than
 * the password itself, so a leaked cookie never reveals the actual secret.
 * Web Crypto is used because this runs in both the proxy (edge) and server
 * actions (node).
 */
export async function authTokenFor(password: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`calorie-gate:${password}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
