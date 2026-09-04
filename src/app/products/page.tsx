import { listSavedBarcodeProducts } from "@/lib/barcode-products";
import type { BarcodeProduct } from "@/lib/products";
import { ProductList } from "./ProductList";

// Server component: products are fetched from Supabase per request (see
// loading.tsx for the streamed skeleton). Edits and deletes go through Server
// Actions that revalidate this path, so the list never holds its own copy.
export default async function ProductsPage() {
  let products: BarcodeProduct[] = [];
  let loadError: string | null = null;
  try {
    products = await listSavedBarcodeProducts();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Couldn't load saved products.";
  }

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-5 py-8 sm:px-6 sm:py-11 lg:max-w-3xl">
      <header className="border-b-2 border-foreground pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Product library
        </p>
        <h1 className="font-serif text-[clamp(2rem,8vw,2.9rem)] font-semibold leading-[1.08] tracking-tight">
          Saved products
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          Products you entered by hand after a scan. Fix a value or remove one here.
        </p>
      </header>

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
