import { SkeletonStats } from "@/components/loaders";
import { GRID } from "../grids";

/** Streams immediately below the header while the Stats tab loads. */
export default function Loading() {
  return (
    <div className={GRID}>
      <SkeletonStats />
    </div>
  );
}
