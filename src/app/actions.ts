"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { AUTH_COOKIE, authTokenFor } from "@/lib/auth";
import type { LoggedMeal } from "@/lib/log";
import {
  deleteMealById,
  getMealById,
  insertMeals,
  latestLoggedAtBetween,
  sumTotalsBetween,
  updateMealById,
} from "@/lib/meals";
import type { MealAnalysis, MealTotals } from "@/lib/schema";
import { getGoals, saveGoals, type Goals } from "@/lib/settings";

/**
 * Server Actions are reachable via direct POST, not just through the UI, so
 * each one re-checks the site password cookie — same rule as the proxy.
 */
async function isAuthed(): Promise<boolean> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return true;
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value === (await authTokenFor(password));
}

export interface ActionResult {
  error?: string;
}

function isValidAnalysis(analysis: MealAnalysis): boolean {
  return (
    typeof analysis === "object" &&
    analysis !== null &&
    Array.isArray(analysis.foods) &&
    typeof analysis.totals === "object" &&
    analysis.totals !== null
  );
}

function isValidMeal(meal: LoggedMeal): boolean {
  return (
    typeof meal === "object" &&
    meal !== null &&
    typeof meal.id === "string" &&
    meal.id.length > 0 &&
    typeof meal.loggedAt === "string" &&
    !Number.isNaN(Date.parse(meal.loggedAt)) &&
    typeof meal.description === "string" &&
    (meal.thumbnail === null || typeof meal.thumbnail === "string") &&
    isValidAnalysis(meal.analysis)
  );
}

function message(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * When `backdate` is given (a past day's local-midnight bounds, computed
 * client-side because day boundaries depend on the viewer's timezone), the
 * meal's timestamp is assigned here instead of taken from the client: noon of
 * that day if it's empty, otherwise just after the day's latest meal — so
 * backdated meals read in the order they were logged and can never land close
 * enough to midnight to flip days for a viewer in another timezone.
 */
export async function logMealAction(
  meal: LoggedMeal,
  backdate?: { startIso: string; endIso: string },
): Promise<ActionResult> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  if (!isValidMeal(meal)) return { error: "Invalid meal data" };
  if (backdate) {
    const start = Date.parse(backdate.startIso);
    const end = Date.parse(backdate.endIso);
    const twoDays = 48 * 60 * 60 * 1000;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      end <= start ||
      end - start > twoDays ||
      start > Date.now()
    ) {
      return { error: "Invalid backdate" };
    }
    try {
      const latestIso = await latestLoggedAtBetween(backdate.startIso, backdate.endIso);
      const last = latestIso === null ? null : Date.parse(latestIso);
      // A minute after the day's latest meal, halving toward midnight when
      // there's less than that left so the timestamp never leaves the day
      const stamp =
        last === null
          ? start + (end - start) / 2
          : Math.min(last + 60_000, last + (end - last) / 2);
      meal = { ...meal, loggedAt: new Date(stamp).toISOString() };
    } catch (err) {
      return { error: message(err, "Couldn't save the meal") };
    }
  }
  try {
    await insertMeals([meal]);
  } catch (err) {
    return { error: message(err, "Couldn't save the meal") };
  }
  revalidatePath("/log");
  return {};
}

export async function updateMealAction(
  id: string,
  patch: { analysis: MealAnalysis; loggedAt: string },
): Promise<ActionResult> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  if (typeof id !== "string" || id.length === 0) return { error: "Invalid id" };
  if (
    typeof patch !== "object" ||
    patch === null ||
    !isValidAnalysis(patch.analysis) ||
    typeof patch.loggedAt !== "string" ||
    Number.isNaN(Date.parse(patch.loggedAt))
  ) {
    return { error: "Invalid meal data" };
  }
  try {
    await updateMealById(id, patch);
  } catch (err) {
    return { error: message(err, "Couldn't update the meal") };
  }
  revalidatePath("/log");
  return {};
}

/** Duplicate a logged meal as a fresh entry stamped now — repeat meals cost no API call. */
export async function relogMealAction(id: string): Promise<ActionResult & { newId?: string }> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  if (typeof id !== "string" || id.length === 0) return { error: "Invalid id" };
  try {
    const meal = await getMealById(id);
    if (!meal) return { error: "That meal no longer exists" };
    const newId = crypto.randomUUID();
    await insertMeals([{ ...meal, id: newId, loggedAt: new Date().toISOString() }]);
    revalidatePath("/log");
    return { newId };
  } catch (err) {
    return { error: message(err, "Couldn't log the meal again") };
  }
}

export async function deleteMealAction(id: string): Promise<ActionResult> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  if (typeof id !== "string" || id.length === 0) return { error: "Invalid id" };
  try {
    await deleteMealById(id);
  } catch (err) {
    return { error: message(err, "Couldn't delete the meal") };
  }
  revalidatePath("/log");
  return {};
}

export async function saveGoalsAction(goals: Goals): Promise<ActionResult> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  const calorieOk =
    typeof goals === "object" &&
    goals !== null &&
    Number.isFinite(goals.calorieGoal) &&
    goals.calorieGoal > 0;
  const proteinOk =
    goals?.proteinGoal === null || (Number.isFinite(goals?.proteinGoal) && goals.proteinGoal! > 0);
  if (!calorieOk || !proteinOk) return { error: "Invalid goals" };
  try {
    await saveGoals({
      calorieGoal: Math.round(goals.calorieGoal),
      proteinGoal: goals.proteinGoal === null ? null : Math.round(goals.proteinGoal),
    });
  } catch (err) {
    return { error: message(err, "Couldn't save the goals") };
  }
  revalidatePath("/log");
  revalidatePath("/");
  return {};
}

export interface TodayProgress {
  totals: MealTotals;
  goals: Goals | null;
}

/**
 * Totals for [startIso, endIso) plus the current goals, for the Analyze page's
 * "today so far" strip. The client supplies the bounds because "today" depends
 * on the viewer's timezone, which the server doesn't know (Vercel runs in UTC).
 */
export async function todayProgressAction(
  startIso: string,
  endIso: string,
): Promise<ActionResult & { progress?: TodayProgress }> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  const twoDays = 48 * 60 * 60 * 1000;
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start || end - start > twoDays) {
    return { error: "Invalid range" };
  }
  try {
    const [totals, goals] = await Promise.all([sumTotalsBetween(startIso, endIso), getGoals()]);
    return { progress: { totals, goals } };
  } catch (err) {
    return { error: message(err, "Couldn't load today's progress") };
  }
}
