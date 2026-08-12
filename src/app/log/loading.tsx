import { SkeletonLog } from "@/components/loaders";

/** Streams immediately on navigation while the page fetches the log from Supabase. */
export default function Loading() {
  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-5 py-8 sm:px-6 sm:py-11">
      <header className="border-b-2 border-foreground pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Daily record
        </p>
        <h1 className="font-serif text-[clamp(2rem,8vw,2.9rem)] font-semibold leading-[1.08] tracking-tight">
          Meal log
        </h1>
        <p className="mt-2 text-[15px] text-muted">Your saved meals, grouped by day.</p>
      </header>
      <SkeletonLog />
    </main>
  );
}
