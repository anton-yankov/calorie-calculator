import { SkeletonPanels } from "@/components/loaders";

/** Streams immediately on navigation while Settings loads the profile and plans. */
export default function Loading() {
  return (
    <main className="page-enter mx-auto w-full max-w-md px-4 pt-4 pb-16 lg:grid lg:max-w-5xl lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-8 lg:px-8 lg:pt-2">
      <SkeletonPanels label="Settings" heights={[220, 132, 132, 132]} />
      <div className="hidden lg:block">
        <SkeletonPanels label="Plan" heights={[220]} />
      </div>
    </main>
  );
}
