import { listSavedBarcodeProducts } from "@/lib/barcode-products";
import { getUserId } from "@/lib/supabase-session";

export const runtime = "nodejs";

/**
 * The viewer's saved products, A to Z, for the homepage search. A route
 * rather than a Server Action so opening the search never waits behind a
 * meal being logged.
 */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const products = await listSavedBarcodeProducts(userId);
    return Response.json(products, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("listing saved products failed:", error);
    return Response.json({ error: "Couldn't load your products." }, { status: 500 });
  }
}
