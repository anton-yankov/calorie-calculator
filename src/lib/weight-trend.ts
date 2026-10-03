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

/** Below this weekly pace the trend counts as flat, so no goal date is promised. */
const FLAT_KG_PER_WEEK = 0.05;

/**
 * Where the trend is heading: its pace between the first and last weigh-in
 * from `since` on (kg per week, negative = losing), and the day the goal
 * weight is reached at that pace. `reachBy` is null when there's no goal, the
 * trend is flat, or it's moving away from the goal. null overall without two
 * weigh-ins to measure between.
 */
export function trendPace(
  points: WeightPoint[],
  since: string,
  goalKg: number | null,
): { kgPerWeek: number; reachBy: string | null } | null {
  const inRange = points.filter((p) => p.day >= since);
  const first = inRange[0];
  const last = inRange.at(-1);
  if (!first || !last || first === last) return null;
  const days =
    (Date.parse(`${last.day}T12:00:00Z`) - Date.parse(`${first.day}T12:00:00Z`)) / 86_400_000;
  if (days <= 0) return null;
  const kgPerWeek = ((last.trendKg - first.trendKg) / days) * 7;
  if (goalKg === null || Math.abs(kgPerWeek) < FLAT_KG_PER_WEEK)
    return { kgPerWeek, reachBy: null };
  const toGo = goalKg - last.trendKg;
  // Only a pace in the goal's direction leads there
  if (Math.sign(toGo) !== Math.sign(kgPerWeek)) return { kgPerWeek, reachBy: null };
  const reach = new Date(`${last.day}T12:00:00Z`);
  reach.setUTCDate(reach.getUTCDate() + Math.round((toGo / kgPerWeek) * 7));
  return { kgPerWeek, reachBy: reach.toISOString().slice(0, 10) };
}
