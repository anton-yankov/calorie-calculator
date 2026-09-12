"use client";

import { DRINK_TYPES, DRINK_LABELS, formatWater } from "@/lib/water";
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
    value: b.value && b.value.nutrition_logged !== false ? pick(b.value) : null,
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
  const waterGoal = goals?.waterGoal ?? null;
  const waterBars: BarDatum[] = stats.buckets.map((b) => ({
    key: b.key,
    label: b.short,
    short: b.short,
    value: b.value?.water_ml ?? null,
    detail: (b.value?.water_by_drink ?? [])
      .map((d) => `${d.name}: ${formatWater(d.ml)}`)
      .join(" · "),
    partial: b.partial,
  }));
  const waterTotal = stats.waterByDrink.reduce((sum, d) => sum + d.ml, 0);
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
          <StatTile
            label="Avg water"
            value={summary.avgWater === null ? "—" : String(Math.round(summary.avgWater))}
            unit={summary.avgWater === null ? undefined : "ml"}
            caption={`${summary.waterCompleteDays} tracked days${waterGoal !== null ? ` · goal ${formatWater(waterGoal)}` : ""}`}
          />
          <StatTile
            label="Water days at goal"
            value={summary.waterGoalDays === null ? "—" : String(summary.waterGoalDays)}
            unit={summary.waterGoalDays === null ? undefined : `of ${summary.waterCompleteDays}`}
            caption={waterGoal === null ? "no water goal" : "today excluded from averages"}
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
          title={mode === "day" ? "Water per day" : "Water per day, weekly average"}
          unit="ml"
          data={waterBars}
          goal={waterGoal}
          mode={mode}
          emptyLabel="No water tracked in this range"
          summary={`Water per ${mode}, ${spanLabel}: ${summary.avgWater === null ? "no average yet" : `average ${formatWater(summary.avgWater)}`}.`}
        />
        <section className="rounded-panel border border-line bg-surface px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Water by drink</h2>
            <span className="font-mono text-sm">{formatWater(waterTotal)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            All drinks count at full volume. Range totals include today; older untracked entries are
            excluded.
          </p>
          {waterTotal === 0 ? (
            <p className="mt-3 text-sm text-muted">Log a drink to see the breakdown.</p>
          ) : (
            <div className="mt-3 divide-y divide-line">
              {DRINK_TYPES.map((type) => {
                const drinks = stats.waterByDrink
                  .filter((d) => d.type === type)
                  .sort((a, b) => b.ml - a.ml);
                const total = drinks.reduce((sum, d) => sum + d.ml, 0);
                if (!total) return null;
                return (
                  <details key={type} className="py-2">
                    <summary className="cursor-pointer text-sm">
                      <span className="inline-flex w-[calc(100%-1.5rem)] items-baseline justify-between gap-2">
                        <span>{DRINK_LABELS[type]}</span>
                        <span className="font-mono text-xs text-muted">
                          {formatWater(total)} · {Math.round((total / waterTotal) * 100)}%
                        </span>
                      </span>
                    </summary>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${(total / waterTotal) * 100}%` }}
                      />
                    </div>
                    <ul className="mt-2 space-y-1 pl-4 text-xs text-muted">
                      {drinks.map((d) => (
                        <li key={d.name} className="flex justify-between gap-3">
                          <span>{d.name}</span>
                          <span className="shrink-0 font-mono">{formatWater(d.ml)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          )}
        </section>
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
