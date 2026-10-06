import { SkeletonProducts } from "@/components/loaders";

/** Streams immediately below the header while the Products tab loads. */
export default function Loading() {
  return <SkeletonProducts />;
}
