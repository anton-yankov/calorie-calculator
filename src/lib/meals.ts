import { connection } from "next/server";
import type { LoggedMeal } from "@/lib/log";
import type { MealAnalysis } from "@/lib/schema";
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

export async function insertMeals(meals: LoggedMeal[]): Promise<void> {
  const { error } = await supabase().from("meals").insert(meals.map(toRow));
  if (error) throw new Error(`Couldn't save: ${error.message}`);
}

export async function deleteMealById(id: string): Promise<void> {
  const { error } = await supabase().from("meals").delete().eq("id", id);
  if (error) throw new Error(`Couldn't delete: ${error.message}`);
}
