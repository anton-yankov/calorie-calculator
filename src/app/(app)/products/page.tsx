import { redirect } from "next/navigation";
import { listSavedBarcodeProducts } from "@/lib/barcode-products";
import type { BarcodeProduct } from "@/lib/products";
import { getUserId } from "@/lib/supabase-session";
import { ProductList } from "./ProductList";

// Server component: products are fetched from Supabase per request (see
// loading.tsx for the streamed skeleton). Edits and deletes go through Server
// Actions that revalidate this path, so the list never holds its own copy.
export default async function ProductsPage() {
  // The proxy already sends logged-out visitors to /login; this is the page's own check
  const userId = await getUserId();
  if (!userId) redirect("/login");

  let products: BarcodeProduct[] = [];
  let loadError: string | null = null;
  try {
    products = await listSavedBarcodeProducts(userId);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Couldn't load saved products.";
  }

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:max-w-5xl">
      {loadError ? (
        <p className="rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
          {loadError} — check your connection and reload.
        </p>
      ) : (
        <ProductList products={products} />
      )}
    </main>
  );
}
