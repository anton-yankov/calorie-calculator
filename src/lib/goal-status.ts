import type { Goal } from "@/lib/plan";
import { formatWater } from "@/lib/water";

/**
 * How a day's intake reads against its target, depending on the goal. Pure
 * functions, so the rules behind every bar colour and message can be tested
 * and explained without a screen.
 *
 * - Losing: calories are a ceiling — under it is fine, over it is over.
 * - Maintaining: calories should land within ±10% of the target.
 * - Gaining: calories are a floor, with no penalty for going above.
 * - Protein and water are always floors.
 *
 * Today isn't over yet, so falling short today is just progress; on a
 * finished day it's a miss.
 */

export type Metric = "calories" | "protein" | "water";

export type GoalStatus =
  /** Today, still working toward the target */
  | "progress"
  /** Today, within 10% of a calorie ceiling */
  | "near"
  /** Reached, within range, or (losing) kept under the ceiling */
  | "met"
  /** A finished day that fell below the target or range */
  | "short"
  /** Past a calorie ceiling, or above the maintain range */
  | "over";

// Shares are kept in tenths so the checks below stay in exact whole numbers
/** Losing turns amber from 9/10 of the calorie ceiling. */
const NEAR_LIMIT_TENTHS = 9;
/** Maintaining counts as on track within 1/10 either side of the target. */
const MAINTAIN_RANGE_TENTHS = 1;
/** The same range as a fraction, for drawing it on the bar. */
export const MAINTAIN_RANGE = MAINTAIN_RANGE_TENTHS / 10;

/**
 * Everything is judged on whole units — the numbers the bars show — so a bar
 * reading "2,000 / 2,000" can never say "Over by 0 kcal". The maintain range's
 * edges are the whole numbers just inside it.
 */
const whole = (n: number) => Math.round(n);
const rangeLow = (target: number) => Math.ceil((target * (10 - MAINTAIN_RANGE_TENTHS)) / 10);
const rangeHigh = (target: number) => Math.floor((target * (10 + MAINTAIN_RANGE_TENTHS)) / 10);

export function goalStatus(
  goal: Goal,
  metric: Metric,
  rawValue: number,
  rawTarget: number,
  isToday: boolean,
): GoalStatus {
  const value = whole(rawValue);
  const target = whole(rawTarget);
  const fellShort = isToday ? "progress" : "short";

  if (metric !== "calories") return value >= target ? "met" : fellShort;

  if (goal === "lose") {
    if (value > target) return "over";
    if (!isToday) return "met";
    return value * 10 >= target * NEAR_LIMIT_TENTHS ? "near" : "progress";
  }

  if (goal === "maintain") {
    if (value > rangeHigh(target)) return "over";
    return value >= rangeLow(target) ? "met" : fellShort;
  }

  return value >= target ? "met" : fellShort;
}

const amount = (n: number, metric: Metric) =>
  metric === "water"
    ? formatWater(n)
    : `${Math.round(n).toLocaleString("en-US")} ${metric === "calories" ? "kcal" : "g"}`;

/**
 * The short line under a bar, e.g. "Over by 190 kcal". For maintaining,
 * distances are measured to the edges of the ±10% range, not to the target.
 */
export function statusMessage(
  goal: Goal,
  metric: Metric,
  status: GoalStatus,
  rawValue: number,
  rawTarget: number,
): string {
  const value = whole(rawValue);
  const target = whole(rawTarget);
  if (metric === "calories" && goal === "maintain") {
    const low = rangeLow(target);
    const high = rangeHigh(target);
    if (status === "over") return `Above your range by ${amount(value - high, metric)}`;
    if (status === "short") return `Below your range by ${amount(low - value, metric)}`;
    if (status === "progress") return `${amount(low - value, metric)} to your range`;
    return "Within your range";
  }

  const gap = Math.abs(target - value);
  switch (status) {
    case "over":
      return `Over by ${amount(value - target, metric)}`;
    case "short":
      return `Short by ${amount(gap, metric)}`;
    case "near":
      return gap === 0
        ? "Right at your limit"
        : `${amount(gap, metric)} left · close to your limit`;
    case "progress":
      return `${amount(gap, metric)} to go`;
    case "met":
      if (metric === "calories" && goal === "lose") {
        return gap === 0 ? "Right at your limit" : `Under your limit by ${amount(gap, metric)}`;
      }
      return "Reached";
  }
}
