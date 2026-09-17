import { SkeletonPanels } from "@/components/loaders";

/** Streams immediately on navigation while Settings loads the profile and plans. */
export default function Loading() {
  return (
    <main className="page-enter mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-5 pb-16 pt-8 sm:px-6 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:content-start lg:items-start lg:gap-x-10 lg:gap-y-7">
      <header className="border-b-2 border-foreground pb-5 lg:col-span-2">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Your account
        </p>
        <h1 className="font-serif text-[clamp(1.9rem,7vw,2.5rem)] font-semibold leading-[1.08] tracking-tight">
          Settings
        </h1>
      </header>
      <SkeletonPanels label="Plan" heights={[220, 52]} />
      <SkeletonPanels label="Details" heights={[260, 120, 110]} />
    </main>
  );
}
