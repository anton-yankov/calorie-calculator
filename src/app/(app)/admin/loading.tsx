import { SkeletonPanels } from "@/components/loaders";

/** Streams immediately on navigation while the admin page loads every account. */
export default function Loading() {
  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-3.5 px-4 pt-4 pb-12 lg:px-8 lg:pt-2 lg:max-w-5xl">
      <SkeletonPanels label="Users" heights={[132, 132]} />
    </main>
  );
}
