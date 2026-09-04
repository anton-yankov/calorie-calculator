import { SkeletonProducts } from "@/components/loaders";

/** Streams immediately on navigation while the page fetches products from Supabase. */
export default function Loading() {
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
      <SkeletonProducts />
    </main>
  );
}
