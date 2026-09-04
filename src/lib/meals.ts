import { connection } from "next/server";
import type { LoggedMeal, LoggedMealSummary } from "@/lib/log";
import { sumTotals } from "@/lib/scale";
import type { MealAnalysis, MealTotals } from "@/lib/schema";
import { supabase } from "@/lib/supabase";

/** Server-side data layer for the meal log — the only code that touches the table. */

interface MealRow {
  id: string;
  logged_at: string;
  description: string;
  analysis: MealAnalysis;
  thumbnail: string | null;
  photo: string | null;
}

type MealSummaryRow = Omit<MealRow, "photo">;

function toMeal(row: MealRow): LoggedMeal {
  return {
    id: row.id,
    loggedAt: row.logged_at,
    description: row.description,
    analysis: row.analysis,
    thumbnail: row.thumbnail,
    photo: row.photo,
  };
}

function toMealSummary(row: MealSummaryRow): LoggedMealSummary {
  return {
    id: row.id,
    loggedAt: row.logged_at,
    description: row.description,
    analysis: row.analysis,
    thumbnail: row.thumbnail,
  };
}

function toRow(meal: LoggedMeal): MealRow {
  return {
    id: meal.id,
    logged_at: meal.loggedAt,
    description: meal.description,
    analysis: meal.analysis,
    thumbnail: meal.thumbnail,
    photo: meal.photo,
  };
}

export async function listMeals(): Promise<LoggedMealSummary[]> {
  // The log must never be prerendered at build time — always fetch per request
  await connection();
  const { data, error } = await supabase()
    .from("meals")
    .select("id, logged_at, description, analysis, thumbnail")
    .order("logged_at", { ascending: false });
  if (error) throw new Error(`Couldn't load the meal log: ${error.message}`);
  return (data as MealSummaryRow[]).map(toMealSummary);
}

export async function getMealById(id: string): Promise<LoggedMeal | null> {
  const { data, error } = await supabase()
    .from("meals")
    .select("id, logged_at, description, analysis, thumbnail, photo")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the meal: ${error.message}`);
  return data ? toMeal(data as MealRow) : null;
}

export async function insertMeals(meals: LoggedMeal[]): Promise<void> {
  const { error } = await supabase().from("meals").insert(meals.map(toRow));
  if (error) throw new Error(`Couldn't save: ${error.message}`);
}

export async function updateMealById(
  id: string,
  patch: { analysis: MealAnalysis; loggedAt: string },
): Promise<void> {
  const { error } = await supabase()
    .from("meals")
    .update({ analysis: patch.analysis, logged_at: patch.loggedAt })
    .eq("id", id);
  if (error) throw new Error(`Couldn't update: ${error.message}`);
}

export async function deleteMealById(id: string): Promise<LoggedMeal | null> {
  const { data, error } = await supabase()
    .from("meals")
    .delete()
    .eq("id", id)
    .select("id, logged_at, description, analysis, thumbnail, photo")
    .maybeSingle();
  if (error) throw new Error(`Couldn't delete: ${error.message}`);
  return data ? toMeal(data as MealRow) : null;
}

export async function getMealPhotoById(id: string): Promise<string | null> {
  const { data, error } = await supabase()
    .from("meals")
    .select("photo, thumbnail")
    .eq("id", id)
    .maybeSingle();
  if (error?.message.includes("photo")) {
    // During the database-first rollout, old deployments can still preview the
    // existing thumbnail until the nullable photo column has been added.
    const legacy = await supabase().from("meals").select("thumbnail").eq("id", id).maybeSingle();
    if (legacy.error) throw new Error(`Couldn't load the photo: ${legacy.error.message}`);
    return legacy.data ? (legacy.data.thumbnail as string | null) : null;
  }
  if (error) throw new Error(`Couldn't load the photo: ${error.message}`);
  return data ? ((data.photo as string | null) ?? (data.thumbnail as string | null)) : null;
}

/** Latest logged_at in [startIso, endIso), or null if none — used to order backdated meals. */
export async function latestLoggedAtBetween(
  startIso: string,
  endIso: string,
): Promise<string | null> {
  const { data, error } = await supabase()
    .from("meals")
    .select("logged_at")
    .gte("logged_at", startIso)
    .lt("logged_at", endIso)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Couldn't check the day's meals: ${error.message}`);
  return data ? (data as { logged_at: string }).logged_at : null;
}

/** Calorie/macro sums for meals logged in [startIso, endIso) — used for "today so far". */
export async function sumTotalsBetween(startIso: string, endIso: string): Promise<MealTotals> {
  const { data, error } = await supabase()
    .from("meals")
    .select("analysis")
    .gte("logged_at", startIso)
    .lt("logged_at", endIso);
  if (error) throw new Error(`Couldn't load today's totals: ${error.message}`);
  return sumTotals((data as { analysis: MealAnalysis }[]).map((row) => row.analysis.totals));
}
