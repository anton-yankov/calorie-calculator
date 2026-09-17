"use client";

import { statusColor } from "@/components/goal-colors";
import { useWaterTracking } from "@/components/WaterTracking";
import { goalStatus } from "@/lib/goal-status";
import { DRINK_TYPES, DRINK_LABELS, formatWater } from "@/lib/water";
import { useMemo, useState, useSyncExternalStore } from "react";
import { DailyBars, type BarDatum } from "@/components/charts/DailyBars";
import { WeightChart } from "@/components/charts/WeightChart";
import { RangePicker } from "@/components/charts/RangePicker";
import { StatTile } from "@/components/charts/StatTile";
import { SkeletonStats } from "@/components/loaders";
import { dayKey, dayLabel, shortDate } from "@/lib/day";
import type { MealTotalRow } from "@/lib/meals";
import type { Goal } from "@/lib/plan";
import type { MealTotals } from "@/lib/schema";
import type { StoredPlan } from "@/lib/plan-history";
import { targetsForDay } from "@/lib/plan-targets";
import { computeRange, groupByDay, macroSplit, type RangeId, type RangeStats } from "@/lib/stats";
import { trendOverRange, withTrend } from "@/lib/weight-trend";
import type { WeightEntry } from "@/lib/weights";
import { WeightEntries, WeightForm } from "./WeightLog";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// true only after hydration; the server snapshot is false so SSR shows the skeleton
const noop = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/**
 * One bar per day (or week) for calories or protein, coloured by how it went
 * against the plan that applied to it. A weekly bar uses the plan in effect on
 * its Monday; plans rarely change mid-week, and the next week picks up the new one.
 */
function goalBars(
  stats: RangeStats,
  plans: StoredPlan[],
  metric: "calories" | "protein",
  detail: (t: MealTotals) => string,
): BarDatum[] {
  return stats.buckets.map((b) => {
    const logged = b.value && b.value.nutrition_logged !== false ? b.value : null;
    const value = logged ? (metric === "calories" ? logged.calories : logged.protein_g) : null;
    const targets = targetsForDay(plans, b.key, null);
    const target = targets
      ? metric === "calories"
        ? targets.calorieTarget
        : targets.proteinTarget
      : null;
    const color =
      targets && target !== null && value !== null
        ? statusColor(targets.goal, goalStatus(targets.goal, metric, value, target, b.partial))
        : "var(--muted)";
    return {
      key: b.key,
      label: b.label,
      short: b.short,
      value,
      detail: b.value ? detail(b.value) : "",
      partial: b.partial,
      target,
      color,
    };
  });
}

const kcal = (n: number) => Math.round(n).toLocaleString("en-US");
const kg = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
/** "−1.2", "+0.4", "0" — a weight change with its direction */
const signedKg = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  return rounded === 0 ? "0" : `${rounded > 0 ? "+" : "−"}${kg(Math.abs(rounded))}`;
};

/** What "on track" meant, worded for the current goal (see goal-status.ts). */
const ON_TRACK_CAPTION: Record<Goal, string> = {
  lose: "calories under your limit",
  maintain: "calories within your range",
  gain: "calories at your target or more",
};

const MACROS = [
  { key: "protein", label: "Protein", color: "var(--green)" },
  { key: "carbs", label: "Carbs", color: "var(--accent)" },
  { key: "fat", label: "Fat", color: "var(--macro-fat)" },
] as const;

