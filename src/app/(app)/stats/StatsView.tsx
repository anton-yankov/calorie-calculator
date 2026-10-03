"use client";

import { ChartColumn, Lightbulb } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { DailyBars, type BarDatum } from "@/components/charts/DailyBars";
import { WeightChart } from "@/components/charts/WeightChart";
import { statusColor } from "@/components/goal-colors";
import { SkeletonStats } from "@/components/loaders";
import {
  CalendarLegend,
  MonthCalendar,
  WeeksCalendar,
  type CalendarDay,
} from "@/components/MonthCalendar";
import { useMounted } from "@/components/useMounted";
import { useWaterTracking } from "@/components/WaterTracking";
import { dayKey, dayLabel, longDate, shortDate } from "@/lib/day";
import { goalStatus } from "@/lib/goal-status";
import { pickInsight } from "@/lib/insights";
import type { MealTotalRow } from "@/lib/meals";
import type { Goal } from "@/lib/plan";
import type { StoredPlan } from "@/lib/plan-history";
import { targetsForDay } from "@/lib/plan-targets";
import type { MealTotals } from "@/lib/schema";
import {
  computeRange,
  dayOutcome,
  groupByDay,
  macroSplit,
  onTrackBefore,
  RANGES,
  type RangeId,
  type RangeStats,
} from "@/lib/stats";
import { DRINK_LABELS, DRINK_TYPES, formatWater } from "@/lib/water";
import { trendOverRange, trendPace, withTrend } from "@/lib/weight-trend";
import type { WeightEntry } from "@/lib/weights";
import { LogWeightButton, WeightEntries } from "./WeightLog";

type Section = "nutrition" | "weight" | "water";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const kcal = (n: number) => Math.round(n).toLocaleString("en-US");
const kg = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
/** "−1.2", "+0.4", "0": a weight change with its direction */
const signedKg = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  return rounded === 0 ? "0" : `${rounded > 0 ? "+" : "−"}${kg(Math.abs(rounded))}`;
};

