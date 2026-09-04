"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { AUTH_COOKIE, authTokenFor } from "@/lib/auth";
import { deleteSavedBarcodeProduct, saveBarcodeProduct } from "@/lib/barcode-products";
import type { LoggedMeal } from "@/lib/log";
import {
  deleteMealById,
  getMealById,
  getMealPhotoById,
  insertMeals,
  latestLoggedAtBetween,
  sumTotalsBetween,
  updateMealById,
} from "@/lib/meals";
import {
  BARCODE_PATTERN,
  isJpegDataUrl,
  MAX_FOOD_IMAGE_LENGTH,
  MAX_MEAL_PHOTO_LENGTH,
  submittedNutrition,
  submittedProductImage,
  submittedServingGrams,
  type ProductNutrition,
} from "@/lib/products";
import type { FoodItem, MealAnalysis, MealTotals } from "@/lib/schema";
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

/** The optional client-side fields on a food: a barcode and a small JPEG copy of its image. */
function isValidFood(food: FoodItem): boolean {
  if (typeof food !== "object" || food === null) return false;
  if (food.barcode !== undefined && !BARCODE_PATTERN.test(String(food.barcode))) return false;
  if (food.imageUrl !== undefined && !isJpegDataUrl(food.imageUrl, MAX_FOOD_IMAGE_LENGTH)) {
    return false;
  }
  return true;
}

function isValidAnalysis(analysis: MealAnalysis): boolean {
  return (
    typeof analysis === "object" &&
    analysis !== null &&
    Array.isArray(analysis.foods) &&
    analysis.foods.every(isValidFood) &&
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
    (meal.photo === undefined ||
      meal.photo === null ||
      isJpegDataUrl(meal.photo, MAX_MEAL_PHOTO_LENGTH)) &&
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
  revalidatePath("/stats");
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
  revalidatePath("/stats");
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
    revalidatePath("/stats");
    return { newId };
  } catch (err) {
    return { error: message(err, "Couldn't log the meal again") };
  }
}

/**
 * Returns the deleted meal in full (the list omits the large photo) so the
 * client's Undo can re-insert exactly what was removed.
 */
export async function deleteMealAction(id: string): Promise<ActionResult & { meal?: LoggedMeal }> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  if (typeof id !== "string" || id.length === 0) return { error: "Invalid id" };
  let meal: LoggedMeal | null;
  try {
    meal = await deleteMealById(id);
  } catch (err) {
    return { error: message(err, "Couldn't delete the meal") };
  }
  revalidatePath("/log");
  revalidatePath("/stats");
  return meal ? { meal } : {};
}

/** The large photo of one meal, fetched only when its thumbnail is tapped. */
export async function getMealPhotoAction(
  id: string,
): Promise<ActionResult & { photo?: string | null }> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  if (typeof id !== "string" || id.length === 0) return { error: "Invalid id" };
  try {
    return { photo: await getMealPhotoById(id) };
  } catch (err) {
    return { error: message(err, "Couldn't load the photo") };
  }
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
  revalidatePath("/stats");
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

export interface ProductFields {
  name: string;
  per100g: ProductNutrition;
  imageUrl: string | null;
  /** The amount prefilled when the product is scanned; null for no default. */
  servingGrams: number | null;
}

/**
 * Writes a saved product's name, nutrition and image. An upsert on the
 * barcode, so it both saves edits and restores a product after "Undo" on a
 * delete — the client still holds the full row.
 */
export async function saveProductAction(
  barcode: string,
  fields: ProductFields,
): Promise<ActionResult> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  if (typeof barcode !== "string" || !BARCODE_PATTERN.test(barcode)) {
    return { error: "Invalid barcode" };
  }
  const name = typeof fields?.name === "string" ? fields.name.trim() : "";
  const per100g = submittedNutrition(fields?.per100g);
  const imageUrl = submittedProductImage(fields?.imageUrl);
  const servingGrams = submittedServingGrams(fields?.servingGrams);
  if (!name || !per100g || imageUrl === undefined || servingGrams === undefined) {
    return { error: "Enter a product name and all four nutrition values per 100 g or ml" };
  }
  try {
    await saveBarcodeProduct(barcode, name, per100g, imageUrl, servingGrams);
  } catch (err) {
    return { error: message(err, "Couldn't save the product") };
  }
  revalidatePath("/products");
  return {};
}

export async function deleteProductAction(barcode: string): Promise<ActionResult> {
  if (!(await isAuthed())) return { error: "Authentication required" };
  if (typeof barcode !== "string" || !BARCODE_PATTERN.test(barcode)) {
    return { error: "Invalid barcode" };
  }
  try {
    await deleteSavedBarcodeProduct(barcode);
  } catch (err) {
    return { error: message(err, "Couldn't delete the product") };
  }
  revalidatePath("/products");
  return {};
}
