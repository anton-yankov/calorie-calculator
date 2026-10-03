import { SkeletonLog, SkeletonLogRail } from "@/components/loaders";

/** Streams immediately on navigation while the page fetches the log from Supabase. */
export default function Loading() {
  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:content-start lg:items-start lg:gap-x-10">
      <SkeletonLogRail />
      <SkeletonLog />
    </main>
  );
}
