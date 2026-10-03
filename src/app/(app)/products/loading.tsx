import { SkeletonProducts } from "@/components/loaders";

/** Streams immediately on navigation while the page fetches products from Supabase. */
export default function Loading() {
  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:max-w-3xl">
      <SkeletonProducts />
    </main>
  );
}
