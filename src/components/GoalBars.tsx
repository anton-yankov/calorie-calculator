"use client";

import type { MealTotals } from "@/lib/schema";
import type { Goals } from "@/lib/settings";

/** One goal as a self-contained cell: label, current/target numbers, and its own bar. */
function GoalCell({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target: number;
  unit?: string;
}) {
  const pct = Math.min(100, (value / target) * 100);
  // Over-goal switches to the accent color — a signal, not a scold
  const over = value > target;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted">
          <span className="font-bold text-foreground">{Math.round(value)}</span> / {target}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} vs goal`}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={target}
        className="h-1.5 overflow-hidden rounded-full bg-line/50"
      >
        <div
          className={`h-full rounded-full ${over ? "bg-accent" : "bg-success"}`}
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
export function GoalBars({ totals, goals }: { totals: MealTotals; goals: Goals }) {
  return (
    <div className={`grid gap-x-5 ${goals.proteinGoal !== null ? "grid-cols-2" : "grid-cols-1"}`}>
      <GoalCell label="Calories" value={totals.calories} target={goals.calorieGoal} />
      {goals.proteinGoal !== null && (
        <GoalCell label="Protein" value={totals.protein_g} target={goals.proteinGoal} unit="g" />
      )}
    </div>
  );
}
