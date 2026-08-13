import { connection } from "next/server";
import type { LoggedMeal } from "@/lib/log";
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
}

function toMeal(row: MealRow): LoggedMeal {
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
  };
}

export async function listMeals(): Promise<LoggedMeal[]> {
  // The log must never be prerendered at build time — always fetch per request
  await connection();
  const { data, error } = await supabase()
    .from("meals")
    .select("*")
    .order("logged_at", { ascending: false });
  if (error) throw new Error(`Couldn't load the meal log: ${error.message}`);
  return (data as MealRow[]).map(toMeal);
}

export async function getMealById(id: string): Promise<LoggedMeal | null> {
  const { data, error } = await supabase().from("meals").select("*").eq("id", id).maybeSingle();
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

export async function deleteMealById(id: string): Promise<void> {
  const { error } = await supabase().from("meals").delete().eq("id", id);
  if (error) throw new Error(`Couldn't delete: ${error.message}`);
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
