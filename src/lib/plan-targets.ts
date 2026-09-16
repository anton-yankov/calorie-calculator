import type { Goal } from "@/lib/plan";
import type { StoredPlan } from "@/lib/plan-history";

/**
 * Turns the plan history into "what was this day judged against?". Water
 * isn't part of a plan: its goal comes from the profile's water setting.
 */

export interface DayTargets {
  /** Decides how the day's numbers are judged (see goal-status.ts) */
  goal: Goal;
  calorieTarget: number;
  proteinTarget: number;
  /** Water goal in ml, or null when none is set */
  waterGoalMl: number | null;
}

/**
 * The plan that applied on `day`: the newest one starting on or before it.
 * Days before the first plan fall back to the oldest plan, so meals logged
 * before setup keep their bars. `plans` must be oldest first, as listPlans returns.
 */
export function planForDay(plans: StoredPlan[], day: string): StoredPlan | null {
  let active: StoredPlan | null = null;
  for (const plan of plans) {
    // YYYY-MM-DD keys compare correctly as strings
    if (plan.effectiveFrom > day) break;
    active = plan;
  }
  // Before the first plan, fall back to the oldest one (null if there are none)
  return active ?? plans[0] ?? null;
}

/** The targets for `day`, or null when the user has no plan at all. */
export function targetsForDay(
  plans: StoredPlan[],
  day: string,
  waterGoalMl: number | null,
): DayTargets | null {
  const plan = planForDay(plans, day);
  if (!plan) return null;
  return {
    goal: plan.goal,
    calorieTarget: plan.calorieTarget,
    proteinTarget: plan.proteinTarget,
    waterGoalMl,
  };
}
