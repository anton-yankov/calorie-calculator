"use client";

import { formatWater } from "@/lib/water";
import type { DayTargets } from "@/lib/plan-targets";
import type { MealTotals } from "@/lib/schema";

/** One goal as a self-contained cell: label, current/target numbers, and its own bar. */
function GoalCell({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number | null;
  target: number;
  unit?: string;
}) {
  const current = value ?? 0;
  const pct = Math.min(100, (current / target) * 100);
  // The goal is a floor: hitting it is the win state, under it is just progress
  const met = value !== null && value >= target;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted">
          <span className="font-bold text-foreground">
            {value === null
              ? "Not tracked"
              : unit === "ml"
                ? formatWater(value)
                : Math.round(value)}
          </span>{" "}
          / {unit === "ml" ? formatWater(target) : target}
          {unit && unit !== "ml" ? ` ${unit}` : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} vs goal`}
        aria-valuenow={value === null ? undefined : Math.min(target, Math.round(value))}
        aria-valuetext={
          value === null ? "Not tracked" : `${value} of ${target} ${unit ?? "calories"}`
        }
        aria-valuemin={0}
        aria-valuemax={target}
        className="h-1.5 overflow-hidden rounded-full bg-line/50"
      >
        <div
          className={`h-full rounded-full ${met ? "bg-success" : "bg-muted/40"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Goal progress for the log's day headers and the Analyze page's Today strip.
 * Side-by-side labeled cells (matching the meal cards' macro strip) — each
 * goal owns its own label, numbers, and bar, so nothing needs decoding.
 */
export function GoalBars({ totals, targets }: { totals: MealTotals; targets: DayTargets }) {
  return (
    <div
      className={`grid gap-x-5 ${targets.waterGoalMl != null ? "grid-cols-1 gap-y-3 sm:grid-cols-3" : "grid-cols-2"}`}
    >
      <GoalCell label="Calories" value={totals.calories} target={targets.calorieTarget} />
      {targets.waterGoalMl != null && (
        <GoalCell
          label="Water"
          value={totals.water_ml ?? null}
          target={targets.waterGoalMl}
          unit="ml"
        />
      )}
      {/* Every plan sets a protein target, so this cell is always shown */}
      <GoalCell label="Protein" value={totals.protein_g} target={targets.proteinTarget} unit="g" />
    </div>
  );
}
