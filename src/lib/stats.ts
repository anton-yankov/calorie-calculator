import { addDays, dayKey, dayLabel, shortDate, weekStart } from "@/lib/day";
import type { MealTotalRow } from "@/lib/meals";
import { sumTotals } from "@/lib/scale";
import type { MealTotals } from "@/lib/schema";
import type { Goals } from "@/lib/settings";

/**
 * Pure math for the Stats page — no React, no Supabase. Meals come in as
 * (timestamp, totals) rows; everything here works on local-timezone day keys
 * from day.ts, so the day boundaries match the log exactly.
 */

export const RANGES = [
  { id: "7d", label: "7d", days: 7 },
  { id: "30d", label: "30d", days: 30 },
  { id: "90d", label: "90d", days: 90 },
  { id: "all", label: "All", days: null },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];

/** Ranges longer than this switch from one bar per day to one bar per week. */
const MAX_DAILY_BARS = 31;

export interface DayStat {
  day: string;
  meals: number;
  totals: MealTotals;
}

/** One bar: a calendar day, or a Monday-to-Sunday week averaged per logged day. */
export interface Bucket {
  /** Day key, or the week's Monday key */
  key: string;
  /** Tooltip heading, e.g. "Thu 28.08 · 3 meals" */
  label: string;
  /** Axis and table label, e.g. "Thu 28.08" or "Wk 25.08" */
  short: string;
  /** null when nothing was logged (never a zero bar) */
  value: MealTotals | null;
  meals: number;
  loggedDays: number;
  /** Still accumulating (today, or the week containing it) — shown outlined, left out of averages */
  partial: boolean;
}

export interface Summary {
  calendarDays: number;
  /** Days with at least one meal, today included */
  loggedDays: number;
  /** Logged days excluding today — what the averages are taken over */
  completeDays: number;
  avgCalories: number | null;
  avgProtein: number | null;
  /** Complete days whose calories reached the goal; null without a goal */
  calorieGoalDays: number | null;
  proteinGoalDays: number | null;
  /** Highest-calorie complete day, for when no goal is set */
  best: { day: string; calories: number } | null;
}

export interface RangeStats {
  start: string;
  end: string;
  mode: "day" | "week";
  buckets: Bucket[];
  summary: Summary;
}

export function groupByDay(rows: MealTotalRow[]): Map<string, DayStat> {
  const days = new Map<string, DayStat>();
  for (const row of rows) {
    const key = dayKey(row.loggedAt);
    const prev = days.get(key);
    days.set(
      key,
      prev
        ? { day: key, meals: prev.meals + 1, totals: sumTotals([prev.totals, row.totals]) }
        : { day: key, meals: 1, totals: row.totals },
    );
  }
  return days;
}

/** Inclusive day keys from start to end; YYYY-MM-DD compares correctly as a string. */
function dayKeysBetween(start: string, end: string): string[] {
  const keys: string[] = [];
  for (let key = start; key <= end; key = addDays(key, 1)) keys.push(key);
  return keys;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function dayBucket(key: string, days: Map<string, DayStat>, today: string): Bucket {
  const stat = days.get(key);
  const short = dayLabel(key);
  return {
    key,
    label: stat ? `${short} · ${plural(stat.meals, "meal")}` : `${short} · no meals`,
    short,
    value: stat?.totals ?? null,
    meals: stat?.meals ?? 0,
    loggedDays: stat ? 1 : 0,
    partial: key === today,
  };
}

function weekBuckets(keys: string[], days: Map<string, DayStat>, today: string): Bucket[] {
  const weeks = new Map<string, string[]>();
  for (const key of keys) {
    const week = dayKey(weekStart(new Date(`${key}T12:00:00`)));
    weeks.set(week, [...(weeks.get(week) ?? []), key]);
  }
  return [...weeks.entries()].map(([week, weekKeys]) => {
    // Today is excluded from the week's average — it's still being eaten
    const complete = weekKeys.filter((k) => k !== today).flatMap((k) => days.get(k) ?? []);
    const n = complete.length;
    const sum = sumTotals(complete.map((d) => d.totals));
    return {
      key: week,
      label: `Week of ${shortDate(week)} · ${plural(n, "logged day")}`,
      short: `Wk ${shortDate(week)}`,
      value: n
        ? {
            calories: sum.calories / n,
            protein_g: sum.protein_g / n,
            carbs_g: sum.carbs_g / n,
            fat_g: sum.fat_g / n,
          }
        : null,
      meals: weekKeys.reduce((total, k) => total + (days.get(k)?.meals ?? 0), 0),
      loggedDays: n,
      partial: weekKeys.includes(today),
    };
  });
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function computeRange(
  days: Map<string, DayStat>,
  range: RangeId,
  goals: Goals | null,
  today: string = dayKey(new Date()),
): RangeStats {
  const preset = RANGES.find((r) => r.id === range) ?? RANGES[1];
  const firstLogged = [...days.keys()].sort()[0];
  const start =
    preset.days !== null
      ? addDays(today, -(preset.days - 1))
      : firstLogged && firstLogged < today
        ? firstLogged
        : today;
  const keys = dayKeysBetween(start, today);
  const mode = keys.length > MAX_DAILY_BARS ? "week" : "day";
  const buckets =
    mode === "day" ? keys.map((k) => dayBucket(k, days, today)) : weekBuckets(keys, days, today);

  const logged = keys.flatMap((k) => days.get(k) ?? []);
  const complete = logged.filter((d) => d.day !== today);
  const calories = complete.map((d) => d.totals.calories);
  const best = complete.reduce<Summary["best"]>(
    (acc, d) =>
      acc && acc.calories >= d.totals.calories ? acc : { day: d.day, calories: d.totals.calories },
    null,
  );

  return {
    start,
    end: today,
    mode,
    buckets,
    summary: {
      calendarDays: keys.length,
      loggedDays: logged.length,
      completeDays: complete.length,
      avgCalories: mean(calories),
      avgProtein: mean(complete.map((d) => d.totals.protein_g)),
      // Goals are floors here, matching GoalBars: reaching the number is the win
      calorieGoalDays: goals
        ? complete.filter((d) => d.totals.calories >= goals.calorieGoal).length
        : null,
      proteinGoalDays:
        goals?.proteinGoal != null
          ? complete.filter((d) => d.totals.protein_g >= goals.proteinGoal!).length
          : null,
      best,
    },
  };
}
