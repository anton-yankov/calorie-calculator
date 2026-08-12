"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { AUTH_COOKIE, authTokenFor } from "@/lib/auth";
import type { LoggedMeal } from "@/lib/log";
import { deleteMealById, insertMeals } from "@/lib/meals";

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
    typeof meal.analysis === "object" &&
    meal.analysis !== null &&
    Array.isArray(meal.analysis.foods) &&
    typeof meal.analysis.totals === "object"
  );
}

function message(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function logMealAction(meal: LoggedMeal): Promise<ActionResult> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  if (!isValidMeal(meal)) return { error: "Invalid meal data" };
  try {
    await insertMeals([meal]);
  } catch (err) {
    return { error: message(err, "Couldn't save the meal") };
  }
  revalidatePath("/log");
  return {};
}

/** Bulk insert for the one-time localStorage import; the client sends batches. */
export async function importMealsAction(meals: LoggedMeal[]): Promise<ActionResult> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  if (!Array.isArray(meals) || meals.length === 0 || !meals.every(isValidMeal)) {
    return { error: "Invalid meal data" };
  }
  try {
    await insertMeals(meals);
  } catch (err) {
    return { error: message(err, "Couldn't import the meals") };
  }
  revalidatePath("/log");
  return {};
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
