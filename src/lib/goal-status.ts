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

/** Losing turns amber from this share of the calorie ceiling. */
const NEAR_LIMIT = 0.9;

/** Maintaining counts as on track within this share either side of the target. */
export const MAINTAIN_RANGE = 0.1;

export function goalStatus(
  goal: Goal,
  metric: Metric,
  value: number,
  target: number,
  isToday: boolean,
): GoalStatus {
  const ratio = value / target;
  const fellShort = isToday ? "progress" : "short";

  if (metric !== "calories") return ratio >= 1 ? "met" : fellShort;

  if (goal === "lose") {
    if (ratio > 1) return "over";
    if (!isToday) return "met";
    return ratio >= NEAR_LIMIT ? "near" : "progress";
  }

  if (goal === "maintain") {
    if (ratio > 1 + MAINTAIN_RANGE) return "over";
    return ratio >= 1 - MAINTAIN_RANGE ? "met" : fellShort;
  }

  return ratio >= 1 ? "met" : fellShort;
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
  value: number,
  target: number,
): string {
  if (metric === "calories" && goal === "maintain") {
    const low = target * (1 - MAINTAIN_RANGE);
    const high = target * (1 + MAINTAIN_RANGE);
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
      return `${amount(gap, metric)} left · close to your limit`;
    case "progress":
      return `${amount(gap, metric)} to go`;
    case "met":
      if (metric === "calories" && goal === "lose") {
        return Math.round(gap) === 0
          ? "Right at your limit"
          : `Under your limit by ${amount(gap, metric)}`;
      }
      return "Reached";
  }
}
