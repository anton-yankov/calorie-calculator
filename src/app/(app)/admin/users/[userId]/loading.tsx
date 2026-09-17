import { SkeletonPanels } from "@/components/loaders";

/** Streams immediately while one account's data loads (also when switching tabs). */
export default function Loading() {
  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-5 py-8 sm:px-6 sm:py-11 lg:max-w-5xl">
      <header className="border-b-2 border-foreground pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Admin · ← Users
        </p>
        <h1 className="font-serif text-[clamp(1.6rem,6vw,2.4rem)] font-semibold leading-[1.1] tracking-tight">
          Loading account…
        </h1>
      </header>
      <SkeletonPanels label="Account" heights={[44, 240, 150]} />
    </main>
  );
}