/** What "on track" meant, worded for the current goal (see goal-status.ts). */
const ON_TRACK_CAPTION: Record<Goal, (target: number) => string> = {
  lose: (t) => `Calories under your ${kcal(t)} limit`,
  maintain: () => "Calories within your range",
  gain: (t) => `Calories at your ${kcal(t)} target or more`,
};

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
    <section className="flex flex-col gap-2.5 rounded-[22px] bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15.5px] font-extrabold">Where your calories come from</h2>
        <span className="shrink-0 text-[12.5px] text-muted">average day</span>
      </div>
      {split ? (
        <>
          <div
            role="img"
            aria-label={MACROS.map((m) => `${m.label} ${Math.round(split[m.key] * 100)}%`).join(
              ", ",
            )}
            className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
          >
            {MACROS.map((m) => (
              <span key={m.key} style={{ width: `${split[m.key] * 100}%`, background: m.color }} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
            {MACROS.map((m) => (
              <li key={m.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: m.color }}
                />
                {m.label} <b className="text-foreground">{Math.round(split[m.key] * 100)}%</b> ·{" "}
                {Math.round(grams[m.key])} g
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted">Appears once a full day is logged.</p>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  unit,
  caption,
  tone = "muted",
}: {
  label: string;
  value: string;
  unit?: string;
  caption: string;
  tone?: "muted" | "good" | "warn";
}) {
  return (
    <div className="min-w-0 rounded-[20px] bg-surface p-3.5">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="block text-2xl leading-tight font-extrabold tracking-tight tabular-nums">
        {value}
        {unit && (
          <span className="ml-1 text-[13px] font-semibold tracking-normal text-muted">{unit}</span>
        )}
      </span>
      <span
        className={`mt-0.5 block text-xs ${tone === "good" ? "text-success" : tone === "warn" ? "text-amber" : "text-muted"}`}
      >
        {caption}
      </span>
    </div>
  );
}

function Switch({
  value,
  onChange,
  water,
}: {
  value: Section;
  onChange: (section: Section) => void;
  water: boolean;
}) {
  const options: [Section, string][] = [
    ["nutrition", "Nutrition"],
    ["weight", "Weight"],
    ...(water ? ([["water", "Water"]] as [Section, string][]) : []),
  ];
  return (
    <div
      role="tablist"
      aria-label="Stats sections"
      className={`grid gap-1 rounded-[16px] bg-surface p-1 ${water ? "grid-cols-3" : "grid-cols-2"}`}
    >
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={`h-10 rounded-[12px] text-sm font-bold transition-colors ${
            value === id ? "bg-accent text-[#241a15]" : "text-muted hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function RangePills({ value, onChange }: { value: RangeId; onChange: (range: RangeId) => void }) {
  return (
    <div role="radiogroup" aria-label="Range" className="flex gap-1.5">
      {RANGES.map((range) => (
        <button
          key={range.id}
          type="button"
          role="radio"
          aria-checked={range.id === value}
          onClick={() => onChange(range.id)}
          className={`h-11 min-w-12 rounded-[12px] px-3 text-[13.5px] font-bold transition-colors ${
            range.id === value
              ? "bg-surface-raised text-foreground"
              : "bg-surface text-muted hover:text-foreground"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The Stats page: Nutrition, Weight and (with water tracking) Water as
 * sections, all following one range. Everything derives from the rows in
 * memory, so switching never refetches. Renders the skeleton until mounted:
 * "today" and every day boundary come from the viewer's clock.
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
  /** The admin's view of another account: no weight form, no edits, no jumping to the Log */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const waterTracking = useWaterTracking();
  const [section, setSection] = useState<Section>("nutrition");
  const [range, setRange] = useState<RangeId>("30d");
  const today = useMounted() ? dayKey(new Date()) : null;

  const days = useMemo(() => groupByDay(rows), [rows]);
  const weightPoints = useMemo(() => withTrend(weights), [weights]);
  const stats = useMemo(
    () => (today ? computeRange(days, range, plans, waterGoalMl, today) : null),
    [days, range, plans, waterGoalMl, today],
  );

  if (!stats || !today) return <SkeletonStats />;
  // Water tracking turned off while its section was open
  const shown: Section = section === "water" && !waterTracking ? "nutrition" : section;

  const { summary, mode } = stats;
  const todayTargets = targetsForDay(plans, stats.end, waterGoalMl);
  const goal = todayTargets?.goal ?? "lose";
  const before = onTrackBefore(days, range, plans, stats.start);
  const preset = RANGES.find((r) => r.id === range)!;
  const emptyDays = summary.calendarDays - summary.loggedDays;
  const rangeLabel = `${shortDate(stats.start)} – ${shortDate(stats.end)}`;
  const spanLabel =
    stats.start === stats.end ? dayLabel(stats.end) : `${stats.start} to ${stats.end}`;

  const dayStatus = (key: string): CalendarDay => dayOutcome(days, plans, key, today, stats.start);
  const openDay = readOnly ? undefined : (key: string) => router.push(`/log#day-${key}`);
  // 7 and 30 days as whole weeks; longer ranges as one full-size calendar per month
  const months: [number, number][] = [];
  if (mode === "week") {
    const end = new Date(`${stats.end}T12:00:00`);
    const startDate = new Date(`${stats.start}T12:00:00`);
    for (
      let d = new Date(end.getFullYear(), end.getMonth(), 1);
      d >= new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      d = new Date(d.getFullYear(), d.getMonth() - 1, 1)
    ) {
      months.push([d.getFullYear(), d.getMonth()]);
    }
  }
  const monthSummary = (year: number, month: number) => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    let met = 0;
    let logged = 0;
    for (const [key, d] of days) {
      if (!key.startsWith(prefix) || key >= today || key < stats.start || d.nutritionMeals === 0)
        continue;
      logged++;
      if (dayStatus(key) === "met") met++;
    }
    return logged ? `${met} of ${logged} on track` : null;
  };

  const calorieGoal = todayTargets?.calorieTarget ?? null;
  const proteinGoal = todayTargets?.proteinTarget ?? null;
  const avgCalories = summary.avgCalories === null ? "—" : kcal(summary.avgCalories);
  const avgProtein = summary.avgProtein === null ? "—" : String(Math.round(summary.avgProtein));
  const caloriesOk =
    summary.avgCalories !== null && todayTargets
      ? goalStatus(goal, "calories", summary.avgCalories, todayTargets.calorieTarget, false) ===
        "met"
      : null;
  const proteinOk =
    summary.avgProtein !== null && proteinGoal !== null ? summary.avgProtein >= proteinGoal : null;

  const insight = pickInsight({
    days,
    plans,
    start: stats.start,
    today,
    onTrackNow: summary.onTrackDays,
    onTrackBefore: before,
    rangeDays: preset.days,
  });

  const calorieBars = goalBars(
    stats,
    plans,
    "calories",
    (t) => `${Math.round(t.protein_g)} g protein`,
  );
  const proteinBars = goalBars(stats, plans, "protein", (t) => `${Math.round(t.calories)} kcal`);

  // Weight: "All" reaches back to the first weigh-in if weighing in started earlier
  const firstWeighIn = weights[0]?.day;
  const weightStart =
    range === "all" && firstWeighIn && firstWeighIn < stats.start ? firstWeighIn : stats.start;
  const weightRange = trendOverRange(weightPoints, weightStart, stats.end);
  const latest = weights.at(-1);
  // Plans never start in the future, so the newest one is today's
  const plan = plans.at(-1);
  const goalWeight = plan?.goalWeightKg ?? null;
  // The journey runs from the plan's start weight to its goal
  const pace = plan ? trendPace(weightPoints, plan.effectiveFrom, goalWeight) : null;

  const water: BarDatum[] = stats.buckets.map((b) => ({
    key: b.key,
    label: b.short,
    short: b.short,
    value: b.value?.water_ml ?? null,
    detail: (b.value?.water_by_drink ?? [])
      .map((d) => `${d.name}: ${formatWater(d.ml)}`)
      .join(" · "),
    partial: b.partial,
    // Water isn't judged by the plan's goal, so its bars keep the accent colour
    target: waterGoalMl,
    color: "var(--tint-lose)",
  }));
  const waterTotal = stats.waterByDrink.reduce((sum, d) => sum + d.ml, 0);

  const controls = (
    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="lg:w-[300px]">
        <Switch value={shown} onChange={setSection} water={waterTracking} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <RangePills value={range} onChange={setRange} />
        <span className="text-[12.5px] text-muted lg:hidden">{rangeLabel}</span>
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (shown === "nutrition") {
    body =
      rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-[22px] bg-surface px-5 py-7 text-center lg:col-span-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-surface-raised text-accent">
            <ChartColumn className="h-7 w-7" strokeWidth={1.9} aria-hidden />
          </span>
          <p className="text-[17px] font-extrabold">Nothing to chart yet</p>
          <p className="max-w-xs text-[13.5px] text-muted">
            {readOnly
              ? "No meals logged yet."
              : "Log a few days of meals and your calendar, averages and charts show up here. Weight works from day one."}
          </p>
          {!readOnly && (
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/">Add a meal</ButtonLink>
              <Button variant="outline" onClick={() => setSection("weight")}>
                Go to Weight
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:sticky lg:top-6">
            <section
              aria-label="Days on track"
              className="flex flex-col gap-3.5 rounded-[22px] bg-surface p-4"
            >
              <div>
                <p className="flex items-baseline gap-2">
                  <b className="text-[34px] leading-none font-extrabold tracking-tight tabular-nums">
                    {summary.onTrackDays}
                  </b>
                  <span className="text-[15px] font-semibold text-muted">
                    of {summary.completeDays} {summary.completeDays === 1 ? "day" : "days"} on track
                  </span>
                </p>
                <p className="mt-1 text-[13.5px] text-muted">
                  {calorieGoal !== null
                    ? ON_TRACK_CAPTION[goal](calorieGoal)
                    : "Judged by each day's plan"}
                  {emptyDays > 0 && ` · ${plural(emptyDays, "day")} not logged`}
                </p>
                {before !== null && summary.onTrackDays !== before && (
                  <span
                    className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${
                      summary.onTrackDays > before
                        ? "bg-success-soft text-success"
                        : "bg-surface-raised text-muted"
                    }`}
                  >
                    {summary.onTrackDays > before ? "▲" : "▼"}{" "}
                    {Math.abs(summary.onTrackDays - before)}{" "}
                    {summary.onTrackDays > before ? "more" : "fewer"} than the {preset.days} days
                    before
                  </span>
                )}
              </div>
              {mode === "day" ? (
                <WeeksCalendar
                  start={stats.start}
                  today={today}
                  dayStatus={dayStatus}
                  onSelect={openDay}
                />
              ) : (
                <MonthCalendar
                  months={months}
                  today={today}
                  dayStatus={dayStatus}
                  onSelect={openDay}
                  summary={monthSummary}
                />
              )}
              <CalendarLegend />
            </section>
            <div className="grid grid-cols-2 gap-2.5">
              <Tile
                label="Avg calories"
                value={avgCalories}
                unit={summary.avgCalories === null ? undefined : "kcal"}
                caption={
                  caloriesOk === null || calorieGoal === null
                    ? plural(summary.completeDays, "finished day")
                    : caloriesOk
                      ? goal === "lose"
                        ? `Under your ${kcal(calorieGoal)} limit`
                        : goal === "maintain"
                          ? "Within your range"
                          : `At or above ${kcal(calorieGoal)}`
                      : `Target ${kcal(calorieGoal)}`
                }
                tone={caloriesOk === null ? "muted" : caloriesOk ? "good" : "warn"}
              />
              <Tile
                label="Avg protein"
                value={avgProtein}
                unit={summary.avgProtein === null ? undefined : "g"}
                caption={
                  proteinGoal === null
                    ? "No target"
                    : `Target ${proteinGoal} g · hit on ${plural(summary.proteinDays, "day")}`
                }
                tone={proteinOk === null ? "muted" : proteinOk ? "good" : "warn"}
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
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
            <MacroSplit
              protein={summary.avgProtein}
              carbs={summary.avgCarbs}
              fat={summary.avgFat}
            />
            {insight && (
              <section className="flex items-start gap-3 rounded-[20px] bg-accent-soft p-4 text-sm">
                <Lightbulb
                  className="mt-0.5 h-[22px] w-[22px] shrink-0 text-accent"
                  strokeWidth={1.9}
                  aria-hidden
                />
                <span>
                  <b className="block text-[14.5px]">{insight.title}</b>
                  <span className="text-[13px] text-muted">{insight.body}</span>
                </span>
              </section>
            )}
          </div>
        </>
      );
  } else if (shown === "weight") {
    const start = plan?.weightKg ?? null;
    const now = latest?.weightKg ?? null;
    const progress =
      start !== null && now !== null && goalWeight !== null && start !== goalWeight
        ? Math.min(Math.max((start - now) / (start - goalWeight), 0), 1)
        : null;
    const moved = start !== null && now !== null ? now - start : null;
    body = (
      <>
        <div className="flex flex-col gap-3 lg:sticky lg:top-6">
          <section
            aria-label="Your weight journey"
            className="flex flex-col gap-3 rounded-[22px] bg-surface p-4"
          >
            {plan && goalWeight !== null && now !== null ? (
              <>
                <div className="grid grid-cols-3">
                  <span className="text-[12px] text-muted">
                    Start · {longDate(plan.effectiveFrom)}
                    <b className="block text-xl font-extrabold text-foreground tabular-nums">
                      {kg(plan.weightKg)}
                    </b>
                  </span>
                  <span className="text-center text-[12px] text-muted">
                    Now
                    <b className="block text-xl font-extrabold text-foreground tabular-nums">
                      {kg(now)}
                    </b>
                  </span>
                  <span className="text-right text-[12px] text-muted">
                    Goal
                    <b className="block text-xl font-extrabold text-foreground tabular-nums">
                      {kg(goalWeight)}
                    </b>
                  </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-line-strong">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${(progress ?? 0) * 100}%`,
                      background: statusColor(goal, "progress"),
                    }}
                  />
                  <span
                    className="absolute -top-1 h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[3px] border-surface"
                    style={{
                      left: `${(progress ?? 0) * 100}%`,
                      background: statusColor(goal, "progress"),
                    }}
                  />
                </div>
                <p className="text-[13.5px] leading-snug text-muted">
                  {moved !== null && (
                    <b className="text-foreground">
                      {Math.abs(moved) < 0.05
                        ? "No change yet"
                        : `${kg(Math.abs(moved))} kg ${moved < 0 ? "down" : "up"}`}
                      , {kg(Math.abs(goalWeight - now))} kg to go.
                    </b>
                  )}{" "}
                  {pace === null
                    ? "Log a few weigh-ins and your pace shows here."
                    : pace.reachBy
                      ? `At your pace so far (about ${kg(Math.abs(pace.kgPerWeek))} kg a week) you'd reach ${kg(goalWeight)} kg around ${new Date(`${pace.reachBy}T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}.`
                      : "So far your trend isn't moving toward your goal yet."}
                </p>
              </>
            ) : (
              <p className="text-[13.5px] text-muted">
                {now === null
                  ? "Your first weigh-in starts the chart and the trend."
                  : `Latest ${kg(now)} kg. With a goal weight in your plan, the way there shows here.`}
              </p>
            )}
            {!readOnly && <LogWeightButton weights={weights} today={today} />}
          </section>
          <div className="grid grid-cols-2 gap-2.5">
            <Tile
              label="Latest"
              value={latest ? kg(latest.weightKg) : "—"}
              unit={latest ? "kg" : undefined}
              caption={latest ? dayLabel(latest.day) : "No weigh-ins yet"}
            />
            <Tile
              label="Trend change"
              value={weightRange.change === null ? "—" : signedKg(weightRange.change)}
              unit={weightRange.change === null ? undefined : "kg"}
              caption={
                weightRange.change === null
                  ? "Needs two weigh-ins"
                  : `Over ${preset.days ? `these ${preset.days} days` : "all time"}`
              }
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <WeightChart
            points={weightRange.points}
            start={weightStart}
            end={stats.end}
            goalKg={goalWeight}
            trendColor={statusColor(goal, "progress")}
            summary={`Weight, ${spanLabel}: ${
              weightRange.points.length === 0
                ? "no weigh-ins"
                : `${plural(weightRange.points.length, "weigh-in")}${
                    weightRange.change === null ? "" : `, trend ${signedKg(weightRange.change)} kg`
                  }`
            }${goalWeight !== null ? `, goal ${kg(goalWeight)} kg` : ""}.`}
          />
          <WeightEntries weights={weights} readOnly={readOnly} />
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="grid grid-cols-2 gap-2.5 self-start lg:sticky lg:top-6">
          <Tile
            label="Avg water"
            value={summary.avgWater === null ? "—" : formatWater(summary.avgWater)}
            caption={
              waterGoalMl !== null
                ? `Goal ${formatWater(waterGoalMl)}`
                : plural(summary.waterCompleteDays, "tracked day")
            }
            tone={
              summary.avgWater === null || waterGoalMl === null
                ? "muted"
                : summary.avgWater >= waterGoalMl
                  ? "good"
                  : "warn"
            }
          />
          <Tile
            label="Days at goal"
            value={summary.waterGoalDays === null ? "—" : String(summary.waterGoalDays)}
            unit={summary.waterGoalDays === null ? undefined : `of ${summary.waterCompleteDays}`}
            caption={waterGoalMl === null ? "No water goal" : "Today not counted"}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <DailyBars
            title={mode === "day" ? "Water per day" : "Water per day, weekly average"}
            unit="ml"
            data={water}
            mode={mode}
            emptyLabel="No water tracked in this range"
            summary={`Water per ${mode}, ${spanLabel}: ${summary.avgWater === null ? "no average yet" : `average ${formatWater(summary.avgWater)}`}.`}
          />
          <section className="flex flex-col gap-2.5 rounded-[22px] bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15.5px] font-extrabold">By drink</h2>
              <span className="text-[12.5px] text-muted tabular-nums">
                {formatWater(waterTotal)} this range
              </span>
            </div>
            {waterTotal === 0 ? (
              <p className="text-sm text-muted">Log a drink to see the breakdown.</p>
            ) : (
              <ul className="flex flex-col">
                {DRINK_TYPES.map((type) => {
                  const drinks = stats.waterByDrink
                    .filter((d) => d.type === type)
                    .sort((a, b) => b.ml - a.ml);
                  const total = drinks.reduce((sum, d) => sum + d.ml, 0);
                  if (!total) return null;
                  return (
                    <li key={type} className="border-t border-line py-2.5 first:border-t-0">
                      <details>
                        <summary className="flex cursor-pointer items-baseline justify-between gap-2 text-sm [&::-webkit-details-marker]:hidden">
                          <b className="font-bold">{DRINK_LABELS[type]}</b>
                          <span className="text-[12.5px] text-muted tabular-nums">
                            {formatWater(total)} · {Math.round((total / waterTotal) * 100)}%
                          </span>
                        </summary>
                        <ul className="mt-2 space-y-1 text-[12.5px] text-muted">
                          {drinks.map((d) => (
                            <li key={d.name} className="flex justify-between gap-3">
                              <span>{d.name}</span>
                              <span className="shrink-0 tabular-nums">{formatWater(d.ml)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-strong">
                        <div
                          className="h-full bg-tint-lose"
                          style={{ width: `${(total / waterTotal) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-muted">
              All drinks count at full volume. Range totals include today; older untracked entries
              are left out.
            </p>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="lg:col-span-2">{controls}</div>
      {body}
    </>
  );
}
