import { addDays, dayKey, dayLabel, shortDate, weekStart } from "@/lib/day";
import { goalStatus } from "@/lib/goal-status";
import type { MealTotalRow } from "@/lib/meals";
import type { StoredPlan } from "@/lib/plan-history";
import { targetsForDay } from "@/lib/plan-targets";
import { sumTotals } from "@/lib/scale";
import type { MealTotals } from "@/lib/schema";

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

interface DayStat {
  day: string;
  meals: number;
  nutritionMeals: number;
  totals: MealTotals;
}

/** One bar: a calendar day, or a Monday-to-Sunday week averaged per logged day. */
interface Bucket {
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

interface Summary {
  calendarDays: number;
  /** Days with at least one meal, today included */
  loggedDays: number;
  /** Logged days excluding today — what the averages are taken over */
  completeDays: number;
  avgCalories: number | null;
  avgProtein: number | null;
  avgCarbs: number | null;
  avgFat: number | null;
  avgWater: number | null;
  waterGoalDays: number | null;
  waterCompleteDays: number;
  /** Complete days whose calories were on track for that day's goal (see goal-status.ts) */
  onTrackDays: number;
  /** Complete days whose protein reached that day's target */
  proteinDays: number;
}

export interface RangeStats {
  start: string;
  end: string;
  mode: "day" | "week";
  buckets: Bucket[];
  summary: Summary;
  waterByDrink: NonNullable<MealTotals["water_by_drink"]>;
}

export function groupByDay(rows: MealTotalRow[]): Map<string, DayStat> {
  const days = new Map<string, DayStat>();
  for (const row of rows) {
    const key = dayKey(row.loggedAt);
    const prev = days.get(key);
    days.set(
      key,
      prev
        ? {
            day: key,
            meals: prev.meals + 1,
            nutritionMeals: prev.nutritionMeals + (row.nutritionLogged === false ? 0 : 1),
            totals: sumTotals([prev.totals, row.totals]),
          }
        : {
            day: key,
            meals: 1,
            nutritionMeals: row.nutritionLogged === false ? 0 : 1,
            totals: row.totals,
          },
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
    const nutrition = complete.filter((d) => d.nutritionMeals > 0);
    const n = nutrition.length;
    const sum = sumTotals(nutrition.map((d) => d.totals));
    const waterDays = complete.filter((d) => d.totals.water_ml !== undefined);
    const waterSum = sumTotals(waterDays.map((d) => d.totals));
    return {
      key: week,
      label: `Week of ${shortDate(week)} · ${plural(n, "logged day")}`,
      short: `Wk ${shortDate(week)}`,
      value:
        n || waterDays.length
          ? {
              nutrition_logged: n > 0,
              ...(waterDays.length
                ? {
                    water_ml: (waterSum.water_ml ?? 0) / waterDays.length,
                    water_by_drink: waterSum.water_by_drink?.map((drink) => ({
                      ...drink,
                      ml: drink.ml / waterDays.length,
                    })),
                  }
                : {}),
              calories: n ? sum.calories / n : 0,
              protein_g: n ? sum.protein_g / n : 0,
              carbs_g: n ? sum.carbs_g / n : 0,
              fat_g: n ? sum.fat_g / n : 0,
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

/** Energy per gram (Atwater factors): 4 kcal for protein and carbs, 9 for fat. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

type Macro = keyof typeof KCAL_PER_GRAM;

/**
 * Each macro's share of the calories they add up to, as fractions summing to 1.
 * Shares come from the grams rather than the logged calories, which rarely
 * match them exactly (fibre, alcohol, rounding). null when there are no grams.
 */
export function macroSplit(grams: Record<Macro, number>): Record<Macro, number> | null {
  const kcal = {
    protein: grams.protein * KCAL_PER_GRAM.protein,
    carbs: grams.carbs * KCAL_PER_GRAM.carbs,
    fat: grams.fat * KCAL_PER_GRAM.fat,
  };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  if (total <= 0) return null;
  return { protein: kcal.protein / total, carbs: kcal.carbs / total, fat: kcal.fat / total };
}

export function computeRange(
  days: Map<string, DayStat>,
  range: RangeId,
  plans: StoredPlan[],
  waterGoalMl: number | null,
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
  const complete = logged.filter((d) => d.day !== today && d.nutritionMeals > 0);
  const waterComplete = logged.filter((d) => d.day !== today && d.totals.water_ml !== undefined);
  // Complete days are finished, so each is judged as a whole day against its own plan
  const statusOf = (d: DayStat, metric: "calories" | "protein") => {
    const targets = targetsForDay(plans, d.day, waterGoalMl);
    if (!targets) return null;
    return metric === "calories"
      ? goalStatus(targets.goal, metric, d.totals.calories, targets.calorieTarget, false)
      : goalStatus(targets.goal, metric, d.totals.protein_g, targets.proteinTarget, false);
  };

  return {
    start,
    end: today,
    mode,
    buckets,
    waterByDrink: sumTotals(logged.map((d) => d.totals)).water_by_drink ?? [],
    summary: {
      calendarDays: keys.length,
      loggedDays: logged.length,
      completeDays: complete.length,
      avgCalories: mean(complete.map((d) => d.totals.calories)),
      avgProtein: mean(complete.map((d) => d.totals.protein_g)),
      avgCarbs: mean(complete.map((d) => d.totals.carbs_g)),
      avgFat: mean(complete.map((d) => d.totals.fat_g)),
      avgWater: mean(waterComplete.map((d) => d.totals.water_ml!)),
      waterCompleteDays: waterComplete.length,
      waterGoalDays:
        waterGoalMl != null
          ? waterComplete.filter((d) => d.totals.water_ml! >= waterGoalMl).length
          : null,
      onTrackDays: complete.filter((d) => statusOf(d, "calories") === "met").length,
      proteinDays: complete.filter((d) => statusOf(d, "protein") === "met").length,
    },
  };
}
