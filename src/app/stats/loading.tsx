import { SkeletonStats } from "@/components/loaders";

/** Streams immediately on navigation while the page fetches meal totals from Supabase. */
export default function Loading() {
  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-5 py-8 sm:px-6 sm:py-11 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:content-start lg:items-start lg:gap-x-10">
      <header className="border-b-2 border-foreground pb-6 lg:col-span-2">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">Trends</p>
        <h1 className="font-serif text-[clamp(2rem,8vw,2.9rem)] font-semibold leading-[1.08] tracking-tight">
          Stats
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          Calories and protein, day by day, against your goals.
        </p>
      </header>
      <SkeletonStats />
    </main>
  );
}