/** Where the average day's calories come from, as one stacked bar. */
function MacroSplit({
  protein,
  carbs,
  fat,
}: {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}) {
  const grams = { protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 };
  const split = macroSplit(grams);
  return (
    <section className="rounded-panel border border-line bg-surface px-4 py-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        Where the calories come from
      </h2>
      {split ? (
        <>
          <div
            role="img"
            aria-label={MACROS.map((m) => `${m.label} ${Math.round(split[m.key] * 100)}%`).join(
              ", ",
            )}
            className="mt-2.5 flex h-2 overflow-hidden rounded-full"
          >
            {MACROS.map((m) => (
              <span key={m.key} style={{ width: `${split[m.key] * 100}%`, background: m.color }} />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
            {MACROS.map((m) => (
              <li key={m.key} className="flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: m.color }} />
                {m.label} {Math.round(grams[m.key])} g · {Math.round(split[m.key] * 100)}%
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1.5 text-sm text-muted">Appears once a full day is logged.</p>
      )}
    </section>
  );
}

/**
 * The stats page body: range control and tiles in one column, the two charts
 * in the other (stacked on phones, side by side from lg). Everything derives
 * from the meal rows in memory, so switching ranges never refetches.
 *
 * Renders the skeleton until mounted: "today" and every day boundary come from
 * the viewer's clock, which the server (UTC on Vercel) can't know.
 */
export function StatsView({
  rows,
  plans,
  waterGoalMl,
  weights,
  readOnly = false,
}: {
  rows: MealTotalRow[];
  plans: StoredPlan[];
  waterGoalMl: number | null;
  weights: WeightEntry[];
  /** The admin's view of another account: no weight form, no edits */
  readOnly?: boolean;
}) {
  const waterTracking = useWaterTracking();
  const [range, setRange] = useState<RangeId>("30d");
  const today = useMounted() ? dayKey(new Date()) : null;

  const days = useMemo(() => groupByDay(rows), [rows]);
  const weightPoints = useMemo(() => withTrend(weights), [weights]);
  const stats = useMemo(
    () => (today ? computeRange(days, range, plans, waterGoalMl, today) : null),
    [days, range, plans, waterGoalMl, today],
  );

  if (!stats) return <SkeletonStats />;

  const { summary, mode } = stats;
  // Captions and chart summaries quote today's plan (stats.end is today); the
  // bars, target lines and day counts use each day's own plan
  const todayTargets = targetsForDay(plans, stats.end, waterGoalMl);
  const calorieGoal = todayTargets?.calorieTarget ?? null;
  const proteinGoal = todayTargets?.proteinTarget ?? null;
  const waterGoal = waterGoalMl;
  const waterBars: BarDatum[] = stats.buckets.map((b) => ({
    key: b.key,
    label: b.short,
    short: b.short,
    value: b.value?.water_ml ?? null,
    detail: (b.value?.water_by_drink ?? [])
      .map((d) => `${d.name}: ${formatWater(d.ml)}`)
      .join(" · "),
    partial: b.partial,
    // Water isn't judged by the plan's goal, so its bars keep the accent colour
    target: waterGoal,
    color: "var(--accent)",
  }));
  const waterTotal = stats.waterByDrink.reduce((sum, d) => sum + d.ml, 0);
  const emptyDays = summary.calendarDays - summary.loggedDays;
  const rangeLabel = `${shortDate(stats.start)} – ${shortDate(stats.end)} · ${
    emptyDays === 0 ? "every day logged" : `${plural(emptyDays, "day")} empty`
  }`;
  const spanLabel =
    stats.start === stats.end ? dayLabel(stats.end) : `${stats.start} to ${stats.end}`;

  const calorieBars = goalBars(
    stats,
    plans,
    "calories",
    (t) => `${Math.round(t.protein_g)} g protein`,
  );
  const proteinBars = goalBars(stats, plans, "protein", (t) => `${Math.round(t.calories)} kcal`);

  // "All" starts at the first meal; reach back further if weighing in started earlier
  const firstWeighIn = weights[0]?.day;
  const weightStart =
    range === "all" && firstWeighIn && firstWeighIn < stats.start ? firstWeighIn : stats.start;
  const weightRange = trendOverRange(weightPoints, weightStart, stats.end);
  const latestWeighIn = weights.at(-1);
  // Plans never start in the future, so the newest one is today's
  const goalWeight = plans.at(-1)?.goalWeightKg ?? null;

  const avgCalories = summary.avgCalories === null ? "—" : kcal(summary.avgCalories);
  const avgProtein = summary.avgProtein === null ? "—" : String(Math.round(summary.avgProtein));

  return (
    <>
      {/* No meals yet: the page still renders, so the weight section works from day one */}
      {rows.length === 0 && (
        <div className="rounded-panel border-2 border-dashed border-line bg-surface/40 px-5 py-6 text-center text-muted lg:col-span-2">
          <p className="font-serif text-xl font-semibold text-foreground">Nothing to chart yet</p>
          <p className="mt-1 text-sm">
            {readOnly
              ? "No meals logged yet."
              : "Log a few days of meals and the calorie and protein trends appear here."}
          </p>
        </div>
      )}
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
              plural(summary.completeDays, "day") +
              (calorieGoal !== null ? ` · target ${kcal(calorieGoal)}` : "")
            }
          />
          <StatTile
            label="Avg protein"
            value={avgProtein}
            unit={summary.avgProtein === null ? undefined : "g"}
            caption={proteinGoal !== null ? `target ${proteinGoal} g` : "no target"}
          />
          <StatTile
            label="Days on track"
            value={String(summary.onTrackDays)}
            unit={`of ${summary.completeDays}`}
            caption={
              todayTargets ? ON_TRACK_CAPTION[todayTargets.goal] : "judged by each day's plan"
            }
          />
          <StatTile
            label="Protein reached"
            value={String(summary.proteinDays)}
            unit={`of ${summary.completeDays}`}
            caption={proteinGoal !== null ? `days at ${proteinGoal} g or more` : "days at target"}
          />
        </div>

        <MacroSplit protein={summary.avgProtein} carbs={summary.avgCarbs} fat={summary.avgFat} />
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Latest weight"
            value={latestWeighIn ? kg(latestWeighIn.weightKg) : "—"}
            unit={latestWeighIn ? "kg" : undefined}
            caption={
              latestWeighIn
                ? `${dayLabel(latestWeighIn.day)}${goalWeight !== null ? ` · goal ${kg(goalWeight)} kg` : ""}`
                : "no weigh-ins yet"
            }
          />
          <StatTile
            label="Trend change"
            value={weightRange.change === null ? "—" : signedKg(weightRange.change)}
            unit={weightRange.change === null ? undefined : "kg"}
            caption={weightRange.change === null ? "needs two weigh-ins" : "over this range"}
          />
        </div>
        {!readOnly && <WeightForm weights={weights} today={stats.end} />}
      </div>

      <section className="flex min-w-0 flex-col gap-4">
        <DailyBars
          title={mode === "day" ? "Calories per day" : "Calories per day, weekly average"}
          unit="kcal"
          data={calorieBars}
          mode={mode}
          summary={`Calories per ${mode}, ${spanLabel}: average ${avgCalories} kcal${
            calorieGoal !== null ? ` against a ${calorieGoal} kcal target` : ""
          }.`}
        />
        <DailyBars
          title={mode === "day" ? "Protein per day" : "Protein per day, weekly average"}
          unit="g"
          data={proteinBars}
          mode={mode}
          summary={`Protein per ${mode}, ${spanLabel}: average ${avgProtein} g${
            proteinGoal !== null ? ` against a ${proteinGoal} g target` : ""
          }.`}
        />
        <WeightChart
          points={weightRange.points}
          start={weightStart}
          end={stats.end}
          goalKg={goalWeight}
          trendColor={todayTargets ? statusColor(todayTargets.goal, "progress") : "var(--accent)"}
          summary={`Weight, ${spanLabel}: ${
            weightRange.points.length === 0
              ? "no weigh-ins"
              : `${plural(weightRange.points.length, "weigh-in")}${
                  weightRange.change === null ? "" : `, trend ${signedKg(weightRange.change)} kg`
                }`
          }${goalWeight !== null ? `, goal ${kg(goalWeight)} kg` : ""}.`}
        />
        <WeightEntries weights={weights} readOnly={readOnly} />
        {waterTracking && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                label="Avg water"
                value={summary.avgWater === null ? "—" : String(Math.round(summary.avgWater))}
                unit={summary.avgWater === null ? undefined : "ml"}
                caption={`${plural(summary.waterCompleteDays, "tracked day")}${waterGoal !== null ? ` · goal ${formatWater(waterGoal)}` : ""}`}
              />
              <StatTile
                label="Water days at goal"
                value={summary.waterGoalDays === null ? "—" : String(summary.waterGoalDays)}
                unit={
                  summary.waterGoalDays === null ? undefined : `of ${summary.waterCompleteDays}`
                }
                caption={waterGoal === null ? "no water goal" : "today excluded"}
              />
            </div>
            <DailyBars
              title={mode === "day" ? "Water per day" : "Water per day, weekly average"}
              unit="ml"
              data={waterBars}
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
                All drinks count at full volume. Range totals include today; older untracked entries
                are excluded.
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
          </>
        )}
      </section>
    </>
  );
}
