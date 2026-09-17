import type { GoalStatus } from "@/lib/goal-status";
import type { Goal } from "@/lib/plan";

/**
 * Colour style B from the Phase 3 mockups: while you're still working toward a
 * target the bar takes the goal's own tint; once there's an outcome, green,
 * amber and red mean the same thing for every goal. Values are CSS variables
 * from globals.css, so the palette lives in one place.
 */
const PROGRESS_TINT: Record<Goal, string> = {
  lose: "var(--tint-lose)",
  maintain: "var(--tint-maintain)",
  gain: "var(--tint-gain)",
};

const OUTCOME: Record<Exclude<GoalStatus, "progress">, string> = {
  met: "var(--green)",
  near: "var(--amber)",
  short: "var(--amber)",
  over: "var(--danger)",
};

export function statusColor(goal: Goal, status: GoalStatus): string {
  return status === "progress" ? PROGRESS_TINT[goal] : OUTCOME[status];
}
