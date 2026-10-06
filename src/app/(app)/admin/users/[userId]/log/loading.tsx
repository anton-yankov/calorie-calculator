import { SkeletonLog } from "@/components/loaders";
import { LOG_GRID } from "../grids";

/** Streams immediately below the header while the Log tab loads. */
export default function Loading() {
  return (
    <div className={LOG_GRID}>
      <SkeletonLog />
    </div>
  );
}
