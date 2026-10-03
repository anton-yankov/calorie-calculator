import { SkeletonPanels } from "@/components/loaders";

/** Streams immediately on navigation while Settings loads the profile and plans. */
export default function Loading() {
  return (
    <main className="page-enter mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-4 pt-4 pb-16 lg:px-8 lg:pt-2 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:content-start lg:items-start lg:gap-x-10 lg:gap-y-7">
      <SkeletonPanels label="Plan" heights={[220, 52]} />
      <SkeletonPanels label="Details" heights={[260, 120, 110]} />
    </main>
  );
}
