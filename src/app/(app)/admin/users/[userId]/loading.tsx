import { SkeletonPanels } from "@/components/loaders";

/** Streams immediately while one account's data loads (also when switching tabs). */
export default function Loading() {
  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-3.5 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:max-w-5xl">
      <SkeletonPanels label="Account" heights={[44, 240, 150]} />
    </main>
  );
}
