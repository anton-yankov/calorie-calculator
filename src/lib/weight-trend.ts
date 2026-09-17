import type { WeightEntry } from "@/lib/weights";

/**
 * The weight trend: an exponential moving average of the weigh-ins. Each
 * weigh-in moves the trend this share of the way toward itself, so a single
 * heavy morning barely shifts it while a real change pulls it along within a
 * week or two. Days without a weigh-in are skipped, not filled in.
 */
const SMOOTHING = 0.1;

export interface WeightPoint extends WeightEntry {
  /** The trend as of this weigh-in */
  trendKg: number;
}

/** Each weigh-in with its trend value; `entries` must be oldest first. The first weigh-in starts the trend. */
export function withTrend(entries: WeightEntry[]): WeightPoint[] {
  let trend: number | null = null;
  return entries.map((entry) => {
    trend = trend === null ? entry.weightKg : trend + SMOOTHING * (entry.weightKg - trend);
    return { ...entry, trendKg: trend };
  });
}

/**
 * The weigh-ins between `start` and `end` (inclusive day keys) and how much the
 * trend moved over that span. The starting trend is the one in effect when the
 * range begins (the last weigh-in on or before `start`), so a range whose first
 * weigh-in comes late still measures from its first day. `change` is null
 * without two trend values to compare.
 */
export function trendOverRange(
  points: WeightPoint[],
  start: string,
  end: string,
): { points: WeightPoint[]; change: number | null } {
  const inRange = points.filter((p) => p.day >= start && p.day <= end);
  const last = inRange.at(-1);
  const before = points.filter((p) => p.day <= start).at(-1);
  const first = before ?? inRange[0];
  if (!last || !first || first === last) return { points: inRange, change: null };
  return { points: inRange, change: last.trendKg - first.trendKg };
}
