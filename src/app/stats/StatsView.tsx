"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { DailyBars, type BarDatum } from "@/components/charts/DailyBars";
import { RangePicker } from "@/components/charts/RangePicker";
import { StatTile } from "@/components/charts/StatTile";
import { SkeletonStats } from "@/components/loaders";
import { dayKey, dayLabel, shortDate } from "@/lib/day";
import type { MealTotalRow } from "@/lib/meals";
import type { MealTotals } from "@/lib/schema";
import type { Goals } from "@/lib/settings";
import { computeRange, groupByDay, type RangeId, type RangeStats } from "@/lib/stats";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// true only after hydration; the server snapshot is false so SSR shows the skeleton
const noop = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

function toBars(
  stats: RangeStats,
  pick: (t: MealTotals) => number,
  detail: (t: MealTotals) => string,
): BarDatum[] {
  return stats.buckets.map((b) => ({
    key: b.key,
    label: b.label,
    short: b.short,
    value: b.value ? pick(b.value) : null,
    detail: b.value ? detail(b.value) : "",
    partial: b.partial,
  }));
}

/**
 * The stats page body: range control and tiles in one column, the two charts
 * in the other (stacked on phones, side by side from lg). Everything derives
 * from the meal rows in memory, so switching ranges never refetches.
 *
 * Renders the skeleton until mounted: "today" and every day boundary come from
 * the viewer's clock, which the server (UTC on Vercel) can't know.
 */
export function StatsView({ rows, goals }: { rows: MealTotalRow[]; goals: Goals | null }) {
  const [range, setRange] = useState<RangeId>("30d");
  const today = useMounted() ? dayKey(new Date()) : null;

  const days = useMemo(() => groupByDay(rows), [rows]);
  const stats = useMemo(
    () => (today ? computeRange(days, range, goals, today) : null),
    [days, range, goals, today],
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-panel border-2 border-dashed border-line bg-surface/40 px-5 py-14 text-center text-muted lg:col-span-2">
        <p className="font-serif text-xl font-semibold text-foreground">Nothing to chart yet</p>
        <p className="mt-1 text-sm">Log a few days of meals and the trends appear here.</p>
      </div>
    );
  }

  if (!stats) return <SkeletonStats />;

  const { summary, mode } = stats;
  const calorieGoal = goals?.calorieGoal ?? null;
  const proteinGoal = goals?.proteinGoal ?? null;
  const rangeLabel = `${shortDate(stats.start)} – ${shortDate(stats.end)}`;
  const spanLabel =
    stats.start === stats.end ? dayLabel(stats.end) : `${stats.start} to ${stats.end}`;

  const calorieBars = toBars(
    stats,
    (t) => t.calories,
    (t) => `${Math.round(t.protein_g)} g protein`,
  );
  const proteinBars = toBars(
    stats,
    (t) => t.protein_g,
    (t) => `${Math.round(t.calories)} kcal`,
  );

  const avgCalories = summary.avgCalories === null ? "—" : String(Math.round(summary.avgCalories));
  const avgProtein = summary.avgProtein === null ? "—" : String(Math.round(summary.avgProtein));

  return (
    <>
      <div className="flex flex-col gap-4 lg:sticky lg:top-24">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <RangePicker value={range} onChange={setRange} />
          <span className="font-mono text-xs tabular-nums text-muted">{rangeLabel}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Avg calories"
            value={avgCalories}
            unit={summary.avgCalories === null ? undefined : "kcal"}
            caption={
              plural(summary.completeDays, "logged day") +
              (calorieGoal !== null ? ` · goal ${calorieGoal}` : "")
            }
          />
          <StatTile
            label="Avg protein"
            value={avgProtein}
            unit={summary.avgProtein === null ? undefined : "g"}
            caption={proteinGoal !== null ? `goal ${proteinGoal} g` : "no protein goal"}
          />
          {summary.calorieGoalDays !== null ? (
            <StatTile
              label="Days at goal"
              value={String(summary.calorieGoalDays)}
              unit={`of ${summary.completeDays}`}
              caption={
                summary.proteinGoalDays !== null
                  ? `protein ${summary.proteinGoalDays} of ${summary.completeDays}`
                  : "calories reached the goal"
              }
            />
          ) : (
            <StatTile
              label="Biggest day"
              value={summary.best ? String(Math.round(summary.best.calories)) : "—"}
              unit={summary.best ? "kcal" : undefined}
              caption={summary.best ? dayLabel(summary.best.day) : "no complete days yet"}
            />
          )}
          <StatTile
            label="Days logged"
            value={String(summary.loggedDays)}
            unit={`of ${summary.calendarDays}`}
            caption={
              summary.loggedDays === summary.calendarDays
                ? "every day logged"
                : `${plural(summary.calendarDays - summary.loggedDays, "day")} empty`
            }
          />
        </div>

        {!goals && (
          <p className="text-sm text-muted">
            Goal lines appear once you{" "}
            <Link href="/log" className="font-semibold text-accent hover:underline">
              set daily goals
            </Link>{" "}
            on the Log page.
          </p>
        )}
      </div>

      <section className="flex min-w-0 flex-col gap-4">
        <DailyBars
          title={mode === "day" ? "Calories per day" : "Calories per day, weekly average"}
          unit="kcal"
          data={calorieBars}
          goal={calorieGoal}
          mode={mode}
          summary={`Calories per ${mode}, ${spanLabel}: average ${avgCalories} kcal${
            calorieGoal !== null ? ` against a ${calorieGoal} kcal goal` : ""
          }.`}
        />
        <DailyBars
          title={mode === "day" ? "Protein per day" : "Protein per day, weekly average"}
          unit="g"
          data={proteinBars}
          goal={proteinGoal}
          mode={mode}
          summary={`Protein per ${mode}, ${spanLabel}: average ${avgProtein} g${
            proteinGoal !== null ? ` against a ${proteinGoal} g goal` : ""
          }.`}
        />
      </section>
    </>
  );
}
