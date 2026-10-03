import { addDays } from "@/lib/day";
import { goalStatus } from "@/lib/goal-status";
import type { StoredPlan } from "@/lib/plan-history";
import { targetsForDay } from "@/lib/plan-targets";
import type { MealTotals } from "@/lib/schema";

/**
 * The Stats insight card: a few fixed checks on the same numbers the charts
 * use, each with a sentence template. No AI: every number in a sentence is
 * filled in from the data, so it can only say things that are true. The most
 * specific check that passes wins; when none does, there's no card.
 */

interface Insight {
  title: string;
  body: string;
}

interface Day {
  day: string;
  nutritionMeals: number;
  totals: MealTotals;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekday = (key: string) => new Date(`${key}T12:00:00`).getDay();
const n = (value: number) => Math.round(value).toLocaleString("en-US");

/** Days over the limit before a pattern is worth pointing out. */
const MIN_OVER_DAYS = 4;
/** Share of those days that must fall on the same two weekdays. */
const PATTERN_SHARE = 0.6;
/** Protein target hit this many finished days in a row. */
const STREAK_DAYS = 5;
/** Average protein this many grams under target... */
const PROTEIN_GAP_G = 15;
/** ...over at least this many logged days. */
const PROTEIN_GAP_MIN_DAYS = 7;
/** Days on track up by this many against the period before. */
const BETTER_BY = 3;
/** Days not logged in the last week before the numbers deserve a caveat. */
const GAP_DAYS = 3;

/**
 * `days` holds every logged day (the whole history, so streaks and the period
 * before can be measured); `start`..`today` is the range on screen. Today is
 * still open, so it never counts as a finished day.
 */
export function pickInsight({
  days,
  plans,
  start,
  today,
  onTrackNow,
  onTrackBefore,
  rangeDays,
}: {
  days: Map<string, Day>;
  plans: StoredPlan[];
  start: string;
  today: string;
  onTrackNow: number;
  onTrackBefore: number | null;
  /** The range's length in days, for "the 30 days before"; null for All */
  rangeDays: number | null;
}): Insight | null {
  const finished: Day[] = [];
  for (let key = start; key < today; key = addDays(key, 1)) {
    const d = days.get(key);
    if (d && d.nutritionMeals > 0) finished.push(d);
  }
  const calorieStatus = (d: Day) => {
    const t = targetsForDay(plans, d.day, null);
    return t ? goalStatus(t.goal, "calories", d.totals.calories, t.calorieTarget, false) : null;
  };
  const proteinMet = (d: Day) => {
    const t = targetsForDay(plans, d.day, null);
    return t ? d.totals.protein_g >= t.proteinTarget : false;
  };

  // 1. Weekday pattern: most days over the limit fall on the same two weekdays
  const over = finished.filter((d) => calorieStatus(d) === "over");
  if (over.length >= MIN_OVER_DAYS) {
    const counts = new Map<number, number>();
    for (const d of over) counts.set(weekday(d.day), (counts.get(weekday(d.day)) ?? 0) + 1);
    const [first, second] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const onTwo = (first?.[1] ?? 0) + (second?.[1] ?? 0);
    if (first && second && onTwo / over.length >= PATTERN_SHARE) {
      const names = [first[0], second[0]].sort((a, b) => a - b).map((i) => WEEKDAYS[i]);
      const weekend = [first[0], second[0]].every((i) => i === 0 || i === 5 || i === 6);
      return {
        title: weekend
          ? "Weekends are where it slips"
          : `${names[0]}s and ${names[1]}s are where it slips`,
        body: `${onTwo} of your ${over.length} days over the limit were a ${names[0]} or ${names[1]}.`,
      };
    }
  }

  // 2. Protein streak: the target hit every finished day lately
  let streak = 0;
  for (let key = addDays(today, -1); ; key = addDays(key, -1)) {
    const d = days.get(key);
    if (!d || d.nutritionMeals === 0 || !proteinMet(d)) break;
    streak++;
  }
  if (streak >= STREAK_DAYS) {
    return {
      title: "Protein on a roll",
      body: `${streak} days in a row at your protein target.`,
    };
  }

  // 3. Protein gap: usually well under the target
  const todayTargets = targetsForDay(plans, today, null);
  if (todayTargets && finished.length >= PROTEIN_GAP_MIN_DAYS) {
    const average = finished.reduce((sum, d) => sum + d.totals.protein_g, 0) / finished.length;
    const gap = todayTargets.proteinTarget - average;
    if (gap >= PROTEIN_GAP_G) {
      return {
        title: "Protein is the one to watch",
        body: `You're usually about ${n(gap)} g short on protein. One extra yogurt or shake would close most of it.`,
      };
    }
  }

  // 4. Getting better than the period before
  if (onTrackBefore !== null && rangeDays !== null && onTrackNow - onTrackBefore >= BETTER_BY) {
    return {
      title: "Getting better",
      body: `${onTrackNow} days on track, up from ${onTrackBefore} the ${rangeDays} days before.`,
    };
  }

  // 5. Logging gaps: the numbers may be flattered by missing days
  let missing = 0;
  for (let i = 1; i <= 7; i++) {
    const d = days.get(addDays(today, -i));
    if (!d || d.nutritionMeals === 0) missing++;
  }
  if (missing >= GAP_DAYS && missing < 7) {
    return {
      title: "A few days are missing",
      body: `${missing} of the last 7 days weren't logged, so these numbers may look better than they are.`,
    };
  }
  return null;
}
