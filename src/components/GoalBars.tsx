"use client";

import { statusColor } from "@/components/goal-colors";
import { goalStatus, MAINTAIN_RANGE, statusMessage, type Metric } from "@/lib/goal-status";
import type { Goal } from "@/lib/plan";
import type { DayTargets } from "@/lib/plan-targets";
import type { MealTotals } from "@/lib/schema";
import { formatWater } from "@/lib/water";

/**
 * The track runs to 120% of the target with a tick at the target itself, so
 * going over shows as a bar passing the tick rather than a bar that's just full.
 */
const TRACK_SCALE = 1.2;

const LABELS: Record<Metric, string> = { calories: "Calories", protein: "Protein", water: "Water" };

const shown = (metric: Metric, n: number) =>
  metric === "water" ? formatWater(n) : Math.round(n).toLocaleString("en-US");

/** One target as a self-contained cell: label, numbers, bar and what it means. */
function GoalCell({
  goal,
  metric,
  value,
  target,
  isToday,
}: {
  goal: Goal;
  metric: Metric;
  /** null when the day has no data for this metric (water logged before tracking) */
  value: number | null;
  target: number;
  isToday: boolean;
}) {
  const status = value === null ? null : goalStatus(goal, metric, value, target, isToday);
  const color = status ? statusColor(goal, status) : "var(--muted)";
  const message =
    value === null || status === null
      ? "Not tracked"
      : statusMessage(goal, metric, status, value, target);
  const width = value === null ? 0 : Math.min(value / (target * TRACK_SCALE), 1) * 100;
  // For maintaining, the on-track range is shaded on the track itself
  const range = goal === "maintain" && metric === "calories";

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
          {LABELS[metric]}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted">
          <span className="font-bold text-foreground">
            {value === null ? "—" : shown(metric, value)}
          </span>{" "}
          / {shown(metric, target)}
          {metric === "protein" && " g"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${LABELS[metric]} vs target`}
        aria-valuenow={value === null ? undefined : Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(target * TRACK_SCALE)}
        aria-valuetext={
          value === null
            ? message
            : `${shown(metric, value)} of ${shown(metric, target)}. ${message}`
        }
        className="relative h-1.5 overflow-hidden rounded-full bg-line/50"
      >
        {range && (
          <div
            className="absolute inset-y-0 bg-success/20"
            style={{
              left: `${((1 - MAINTAIN_RANGE) / TRACK_SCALE) * 100}%`,
              width: `${((2 * MAINTAIN_RANGE) / TRACK_SCALE) * 100}%`,
            }}
          />
        )}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{ width: `${width}%`, background: color }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/55"
          style={{ left: `${100 / TRACK_SCALE}%` }}
        />
      </div>
      <span
        className="text-[11px] font-semibold leading-snug"
        style={{ color: status === "progress" || status === null ? "var(--muted)" : color }}
      >
        {message}
      </span>
    </div>
  );
}

/**
 * Target progress for the log's day headers and the Analyze page's Today
 * strip. Each cell is judged by the day's goal: losing treats calories as a
 * ceiling, maintaining as a ±10% range, gaining as a floor (see goal-status.ts).
 */
export function GoalBars({
  totals,
  targets,
  isToday,
}: {
  totals: MealTotals;
  targets: DayTargets;
  /** A finished day can fall short; today is still in progress */
  isToday: boolean;
}) {
  const { goal } = targets;
  return (
    <div
      className={`grid gap-x-5 gap-y-3 ${targets.waterGoalMl != null ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}
    >
      <GoalCell
        goal={goal}
        metric="calories"
        value={totals.calories}
        target={targets.calorieTarget}
        isToday={isToday}
      />
      {targets.waterGoalMl != null && (
        <GoalCell
          goal={goal}
          metric="water"
          value={totals.water_ml ?? null}
          target={targets.waterGoalMl}
          isToday={isToday}
        />
      )}
      {/* Every plan sets a protein target, so this cell is always shown */}
      <GoalCell
        goal={goal}
        metric="protein"
        value={totals.protein_g}
        target={targets.proteinTarget}
        isToday={isToday}
      />
    </div>
  );
}
