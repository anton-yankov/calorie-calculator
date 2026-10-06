import { SkeletonPanels } from "@/components/loaders";

/** Streams immediately below the header while the Overview tab loads. */
export default function Loading() {
  return <SkeletonPanels label="Overview" heights={[240, 150]} />;
}
